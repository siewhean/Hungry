import { useCallback, useRef, useState } from "react";

import { reportError } from "@/lib/monitoring/reportError";
import type { Session } from "@/lib/services/types";
import { applySignedInProfile } from "./applySignedInProfile";

interface ApplyOptions {
  /** Shown when the account is in but part of the taste profile could not sync yet. */
  onSyncWarning: () => void;
  /** Runs once the profile is in: the screen's own completeAuth. Not run when the sync failed. */
  onSynced: () => void | Promise<void>;
}

/**
 * A failed profile sync after sign-in used to end the handler with a bare `return`: the person
 * was signed in (the auth listener had already seen the session) yet got no message and their
 * onboarding answers were never merged. This keeps the failure on screen: `failed` drives a
 * banner with a "Try again" that re-runs the same sync and then `onSynced`, and every failure
 * reaches error tracking.
 */
export function useSignedInProfileSync(screen: string) {
  const [failed, setFailed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryRef = useRef<(() => Promise<boolean>) | null>(null);

  /** Resolves true when the profile is in and `onSynced` ran. */
  const apply = useCallback(
    async (session: Session, options: ApplyOptions): Promise<boolean> => {
      const run = async (): Promise<boolean> => {
        try {
          const migration = await applySignedInProfile(session.profile, {
            profileReady: session.profileReady,
            onSyncWarning: options.onSyncWarning,
          });
          if (migration.status === "failed") {
            reportError(migration.error ?? new Error("Signed-in profile sync failed"), {
              screen,
              action: "profile_sync",
            });
            setFailed(true);
            return false;
          }
        } catch (error) {
          reportError(error, { screen, action: "profile_sync" });
          setFailed(true);
          return false;
        }
        setFailed(false);
        await options.onSynced();
        return true;
      };
      retryRef.current = run;
      return run();
    },
    [screen],
  );

  const retry = useCallback(async () => {
    const run = retryRef.current;
    if (!run || isRetrying) return;
    setIsRetrying(true);
    try {
      await run();
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying, screen]);

  return { failed, isRetrying, apply, retry };
}
