import { useEffect, useState } from "react";

import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { ProfileRelationship } from "@/lib/services/types";

/**
 * "Follows you" and the mutual followers line for one profile. Null while loading, for yourself,
 * signed out, or when the read fails (reported): the header simply leaves the line out.
 * `reloadKey` re-reads after the viewer follows or unfollows (the mutual line can change).
 */
export function useProfileRelationship(
  userId: string | undefined,
  enabled: boolean,
  reloadKey: unknown = 0,
): ProfileRelationship | null {
  const [relationship, setRelationship] = useState<{
    userId: string;
    value: ProfileRelationship | null;
  } | null>(null);

  useEffect(() => {
    if (!userId || !enabled) return;
    let isActive = true;
    void getHungryService()
      .social.getProfileRelationship(userId)
      .then((value) => {
        if (isActive) setRelationship({ userId, value });
      })
      .catch((error) => {
        reportError(error, { screen: "UserProfile", action: "load_profile_relationship" });
      });
    return () => {
      isActive = false;
    };
  }, [enabled, reloadKey, userId]);

  if (!enabled || !relationship || relationship.userId !== userId) return null;
  return relationship.value;
}
