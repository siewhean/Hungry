import type { UserProfile } from "@/types/domain";
import type { OnboardingDraft } from "./useOnboardingDraftStore";

type CommitDependencies = {
  authenticated: boolean;
  save: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  apply: (profile: UserProfile) => void;
  markCommitted: () => void;
  assertCurrent: () => void;
};

/** One confirmed profile write; an unsuccessful retake leaves prior preferences intact. */
export async function commitQuizProfile(
  profile: UserProfile,
  draft: OnboardingDraft,
  dependencies: CommitDependencies,
): Promise<void> {
  dependencies.assertCurrent();
  if (profile.id !== draft.subjectId) throw new Error("This draft belongs to another account.");
  const updates: Partial<UserProfile> = {
    tasteVector: { ...draft.values },
    dietaryPreferences: [...draft.dietaryPreferences],
    maxDishBudget: draft.maxDishBudget,
    onboardingCuisineIds: [...draft.cuisineIds],
    onboardingSelectedDishIds: [...draft.selectedDishIds],
  };
  const confirmed = dependencies.authenticated
    ? await dependencies.save(updates)
    : { ...profile, ...updates };
  dependencies.assertCurrent();
  if (confirmed.id !== profile.id) throw new Error("The saved profile belongs to another account.");
  dependencies.apply(confirmed);
  dependencies.markCommitted();
}
