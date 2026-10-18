const MERCHANT_DISH_IMAGE_PREFIX = "/storage/v1/object/public/merchant-dish-images/";
export const UNLINKED_VENUE_SEGMENT = "unlinked";

export type MerchantDishImageOwner = {
  /** Configured Supabase project URL (EXPO_PUBLIC_SUPABASE_URL). */
  supabaseUrl: string;
  /** Signed-in user id; uploads are keyed `${userId}/${venueId}/${dishId}/...`. */
  userId: string | null;
  /** Venue linked to the merchant outlet being edited. */
  venueId: string | null;
};

// A dish photo is kept as "already uploaded" only when it is an https public
// object in this project's merchant-dish-images bucket filed under the edited
// outlet's venue folder (any co-manager's prefix; storage RLS stops users
// writing into another user's prefix). Anything else must go through the
// local-file upload path.
export function isOwnMerchantDishImageUrl(url: string, owner: MerchantDishImageOwner): boolean {
  let parsed: URL;
  let expected: URL;
  try {
    parsed = new URL(url);
    expected = new URL(owner.supabaseUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" || expected.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.origin !== expected.origin) return false;
  if (!parsed.pathname.startsWith(MERCHANT_DISH_IMAGE_PREFIX)) return false;

  let segments: string[];
  try {
    segments = parsed.pathname
      .slice(MERCHANT_DISH_IMAGE_PREFIX.length)
      .split("/")
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return false;
  }
  // `${userId}/${venueId}/${dishId}/file`
  if (segments.length < 4) return false;
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return false;
  }

  const [ownerSegment, venueSegment] = segments;
  // Uploads for an outlet with no venue are filed under "unlinked"; those are
  // only trusted from the caller's own prefix.
  const expectedVenue = owner.venueId || UNLINKED_VENUE_SEGMENT;
  if (venueSegment !== expectedVenue) return false;
  if (expectedVenue === UNLINKED_VENUE_SEGMENT) {
    return Boolean(owner.userId) && ownerSegment === owner.userId;
  }
  return true;
}
