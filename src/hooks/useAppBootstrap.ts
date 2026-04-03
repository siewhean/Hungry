import { useEffect } from "react";

import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";

export function useAppBootstrap() {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const syncProfile = useProfileStore((state) => state.syncProfile);

  useEffect(() => {
    syncProfile(isAuthenticated);
  }, [isAuthenticated, syncProfile]);
}

