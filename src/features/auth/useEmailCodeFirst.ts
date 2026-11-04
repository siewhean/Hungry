import { useExperimentVariant } from "@/lib/experiments/experiments";
import { useSessionStore } from "@/store/useSessionStore";

/**
 * True when Login, Create account and the onboarding account step lead with the emailed code
 * instead of a password. It is a staged release (auth_email_code_first_v1): everyone gets the
 * code form unless a PostHog flag of that key says "control". Exposure is recorded only for a
 * signed-out person, who is the one looking at the form; a signed-in one sees the same arm.
 */
export function useEmailCodeFirst(): boolean {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  return (
    useExperimentVariant("auth_email_code_first_v1", { expose: !isAuthenticated }) === "email_code"
  );
}
