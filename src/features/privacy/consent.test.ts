// App Review 5.1.1(ii) and 5.1.2(i): the analytics question is asked once and follows the account;
// AI search needs a saved yes. Runs against the mock service with the real stores.

import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  clearTrackedAnalyticsEvents,
  getTrackedAnalyticsEvents,
  isAnalyticsEnabled,
} from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useConsentStore } from "@/store/useConsentStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";

import {
  answerAnalyticsConsent,
  enforcePreConsentAnalytics,
  ensureAiSearchConsent,
  setAiSearchConsent,
  subscribeConsentSync,
  syncConsentsWithAccount,
} from "./consent";

async function saveOnAccount(
  consents: Parameters<ReturnType<typeof getHungryService>["privacy"]["saveConsents"]>[0],
) {
  await getHungryService().privacy.saveConsents(consents);
}

beforeEach(async () => {
  useConsentStore.setState({
    analyticsAsked: false,
    aiSearchAllowed: false,
    accountChecked: false,
    aiSearchNotice: null,
  });
  useUIStore.getState().setAnalyticsEnabled(true);
  useSessionStore.setState({
    isAuthenticated: false,
    isAuthReady: true,
    authenticatedUserId: null,
  });
  // The mock account starts with nothing answered.
  await saveOnAccount({ analytics: null, aiSearch: false });
  clearTrackedAnalyticsEvents();
});

test("a phone that has not been asked sends no analytics, and an answered one is left alone", () => {
  const stop = enforcePreConsentAnalytics();
  assert.equal(useUIStore.getState().analyticsEnabled, false);
  assert.equal(isAnalyticsEnabled(), false);
  stop();

  useConsentStore.setState({ analyticsAsked: true });
  useUIStore.getState().setAnalyticsEnabled(true);
  enforcePreConsentAnalytics()();
  assert.equal(useUIStore.getState().analyticsEnabled, true);
  assert.equal(isAnalyticsEnabled(), true);
});

test("yes switches analytics on and says so; no switches it off and sends nothing", async () => {
  await answerAnalyticsConsent(true);
  assert.equal(useConsentStore.getState().analyticsAsked, true);
  assert.equal(isAnalyticsEnabled(), true);
  assert.deepEqual(
    getTrackedAnalyticsEvents().map((record) => [record.event, record.properties]),
    [["settings_changed", { setting: "usage_analytics", value: true }]],
  );

  clearTrackedAnalyticsEvents();
  await answerAnalyticsConsent(false);
  assert.equal(useUIStore.getState().analyticsEnabled, false);
  assert.equal(isAnalyticsEnabled(), false);
  assert.deepEqual(getTrackedAnalyticsEvents(), []);
});

test("an answer given while signed in is saved on the account; one given signed out waits for sign-in", async () => {
  await answerAnalyticsConsent(false);
  assert.equal((await getHungryService().privacy.getConsents()).analytics, null);

  useSessionStore.setState({ isAuthenticated: true });
  await answerAnalyticsConsent(true);
  assert.equal((await getHungryService().privacy.getConsents()).analytics, true);
});

test("a failed account save keeps the person's choice on this phone", async () => {
  const privacy = getHungryService().privacy;
  const original = privacy.saveConsents;
  privacy.saveConsents = async () => {
    throw new Error("offline");
  };
  try {
    useSessionStore.setState({ isAuthenticated: true });
    await answerAnalyticsConsent(false);
    assert.equal(useUIStore.getState().analyticsEnabled, false);
    assert.equal(useConsentStore.getState().analyticsAsked, true);
  } finally {
    privacy.saveConsents = original;
  }
});

test("sign-in takes the account's answers: an answer from another phone wins and nothing is asked again", async () => {
  await saveOnAccount({ analytics: false, aiSearch: true });
  await syncConsentsWithAccount();
  const state = useConsentStore.getState();
  assert.deepEqual(
    [state.analyticsAsked, state.aiSearchAllowed, state.accountChecked],
    [true, true, true],
  );
  assert.equal(useUIStore.getState().analyticsEnabled, false);
  assert.equal(isAnalyticsEnabled(), false);
});

test("sign-in saves this phone's answer when the account has none, and leaves the question for a person asked nowhere", async () => {
  useConsentStore.setState({ analyticsAsked: true });
  useUIStore.getState().setAnalyticsEnabled(false);
  await syncConsentsWithAccount();
  assert.equal((await getHungryService().privacy.getConsents()).analytics, false);

  useConsentStore.setState({ analyticsAsked: false, accountChecked: false });
  await saveOnAccount({ analytics: null });
  await syncConsentsWithAccount();
  const state = useConsentStore.getState();
  assert.deepEqual([state.analyticsAsked, state.accountChecked], [false, true]);
});

test("AI search is allowed only after the choice is saved on the account", async () => {
  await setAiSearchConsent(true);
  assert.equal(useConsentStore.getState().aiSearchAllowed, true);
  assert.equal((await getHungryService().privacy.getConsents()).aiSearch, true);
  await setAiSearchConsent(false);
  assert.equal(useConsentStore.getState().aiSearchAllowed, false);

  const privacy = getHungryService().privacy;
  const original = privacy.saveConsents;
  privacy.saveConsents = async () => {
    throw new Error("offline");
  };
  try {
    await assert.rejects(() => setAiSearchConsent(true));
    assert.equal(
      useConsentStore.getState().aiSearchAllowed,
      false,
      "the switch never claims a yes the server lacks",
    );
  } finally {
    privacy.saveConsents = original;
  }
});

test("ensureAiSearchConsent passes at once when allowed, otherwise opens one shared notice", async () => {
  useConsentStore.setState({ aiSearchAllowed: true });
  assert.equal(await ensureAiSearchConsent(), true);
  assert.equal(useConsentStore.getState().aiSearchNotice, null);

  useConsentStore.setState({ aiSearchAllowed: false });
  const first = ensureAiSearchConsent();
  const second = ensureAiSearchConsent();
  assert.ok(useConsentStore.getState().aiSearchNotice, "the notice is open");
  useConsentStore.getState().aiSearchNotice?.answer(false);
  assert.deepEqual(await Promise.all([first, second]), [false, false]);

  const third = ensureAiSearchConsent();
  useConsentStore.getState().aiSearchNotice?.answer(true);
  assert.equal(await third, true, "a later ask opens a fresh notice");
});

test("the account sync runs once per account, and sign-out forgets the AI-search yes", async () => {
  await saveOnAccount({ aiSearch: true });
  const errors: unknown[] = [];
  const stop = subscribeConsentSync((error) => errors.push(error));
  try {
    useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: "user-1" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(useConsentStore.getState().aiSearchAllowed, true);
    assert.equal(useConsentStore.getState().accountChecked, true);

    useSessionStore.setState({ isAuthenticated: false, authenticatedUserId: null });
    assert.equal(useConsentStore.getState().aiSearchAllowed, false);
    assert.equal(useConsentStore.getState().accountChecked, false);
    assert.deepEqual(errors, []);
  } finally {
    stop();
  }
});
