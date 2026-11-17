import assert from "node:assert/strict";
import test from "node:test";
import { dishes, userProfile } from "@/lib/services/mock/data";
import type { UserProfile } from "@/types/domain";
import type { OnboardingDraft } from "./useOnboardingDraftStore";
import { commitQuizProfile } from "./commitQuizProfile";

function draft(): OnboardingDraft {
  return {
    subjectId: userProfile.id,
    mode: "profile",
    values: dishes[0].tasteVector,
    dietaryPreferences: [...userProfile.dietaryPreferences],
    maxDishBudget: userProfile.maxDishBudget,
    step: 5,
    answeredKeys: {},
    cuisineIds: [...(userProfile.onboardingCuisineIds ?? [])],
    selectedDishIds: [dishes[0].id],
    committed: false,
  };
}

test("failed Finish preserves previous profile and leaves staged retake retryable", async () => {
  const staged = draft();
  let profile = userProfile;
  let writes = 0;
  await assert.rejects(
    () =>
      commitQuizProfile(userProfile, staged, {
        authenticated: true,
        save: async () => {
          writes += 1;
          throw new Error("Offline");
        },
        apply: (next) => {
          profile = next;
        },
        markCommitted: () => {
          staged.committed = true;
        },
        assertCurrent: () => {},
      }),
    /Offline/,
  );
  assert.equal(writes, 1);
  assert.equal(profile, userProfile);
  assert.equal(staged.committed, false);
  assert.deepEqual(staged.values, dishes[0].tasteVector);
});

test("confirmed Finish writes all preferences once and applies only the server response", async () => {
  const staged = draft();
  let writes = 0;
  let applied: UserProfile | undefined;
  let received: Partial<UserProfile> | undefined;
  const confirmed = {
    ...userProfile,
    tasteVector: { ...staged.values },
    onboardingSelectedDishIds: staged.selectedDishIds,
  };
  await commitQuizProfile(userProfile, staged, {
    authenticated: true,
    save: async (updates) => {
      writes += 1;
      received = updates;
      return confirmed;
    },
    apply: (next) => {
      applied = next;
    },
    markCommitted: () => {
      staged.committed = true;
    },
    assertCurrent: () => {},
  });
  assert.equal(writes, 1);
  assert.deepEqual(Object.keys(received!).sort(), [
    "dietaryPreferences",
    "maxDishBudget",
    "onboardingCuisineIds",
    "onboardingSelectedDishIds",
    "tasteVector",
  ]);
  assert.equal(applied, confirmed);
  assert.equal(staged.committed, true);
});

test("account transition while Finish awaits cannot apply or commit its late response", async () => {
  const staged = draft();
  let current = true;
  let applied = false;
  await assert.rejects(
    () =>
      commitQuizProfile(userProfile, staged, {
        authenticated: true,
        save: async () => {
          current = false;
          return userProfile;
        },
        apply: () => {
          applied = true;
        },
        markCommitted: () => {
          staged.committed = true;
        },
        assertCurrent: () => {
          if (!current) throw new Error("Account changed");
        },
      }),
    /Account changed/,
  );
  assert.equal(applied, false);
  assert.equal(staged.committed, false);
});

test("guest Finish merges the staged fields locally without a service write", async () => {
  const staged = draft();
  let applied: UserProfile | undefined;
  await commitQuizProfile(userProfile, staged, {
    authenticated: false,
    save: async () => {
      throw new Error("Guest must not save remotely");
    },
    apply: (next) => {
      applied = next;
    },
    markCommitted: () => {
      staged.committed = true;
    },
    assertCurrent: () => {},
  });
  assert.deepEqual(applied?.tasteVector, staged.values);
  assert.deepEqual(applied?.onboardingSelectedDishIds, staged.selectedDishIds);
  assert.equal(staged.committed, true);
  assert.notEqual(applied, userProfile);
});
