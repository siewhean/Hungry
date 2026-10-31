// The one-time analytics question (Welcome and the signed-in prompt) and the "sent to Anthropic"
// notice, checked in a rendered tree (react-native-web + jsdom, mock data). Run with
// `node scripts/test-render.mjs src/features/privacy/consent.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement, Fragment } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { WelcomeScreen } from "@/app/screens/onboarding/WelcomeScreen";
import { isAnalyticsEnabled } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useConsentStore } from "@/store/useConsentStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, createFakeNavigation, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

import { AiSearchConsentPrompt } from "./AiSearchConsentPrompt";
import { AnalyticsConsentDialog } from "./AnalyticsConsentDialog";
import { AnalyticsConsentPrompt } from "./AnalyticsConsentPrompt";
import { ensureAiSearchConsent } from "./consent";

beforeEach(async () => {
  await enterScenario("guest");
  useUIStore.getState().setAnalyticsEnabled(true);
  await getHungryService().privacy.saveConsents({ analytics: null, aiSearch: false });
});

afterEach(async () => {
  await cleanup();
});

const QUESTION = "Help improve Hungry?";

test("Welcome asks the analytics question before the first step; Don't share continues with analytics off", async () => {
  useConsentStore.setState({ analyticsAsked: false });
  const navigation = createFakeNavigation();
  const view = await renderScreen(WelcomeScreen as never, {
    name: "OnboardingWelcome",
    navigation,
  });
  assert.equal(view.findByText(QUESTION), null, "not shown until Get started");

  await view.press(view.findByText("Get started"));
  assert.ok(view.findByText(QUESTION), "the question is on screen");
  assert.ok(view.findByText("Share usage data"));
  assert.equal(navigation.calls.length, 0, "nothing opens until the person answers");

  await view.press(view.findByText("Don't share"));
  assert.equal(view.findByText(QUESTION), null);
  assert.ok(navigation.calls.some((call) => call.args[0] === "LocationPermission"));
  assert.equal(useConsentStore.getState().analyticsAsked, true);
  assert.equal(isAnalyticsEnabled(), false);
});

test("Welcome goes straight on once the question has been answered", async () => {
  useConsentStore.setState({ analyticsAsked: true });
  const navigation = createFakeNavigation();
  const view = await renderScreen(WelcomeScreen as never, {
    name: "OnboardingWelcome",
    navigation,
  });
  await view.press(view.findByText("Get started"));
  assert.equal(view.findByText(QUESTION), null);
  assert.ok(navigation.calls.some((call) => call.args[0] === "LocationPermission"));
});

test("the question names PostHog and the Settings switch, and offers both answers at equal weight", async () => {
  const view = await render(createElement(AnalyticsConsentDialog, { visible: true }));
  assert.match(view.text(), /PostHog/);
  assert.match(view.text(), /change this any time in Settings/);
  assert.match(view.text(), /Crash reports are still sent/);
  assert.ok(view.findByText("Share usage data"));
  assert.ok(view.findByText("Don't share"));
});

test("the signed-in prompt waits for the account check and never asks twice", async () => {
  const view = await render(createElement(AnalyticsConsentPrompt));
  const shown = () => view.findByText(QUESTION) !== null;

  useSessionStore.setState({ isAuthenticated: true });
  useConsentStore.setState({ analyticsAsked: false, accountChecked: false });
  await view.rerender(createElement(AnalyticsConsentPrompt));
  assert.equal(shown(), false, "the account's answer is not read yet");

  useConsentStore.setState({ accountChecked: true });
  await view.rerender(createElement(AnalyticsConsentPrompt));
  assert.equal(shown(), true);

  await view.press(view.findByText("Share usage data"));
  assert.equal(shown(), false);
  assert.equal(useConsentStore.getState().analyticsAsked, true);
  assert.equal(isAnalyticsEnabled(), true);
  assert.equal((await getHungryService().privacy.getConsents()).analytics, true);
});

test("the AI notice says what is sent to Anthropic and Google; Allow saves it and lets the feature go on", async () => {
  const view = await render(createElement(Fragment, null, createElement(AiSearchConsentPrompt)));
  const ask = ensureAiSearchConsent();
  await view.settle();
  assert.match(view.text(), /Allow AI features\?/);
  assert.match(view.text(), /words you type in search go to Anthropic/);
  assert.match(view.text(), /menu photo you add goes to Google/);
  assert.match(view.text(), /name, email and account details are not sent/);
  assert.match(view.text(), /turn this off any time in Settings under Privacy & data/);

  await view.press(view.findByText("Allow AI"));
  assert.equal(await ask, true);
  assert.equal(useConsentStore.getState().aiSearchAllowed, true);
  assert.equal((await getHungryService().privacy.getConsents()).aiSearch, true);
  assert.equal(view.findByText("Allow AI"), null, "the notice closes");
});

test("Not now declines without saving anything, and a failed save does not let the search go on", async () => {
  const view = await render(createElement(AiSearchConsentPrompt));

  let ask = ensureAiSearchConsent();
  await view.settle();
  await view.press(view.findByText("Not now"));
  assert.equal(await ask, false);
  assert.equal(useConsentStore.getState().aiSearchAllowed, false);
  assert.equal((await getHungryService().privacy.getConsents()).aiSearch, false);

  const privacy = getHungryService().privacy;
  const original = privacy.saveConsents;
  privacy.saveConsents = async () => {
    throw new Error("offline");
  };
  try {
    ask = ensureAiSearchConsent();
    await view.settle();
    await view.press(view.findByText("Allow AI"));
    assert.equal(await ask, false);
    assert.equal(useConsentStore.getState().aiSearchAllowed, false);
    assert.equal(useUIStore.getState().toast?.tone, "error");
  } finally {
    privacy.saveConsents = original;
  }
});
