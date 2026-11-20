import PostHog from "posthog-react-native";

import { reportError } from "@/lib/monitoring/reportError";

import type { AnalyticsEventRecord, AnalyticsSink } from "./types";
import { sanitizeAnalyticsProperties } from "./privacy";
import { getAnalyticsEnvironment, isInternalBuild } from "./trafficTag";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";
const POSTHOG_DISABLED = process.env.EXPO_PUBLIC_DISABLE_POSTHOG === "1";
const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim();
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST;

let posthogClient: PostHog | null = null;
/** Set from the Developer tools: this phone belongs to the team, so its traffic is not diners'. */
let deviceMarkedInternal: boolean | undefined;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type PostHogProperties = { [key: string]: JsonValue };

function getPostHogClient(): PostHog | null {
  if (POSTHOG_DISABLED || !POSTHOG_API_KEY) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      // Application Installed / Updated / Opened / Backgrounded, for retention.
      captureAppLifecycleEvents: true,
    });
    registerTrafficProperties(posthogClient);
  }

  return posthogClient;
}

/**
 * `environment` goes on every event. `is_internal` is written only when it is true (or when a
 * device is unmarked), never as false by default: PostHog keeps super properties between
 * launches, so a false written here would wipe the mark a Developer tools toggle saved earlier.
 */
function trafficProperties(): PostHogProperties {
  const internal = isInternalBuild() || deviceMarkedInternal === true;
  return {
    environment: getAnalyticsEnvironment(),
    ...(internal ? { is_internal: true } : {}),
  };
}

function registerTrafficProperties(client: PostHog): void {
  void client
    .register(trafficProperties())
    .catch((error: unknown) => reportError(error, { area: "posthog_traffic_properties" }));
}

/** Marks (or unmarks) this phone as the team's; every later event carries the answer. */
export function setPostHogInternalDevice(internal: boolean): void {
  deviceMarkedInternal = internal;
  const client = getPostHogClient();
  if (!client) {
    return;
  }

  // An unmarked phone still on an internal build stays internal.
  void client
    .register({ is_internal: internal || isInternalBuild() })
    .catch((error: unknown) => reportError(error, { area: "posthog_traffic_properties" }));
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const mapped = value
      .map((entry) => toJsonValue(entry))
      .filter((entry): entry is JsonValue => entry !== undefined);
    return mapped;
  }

  if (typeof value === "object") {
    const mappedEntries = Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => {
        const mappedValue = toJsonValue(entry);
        return mappedValue === undefined ? null : ([key, mappedValue] as const);
      })
      .filter((entry): entry is readonly [string, JsonValue] => entry !== null);
    return Object.fromEntries(mappedEntries);
  }

  return undefined;
}

function toPostHogProperties(properties: Record<string, unknown>): PostHogProperties {
  const normalizedEntries = Object.entries(properties)
    .map(([key, value]) => {
      const normalized = toJsonValue(value);
      return normalized === undefined ? null : ([key, normalized] as const);
    })
    .filter((entry): entry is readonly [string, JsonValue] => entry !== null);

  return Object.fromEntries(normalizedEntries);
}

function mapEventProperties(event: AnalyticsEventRecord): PostHogProperties {
  return toPostHogProperties({
    ...sanitizeAnalyticsProperties(event.properties),
    session_id: event.session_id,
    source_timestamp: event.timestamp,
    ...(event.user_id ? { user_id: event.user_id } : {}),
  });
}

export const posthogSink: AnalyticsSink = (event) => {
  const client = getPostHogClient();
  if (!client) {
    return;
  }

  client.capture(event.event, mapEventProperties(event));
};

export function identifyPostHogUser(userId: string, properties: Record<string, unknown>): void {
  const client = getPostHogClient();
  if (!client || !userId) {
    return;
  }

  // Internal traffic also marks the person, so a PostHog person filter works after sign-in.
  const internal = isInternalBuild() || deviceMarkedInternal === true;
  client.identify(
    userId,
    toPostHogProperties(
      sanitizeAnalyticsProperties({ ...properties, ...(internal ? { is_internal: true } : {}) }),
    ),
  );
}

/** Stops PostHog capturing (or resumes it); PostHog remembers the choice across launches. */
export function setPostHogOptOut(optedOut: boolean): void {
  const client = getPostHogClient();
  if (!client) {
    return;
  }

  void (optedOut ? client.optOut() : client.optIn()).catch((error: unknown) =>
    reportError(error, { area: "posthog_opt_out" }),
  );
}

export function resetPostHogUser(): void {
  const client = getPostHogClient();
  if (!client) {
    return;
  }

  client.reset();
  // reset() drops super properties, and the next sign-in is on the same phone.
  registerTrafficProperties(client);
}

/** Adds properties to every later event (for example lifecycle_state). */
export function registerPostHogProperties(properties: Record<string, unknown>): void {
  const client = getPostHogClient();
  if (!client) {
    return;
  }

  void client.register(toPostHogProperties(sanitizeAnalyticsProperties(properties)));
}

/**
 * The flag's value for this user (PostHog keeps the assignment stable per
 * user). Records exposure: PostHog sends `$feature_flag_called` once per flag
 * load.
 */
export function getPostHogFeatureFlag(key: string): boolean | string | undefined {
  return getPostHogClient()?.getFeatureFlag(key);
}

/** The flag's value without recording exposure. */
export function peekPostHogFeatureFlag(key: string): boolean | string | undefined {
  const result = getPostHogClient()?.getFeatureFlagResult(key, { sendEvent: false });
  return result ? (result.variant ?? result.enabled) : undefined;
}

/** True once flags have loaded from the server or the on-device cache. */
export function havePostHogFeatureFlagsLoaded(): boolean {
  return getPostHogClient()?.getFeatureFlags() !== undefined;
}

/** Calls back whenever flags load or reload; returns an unsubscribe. */
export function onPostHogFeatureFlags(callback: () => void): () => void {
  const client = getPostHogClient();
  if (!client) {
    return () => undefined;
  }

  return client.onFeatureFlags(() => callback());
}
