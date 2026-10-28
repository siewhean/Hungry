import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { REVIEW_MAX_TAGS } from "@/constants/taste";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { createClientReviewId, createInitialReviewDraft } from "@/features/review/reviewDraft";
import { REVIEW_TEXT_MAX_LENGTH, clampFreeTextInput } from "@/lib/security/inputSanitization";
import type { ReviewDraft, TasteKey } from "@/types/domain";
import { hungryPersistStorage } from "./persistStorage";

const initialDraft = createInitialReviewDraft();

/** Most photos one review can carry; the picker and the store both enforce it. */
export const REVIEW_MAX_PHOTOS = 5;

/** The optional "How did it taste?" answers (0-10 per taste), for one dish. */
export interface ReviewFeltTaste {
  dishId?: string;
  values: Partial<Record<TasteKey, number>>;
}

const emptyFeltTaste = (): ReviewFeltTaste => ({ values: {} });

interface ReviewDraftState {
  draft: ReviewDraft;
  /** Saved with the draft so a resumed review keeps its taste answers. */
  feltTaste: ReviewFeltTaste;
  /** Sets (or with undefined clears) one taste answer for `dishId`. */
  setFeltTaste: (dishId: string, key: TasteKey, value: number | undefined) => void;
  clearFeltTaste: () => void;
  isSubmitting: boolean;
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
  resetDraft: () => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setVideoUri: (uri?: string) => void;
  setMusicId: (id?: string) => void;
}

export const useReviewDraftStore = create<ReviewDraftState>()(
  persist(
    (set, get) => ({
      draft: initialDraft,
      feltTaste: emptyFeltTaste(),
      isSubmitting: false,
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
          // Picking the first dish keeps whatever was already filled in
          // (rating, text, photos); only switching from one dish to another
          // starts a fresh draft.
          if (!state.draft.selectedDishId) {
            return {
              draft: { ...state.draft, selectedVenueId, selectedDishId },
              feltTaste: emptyFeltTaste(),
            };
          }
          return {
            draft: {
              ...initialDraft,
              selectedVenueId,
              selectedDishId,
            },
            feltTaste: emptyFeltTaste(),
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
        set((state) => {
          const selected = state.draft.selectedTags.includes(tag);
          // The server keeps at most REVIEW_MAX_TAGS; a ninth tap is ignored, not silently dropped later.
          if (!selected && state.draft.selectedTags.length >= REVIEW_MAX_TAGS) return state;
          return {
            draft: {
              ...state.draft,
              selectedTags: selected
                ? state.draft.selectedTags.filter((value) => value !== tag)
                : [...state.draft.selectedTags, tag],
            },
          };
        }),
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
            text: clampFreeTextInput(text, REVIEW_TEXT_MAX_LENGTH),
          },
        })),
      addPhoto: (uri) =>
        set((state) => {
          // Photos are keyed by uri, so a duplicate pick would make one remove tap drop both.
          if (state.draft.photos.includes(uri) || state.draft.photos.length >= REVIEW_MAX_PHOTOS) {
            return state;
          }
          return { draft: { ...state.draft, photos: [...state.draft.photos, uri] } };
        }),
      removePhoto: (uri) =>
        set((state) => ({
          draft: {
            ...state.draft,
            photos: state.draft.photos.filter((photoUri) => photoUri !== uri),
          },
        })),
      setFeltTaste: (dishId, key, value) =>
        set((state) => {
          const values = state.feltTaste.dishId === dishId ? { ...state.feltTaste.values } : {};
          if (value === undefined) delete values[key];
          else values[key] = value;
          return { feltTaste: { dishId, values } };
        }),
      clearFeltTaste: () => set({ feltTaste: emptyFeltTaste() }),
      resetDraft: () =>
        set({
          draft: createInitialReviewDraft(),
          feltTaste: emptyFeltTaste(),
          isSubmitting: false,
          pendingReviewId: undefined,
        }),
      setSubmitting: (isSubmitting) => set({ isSubmitting }),
      setVideoUri: (uri) =>
        set((state) => ({
          draft: { ...state.draft, videoUri: uri },
        })),
      setMusicId: (id) =>
        set((state) => ({
          draft: { ...state.draft, musicId: id },
        })),
    }),
    {
      name: "hungry-review-draft-v1",
      storage: hungryPersistStorage,
      // v2: recommend became boolean | null. A v1 draft's false was the old
      // default, not an answer, so it is cleared rather than sent as "No".
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<ReviewDraftState> | undefined;
        if (version < 2 && state?.draft) {
          return { ...state, draft: { ...state.draft, recommend: null } };
        }
        return state as ReviewDraftState;
      },
      partialize: (state) => ({
        draft: state.draft,
        feltTaste: state.feltTaste,
        pendingReviewId: state.pendingReviewId,
      }),
    },
  ),
);

/**
 * True once the persisted draft has been read from storage. The store hydrates
 * asynchronously, so a screen that acts on the draft (for example starting a review for a
 * routed dish) must wait for this, or the saved draft lands on top of what it just did.
 */
export function useReviewDraftHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useReviewDraftStore.persist.onFinishHydration(onChange),
    () => useReviewDraftStore.persist.hasHydrated(),
    () => false,
  );
}
