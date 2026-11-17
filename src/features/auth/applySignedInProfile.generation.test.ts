import assert from "node:assert/strict";
import { test } from "node:test";
import { userProfile } from "@/lib/services/mock/data";
import { hungryService } from "@/lib/services/mock/mockService";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import { setServiceProvider, resetServiceProvider } from "@/lib/services/serviceProvider";
import { advanceAccountGeneration } from "@/lib/security/accountScope";
import { useProfileStore } from "@/store/useProfileStore";
import { useOnboardingDraftStore } from "@/features/onboarding/useOnboardingDraftStore";
import { similarityScore } from "@/lib/ai/similarityScore";
import { applySignedInProfile } from "./applySignedInProfile";

test("A-to-B-to-A invalidates earlier sign-in's delayed profile-ready continuation", async () => {
  const globals = globalThis as typeof globalThis & {
    requestIdleCallback?: (callback: () => void) => number;
  };
  const previousIdle = globals.requestIdleCallback;
  const callbacks: (() => void)[] = [];
  globals.requestIdleCallback = (callback) => {
    callbacks.push(() => callback({ didTimeout: false, timeRemaining: () => 50 }));
    return callbacks.length;
  };
  let reads = 0;
  let resolveReady!: (value: typeof userProfile) => void;
  const profileReady = new Promise<typeof userProfile>((resolve) => {
    resolveReady = resolve;
  });
  useOnboardingDraftStore.getState().reset();
  useProfileStore.getState().applyProfile(structuredClone(userProfile));
  setServiceProvider({
    mode: "supabase",
    repository: dataRepositoryMock,
    similarityScore,
    service: {
      ...hungryService,
      profile: {
        ...hungryService.profile,
        getProfile: async () => {
          reads++;
          return structuredClone(userProfile);
        },
      },
    },
  });
  try {
    await applySignedInProfile(structuredClone(userProfile), { profileReady });
    callbacks.forEach((callback) => callback());
    await Promise.resolve();
    advanceAccountGeneration(); // A -> B
    advanceAccountGeneration(); // B -> A, same canonical identity in a new session epoch
    useProfileStore
      .getState()
      .applyProfile({ ...structuredClone(userProfile), displayName: "Current account epoch" });
    resolveReady(structuredClone(userProfile));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(reads, 0);
    assert.equal(useProfileStore.getState().profile.displayName, "Current account epoch");
  } finally {
    globals.requestIdleCallback = previousIdle;
    resetServiceProvider();
  }
});
