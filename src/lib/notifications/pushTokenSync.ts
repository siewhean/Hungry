/**
 * Binds this device's push token to the account again after every sign-in.
 *
 * Sign-out and an account-deletion request unbind the token (the server row is
 * deleted), but the saved alert preferences stay on. Without this, Settings
 * shows alerts on while no push can reach the phone. Registration never asks
 * for permission here: it is a no-op unless the user already allowed
 * notifications.
 */

import { useSessionStore } from "@/store/useSessionStore";

type SessionSnapshot = {
  isAuthReady: boolean;
  isAuthenticated: boolean;
  authenticatedUserId?: string | null;
};

/** Calls `register` once per signed-in account, and again after each new sign-in. */
export function subscribePushTokenSync(
  register: () => Promise<unknown>,
  onError: (error: unknown) => void = () => undefined,
): () => void {
  let registeredFor: string | null = null;

  const sync = (state: SessionSnapshot) => {
    // Wait for the restored session to be confirmed before binding the token to it.
    if (!state.isAuthReady) return;
    if (!state.isAuthenticated) {
      registeredFor = null;
      return;
    }
    const accountKey = state.authenticatedUserId ?? "signed-in";
    if (registeredFor === accountKey) return;
    registeredFor = accountKey;
    // A failure waits for the next sign-in rather than retrying on every store change.
    void register().catch(onError);
  };

  sync(useSessionStore.getState());
  return useSessionStore.subscribe(sync);
}
