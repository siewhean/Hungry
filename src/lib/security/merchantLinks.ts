// Merchant-supplied profile links are untrusted: web links open only as
// https in the in-app browser, and phone/email are rebuilt from validated parts.
export function toMerchantWebUrl(url: string): string | null {
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (parsed.username || parsed.password || !parsed.hostname.includes(".")) return null;
    parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function toMerchantPhoneUrl(phone: string): string | null {
  const digits = phone.replace(/[\s()-]/g, "");
  return /^\+?\d{5,15}$/.test(digits) ? `tel:${digits}` : null;
}

export function toMerchantEmailUrl(email: string): string | null {
  const trimmed = email.trim();
  return /^[^\s@?&#/]+@[^\s@?&#/]+\.[a-z]{2,}$/i.test(trimmed) ? `mailto:${trimmed}` : null;
}
