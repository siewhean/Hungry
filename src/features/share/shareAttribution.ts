// Shared links carry `?src=<channel>` so an install or signup can be credited
// to the share that brought the person in. The tag is read when the link
// opens and attached to sign_up_completed later. It is kept in storage for
// ATTRIBUTION_TTL_MS so a signup after the app is relaunched still counts.

import { hungryPersistStorage } from "@/store/persistStorage";

export type ShareSource = "whatsapp" | "telegram" | "system_share" | "copy_link";

const SHARE_SOURCES = new Set<string>(["whatsapp", "telegram", "system_share", "copy_link"]);

export interface ShareAttribution {
  source: ShareSource;
  route: string;
}

const ATTRIBUTION_STORAGE_KEY = "hungry-share-attribution-v1";
export const ATTRIBUTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let pendingAttribution: ShareAttribution | null = null;
let pendingAttributionSavedAt = 0;

export function withShareSource(url: string, source: ShareSource): string {
  const [base, hash] = url.split("#");
  const tagged = `${base}${base.includes("?") ? "&" : "?"}src=${source}`;
  return hash === undefined ? tagged : `${tagged}#${hash}`;
}

export function parseShareSource(rawPath: string): ShareSource | undefined {
  const queryIndex = rawPath.indexOf("?");
  if (queryIndex < 0) return undefined;
  const value = new URLSearchParams(rawPath.slice(queryIndex + 1).split("#")[0]).get("src");
  return value && SHARE_SOURCES.has(value) ? (value as ShareSource) : undefined;
}

export function rememberShareAttribution(attribution: ShareAttribution) {
  pendingAttribution = attribution;
  pendingAttributionSavedAt = Date.now();
  void Promise.resolve(
    hungryPersistStorage?.setItem(ATTRIBUTION_STORAGE_KEY, {
      state: { ...attribution, savedAt: pendingAttributionSavedAt },
      version: 0,
    }),
  ).catch(() => undefined);
}

export function getShareAttribution(): ShareAttribution | null {
  if (pendingAttribution && Date.now() - pendingAttributionSavedAt > ATTRIBUTION_TTL_MS) {
    pendingAttribution = null;
  }
  return pendingAttribution;
}

/** Restores a share tag saved in an earlier app session. Call once at startup. */
export async function hydrateShareAttribution(): Promise<void> {
  try {
    const stored = await hungryPersistStorage?.getItem(ATTRIBUTION_STORAGE_KEY);
    const state = stored?.state as Partial<ShareAttribution & { savedAt: number }> | undefined;
    const savedAt = typeof state?.savedAt === "number" ? state.savedAt : 0;
    const isValid =
      typeof state?.source === "string" &&
      SHARE_SOURCES.has(state.source) &&
      typeof state.route === "string" &&
      Date.now() - savedAt <= ATTRIBUTION_TTL_MS;
    if (!isValid) {
      if (stored) await hungryPersistStorage?.removeItem(ATTRIBUTION_STORAGE_KEY);
      return;
    }
    // A link opened in this session is newer than the stored one.
    if (pendingAttribution && pendingAttributionSavedAt >= savedAt) return;
    pendingAttribution = { source: state.source as ShareSource, route: state.route as string };
    pendingAttributionSavedAt = savedAt;
  } catch {
    // Attribution is best effort.
  }
}
