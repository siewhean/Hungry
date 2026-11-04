import { useConsentStore } from "@/store/useConsentStore";
import { useSessionStore } from "@/store/useSessionStore";

import { AnalyticsConsentDialog } from "./AnalyticsConsentDialog";

/**
 * Asks the analytics question of a signed-in person who has not answered on this phone or on
 * their account (someone who signed in without going through Welcome, or an install from before
 * the question existed). Waits until the account's answers are read so it never asks twice.
 */
export function AnalyticsConsentPrompt() {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const accountChecked = useConsentStore((state) => state.accountChecked);
  const analyticsAsked = useConsentStore((state) => state.analyticsAsked);
  return <AnalyticsConsentDialog visible={isAuthenticated && accountChecked && !analyticsAsked} />;
}
