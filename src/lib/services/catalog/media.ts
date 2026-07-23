import { isRelease01BlockedImageUrl } from "@/constants/release01";

export type CatalogMediaPolicy = {
  approvedForDisplay?: boolean;
  rightsStatus?: string;
};

/**
 * The only image mapping boundary shared by Supabase cards, details, and the
 * authenticated Excel fallback. Invalid, synthetic, or explicitly withheld
 * media becomes absent data so every surface renders its neutral image state.
 */
export function sanitizeCatalogImageUrl(
  value: string | null | undefined,
  policy: CatalogMediaPolicy = {},
): string | undefined {
  const candidate = value?.trim();
  if (!candidate || isRelease01BlockedImageUrl(candidate)) return undefined;
  if (policy.approvedForDisplay === false) return undefined;

  const rightsStatus = policy.rightsStatus?.trim().toLowerCase();
  if (["unavailable", "rejected", "restricted", "removed"].includes(rightsStatus ?? "")) {
    return undefined;
  }

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function sanitizeCatalogMediaUrl(
  value: string | null | undefined,
  rightsStatus: string | undefined,
  approvedForDisplay: boolean | undefined,
): string | undefined {
  return sanitizeCatalogImageUrl(value, { rightsStatus, approvedForDisplay });
}
