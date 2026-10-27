import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { DietaryFlag, TasteKey, TasteVector } from "@/types/domain";
import { hungryPersistStorage } from "./persistStorage";

/** The onboarding screens a relaunch can reopen, in the order the flow shows them. */
export const ONBOARDING_RESUME_ROUTES = [
  "LocationPermission",
  "TasteQuiz",
  "DietaryPreferences",
  "FoodOpenness",
  "TasteProfileResult",
] as const;
export type OnboardingResumeRoute = (typeof ONBOARDING_RESUME_ROUTES)[number];

/** A draft older than this is dropped: someone back after a day starts from Welcome. */
export const ONBOARDING_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export interface OnboardingDraftQuiz {
  answers: TasteVector;
  answeredKeys: TasteKey[];
  /** The question the user was on. */
  step: number;
}

export interface OnboardingDraftDietary {
  dietaryPreferences: DietaryFlag[];
  /** null: "Any price". */
  maxDishBudget: number | null;
}

interface OnboardingDraftState {
  route: OnboardingResumeRoute | null;
  savedAt: number | null;
  quiz: OnboardingDraftQuiz | null;
  dietary: OnboardingDraftDietary | null;
  rememberRoute: (route: OnboardingResumeRoute) => void;
  rememberQuiz: (quiz: OnboardingDraftQuiz) => void;
  rememberDietary: (dietary: OnboardingDraftDietary) => void;
  clearDraft: () => void;
}

const EMPTY_DRAFT = { route: null, savedAt: null, quiz: null, dietary: null } as const;

/**
 * Where a not-yet-finished onboarding run stands, so closing the app (to allow location in
 * Settings, say) does not send the user back to Welcome with every answer gone. Only the
 * answers that live in screen state are kept here; the profile and location stores already
 * persist what a finished step saved.
 */
export const useOnboardingDraftStore = create<OnboardingDraftState>()(
  persist(
    (set) => ({
      ...EMPTY_DRAFT,
      rememberRoute: (route) => set({ route, savedAt: Date.now() }),
      rememberQuiz: (quiz) => set({ quiz, savedAt: Date.now() }),
      rememberDietary: (dietary) => set({ dietary, savedAt: Date.now() }),
      clearDraft: () => set({ ...EMPTY_DRAFT }),
    }),
    {
      name: "hungry-onboarding-draft-v1",
      storage: hungryPersistStorage,
      partialize: (state) => ({
        route: state.route,
        savedAt: state.savedAt,
        quiz: state.quiz,
        dietary: state.dietary,
      }),
    },
  ),
);

/** The draft to resume from, or null when there is none or it has expired. */
export function getFreshOnboardingDraft(now: number = Date.now()): {
  route: OnboardingResumeRoute;
  quiz: OnboardingDraftQuiz | null;
  dietary: OnboardingDraftDietary | null;
} | null {
  const { route, savedAt, quiz, dietary } = useOnboardingDraftStore.getState();
  if (!route || savedAt === null) return null;
  if (now - savedAt > ONBOARDING_DRAFT_TTL_MS) return null;
  return { route, quiz, dietary };
}
