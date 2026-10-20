import { useCallback } from "react";

import { useSessionStore, type PendingRoute } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";

// Guests can browse; anything that saves needs an account. Returns true when signed
// in. Otherwise it opens the sign-in sheet (SignInPromptSheet), returns the guest to
// `returnRoute` after sign-in and then runs `onSignedIn` to finish the save/like/follow.
export function useRequireAccount() {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const openSignInPrompt = useUIStore((state) => state.openSignInPrompt);

  return useCallback(
    (message: string, returnRoute: string | PendingRoute, onSignedIn?: () => void) => {
      if (isAuthenticated) return true;
      setReturnRoute(returnRoute);
      openSignInPrompt({ title: message.replace(/\.$/, "") }, onSignedIn);
      return false;
    },
    [isAuthenticated, openSignInPrompt, setReturnRoute],
  );
}
