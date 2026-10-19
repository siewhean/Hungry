// The signup confirmation link reopens EmailVerification with only `?code=`,
// often after a cold start. Remember, in storage, whether the sign-up that sent
// the email had already finished onboarding (OnboardingAuth) so confirming it
// neither skips nor repeats onboarding.

import { hungryPersistStorage } from "@/store/persistStorage";

const STORAGE_KEY = "hungry-pending-email-verification-v1";

// null = not known in memory yet; read storage.
let pendingCompletesOnboarding: boolean | null = null;

/** Called whenever a sign-up opens EmailVerification for a new email. */
export function rememberPendingEmailVerification(completedOnboarding: boolean): void {
  pendingCompletesOnboarding = completedOnboarding;
  void Promise.resolve(
    completedOnboarding
      ? hungryPersistStorage?.setItem(STORAGE_KEY, { state: { completedOnboarding }, version: 0 })
      : hungryPersistStorage?.removeItem(STORAGE_KEY),
  ).catch(() => undefined);
}

/** Reads and clears the flag once the confirmation link is exchanged. */
export async function takePendingEmailVerificationCompletesOnboarding(): Promise<boolean> {
  let value = pendingCompletesOnboarding;
  if (value === null) {
    try {
      const stored = await hungryPersistStorage?.getItem(STORAGE_KEY);
      value =
        (stored?.state as { completedOnboarding?: unknown } | undefined)?.completedOnboarding ===
        true;
    } catch {
      value = false;
    }
  }
  pendingCompletesOnboarding = false;
  void Promise.resolve(hungryPersistStorage?.removeItem(STORAGE_KEY)).catch(() => undefined);
  return value;
}

/** Test-only: forget the in-memory value, as on a cold start. */
export function resetPendingEmailVerificationMemoryForTests(): void {
  pendingCompletesOnboarding = null;
}
