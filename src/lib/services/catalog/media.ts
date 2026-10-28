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

/**
 * Mirrors `public.catalog_url_is_delivery_app` (20260610120000): Grab, foodpanda and Deliveroo
 * photos are not licensed for display unless the server says so.
 */
export function isDeliveryAppImageUrl(value: string | null | undefined): boolean {
  const url = (value ?? "").toLowerCase();
  return url.includes("grab.com") || url.includes("foodpanda.") || url.includes("deliveroo.");
}

/**
 * The bundled offline (Excel) catalog has no rights data. It keeps first-party photos as before,
 * but never a delivery-app photo, which the server would withhold (no licence on record).
 */
export function sanitizeOfflineCatalogImageUrl(
  value: string | null | undefined,
): string | undefined {
  if (isDeliveryAppImageUrl(value)) return undefined;
  return sanitizeCatalogImageUrl(value, { rightsStatus: "approved", approvedForDisplay: true });
}

export function sanitizeCatalogMediaUrl(
  value: string | null | undefined,
  rightsStatus: string | undefined,
  approvedForDisplay: boolean | undefined,
): string | undefined {
  const normalizedRightsStatus = rightsStatus?.trim().toLowerCase();
  const allowedRightsStatuses = new Set([
    "approved",
    "licensed",
    "owned",
    "permitted",
    "permitted_api",
    "merchant_owned",
    "operator_owned",
    "user_submitted",
  ]);

  // Raw catalog responses are untrusted by default. A URL is displayable only
  // when the server explicitly returns both a positive display approval and a
  // recognised rights status; missing projection fields must not surface media.
  if (approvedForDisplay !== true || !allowedRightsStatuses.has(normalizedRightsStatus ?? "")) {
    return undefined;
  }

  return sanitizeCatalogImageUrl(value, { rightsStatus, approvedForDisplay });
}

/**
 * Raw-catalog RPCs whose card rows carry an `image_url` the server has already passed through
 * `public.catalog_display_image_url` (approved for display, allowed rights status, no Unsplash,
 * no delivery-app photo unless licensed). The card tables have no `media_approved_for_display`
 * column, so these rows never carry a display flag; the BEFORE INSERT triggers from
 * 20261021150100_catalog_raw_card_display_rights.sql rewrite every `catalog_raw_dish_cards.image_url`,
 * `catalog_raw_venue_cards.image_url` and `representative_dish.image_url` on publish:
 *   - catalog_raw_dishes_page / catalog_raw_venues_page: `to_jsonb(visible)` of the card rows
 *   - catalog_raw_venue_menu_page: delegates to catalog_raw_dishes_page
 *   - catalog_raw_dish_detail / catalog_raw_venue_detail: `to_jsonb(c)` of one card row
 * The dish gallery (`media` from catalog_raw_dish_media) is not in this list: those rows do carry
 * `approved_for_display` and keep the strict `sanitizeCatalogMediaUrl` check.
 */
export const SERVER_FILTERED_CARD_IMAGE_RPCS = [
  "catalog_raw_dishes_page",
  "catalog_raw_venues_page",
  "catalog_raw_venue_menu_page",
  "catalog_raw_dish_detail",
  "catalog_raw_venue_detail",
] as const;

export type ServerFilteredCardImageRpc = (typeof SERVER_FILTERED_CARD_IMAGE_RPCS)[number];

const SERVER_FILTERED_CARD_IMAGE_RPC_SET: ReadonlySet<string> = new Set(
  SERVER_FILTERED_CARD_IMAGE_RPCS,
);

/**
 * The card image for a raw-catalog row. Rows from a server-filtered RPC keep their image unless it
 * is blocked, malformed or explicitly withheld (an explicit `false` display flag or a withheld
 * rights status still hides it). Rows from any other source must carry a positive display approval
 * and a recognised rights status, as before.
 */
export function sanitizeCatalogCardImageUrl(
  value: string | null | undefined,
  sourceRpc: string,
  policy: CatalogMediaPolicy = {},
): string | undefined {
  if (!SERVER_FILTERED_CARD_IMAGE_RPC_SET.has(sourceRpc)) {
    return sanitizeCatalogMediaUrl(value, policy.rightsStatus, policy.approvedForDisplay);
  }
  return sanitizeCatalogImageUrl(value, policy);
}
