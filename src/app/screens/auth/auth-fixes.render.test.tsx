// Round-3 auth fixes, checked in a rendered screen. Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { EmailChangeScreen } from "@/app/screens/auth/EmailChangeScreen";
import { ForgotPasswordScreen } from "@/app/screens/auth/ForgotPasswordScreen";
import { LoginScreen } from "@/app/screens/auth/LoginScreen";
import { ResetPasswordScreen } from "@/app/screens/auth/ResetPasswordScreen";
import { SignUpScreen } from "@/app/screens/auth/SignUpScreen";
import {
  clearTrackedAnalyticsEvents,
  getTrackedAnalyticsEvents,
} from "@/lib/analytics/mockAnalytics";
import {
  resetExperimentSession,
  setExperimentFlagSource,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { cleanup, createFakeNavigation, renderScreen, type RenderResult } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

beforeEach(() => enterScenario("guest"));
afterEach(async () => {
  await cleanup();
  setExperimentFlagSource(undefined);
  resetExperimentSession();
});

const inputs = (view: RenderResult) =>
  Array.from(view.container.ownerDocument.querySelectorAll("input")) as HTMLInputElement[];

function fakeFlags(flags: Record<string, string>) {
  const state = { exposures: [] as string[] };
  const source: ExperimentFlagSource = {
    peek: (key) => flags[key],
    expose: (key) => {
      state.exposures.push(key);
      return flags[key];
    },
    hasLoaded: () => true,
    onChange: () => () => undefined,
  };
  return { state, source };
}

test("AUTH-X2: an unconfirmed sign-in opens the code screen without sending another email", async () => {
  const auth = getHungryService().auth;
  const originalSignIn = auth.signIn;
  const originalResend = auth.resendVerificationEmail;
  let resends = 0;
  auth.signIn = (async () => {
    throw Object.assign(new Error("refused"), { code: "email_not_confirmed" });
  }) as typeof auth.signIn;
  auth.resendVerificationEmail = (async () => {
    resends += 1;
  }) as typeof auth.resendVerificationEmail;
  try {
    const navigation = createFakeNavigation();
    const view = await renderScreen(LoginScreen as never, { name: "Login", navigation });
    const [email, password] = inputs(view);
    await view.type(email, " Mei@Example.SG ");
    await view.type(password, "secret-password");
    await view.press(view.findByText("Sign in"));
    await view.press(view.findByText("Enter the code from the email"));
    await view.settle();
    assert.equal(resends, 0);
    assert.deepEqual(navigation.calls.at(-1), {
      method: "navigate",
      args: ["EmailVerification", { email: "mei@example.sg" }],
    });
  } finally {
    auth.signIn = originalSignIn;
    auth.resendVerificationEmail = originalResend;
  }
});

test("AUTH-X5: the Login and SignUp footer rows wrap at large text", async () => {
  const login = await renderScreen(LoginScreen as never, { name: "Login" });
  assert.match(login.findByTestId("login-footer")?.getAttribute("style") ?? "", /flex-wrap: wrap/);
  await login.unmount();
  const signUp = await renderScreen(SignUpScreen as never, { name: "SignUp" });
  assert.match(
    signUp.findByTestId("sign-up-footer")?.getAttribute("style") ?? "",
    /flex-wrap: wrap/,
  );
});

test("experiment auth_signup_password_visible_v1: control masks the new password", async () => {
  const flags = fakeFlags({ auth_signup_password_visible_v1: "control" });
  setExperimentFlagSource(flags.source);
  const view = await renderScreen(SignUpScreen as never, { name: "SignUp" });
  const password = inputs(view)[2];
  assert.equal(password.getAttribute("type"), "password");
  assert.deepEqual(flags.state.exposures.slice(0, 1), ["auth_signup_password_visible_v1"]);
});

test("experiment auth_signup_password_visible_v1: visible_password shows it, and Hide still works", async () => {
  const flags = fakeFlags({ auth_signup_password_visible_v1: "visible_password" });
  setExperimentFlagSource(flags.source);
  const view = await renderScreen(SignUpScreen as never, { name: "SignUp" });
  assert.notEqual(inputs(view)[2].getAttribute("type"), "password");
  await view.press(view.findByLabel("Hide password"));
  assert.equal(inputs(view)[2].getAttribute("type"), "password");
});

test("experiment auth_signup_password_visible_v1: a signed-in user is never exposed", async () => {
  useSessionStore.setState({ isAuthenticated: true });
  const flags = fakeFlags({ auth_signup_password_visible_v1: "visible_password" });
  setExperimentFlagSource(flags.source);
  const view = await renderScreen(SignUpScreen as never, { name: "SignUp" });
  assert.equal(inputs(view)[2].getAttribute("type"), "password");
  assert.deepEqual(flags.state.exposures, []);
});

test("AUTH-13: a submitted sign-up logs sign_up_submitted", async () => {
  clearTrackedAnalyticsEvents();
  const view = await renderScreen(SignUpScreen as never, { name: "SignUp" });
  const [name, email, password] = inputs(view);
  await view.type(name, "Mei");
  await view.type(email, "mei.new@example.sg");
  await view.type(password, "a-long-unique-password-42");
  // "Create account" is also the screen title; the submit button is the last match.
  const matches = Array.from(view.container.querySelectorAll("*")).filter(
    (node) => node.childNodes.length === 1 && node.textContent === "Create account",
  ) as HTMLElement[];
  await view.press(matches.at(-1) ?? null);
  await view.settle();
  const submitted = getTrackedAnalyticsEvents().filter((e) => e.event === "sign_up_submitted");
  assert.equal(submitted.length, 1);
  assert.deepEqual(submitted[0].properties, { screen: "sign_up", method: "email" });
});

test("AUTH-4: Forgot password from Settings keeps the user signed in and fills their email", async () => {
  useSessionStore.setState({ isAuthenticated: true, passwordRecoveryInProgress: false });
  const view = await renderScreen(ForgotPasswordScreen as never, {
    name: "ForgotPassword",
    params: { email: "mei@example.sg", fromSignedIn: true },
  });
  assert.equal(inputs(view)[0].value, "mei@example.sg");
  assert.ok(view.findByText("Back"));
  assert.equal(view.findByText("Back to sign in"), null);
  // The hold keeps RootNavigator from sending the user Home while this screen is open.
  assert.equal(useSessionStore.getState().passwordRecoveryInProgress, true);
  await view.unmount();
  assert.equal(useSessionStore.getState().passwordRecoveryInProgress, false);
});

test("AUTH-4: Cancel on a reset started while signed in goes back instead of to Login", async () => {
  const navigation = createFakeNavigation();
  const view = await renderScreen(ResetPasswordScreen as never, {
    name: "ResetPassword",
    navigation,
    params: { email: "mei@example.sg", recoveryVerified: true, fromSignedIn: true },
  });
  await view.press(view.findByLabel("Cancel"));
  assert.deepEqual(navigation.calls.at(-1), { method: "goBack", args: [] });
  assert.ok(!navigation.calls.some((call) => call.args[0] === "Login"));
});

test("AUTH-6: the first of two email-change links reads as progress, not failure", async () => {
  const view = await renderScreen(EmailChangeScreen as never, {
    name: "EmailChange",
    params: { otherLinkPending: true },
  });
  assert.match(view.text(), /One down, one to go/);
  assert.doesNotMatch(view.text(), /couldn't confirm/);
});
