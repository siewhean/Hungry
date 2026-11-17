const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function redactEmail(value?: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || !EMAIL_REGEX.test(normalized)) return "redacted";

  const [localPart, domainPart] = normalized.split("@");
  const [domainName, ...domainSuffix] = domainPart.split(".");
  const localPrefix = localPart.slice(0, Math.min(2, localPart.length));
  const domainPrefix = domainName.slice(0, Math.min(1, domainName.length));
  const suffix = domainSuffix.length > 0 ? `.${domainSuffix.join(".")}` : "";

  return `${localPrefix}${localPart.length > 2 ? "***" : "*"}@${domainPrefix}***${suffix}`;
}

export function redactIdentifier(value?: string, visibleStart = 2, visibleEnd = 2) {
  const normalized = value?.trim();
  if (!normalized) return "redacted";

  const start = normalized.slice(0, Math.min(visibleStart, normalized.length));
  const end = normalized.length > visibleStart ? normalized.slice(Math.max(normalized.length - visibleEnd, visibleStart)) : "";

  return end ? `${start}***${end}` : `${start}***`;
}

export function redactPhone(value?: string) {
  const normalized = value?.trim();
  if (!normalized) return "redacted";

  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 4) return redactIdentifier(normalized, 1, 1);

  return `phone ending ${digits.slice(-4)}`;
}

export function redactContact(value?: string) {
  const normalized = value?.trim();
  if (!normalized) return "redacted";
  if (EMAIL_REGEX.test(normalized)) return redactEmail(normalized);
  if (normalized.replace(/\D/g, "").length >= 4) return redactPhone(normalized);

  return redactIdentifier(normalized, 2, 2);
}
