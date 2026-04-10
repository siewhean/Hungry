import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createInitialReviewDraft } from "@/features/review/reviewDraft";
import type { ReviewDraft } from "@/types/domain";
import { hungryPersistStorage } from "./persistStorage";

const initialDraft = createInitialReviewDraft();

interface ReviewDraftState {
  draft: ReviewDraft;
  isSubmitting: boolean;
  failedPhotoUris: string[];
  selectDish: (venueId: string, dishId: string) => void;
  setRating: (rating: number) => void;
  toggleTag: (tag: string) => void;
  setRecommend: (recommend: boolean) => void;
  setText: (text: string) => void;
  addPhoto: (uri: string) => void;
  markPhotoFailed: (uri: string) => void;
  clearFailedPhoto: (uri: string) => void;
  resetDraft: () => void;
  setSubmitting: (isSubmitting: boolean) => void;
}

export const useReviewDraftStore = create<ReviewDraftState>()(
  persist(
    (set) => ({
      draft: initialDraft,
      isSubmitting: false,
      failedPhotoUris: [],
      selectDish: (selectedVenueId, selectedDishId) =>
        set(() => ({
          draft: {
            ...initialDraft,
            selectedVenueId,
            selectedDishId,
          },
          failedPhotoUris: [],
        })),
      setRating: (rating) =>
        set((state) => ({
          draft: {
            ...state.draft,
            rating,
          },
        })),
      toggleTag: (tag) =>
        set((state) => ({
          draft: {
            ...state.draft,
            selectedTags: state.draft.selectedTags.includes(tag)
              ? state.draft.selectedTags.filter((value) => value !== tag)
              : [...state.draft.selectedTags, tag],
          },
        })),
      setRecommend: (recommend) =>
        set((state) => ({
          draft: {
            ...state.draft,
            recommend,
          },
        })),
      setText: (text) =>
        set((state) => ({
          draft: {
            ...state.draft,
            text,
          },
        })),
      addPhoto: (uri) =>
        set((state) => ({
          draft: {
            ...state.draft,
            photos: [...state.draft.photos, uri],
          },
        })),
      markPhotoFailed: (uri) => set((state) => ({ failedPhotoUris: [...state.failedPhotoUris, uri] })),
      clearFailedPhoto: (uri) =>
        set((state) => ({ failedPhotoUris: state.failedPhotoUris.filter((value) => value !== uri) })),
      resetDraft: () => set({ draft: createInitialReviewDraft(), isSubmitting: false, failedPhotoUris: [] }),
      setSubmitting: (isSubmitting) => set({ isSubmitting }),
    }),
    {
      name: "hungry-review-draft-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        draft: state.draft,
        failedPhotoUris: state.failedPhotoUris,
      }),
    },
  ),
);
