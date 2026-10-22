// Session scenarios for render tests: who is looking at the screen.

import { merchantAccount } from "@/lib/services/mock/data";
import { getHungryService, setMockServiceProvider } from "@/lib/services/serviceProvider";
import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import { useMerchantStore } from "@/store/useMerchantStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";

export type Scenario = "guest" | "user" | "merchant";

/** Puts every store into a known state for the scenario. Mock data source, no network. */
export async function enterScenario(scenario: Scenario): Promise<void> {
  setConfiguredDataSource("mock");
  setMockServiceProvider();
  // Drop whatever the previous scenario left in account-scoped stores (social, activity, profile).
  useSessionStore.getState().clearSession();
  useUIStore.setState({ toast: null, signInPrompt: null, safetyMenu: null });
  useMerchantStore.getState().setAccount(null);
  useMerchantStore.getState().setMerchantModeActive(false);
  useMerchantStore.getState().setDeveloperMerchantMode(false);

  const session = useSessionStore.getState();
  if (scenario === "guest") {
    useSessionStore.setState({ isAuthenticated: false });
    return;
  }

  const signedIn = await getHungryService().auth.signIn("weiming@example.sg", "dev-password");
  if (!signedIn) throw new Error("Mock sign-in failed; render tests cannot run.");
  useProfileStore.getState().applyProfile(signedIn.profile);
  session.completeAuth();
  session.completeOnboarding(false);

  if (scenario === "merchant") {
    useMerchantStore.getState().setAccount(JSON.parse(JSON.stringify(merchantAccount)));
    useMerchantStore.getState().setMerchantModeActive(true);
  }
}
