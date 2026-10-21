// A guest who taps Save on the onboarding result screen is sent to sign up. Email
// sign-up resets to EmailVerification (and the user may leave the app to read the
// email), which unmounts the result screen, so the dish is kept on the device and
// saved once any sign-in or verification finishes (applySignedInProfile).

import { hungryPersistStorage } from "@/store/persistStorage";
import { useUIStore } from "@/store/useUIStore";
import type { DishDetail } from "@/types/domain";
import { saveDishAfterSignIn } from "./finishGuestAction";

const PENDING_SAVE_STORAGE_NAME = "hungry-pending-dish-save-v1";
// A save older than this is not attached to whichever account signs in later.
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type PendingDishSave = { dish: DishDetail; savedAt: number };

// undefined = not read from storage yet; null = nothing pending.
let pending: PendingDishSave | null | undefined;

function isPendingDishSave(value: unknown): value is PendingDishSave {
  const candidate = value as Partial<PendingDishSave> | null | undefined;
  return (
    typeof candidate?.dish?.id === "string" &&
    typeof candidate.dish.name === "string" &&
    typeof candidate.savedAt === "number"
  );
}

/** Keeps the dish a guest asked to save until they finish signing in. */
export function rememberPendingDishSave(dish: DishDetail): void {
  pending = { dish, savedAt: Date.now() };
  void Promise.resolve(
    hungryPersistStorage?.setItem(PENDING_SAVE_STORAGE_NAME, { state: pending, version: 0 }),
  ).catch(() => undefined);
}

// Claims the pending save so two callers never save it twice.
async function takePending(): Promise<PendingDishSave | null> {
  if (pending === undefined) {
    let stored: PendingDishSave | null = null;
    try {
      const value = (await hungryPersistStorage?.getItem(PENDING_SAVE_STORAGE_NAME))?.state;
      stored = isPendingDishSave(value) ? value : null;
    } catch {
      stored = null;
    }
    if (pending === undefined) pending = stored;
  }
  const saved = pending;
  pending = null;
  if (saved) {
    void Promise.resolve(hungryPersistStorage?.removeItem(PENDING_SAVE_STORAGE_NAME)).catch(
      () => undefined,
    );
  }
  return saved;
}

/** Saves the dish a guest asked for before signing in. Safe to call on every sign-in. */
export async function flushPendingDishSave(now: number = Date.now()): Promise<void> {
  const saved = await takePending();
  if (!saved || now - saved.savedAt > PENDING_MAX_AGE_MS) return;
  const didSave = await saveDishAfterSignIn(saved.dish);
  useUIStore
    .getState()
    .showToast(
      didSave
        ? { message: `Saved ${saved.dish.name}`, tone: "success" }
        : { message: `Couldn't save ${saved.dish.name}. Try again from the dish.`, tone: "error" },
    );
}
