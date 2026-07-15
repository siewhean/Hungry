const SAFE_IP_RE = /^[0-9a-fA-F:.]{2,45}$/;

function sanitizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim() ?? "";
  return SAFE_IP_RE.test(first) ? first : null;
}

export function resolveClientIp(
  forwardedFor: string | null | undefined,
  realIp: string | null | undefined,
): string {
  return sanitizeIp(forwardedFor) ?? sanitizeIp(realIp) ?? "unknown";
}
