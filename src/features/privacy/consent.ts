/**
 * The two privacy choices App Review asks for, and how they follow the person's account.
 *
 *  - Usage analytics (5.1.1(ii)): asked once. The answer takes effect on this device at once
 *    (`useUIStore.analyticsEnabled` drives PostHog) and is saved on the account, so signing in on
 *    another phone does not ask again.
 *  - AI features (5.1.2(i)): typed search text goes to Anthropic and a menu photo goes to Google,
 *    so each needs an explicit yes. One yes covers both and is saved on the account before the
 *    app acts on it; the mood-search and ingest-menu-photo Edge Functions check it again.
 */
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useConsentStore } from "@/store/useConsentStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";

/**
 * Holds analytics off on a phone that has not been asked yet (a new install, or one from before
 * the question existed) once both stores have been read back from storage. Whatever was tracked
 * before this is dropped, not sent late.
 */
export function enforcePreConsentAnalytics(): () => void {
  const apply = () => {
    if (!useConsentStore.persist.hasHydrated() || !useUIStore.persist.hasHydrated()) return;
    if (!useConsentStore.getState().analyticsAsked)
      useUIStore.getState().setAnalyticsEnabled(false);
  };
  apply();
  const stops = [
    useConsentStore.persist.onFinishHydration(apply),
    useUIStore.persist.onFinishHydration(apply),
  ];
  return () => stops.forEach((stop) => stop());
}

/**
 * Records the analytics answer: on this device now, then on the account. A signed-out answer
 * (first run) is saved by `syncConsentsWithAccount` after sign-in. A save that fails does not
 * undo the choice (a decline must not wait on the network); the next sign-in saves it.
 */
export async function answerAnalyticsConsent(granted: boolean): Promise<void> {
  useUIStore.getState().setAnalyticsEnabled(granted);
  useConsentStore.getState().setAnalyticsAsked(true);
  // Declining sends nothing, not even this change.
  if (granted) trackAnalyticsEvent("settings_changed", { setting: "usage_analytics", value: true });
  if (!useSessionStore.getState().isAuthenticated) return;
  try {
    await getHungryService().privacy.saveConsents({ analytics: granted });
  } catch (error) {
    reportError(error, { area: "consent_analytics_save" });
  }
}

/**
 * Saves the AI-search choice on the account, and only then changes the app, so the switch never
 * shows "allowed" for a choice the server does not have. Throws when it cannot save.
 */
export async function setAiSearchConsent(allowed: boolean): Promise<void> {
  await getHungryService().privacy.saveConsents({ aiSearch: allowed });
  useConsentStore.getState().setAiSearchAllowed(allowed);
}

/**
 * After sign-in: take the account's answers (an answer given on another phone wins), or save this
 * phone's analytics answer when the account has none yet.
 */
export async function syncConsentsWithAccount(): Promise<void> {
  const account = await getHungryService().privacy.getConsents();
  const consent = useConsentStore.getState();
  consent.setAiSearchAllowed(account.aiSearch);
  if (account.analytics !== null) {
    useUIStore.getState().setAnalyticsEnabled(account.analytics);
    consent.setAnalyticsAsked(true);
  } else if (consent.analyticsAsked) {
    await getHungryService().privacy.saveConsents({
      analytics: useUIStore.getState().analyticsEnabled,
    });
  }
  // Only now do we know whether the person still has to be asked.
  consent.setAccountChecked(true);
}

/**
 * Runs `syncConsentsWithAccount` once per signed-in account, and forgets the account's AI-search
 * answer at sign-out so the next person on this phone does not inherit it.
 */
export function subscribeConsentSync(
  onError: (error: unknown) => void = () => undefined,
): () => void {
  let syncedFor: string | null = null;

  const sync = (state: {
    isAuthReady: boolean;
    isAuthenticated: boolean;
    authenticatedUserId?: string | null;
  }) => {
    if (!state.isAuthReady) return;
    if (!state.isAuthenticated) {
      if (syncedFor !== null) {
        useConsentStore.getState().setAiSearchAllowed(false);
        useConsentStore.getState().setAccountChecked(false);
      }
      syncedFor = null;
      return;
    }
    const accountKey = state.authenticatedUserId ?? "signed-in";
    if (syncedFor === accountKey) return;
    syncedFor = accountKey;
    // A failure waits for the next sign-in rather than retrying on every store change.
    void syncConsentsWithAccount().catch(onError);
  };

  sync(useSessionStore.getState());
  return useSessionStore.subscribe(sync);
}

let pendingAiSearchAsk: Promise<boolean> | null = null;

/**
 * Call before sending typed text to the AI provider. Resolves true at once when the account has
 * allowed AI search; otherwise shows the "sent to Anthropic" notice and resolves with the answer.
 * Two callers at the same time share one notice.
 */
export function ensureAiSearchConsent(): Promise<boolean> {
  if (useConsentStore.getState().aiSearchAllowed) return Promise.resolve(true);
  if (pendingAiSearchAsk) return pendingAiSearchAsk;
  pendingAiSearchAsk = new Promise<boolean>((resolve) => {
    useConsentStore.getState().openAiSearchNotice((allowed) => {
      pendingAiSearchAsk = null;
      resolve(allowed);
    });
  });
  return pendingAiSearchAsk;
}
