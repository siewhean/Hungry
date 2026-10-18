// Shared links carry `?src=<channel>` so an install or signup can be credited
// to the share that brought the person in. The tag is read when the link
// opens and attached to sign_up_completed later in the same app session.

export type ShareSource = "whatsapp" | "telegram" | "system_share" | "copy_link";

const SHARE_SOURCES = new Set<string>(["whatsapp", "telegram", "system_share", "copy_link"]);

export interface ShareAttribution {
  source: ShareSource;
  route: string;
}

let pendingAttribution: ShareAttribution | null = null;

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
}

export function getShareAttribution(): ShareAttribution | null {
  return pendingAttribution;
}
