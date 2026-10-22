import type { SubmitReviewInput } from "@/lib/services/types";

/** Content fingerprints, not local paths alone, distinguish immutable upload attempts. */
export async function reviewAttemptPayload(
  draft: SubmitReviewInput,
  hashPhoto: (uri: string) => Promise<string>,
) {
  const photos = [];
  for (const uri of draft.photos) photos.push({ uri, digest: await hashPhoto(uri) });
  return JSON.stringify({
    photos,
    dish: draft.dishId,
    venue: draft.venueId,
    rating: draft.rating,
    text: draft.text,
    tags: draft.tags,
    recommend: draft.wouldRecommend ?? true,
  });
}
