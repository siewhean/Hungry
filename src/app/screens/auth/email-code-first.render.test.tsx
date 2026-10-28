// The emailed-code sign-in on Login and Create account, plus the screens around it.
// Run with `npm run test:render`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach, beforeEach } from "node:test";

import { AUTH_COMPACT_LOGO_SIZE } from "@/app/screens/auth/AuthScreenShell";
import { EmailVerificationScreen } from "@/app/screens/auth/EmailVerificationScreen";
import { ForgotPasswordScreen } from "@/app/screens/auth/ForgotPasswordScreen";
import { LoginScreen } from "@/app/screens/auth/LoginScreen";
import { OnboardingAuthScreen } from "@/app/screens/onboarding/OnboardingAuthScreen";
import { ResetPasswordScreen } from "@/app/screens/auth/ResetPasswordScreen";
import { ResetPasswordSuccessScreen } from "@/app/screens/auth/ResetPasswordSuccessScreen";
import { SignUpScreen } from "@/app/screens/auth/SignUpScreen";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  EXPERIMENTS,
  clearExperimentOverrides,
  resetExperimentSession,
  setExperimentFlagSource,
  setExperimentOverride,
} from "@/lib/experiments/experiments";
import {
  getHungryService,
  getServiceProvider,
  setServiceProvider,
} from "@/lib/services/serviceProvider";
import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import type { Session } from "@/lib/services/types";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, createFakeNavigation, renderScreen, type RenderResult } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

beforeEach(async () => {
  clearTrackedAnalyticsEvents();
  useUIStore.setState({ toast: null } as never);
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

const events = (name: string) =>
  getTrackedAnalyticsEvents().filter((event) => event.event === name);

/** Replaces service methods for one test and puts them back. */
function stubAuth<K extends keyof ReturnType<typeof getHungryService>["auth"]>(
  stubs: Partial<Record<K, unknown>>,
) {
  const auth = getHungryService().auth as unknown as Record<string, unknown>;
  const originals: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(stubs)) {
    originals[key] = auth[key];
    auth[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(originals)) auth[key] = value;
  };
}

async function signInByCode(view: RenderResult, address = "mei@example.sg") {
  await view.type(inputs(view)[0], address);
  await view.press(view.findByText("Continue"));
  await view.settle();
}

test("Login leads with an emailed code, not a password", async () => {
  const view = await renderScreen(LoginScreen as never, { name: "Login" });
  assert.match(view.text(), /Sign in to Hungry/);
  assert.equal(inputs(view).length, 1);
  assert.ok(view.findByText("Use a password instead"));
  assert.match(view.text(), /By continuing, you agree to Hungry's/);
  assert.equal(view.findByText("Forgot password?"), null);
});

test("an emailed code signs in: send, check your email, type the code, signed in", async () => {
  const sent: unknown[][] = [];
  const restore = stubAuth({
    signInWithEmailCode: async (...args: unknown[]) => {
      sent.push(args);
    },
  });
  try {
    const view = await renderScreen(LoginScreen as never, { name: "Login" });
    await signInByCode(view, "  Mei@Example.SG ");
    assert.deepEqual(sent, [["mei@example.sg", { displayName: undefined }]]);
    assert.match(view.text(), /Check your email/);
    assert.match(view.text(), /mei@example\.sg/);
    assert.match(view.text(), /spam or promotions/);
    assert.equal(useSessionStore.getState().isAuthenticated, false);

    await view.type(inputs(view)[0], "12345678");
    await view.settle();
    assert.equal(useSessionStore.getState().isAuthenticated, true);
    assert.equal(events("email_code_requested").length, 1);
    assert.equal(events("sign_in_submitted")[0].properties.method, "email_code");
    // The screen change is the confirmation: no toast on top of it.
    assert.equal((useUIStore.getState() as { toast?: unknown }).toast ?? null, null);
  } finally {
    restore();
  }
});

test("Wrong email? goes back to the email step with the address kept", async () => {
  const restore = stubAuth({ signInWithEmailCode: async () => undefined });
  try {
    const view = await renderScreen(LoginScreen as never, { name: "Login" });
    await signInByCode(view);
    await view.press(view.findByText("Wrong email? Change it"));
    assert.equal(inputs(view)[0].value, "mei@example.sg");
    assert.ok(view.findByText("Use a password instead"));
  } finally {
    restore();
  }
});

test("a code that could not be sent stays on the email step with a reason", async () => {
  const restore = stubAuth({
    signInWithEmailCode: async () => {
      throw Object.assign(new Error("rate limited"), {
        code: "over_email_send_rate_limit",
        status: 429,
      });
    },
  });
  try {
    const view = await renderScreen(LoginScreen as never, { name: "Login" });
    await signInByCode(view);
    assert.doesNotMatch(view.text(), /Check your email/);
    assert.ok(view.container.querySelector('[role="alert"]'));
    const failed = events("auth_failed")[0];
    assert.equal(failed.properties.reason, "over_email_send_rate_limit");
    assert.equal(failed.properties.screen, "login");
    assert.equal(failed.properties.flow, "email_code");
  } finally {
    restore();
  }
});

test("an empty address is refused before any email is sent", async () => {
  let sends = 0;
  const restore = stubAuth({
    signInWithEmailCode: async () => {
      sends += 1;
    },
  });
  try {
    const view = await renderScreen(LoginScreen as never, { name: "Login" });
    await view.press(view.findByText("Continue"));
    assert.match(view.text(), /Email is required/);
    await view.type(inputs(view)[0], "not-an-email");
    await view.press(view.findByText("Continue"));
    assert.match(view.text(), /valid email/i);
    assert.equal(sends, 0);
  } finally {
    restore();
  }
});

/** Leaves the field the way a person does, so onBlur runs. */
async function leaveField(view: RenderResult, input: HTMLInputElement) {
  input.focus();
  input.blur();
  await view.settle();
}

test("a mistyped provider domain offers the likely address, and one tap uses it", async () => {
  const view = await renderScreen(LoginScreen as never, { name: "Login" });
  await view.type(inputs(view)[0], "mei@gmial.com");
  await leaveField(view, inputs(view)[0]);
  assert.match(view.text(), /Did you mean/);
  await view.press(view.findByLabel("Use this address: mei@gmail.com"));
  assert.equal(inputs(view)[0].value, "mei@gmail.com");
  assert.doesNotMatch(view.text(), /Did you mean/);
});

test("Use a password instead opens the password form, and Email me a code instead returns", async () => {
  const view = await renderScreen(LoginScreen as never, { name: "Login" });
  await view.press(view.findByText("Use a password instead"));
  assert.equal(inputs(view).length, 2);
  assert.ok(view.findByText("Forgot password?"));
  await view.press(view.findByText("Email me a code instead"));
  assert.equal(inputs(view).length, 1);
});

test("a flag that says control keeps the password form first", async () => {
  setExperimentOverride("auth_email_code_first_v1", "control");
  const view = await renderScreen(LoginScreen as never, { name: "Login" });
  assert.equal(inputs(view).length, 2);
  assert.equal(view.findByText("Use a password instead"), null);
});

test("Forgot password carries the address typed on Login", async () => {
  setExperimentOverride("auth_email_code_first_v1", "control");
  const navigation = createFakeNavigation();
  const view = await renderScreen(LoginScreen as never, { name: "Login", navigation });
  await view.type(inputs(view)[0], " Mei@Example.SG ");
  await view.press(view.findByLabel("Forgot password?"));
  assert.deepEqual(navigation.calls.at(-1), {
    method: "navigate",
    args: ["ForgotPassword", { email: "mei@example.sg" }],
  });
});

test("a wrong password offers Reset password only in the nudge arm", async () => {
  const refuse = async () => {
    throw Object.assign(new Error("Invalid login credentials"), { code: "invalid_credentials" });
  };
  const run = async (arm: "control" | "nudge") => {
    setExperimentOverride("auth_email_code_first_v1", "control");
    setExperimentOverride("auth_login_reset_nudge_v1", arm);
    const restore = stubAuth({ signIn: refuse });
    try {
      const view = await renderScreen(LoginScreen as never, { name: "Login" });
      await view.type(inputs(view)[0], "mei@example.sg");
      await view.type(inputs(view)[1], "wrong-password");
      await view.press(view.findByText("Sign in"));
      await view.settle();
      return Boolean(view.findByLabel("Reset password"));
    } finally {
      restore();
      await cleanup();
    }
  };
  assert.equal(await run("control"), false);
  assert.equal(await run("nudge"), true);
  assert.equal(EXPERIMENTS.auth_login_reset_nudge_v1.status, "draft");
});

test("a sign-in code that is accepted but whose profile cannot load shows Try again, and retry finishes", async () => {
  let reads = 0;
  const profile = getHungryService().profile;
  const accountProfile = await profile.getProfile();
  const session = {
    userId: "user-1",
    accessToken: "t",
    refreshToken: "r",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    profile: accountProfile,
    get profileReady() {
      reads += 1;
      return reads === 1
        ? Promise.reject(new Error("profile read failed"))
        : Promise.resolve(accountProfile);
    },
  } as unknown as Session;
  const restore = stubAuth({
    signInWithEmailCode: async () => undefined,
    verifyEmailCode: async () => session,
  });
  // Mock mode never fails a sync; the account-backed mode does.
  const original = getServiceProvider();
  setServiceProvider({ ...original, mode: "supabase" });
  const reported: unknown[] = [];
  const realError = console.error;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") reported.push(args[2]);
  };
  try {
    const view = await renderScreen(LoginScreen as never, { name: "Login" });
    await signInByCode(view);
    await view.type(inputs(view)[0], "12345678");
    await view.settle();
    assert.match(view.text(), /couldn't load your taste profile/);
    assert.equal(useSessionStore.getState().isAuthenticated, false);
    assert.deepEqual(reported[0], { screen: "login", action: "profile_sync" });

    await view.press(view.findByText("Try again"));
    await view.settle();
    assert.doesNotMatch(view.text(), /couldn't load your taste profile/);
    assert.equal(useSessionStore.getState().isAuthenticated, true);
  } finally {
    console.error = realError;
    globals.__DEV__ = previousDev;
    setServiceProvider(original);
    restore();
  }
});

test("Create account asks for a name, refuses a reserved one, and sends the name with the code", async () => {
  const sent: unknown[][] = [];
  const restore = stubAuth({
    signInWithEmailCode: async (...args: unknown[]) => {
      sent.push(args);
    },
  });
  try {
    const view = await renderScreen(SignUpScreen as never, { name: "SignUp" });
    assert.equal(inputs(view).length, 2);
    await view.press(view.findByText("Continue"));
    assert.match(view.text(), /Name is required/);

    await view.type(inputs(view)[0], "Admin");
    await view.type(inputs(view)[1], "mei@example.sg");
    await view.press(view.findByText("Continue"));
    assert.match(view.text(), /That name is reserved/);
    assert.deepEqual(sent, []);

    await view.type(inputs(view)[0], "Mei");
    await view.press(view.findByText("Continue"));
    await view.settle();
    assert.deepEqual(sent, [["mei@example.sg", { displayName: "Mei" }]]);
    assert.match(view.text(), /Check your email/);
    assert.equal(events("sign_up_submitted")[0].properties.method, "email_code");
  } finally {
    restore();
  }
});

test("the name field stops at 40 characters", async () => {
  const view = await renderScreen(SignUpScreen as never, { name: "SignUp" });
  assert.equal(inputs(view)[0].getAttribute("maxlength"), "40");
});

test("the verify screen has one primary action and no arrival toast", async () => {
  const navigation = createFakeNavigation();
  const view = await renderScreen(EmailVerificationScreen as never, {
    name: "EmailVerification",
    navigation,
    params: { email: "Mei@Example.SG" },
  });
  await view.settle();
  assert.match(view.text(), /mei@example\.sg/);
  assert.ok(view.findByText("Wrong email? Change it"));
  assert.ok(view.findByText("Verify email"));
  assert.equal((useUIStore.getState() as { toast?: unknown }).toast ?? null, null);
  await view.press(view.findByText("Sign in"));
  assert.deepEqual(navigation.calls.at(-1), {
    method: "navigate",
    args: ["Login", { email: "mei@example.sg" }],
  });
  await view.press(view.findByText("Wrong email? Change it"));
  assert.equal(navigation.calls.at(-1)?.method, "goBack");
});

test("Forgot password turns into Check your inbox once the link is sent", async () => {
  const restore = stubAuth({ forgotPassword: async () => undefined });
  try {
    const view = await renderScreen(ForgotPasswordScreen as never, {
      name: "ForgotPassword",
      params: { email: "mei@example.sg" },
    });
    assert.match(view.text(), /Forgot password/);
    await view.press(view.findByText("Send reset link"));
    await view.settle();
    assert.match(view.text(), /Check your inbox/);
    assert.doesNotMatch(view.text(), /Forgot password/);
  } finally {
    restore();
  }
});

test("Forgot password offers the likely address when the domain is a typo", async () => {
  const view = await renderScreen(ForgotPasswordScreen as never, { name: "ForgotPassword" });
  await view.type(inputs(view)[0], "mei@gmial.com");
  await leaveField(view, inputs(view)[0]);
  assert.match(view.text(), /Did you mean/);
});

test("a reset asks for the new password once, signs out other devices, and says so", async () => {
  const calls: unknown[][] = [];
  const restore = stubAuth({
    updatePassword: async () => undefined,
    signOut: async (...args: unknown[]) => {
      calls.push(args);
    },
  });
  const original = getServiceProvider();
  setServiceProvider({ ...original, mode: "supabase" });
  setConfiguredDataSource("supabase");
  try {
    const navigation = createFakeNavigation();
    const view = await renderScreen(ResetPasswordScreen as never, {
      name: "ResetPassword",
      navigation,
      params: { email: "mei@example.sg", recoveryVerified: true },
    });
    await view.settle();
    assert.equal(inputs(view).length, 1);
    await view.type(inputs(view)[0], "a-Strong-passw0rd!");
    await view.press(view.findByText("Update password"));
    await view.settle();
    assert.deepEqual(calls, [[{ scope: "others" }]]);
    assert.deepEqual(navigation.calls.at(-1), {
      method: "navigate",
      args: ["ResetPasswordSuccess", { otherDevicesSignedOut: true }],
    });
    assert.equal(events("password_reset_completed").length, 1);
  } finally {
    setServiceProvider(original);
    restore();
  }
});

test("a failed sign-out of other devices does not stop the reset from finishing", async () => {
  const restore = stubAuth({
    updatePassword: async () => undefined,
    signOut: async () => {
      throw new Error("offline");
    },
  });
  const original = getServiceProvider();
  setServiceProvider({ ...original, mode: "supabase" });
  setConfiguredDataSource("supabase");
  const realError = console.error;
  console.error = () => undefined;
  try {
    const navigation = createFakeNavigation();
    const view = await renderScreen(ResetPasswordScreen as never, {
      name: "ResetPassword",
      navigation,
      params: { email: "mei@example.sg", recoveryVerified: true },
    });
    await view.settle();
    await view.type(inputs(view)[0], "a-Strong-passw0rd!");
    await view.press(view.findByText("Update password"));
    await view.settle();
    assert.deepEqual(navigation.calls.at(-1), {
      method: "navigate",
      args: ["ResetPasswordSuccess", { otherDevicesSignedOut: false }],
    });
  } finally {
    console.error = realError;
    setServiceProvider(original);
    restore();
  }
});

test("a rejected new password stays on the form with the reason inline", async () => {
  const restore = stubAuth({
    updatePassword: async () => {
      throw Object.assign(new Error("Password is known to be weak"), { code: "weak_password" });
    },
  });
  const original = getServiceProvider();
  setServiceProvider({ ...original, mode: "supabase" });
  setConfiguredDataSource("supabase");
  try {
    const navigation = createFakeNavigation();
    const view = await renderScreen(ResetPasswordScreen as never, {
      name: "ResetPassword",
      navigation,
      params: { email: "mei@example.sg", recoveryVerified: true },
    });
    await view.settle();
    await view.type(inputs(view)[0], "a-Strong-passw0rd!");
    await view.press(view.findByText("Update password"));
    await view.settle();
    assert.ok(view.container.querySelector('[role="alert"]'));
    assert.notEqual(navigation.calls.at(-1)?.args[0], "ResetPasswordSuccess");
  } finally {
    setServiceProvider(original);
    restore();
  }
});

test("the success screen says other devices were signed out only when they were", async () => {
  useSessionStore.setState({ isAuthenticated: true });
  const signedOut = await renderScreen(ResetPasswordSuccessScreen as never, {
    name: "ResetPasswordSuccess",
    params: { otherDevicesSignedOut: true },
  });
  assert.match(signedOut.text(), /signed you out on your other devices/);
  await cleanup();
  const plain = await renderScreen(ResetPasswordSuccessScreen as never, {
    name: "ResetPasswordSuccess",
  });
  assert.doesNotMatch(plain.text(), /other devices/);
});

test("the onboarding account step leads with the code on both tabs and asks for a name on Create account", async () => {
  const sent: unknown[][] = [];
  const restore = stubAuth({
    signInWithEmailCode: async (...args: unknown[]) => {
      sent.push(args);
    },
  });
  try {
    const parent = createFakeNavigation();
    const navigation = { ...createFakeNavigation(), getParent: () => parent };
    const view = await renderScreen(OnboardingAuthScreen as never, {
      name: "OnboardingAuth",
      navigation: navigation as never,
    });
    // Create account: name and email, no password.
    assert.equal(inputs(view).length, 2);
    assert.ok(view.findByText("Use a password instead"));
    await view.type(inputs(view)[0], "Mei");
    await view.type(inputs(view)[1], "mei@example.sg");
    await view.press(view.findByText("Continue"));
    await view.settle();
    assert.deepEqual(sent, [["mei@example.sg", { displayName: "Mei" }]]);
    assert.match(view.text(), /Check your email/);
    assert.equal(events("email_code_requested")[0].properties.screen, "onboarding_auth");
  } finally {
    restore();
  }
});

test("the compact auth header is the 48pt mark alone, and the long auth screens use it", async () => {
  const shell = readFileSync("src/app/screens/auth/AuthScreenShell.tsx", "utf8");
  assert.equal(AUTH_COMPACT_LOGO_SIZE, 48);
  assert.match(shell, /compact \? AUTH_COMPACT_LOGO_SIZE : HUNGRY_LOGO_STANDARD_SIZE/);
  assert.match(shell, /showWordmark=\{!compact\}/);
  for (const file of [
    "LoginScreen",
    "SignUpScreen",
    "EmailVerificationScreen",
    "ResetPasswordScreen",
    "ResetPasswordSuccessScreen",
  ]) {
    assert.match(readFileSync(`src/app/screens/auth/${file}.tsx`, "utf8"), /\bcompact\b/, file);
  }
});

test("the onboarding password forms use labelled fields, like Login and Create account", async () => {
  setExperimentOverride("auth_email_code_first_v1", "control");
  const parent = createFakeNavigation();
  const navigation = { ...createFakeNavigation(), getParent: () => parent };
  const view = await renderScreen(OnboardingAuthScreen as never, {
    name: "OnboardingAuth",
    navigation: navigation as never,
  });
  for (const input of inputs(view)) {
    assert.ok(!input.getAttribute("placeholder"));
  }
  assert.match(view.text(), /Name shown on your reviews/);
  assert.match(view.text(), /Email address/);
  assert.match(view.text(), /Create password/);
});

test("a wrong code shows the reason and keeps the field for another try", async () => {
  const restore = stubAuth({ signInWithEmailCode: async () => undefined });
  try {
    const view = await renderScreen(LoginScreen as never, { name: "Login" });
    await signInByCode(view);
    await view.type(inputs(view)[0], "00000000");
    await view.settle();
    assert.match(view.text(), /wrong or has expired|expired|invalid/i);
    assert.equal(useSessionStore.getState().isAuthenticated, false);
    assert.equal(inputs(view)[0].value, "00000000");
    await view.type(inputs(view)[0], "1234567");
    await view.type(inputs(view)[0], "12345678");
    await view.settle();
    assert.equal(useSessionStore.getState().isAuthenticated, true);
  } finally {
    restore();
  }
});
