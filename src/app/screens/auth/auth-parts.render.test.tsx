// The small pieces the auth screens share, rendered on their own. Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { createElement, useState } from "react";

import { AuthProviderButtons } from "@/app/screens/auth/AuthProviderButtons";
import { AuthTextLink } from "@/app/screens/auth/AuthTextLink";
import { DisplayNameField } from "@/app/screens/auth/DisplayNameField";
import { EmailCodeEntry } from "@/app/screens/auth/EmailCodeEntry";
import { EmailSuggestionHint, useEmailSuggestion } from "@/app/screens/auth/EmailSuggestion";
import { ProfileSyncFailureBanner } from "@/app/screens/auth/ProfileSyncFailureBanner";
import { useEmailCodeFirst } from "@/features/auth/useEmailCodeFirst";
import { AppText } from "@/components/ui";
import { clearTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  clearExperimentOverrides,
  resetExperimentSession,
  setExperimentFlagSource,
  setExperimentOverride,
} from "@/lib/experiments/experiments";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { cleanup, render, type RenderResult } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

beforeEach(async () => {
  clearTrackedAnalyticsEvents();
  await enterScenario("guest");
});
afterEach(async () => {
  await cleanup();
  setExperimentFlagSource(undefined);
  resetExperimentSession();
  clearExperimentOverrides();
});

const inputs = (view: RenderResult) =>
  Array.from(view.container.ownerDocument.querySelectorAll("input")) as HTMLInputElement[];

test("AuthTextLink is a 44pt button that presses, and does nothing while disabled", async () => {
  let presses = 0;
  const view = await render(
    createElement(AuthTextLink, { label: "Wrong email? Change it", onPress: () => (presses += 1) }),
  );
  const link = view.findByLabel("Wrong email? Change it")!;
  assert.match(link.getAttribute("style") ?? "", /min-height: 44px/);
  await view.press(link);
  assert.equal(presses, 1);
  await view.rerender(
    createElement(AuthTextLink, {
      label: "Wrong email? Change it",
      disabled: true,
      onPress: () => (presses += 1),
    }),
  );
  await view.press(view.findByLabel("Wrong email? Change it"));
  assert.equal(presses, 1);
});

test("DisplayNameField caps the name at 40 and counts what is typed", async () => {
  function Harness() {
    const [value, setValue] = useState("");
    return createElement(DisplayNameField, { value, onChangeText: setValue });
  }
  const view = await render(createElement(Harness));
  assert.equal(inputs(view)[0].getAttribute("maxlength"), "40");
  assert.match(view.text(), /0\/40/);
  await view.type(inputs(view)[0], "Mei Tan");
  assert.match(view.text(), /7\/40/);
  assert.ok(view.findByLabel("7 of 40 characters"));
});

test("DisplayNameField shows its label and a one-line helper beside the counter", async () => {
  const view = await render(
    createElement(DisplayNameField, { value: "", onChangeText: () => undefined }),
  );
  assert.match(view.text(), /Name shown on your reviews/);
  assert.match(view.text(), /A nickname is fine/);
  assert.ok(!inputs(view)[0].getAttribute("placeholder"));
});

test("EmailSuggestionHint stays out of the way until there is a suggestion, then accepts it", async () => {
  const accepted: string[] = [];
  const view = await render(
    createElement(EmailSuggestionHint, {
      suggestion: null,
      onAccept: (value: string) => accepted.push(value),
    }),
  );
  assert.equal(view.text(), "");
  await view.rerender(
    createElement(EmailSuggestionHint, {
      suggestion: "mei@gmail.com",
      onAccept: (value: string) => accepted.push(value),
    }),
  );
  assert.match(view.text(), /Did you mean/);
  await view.press(view.findByLabel("Use this address: mei@gmail.com"));
  assert.deepEqual(accepted, ["mei@gmail.com"]);
});

test("useEmailSuggestion suggests on check and clears on the next edit", async () => {
  let api!: ReturnType<typeof useEmailSuggestion>;
  function Harness() {
    api = useEmailSuggestion();
    return createElement(AppText, null, api.suggestion ?? "none");
  }
  const view = await render(createElement(Harness));
  assert.equal(view.text(), "none");
  api.check("mei@gmial.com");
  await view.settle();
  assert.equal(view.text(), "mei@gmail.com");
  api.clear();
  await view.settle();
  assert.equal(view.text(), "none");
});

test("ProfileSyncFailureBanner is an alert whose Try again retries", async () => {
  let retries = 0;
  const view = await render(
    createElement(ProfileSyncFailureBanner, { onRetry: () => (retries += 1), retrying: false }),
  );
  assert.ok(view.container.querySelector('[role="alert"]'));
  assert.match(view.text(), /couldn't load your taste profile/);
  await view.press(view.findByText("Try again"));
  assert.equal(retries, 1);
});

test("AuthProviderButtons lists the enabled providers with the divider, and tells which was pressed", async () => {
  const pressed: string[] = [];
  const view = await render(
    createElement(AuthProviderButtons, {
      disabled: false,
      divider: "or use email",
      onPress: (provider: string) => pressed.push(provider),
    }),
  );
  assert.match(view.text(), /or use email/);
  const google = view.findByLabel("Continue with Google");
  assert.ok(google, "Google is offered on web when its flag is on");
  await view.press(google);
  assert.deepEqual(pressed, ["google"]);

  await view.rerender(
    createElement(AuthProviderButtons, {
      disabled: true,
      divider: "or use email",
      intent: "signIn",
      onPress: (provider: string) => pressed.push(provider),
    }),
  );
  await view.press(view.findByLabel("Sign in with Google"));
  assert.deepEqual(pressed, ["google"], "a disabled button does not fire");
});

test("EmailCodeEntry signs a returning person in with only an email, and offers a password", async () => {
  let signedIn = 0;
  let usedPassword = 0;
  const auth = getHungryService().auth;
  const originalSend = auth.signInWithEmailCode;
  auth.signInWithEmailCode = (async () => undefined) as typeof auth.signInWithEmailCode;
  try {
    const view = await render(
      createElement(EmailCodeEntry, {
        screen: "login",
        askName: false,
        initialEmail: "mei@example.sg",
        onSignedIn: () => {
          signedIn += 1;
        },
        onUsePassword: () => {
          usedPassword += 1;
        },
      }),
    );
    assert.equal(inputs(view).length, 1);
    assert.equal(inputs(view)[0].value, "mei@example.sg");
    await view.press(view.findByText("Use a password instead"));
    assert.equal(usedPassword, 1);
    await view.press(view.findByText("Email me a code"));
    await view.settle();
    await view.type(inputs(view)[0], "12345678");
    await view.settle();
    assert.equal(signedIn, 1);
    assert.equal(
      useSessionStore.getState().isAuthenticated,
      false,
      "the screen's own onSignedIn finishes sign-in",
    );
  } finally {
    auth.signInWithEmailCode = originalSend;
  }
});

test("useEmailCodeFirst follows the rollout flag, and a flag saying control turns it off", async () => {
  function Harness() {
    return createElement(AppText, null, useEmailCodeFirst() ? "code" : "password");
  }
  const view = await render(createElement(Harness));
  assert.equal(view.text(), "code");
  await cleanup();
  setExperimentOverride("auth_email_code_first_v1", "control");
  const control = await render(createElement(Harness));
  assert.equal(control.text(), "password");
});
