import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createOnboardingDraftStorage } from "./onboardingDraftStorage";
import type { DietaryFlag, TasteVector, UserProfile } from "@/types/domain";

export interface OnboardingDraft {
  subjectId: string;
  mode: "onboarding" | "profile";
  values: TasteVector;
  dietaryPreferences: DietaryFlag[];
  maxDishBudget?: number;
  step: number;
  answeredKeys: Record<string, boolean>;
  cuisineIds: string[];
  selectedDishIds: string[];
  pendingSaveDishId?: string;
  committed: boolean;
}
interface DraftState {
  draft: OnboardingDraft | null;
  prepare: (profile: UserProfile, mode?: OnboardingDraft["mode"]) => OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
  setAccountScope: (userId: string | null, options?: { adoptGuest?: boolean }) => Promise<void>;
  clearForAccount: (userId?: string) => void;
  reset: () => void;
}
const scopedStorage = createOnboardingDraftStorage<OnboardingDraft>();
const rememberedDrafts = new Map<string, OnboardingDraft>();
let activeSubject: string | null | undefined;
let scopeGeneration = 0;
let pendingScope = Promise.resolve();
const remember = (draft: OnboardingDraft | null) => {
  if (draft) rememberedDrafts.set(draft.subjectId, draft);
};
export const useOnboardingDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      draft: null,
      prepare: (profile, mode = "onboarding") => {
        const current = get().draft;
        if (current?.subjectId === profile.id && current.mode === mode && !current.committed)
          return current;
        const draft: OnboardingDraft = {
          subjectId: profile.id,
          mode,
          values: { ...profile.tasteVector },
          dietaryPreferences: [...profile.dietaryPreferences],
          maxDishBudget: profile.maxDishBudget,
          step: 0,
          answeredKeys: {},
          cuisineIds: [...(profile.onboardingCuisineIds ?? [])],
          selectedDishIds: [...(profile.onboardingSelectedDishIds ?? [])],
          committed: false,
        };
        remember(draft);
        set({ draft });
        return draft;
      },
      update: (patch) =>
        set((state) => {
          const draft = state.draft
            ? { ...state.draft, ...patch, subjectId: state.draft.subjectId }
            : null;
          remember(draft);
          return { draft };
        }),
      setAccountScope: (userId, options) => {
        if (activeSubject === userId) return pendingScope;
        const previous = get().draft;
        remember(previous);
        activeSubject = userId;
        const generation = ++scopeGeneration;
        if (
          userId &&
          options?.adoptGuest &&
          previous?.subjectId === "guest-user" &&
          previous.mode === "onboarding"
        ) {
          const adopted = { ...previous, subjectId: userId };
          rememberedDrafts.delete("guest-user");
          remember(adopted);
          set({ draft: adopted });
          pendingScope = scopedStorage.remove("guest-user");
          return pendingScope;
        }
        if (!userId) {
          set({ draft: null });
          pendingScope = Promise.resolve();
          return pendingScope;
        }
        const remembered = rememberedDrafts.get(userId);
        if (remembered) {
          set({ draft: remembered });
          pendingScope = Promise.resolve();
          return pendingScope;
        }
        if (previous?.subjectId === userId) {
          pendingScope = Promise.resolve();
          return pendingScope;
        }
        set({ draft: null });
        pendingScope = scopedStorage.load(userId).then((result) => {
          if (
            generation !== scopeGeneration ||
            activeSubject !== userId ||
            !result.current ||
            get().draft
          )
            return;
          if (result.draft) {
            remember(result.draft);
            set({ draft: result.draft });
          }
        });
        return pendingScope;
      },
      clearForAccount: (userId) => {
        const current = get().draft;
        if (userId && current?.subjectId !== userId) return;
        const subject = userId ?? current?.subjectId ?? activeSubject;
        if (subject) {
          rememberedDrafts.delete(subject);
          void scopedStorage.remove(subject).catch(() => {});
        }
        set({ draft: null });
      },
      reset: () => {
        const subject = get().draft?.subjectId ?? activeSubject;
        if (subject) {
          rememberedDrafts.delete(subject);
          void scopedStorage.remove(subject).catch(() => {});
        }
        scopeGeneration++;
        activeSubject = undefined;
        pendingScope = Promise.resolve();
        set({ draft: null });
      },
    }),
    {
      name: "hungry-onboarding-draft-v1",
      storage: scopedStorage.storage,
      partialize: (state) => ({ draft: state.draft }),
    },
  ),
);

export function closestTasteOptionIndex(value: number) {
  const options = [2, 5, 8];
  return options.reduce(
    (best, option, index) =>
      Math.abs(option - value) < Math.abs(options[best] - value) ? index : best,
    0,
  );
}
