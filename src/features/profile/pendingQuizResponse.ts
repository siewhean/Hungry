// A guest who takes the taste quiz has no account to save the answers to yet.
// Keep the latest answers on the device and record them once the guest signs up
// or signs in (applySignedInProfile flushes them), instead of dropping them.

import { getHungryService } from "@/lib/services/serviceProvider";
import { hungryPersistStorage } from "@/store/persistStorage";
import { useSessionStore } from "@/store/useSessionStore";
import type { TasteVector } from "@/types/domain";

const STORAGE_KEY = "hungry-pending-quiz-response-v1";
// Answers older than this are not attached to whichever account signs in later.
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type PendingQuizResponse = {
  responses: Record<string, unknown>;
  tasteVector: TasteVector;
  savedAt: number;
};

// undefined = not read from storage yet; null = nothing pending.
let pending: PendingQuizResponse | null | undefined;

function isPendingQuizResponse(value: unknown): value is PendingQuizResponse {
  const candidate = value as Partial<PendingQuizResponse> | null | undefined;
  return (
    Boolean(candidate) &&
    typeof candidate?.responses === "object" &&
    typeof candidate?.tasteVector === "object" &&
    typeof candidate?.savedAt === "number"
  );
}

async function readPending(): Promise<PendingQuizResponse | null> {
  if (pending !== undefined) return pending;
  try {
    const stored = await hungryPersistStorage?.getItem(STORAGE_KEY);
    pending = isPendingQuizResponse(stored?.state) ? stored.state : null;
  } catch {
    pending = null;
  }
  return pending;
}

function clearPending(): void {
  pending = null;
  void Promise.resolve(hungryPersistStorage?.removeItem(STORAGE_KEY)).catch(() => undefined);
}

/** Records the quiz now when signed in, otherwise keeps it until the user signs in. */
export function recordQuizResponse(
  responses: Record<string, unknown>,
  tasteVector: TasteVector,
): void {
  if (useSessionStore.getState().isAuthenticated) {
    void getHungryService()
      .profile.recordQuizResponse(responses, tasteVector)
      .catch(() => undefined);
    return;
  }
  pending = { responses, tasteVector, savedAt: Date.now() };
  void Promise.resolve(
    hungryPersistStorage?.setItem(STORAGE_KEY, { state: pending, version: 0 }),
  ).catch(() => undefined);
}

/** Saves answers a guest gave before signing in. Safe to call on every sign-in. */
export async function flushPendingQuizResponse(now: number = Date.now()): Promise<void> {
  const saved = await readPending();
  if (!saved) return;
  clearPending();
  if (now - saved.savedAt > PENDING_MAX_AGE_MS) return;
  await getHungryService()
    .profile.recordQuizResponse(saved.responses, saved.tasteVector)
    .catch(() => undefined);
}
