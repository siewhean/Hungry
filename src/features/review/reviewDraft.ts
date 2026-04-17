import type { ReviewDraft } from "../../types/domain";

export function createInitialReviewDraft(): ReviewDraft {
  return {
    selectedVenueId: undefined,
    selectedDishId: undefined,
    rating: 0,
    selectedTags: [],
    recommend: false,
    text: "",
    photos: [],
  };
}
