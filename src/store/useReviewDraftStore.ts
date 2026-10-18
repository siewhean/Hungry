import { create } from "zustand";
import { persist } from "zustand/middleware";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { createClientReviewId, createInitialReviewDraft } from "@/features/review/reviewDraft";
import { REVIEW_TEXT_MAX_LENGTH, sanitizeFreeText } from "@/lib/security/inputSanitization";
import type { ReviewDraft } from "@/types/domain";
import { hungryPersistStorage } from "./persistStorage";

const initialDraft = createInitialReviewDraft();

interface ReviewDraftState {
  draft: ReviewDraft;
  isSubmitting: boolean;
  failedPhotoUris: string[];
  /** Client review id reused across retries of the same draft so retries never duplicate it. */
  pendingReviewId?: string;
  ensurePendingReviewId: () => string;
  selectDish: (venueId: string, dishId: string) => void;
  setRating: (rating: number) => void;
  toggleTag: (tag: string) => void;
  setRecommend: (recommend: boolean) => void;
  setText: (text: string) => void;
  addPhoto: (uri: string) => void;
  removePhoto: (uri: string) => void;
  markPhotoFailed: (uri: string) => void;
  clearFailedPhoto: (uri: string) => void;
  resetDraft: () => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setVideoUri: (uri?: string) => void;
  setFilterId: (id?: string) => void;
  setMusicId: (id?: string) => void;
}

export const useReviewDraftStore = create<ReviewDraftState>()(
  persist(
    (set, get) => ({
      draft: initialDraft,
      isSubmitting: false,
      failedPhotoUris: [],
      pendingReviewId: undefined,
      ensurePendingReviewId: () => {
        const existing = get().pendingReviewId;
        if (existing) return existing;
        const pendingReviewId = createClientReviewId();
        set({ pendingReviewId });
        return pendingReviewId;
      },
      selectDish: (selectedVenueId, selectedDishId) =>
        set((state) => {
          // Re-selecting the dish already in the draft must not wipe the draft.
          if (
            state.draft.selectedDishId === selectedDishId &&
            state.draft.selectedVenueId === selectedVenueId
          ) {
            return state;
          }
          trackAnalyticsEvent("review_started", {
            trigger: "review_flow",
            venue_id: selectedVenueId,
            dish_id: selectedDishId,
          });
          return {
            draft: {
              ...initialDraft,
              selectedVenueId,
              selectedDishId,
            },
            failedPhotoUris: [],
            pendingReviewId: undefined,
          };
        }),
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
            text: sanitizeFreeText(text, REVIEW_TEXT_MAX_LENGTH),
          },
        })),
      addPhoto: (uri) =>
        set((state) => ({
          draft: {
            ...state.draft,
            photos: [...state.draft.photos, uri],
          },
        })),
      removePhoto: (uri) =>
        set((state) => ({
          draft: {
            ...state.draft,
            photos: state.draft.photos.filter((photoUri) => photoUri !== uri),
          },
          failedPhotoUris: state.failedPhotoUris.filter((value) => value !== uri),
        })),
      markPhotoFailed: (uri) =>
        set((state) => ({ failedPhotoUris: [...state.failedPhotoUris, uri] })),
      clearFailedPhoto: (uri) =>
        set((state) => ({
          failedPhotoUris: state.failedPhotoUris.filter((value) => value !== uri),
        })),
      resetDraft: () =>
        set({
          draft: createInitialReviewDraft(),
          isSubmitting: false,
          failedPhotoUris: [],
          pendingReviewId: undefined,
        }),
      setSubmitting: (isSubmitting) => set({ isSubmitting }),
      setVideoUri: (uri) =>
        set((state) => ({
          draft: { ...state.draft, videoUri: uri },
        })),
      setFilterId: (id) =>
        set((state) => ({
          draft: { ...state.draft, filterId: id },
        })),
      setMusicId: (id) =>
        set((state) => ({
          draft: { ...state.draft, musicId: id },
        })),
    }),
    {
      name: "hungry-review-draft-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        draft: state.draft,
        failedPhotoUris: state.failedPhotoUris,
        pendingReviewId: state.pendingReviewId,
      }),
    },
  ),
);
