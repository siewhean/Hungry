// Click-through checks of the main forms: type, press, read what the screen says back.
// Run with `npm run test:render`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { ForgotPasswordScreen } from "@/app/screens/auth/ForgotPasswordScreen";
import { LoginScreen } from "@/app/screens/auth/LoginScreen";
import { clearExperimentOverrides, setExperimentOverride } from "@/lib/experiments/experiments";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { cleanup, createFakeNavigation, renderScreen, type RenderResult } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

// These tests drive the password form; the emailed-code default has its own tests.
beforeEach(() => {
  setExperimentOverride("auth_email_code_first_v1", "control");
  return enterScenario("guest");
});
afterEach(async () => {
  await cleanup();
  clearExperimentOverrides();
});

const inputs = (view: RenderResult) =>
  Array.from(view.container.ownerDocument.querySelectorAll("input")) as HTMLInputElement[];

test("ForgotPasswordScreen asks for an email, rejects a bad one, then says to check the inbox", async () => {
  const view = await renderScreen(ForgotPasswordScreen as never, { name: "ForgotPassword" });
  assert.match(view.text(), /Enter your email address/);

  await view.press(view.findByText("Send reset link"));
  assert.match(view.text(), /Email is required/);

  await view.type(inputs(view)[0], "not-an-email");
  await view.press(view.findByText("Send reset link"));
  assert.match(view.text(), /Enter a valid email address/);
  assert.doesNotMatch(view.text(), /Check your inbox/);

  await view.type(inputs(view)[0], "  Mei@Example.SG ");
  await view.press(view.findByText("Send reset link"));
  assert.match(view.text(), /Check your inbox/);
  assert.match(view.text(), /mei@example\.sg/, "the address is trimmed and lower-cased");

  await view.press(view.findByText("Use a different email"));
  assert.match(view.text(), /Send reset link/);
});

test("ForgotPasswordScreen goes back to sign in", async () => {
  const navigation = createFakeNavigation();
  const view = await renderScreen(ForgotPasswordScreen as never, {
    name: "ForgotPassword",
    navigation,
  });
  await view.press(view.findByText("Back to sign in"));
  assert.deepEqual(
    navigation.calls.map((call) => call.method),
    ["goBack"],
  );
});

test("LoginScreen validates the form before it tries to sign in", async () => {
  const view = await renderScreen(LoginScreen as never, { name: "Login" });
  await view.press(view.findByText("Sign in"));
  assert.match(view.text(), /Email is required/);
  assert.match(view.text(), /Password is required/);
  assert.equal(useSessionStore.getState().isAuthenticated, false);
});

test("LoginScreen shows a clear message for each way sign-in can be refused, and stays signed out", async () => {
  const auth = getHungryService().auth;
  const original = auth.signIn;
  try {
    const cases: [string, RegExp][] = [
      ["invalid_credentials", /Incorrect email or password/],
      ["email_not_confirmed", /verify your email/i],
    ];
    for (const [code, message] of cases) {
      auth.signIn = (async () => {
        throw Object.assign(new Error("refused"), { code });
      }) as typeof auth.signIn;
      const view = await renderScreen(LoginScreen as never, { name: "Login" });
      const [email, password] = inputs(view);
      await view.type(email, "weiming@example.sg");
      await view.type(password, "wrong-password");
      await view.press(view.findByText("Sign in"));
      assert.match(view.text(), message, code);
      assert.equal(useSessionStore.getState().isAuthenticated, false);
      if (code === "email_not_confirmed")
        assert.ok(view.findByText("Enter the code from the email"));
      await view.unmount();
    }
  } finally {
    auth.signIn = original;
  }
});

test("LoginScreen signs a known account in", async () => {
  const view = await renderScreen(LoginScreen as never, { name: "Login" });
  const [email, password] = inputs(view);
  await view.type(email, "weiming@example.sg");
  await view.type(password, "dev-password");
  await view.press(view.findByText("Sign in"));
  assert.equal(useSessionStore.getState().isAuthenticated, true);
});

test("LoginScreen requires an account: no guest browsing, a link to create one", async () => {
  const navigation = createFakeNavigation();
  const view = await renderScreen(LoginScreen as never, { name: "Login", navigation });
  assert.equal(view.findByText("Continue without an account"), null);
  await view.press(view.findByText("Create account"));
  assert.deepEqual(navigation.calls, [{ method: "navigate", args: ["SignUp"] }]);
});
