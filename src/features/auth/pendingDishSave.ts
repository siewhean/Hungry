// A guest who taps Save on the onboarding result screen is sent to sign up. Email
// sign-up resets to EmailVerification (and the user may leave the app to read the
// email), which unmounts the result screen, so the dishes are kept on the device and
// saved once any sign-in or verification finishes (applySignedInProfile).

import { hungryPersistStorage } from "@/store/persistStorage";
import { useUIStore } from "@/store/useUIStore";
import type { DishDetail } from "@/types/domain";
import { saveDishesAfterSignIn } from "./finishGuestAction";

const PENDING_SAVE_STORAGE_NAME = "hungry-pending-dish-save-v2";
// The v1 key held a single dish; it is dropped, never attached to a later account.
const LEGACY_PENDING_SAVE_STORAGE_NAME = "hungry-pending-dish-save-v1";
// A save older than this is not attached to whichever account signs in later.
const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// The result grid shows four dishes; a few more covers the dish page backstop.
const MAX_PENDING_DISHES = 8;

type PendingDishSave = { dishes: DishDetail[]; savedAt: number };

// undefined = not read from storage yet; null = nothing pending.
let pending: PendingDishSave | null | undefined;

function isDish(value: unknown): value is DishDetail {
  const dish = value as Partial<DishDetail> | null | undefined;
  return typeof dish?.id === "string" && typeof dish.name === "string";
}

function isPendingDishSave(value: unknown): value is PendingDishSave {
  const candidate = value as Partial<PendingDishSave> | null | undefined;
  return (
    Array.isArray(candidate?.dishes) &&
    candidate.dishes.every(isDish) &&
    typeof candidate.savedAt === "number"
  );
}

function persistPending(): void {
  void Promise.resolve(
    pending && pending.dishes.length > 0
      ? hungryPersistStorage?.setItem(PENDING_SAVE_STORAGE_NAME, { state: pending, version: 0 })
      : hungryPersistStorage?.removeItem(PENDING_SAVE_STORAGE_NAME),
  ).catch(() => undefined);
}

/** Adds a dish to the ones a guest asked to save before they finish signing in. */
export function rememberPendingDishSave(dish: DishDetail): void {
  const others = (pending?.dishes ?? []).filter((item) => item.id !== dish.id);
  pending = { dishes: [...others, dish].slice(-MAX_PENDING_DISHES), savedAt: Date.now() };
  persistPending();
}

/** Takes one dish back out of the pending saves (the guest tapped its heart again). */
export function forgetPendingDishSave(dishId: string): void {
  if (!pending) return;
  pending = { ...pending, dishes: pending.dishes.filter((item) => item.id !== dishId) };
  persistPending();
}

/** Ids of the dishes waiting to be saved, as remembered in this app session. */
export function getPendingDishSaveIds(): string[] {
  return pending?.dishes.map((dish) => dish.id) ?? [];
}

/**
 * Drops remembered saves: the guest backed out of signing in ("Not now"), chose to sign
 * in to an existing account from Welcome, or signed out. They never attach to another account.
 */
export function clearPendingDishSave(): void {
  pending = null;
  void Promise.resolve(hungryPersistStorage?.removeItem(PENDING_SAVE_STORAGE_NAME)).catch(
    () => undefined,
  );
}

// Claims the pending saves so two callers never save them twice.
async function takePending(): Promise<PendingDishSave | null> {
  if (pending === undefined) {
    let stored: PendingDishSave | null = null;
    try {
      const value = (await hungryPersistStorage?.getItem(PENDING_SAVE_STORAGE_NAME))?.state;
      stored = isPendingDishSave(value) ? value : null;
    } catch {
      stored = null;
    }
    void Promise.resolve(hungryPersistStorage?.removeItem(LEGACY_PENDING_SAVE_STORAGE_NAME)).catch(
      () => undefined,
    );
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

function describeDishes(dishes: DishDetail[]): string {
  return dishes.length === 1 ? dishes[0].name : `${dishes.length} dishes`;
}

/** Saves the dishes a guest asked for before signing in. Safe to call on every sign-in. */
export async function flushPendingDishSave(now: number = Date.now()): Promise<void> {
  const saved = await takePending();
  if (!saved || saved.dishes.length === 0 || now - saved.savedAt > PENDING_MAX_AGE_MS) return;
  const failed = await saveDishesAfterSignIn(saved.dishes);
  useUIStore.getState().showToast(
    failed.length === 0
      ? { message: `Saved ${describeDishes(saved.dishes)}`, tone: "success" }
      : {
          message: `Couldn't save ${describeDishes(failed)}. Try again from the dish.`,
          tone: "error",
        },
  );
}
