import { isAnalyticsEnabled, trackAnalyticsEvent } from "@/lib/analytics";
import { getAppEnvironment } from "@/lib/services/supabase/client";
import { catalogProjectHost, type CatalogReadFailure } from "@/lib/services/catalogReads";

type Surface = "home" | "dish" | "stall";
type Outcome = CatalogReadFailure | "success" | "empty" | "missing" | "stale";
type TimingOrigin = "tap" | "focus" | "mount" | "js-start" | "request";

export function catalogNow(): number {
  return Date.now();
}

let jsStartedAt: number | undefined;
let appOpenRecorded = false;
let build: Record<string, string | null> | undefined;
const pendingTaps: Partial<Record<"dish" | "stall", { id: string; at: number }>> = {};

export function markCatalogAppStart(): void {
  jsStartedAt ??= catalogNow();
}

export function markCatalogTap(surface: "dish" | "stall", id: string): void {
  pendingTaps[surface] = { id, at: catalogNow() };
}

export function consumeCatalogTap(surface: "dish" | "stall", id: string): number | undefined {
  const tap = pendingTaps[surface];
  if (tap?.id !== id) return undefined;
  delete pendingTaps[surface];
  return catalogNow() - tap.at <= 5000 ? tap.at : undefined;
}

function buildMetadata(): Record<string, string | null> {
  if (build) return build;
  try {
    const { default: Constants } = require("expo-constants") as typeof import("expo-constants");
    const Updates = require("expo-updates") as typeof import("expo-updates");
    build = {
      app_version: Constants.expoConfig?.version ?? null,
      native_build: Constants.nativeBuildVersion ?? null,
      update_id: Updates.updateId ?? null,
    };
  } catch {
    build = {};
  }
  return build;
}

function record(
  surface: Surface,
  milestone: string,
  startedAt: number,
  outcome: Outcome,
  origin: TimingOrigin,
): void {
  if (!isAnalyticsEnabled()) return;
  trackAnalyticsEvent("catalog_performance", {
    surface,
    milestone,
    outcome,
    timing_origin: origin,
    duration_ms: Math.max(0, catalogNow() - startedAt),
    environment: getAppEnvironment(),
    project_host: catalogProjectHost(),
    ...buildMetadata(),
  });
}

export function recordCatalogPaint(
  surface: Surface,
  milestone: "actionable" | "menu" | "image",
  startedAt: number,
  outcome: Outcome = "success",
  origin: TimingOrigin = "mount",
): void {
  record(surface, milestone, startedAt, outcome, origin);
  if (
    surface === "home" &&
    milestone === "actionable" &&
    !appOpenRecorded &&
    jsStartedAt !== undefined
  ) {
    if (outcome === "success" || outcome === "stale") appOpenRecorded = true;
    record(surface, "js_start_to_actionable", jsStartedAt, outcome, "js-start");
  }
}

export function recordCatalogRpc(
  surface: Surface,
  rpc: string,
  startedAt: number,
  outcome: Outcome,
): void {
  record(surface, rpc, startedAt, outcome, "request");
}
