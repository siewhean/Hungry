import PostHog from "posthog-react-native";

import type { AnalyticsEventRecord, AnalyticsSink } from "./types";
import { sanitizeAnalyticsProperties } from "./privacy";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";
const POSTHOG_DISABLED = process.env.EXPO_PUBLIC_DISABLE_POSTHOG === "1";
const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim();
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST;

let posthogClient: PostHog | null = null;

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
  }

  return posthogClient;
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

  client.identify(userId, toPostHogProperties(sanitizeAnalyticsProperties(properties)));
}

export function resetPostHogUser(): void {
  const client = getPostHogClient();
  if (!client) {
    return;
  }

  client.reset();
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
