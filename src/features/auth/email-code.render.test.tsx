// The emailed-code field and the provider button, rendered. Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { createElement } from "react";

import {
  AuthProviderButton,
  PROVIDER_LOGO_FLOW_FONT_SCALE,
  shouldFlowProviderLogo,
} from "@/app/screens/auth/AuthProviderButton";
import { EmailCodeField } from "@/features/auth/EmailCodeField";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { cleanup, render, type RenderResult } from "@/test/render";

beforeEach(() => clearTrackedAnalyticsEvents());
afterEach(cleanup);

const codeInput = (view: RenderResult) =>
  view.container.ownerDocument.querySelector("input") as HTMLInputElement;

const submittedEvents = () =>
  getTrackedAnalyticsEvents().filter((event) => event.event === "email_code_submitted");

test("EmailCodeField submits by itself on the eighth digit, once", async () => {
  const submitted: string[] = [];
  const view = await render(
    createElement(EmailCodeField, {
      screen: "login",
      onSubmit: async (code: string) => {
        submitted.push(code);
      },
    }),
  );
  await view.type(codeInput(view), "1234567");
  assert.deepEqual(submitted, []);
  await view.type(codeInput(view), "12345678");
  await view.settle();
  assert.deepEqual(submitted, ["12345678"]);
  assert.equal(submittedEvents().length, 1);
  assert.equal(submittedEvents()[0].properties.auto, true);
});

test("a wrong code is announced as an alert, clears the field, and a new code is tried", async () => {
  let attempts = 0;
  const view = await render(
    createElement(EmailCodeField, {
      screen: "login",
      onSubmit: async () => {
        attempts += 1;
        throw new Error("nope");
      },
    }),
  );
  await view.type(codeInput(view), "12345678");
  await view.settle();
  assert.equal(attempts, 1);
  assert.match(view.text(), /wrong or has expired|nope|try again/i);
  const alert = view.container.ownerDocument.querySelector('[role="alert"]');
  assert.ok(alert, "the message is exposed as an alert");
  assert.match(alert.textContent ?? "", /wrong or has expired|nope|try again/i);

  // The wrong digits are gone, so the retry starts from an empty field.
  assert.equal(codeInput(view).value, "");

  // The same eight digits typed again are a new attempt, not a repeat of the last one.
  await view.type(codeInput(view), "12345678");
  await view.settle();
  assert.equal(attempts, 2);

  await view.type(codeInput(view), "87654321");
  await view.settle();
  assert.equal(attempts, 3);
});

test("a pasted code with a space is cleaned and reported as a paste", async () => {
  const submitted: string[] = [];
  const view = await render(
    createElement(EmailCodeField, {
      screen: "onboarding_auth",
      onSubmit: async (code: string) => {
        submitted.push(code);
      },
    }),
  );
  await view.type(codeInput(view), "1234 5678");
  await view.settle();
  assert.deepEqual(submitted, ["12345678"]);
  assert.deepEqual(submittedEvents()[0].properties, {
    screen: "onboarding_auth",
    auto: true,
    paste: true,
  });
});

test("the field says what it wants and has no event without a screen", async () => {
  const view = await render(createElement(EmailCodeField, { onSubmit: async () => undefined }));
  assert.equal(codeInput(view).getAttribute("placeholder"), "8-digit code");
  await view.type(codeInput(view), "12345678");
  await view.settle();
  assert.equal(submittedEvents().length, 0);
});

test("the provider logo stays pinned in a normal native row and joins the label when it cannot fit", async () => {
  assert.equal(shouldFlowProviderLogo(1, false), false);
  assert.equal(shouldFlowProviderLogo(PROVIDER_LOGO_FLOW_FONT_SCALE, false), false);
  assert.equal(shouldFlowProviderLogo(PROVIDER_LOGO_FLOW_FONT_SCALE + 0.1, false), true);
  assert.equal(shouldFlowProviderLogo(1, true), true);
  // Web zoom changes neither the font scale nor reports a wrap, so web is always in the row.
  assert.equal(shouldFlowProviderLogo(1, false, true), true);

  const view = await render(
    createElement(AuthProviderButton, {
      provider: "google",
      intent: "continue",
      onPress: () => undefined,
    }),
  );
  assert.ok(view.findByTestId("provider-logo-in-flow"));
  assert.equal(view.findByTestId("provider-logo-pinned"), null);
});

test("the resend countdown reads m:ss, the same as Forgot password's", async () => {
  const view = await render(
    createElement(EmailCodeField, {
      onSubmit: async () => undefined,
      onResend: async () => undefined,
    }),
  );
  assert.match(view.text(), /Resend code in \d:\d\d/);
  assert.doesNotMatch(view.text(), /Resend code in \d+s/);
});
