// The caller's IP address from the request headers, for rate limits. On Vercel both headers are
// set by the platform, not the caller. Anything that does not look like an IP address is ignored,
// so a crafted header cannot pick another caller's rate-limit key.

const SAFE_IP_RE = /^[0-9a-fA-F:.]{2,45}$/;

function safeIp(raw: string | null | undefined): string {
  const first = raw?.split(",")[0]?.trim() ?? "";
  return SAFE_IP_RE.test(first) ? first : "";
}

export function clientIpFromHeaders(headers: Pick<Headers, "get">): string {
  return safeIp(headers.get("x-forwarded-for")) || safeIp(headers.get("x-real-ip")) || "unknown";
}
