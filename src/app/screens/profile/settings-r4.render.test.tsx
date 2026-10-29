// Settings and account, round four (SET4-*): the bug fixes, the analytics switch, the deletion
// extras and the redesigned layout. Run with
// `node scripts/test-render.mjs src/app/screens/profile/settings-r4.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import { Alert, Dimensions } from "react-native";
import test, { afterEach, beforeEach } from "node:test";

import { SettingsScreen } from "@/app/screens/profile/SettingsScreen";
import { AccountDeletionDialog } from "@/components/settings/AccountDeletionDialog";
import { SettingsProfileCard } from "@/components/settings/SettingsProfileCard";
import {
  clearTrackedAnalyticsEvents,
  getTrackedAnalyticsEvents,
  setAnalyticsSink,
  type AnalyticsEventRecord,
} from "@/lib/analytics";
import { applyAnalyticsPreference } from "@/lib/analytics/preference";
import { getHungryService } from "@/lib/services/serviceProvider";
import { hungryPersistStorage } from "@/store/persistStorage";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

const restores: (() => void)[] = [];
const originalAlert = Alert.alert;

/** Swaps a property for the length of one test. */
function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

/** reportError logs `[reportError]`, error, context in development; this collects the contexts. */
function captureReports() {
  const reports: Record<string, unknown>[] = [];
  const original = console.error;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") reports.push((args[2] ?? {}) as Record<string, unknown>);
  };
  restores.push(() => {
    console.error = original;
    globals.__DEV__ = previousDev;
  });
  return reports;
}

beforeEach(async () => {
  // The web build confirms with the browser's confirm(); the test says yes.
  const globals = globalThis as { confirm?: (message: string) => boolean };
  const previousConfirm = globals.confirm;
  globals.confirm = () => true;
  restores.push(() => {
    globals.confirm = previousConfirm;
  });
  await enterScenario("user");
  clearTrackedAnalyticsEvents();
  Alert.alert = (() => undefined) as typeof Alert.alert;
});

afterEach(async () => {
  await cleanup();
  Alert.alert = originalAlert;
  while (restores.length) restores.pop()?.();
  applyAnalyticsPreference(true);
  useUIStore.setState({ analyticsEnabled: true, toast: null });
  setAnalyticsSink(null);
});

const settingsScreen = () => renderScreen(SettingsScreen as never, { name: "Settings" });
type View = Awaited<ReturnType<typeof settingsScreen>>;

/** Opens the folded "Your taste" section so its rows are on screen. */
async function openYourTaste(view: View) {
  await view.press(view.findByLabel(/^Your taste, /));
}

// --- SET4-1: sign out everywhere -----------------------------------------------------------

test("SET4-1: signing out of all devices is not reported as an expired session", async () => {
  // Supabase answers a global sign-out with SIGNED_OUT, which the session store reads as expiry
  // unless the app said it asked for it.
  stub(getHungryService().auth, "signOut", async () => {
    useSessionStore
      .getState()
      .applyAuthStateFromSession({ isAuthenticated: false, userId: null, sessionExpired: true });
  });
  const view = await settingsScreen();
  await view.press(view.findByLabel("Sign out of all devices"));
  await view.settle();

  assert.equal(useSessionStore.getState().isAuthenticated, false);
  assert.equal(useSessionStore.getState().sessionExpired, false);
  assert.deepEqual(useSessionStore.getState().consumeAuthNotice(), {
    message: "Signed out of all devices.",
    tone: "success",
  });
});

test("SET4-1: a failed global sign-out keeps the person signed in and clears the notice", async () => {
  const reports = captureReports();
  stub(getHungryService().auth, "signOut", async () => {
    throw new Error("offline");
  });
  const view = await settingsScreen();
  await view.press(view.findByLabel("Sign out of all devices"));
  await view.settle();

  assert.equal(useSessionStore.getState().isAuthenticated, true);
  assert.equal(useSessionStore.getState().authNotice, null);
  assert.match(useUIStore.getState().toast?.message ?? "", /Couldn't sign out everywhere/);
  assert.ok(reports.some((report) => report.area === "settings_sign_out_everywhere"));
});

// --- SET4-6: cache and location resets report failures -------------------------------------

test("SET4-6: Clear local cache reports a storage failure and does not claim success", async () => {
  const reports = captureReports();
  assert.ok(hungryPersistStorage, "persist storage exists");
  stub(hungryPersistStorage, "removeItem", async () => {
    throw new Error("storage full");
  });
  const view = await settingsScreen();
  await view.press(view.findByLabel("Clear local cache"));
  await view.settle();

  assert.match(useUIStore.getState().toast?.message ?? "", /Couldn't clear/);
  assert.equal(useUIStore.getState().toast?.tone, "error");
  assert.equal(reports.filter((report) => report.area === "settings_clear_local_cache").length, 1);
  assert.equal(
    getTrackedAnalyticsEvents().some((record) => record.event === "settings_local_cache_cleared"),
    false,
  );
});

test("SET4-6: Reset selected location reports a failure and does not claim success", async () => {
  const reports = captureReports();
  useLocationStore.setState({
    clearManualLocation: async () => {
      throw new Error("storage full");
    },
  } as never);
  const view = await settingsScreen();
  await view.press(view.findByLabel("Reset selected location"));
  await view.settle();

  assert.match(useUIStore.getState().toast?.message ?? "", /Couldn't reset/);
  assert.equal(reports.filter((report) => report.area === "settings_reset_location").length, 1);
});

// --- SET4-7: Meal budget -------------------------------------------------------------------

test("SET4-7: Meal budget opens the dietary step at the budget, Dietary preferences does not", async () => {
  const view = await settingsScreen();
  await openYourTaste(view);

  await view.press(view.findByLabel("Meal budget"));
  await view.press(view.findByLabel("Dietary preferences"));

  const quizCalls = view.navigation.calls
    .filter((call) => call.method === "navigate")
    .map((call) => call.args[1] as { screen?: string; params?: { initialPhase?: string } })
    .filter((args) => args?.screen === "TasteQuiz");
  assert.deepEqual(
    quizCalls.map((args) => args.params?.initialPhase),
    ["budget", "dietary"],
  );
});

test("SET4-7: the quiz opened at the budget shows the dietary step with its budget chips", async () => {
  const { TasteQuizScreen } =
    require("@/app/screens/onboarding/TasteQuizScreen") as typeof import("@/app/screens/onboarding/TasteQuizScreen");
  const view = await renderScreen(TasteQuizScreen as never, {
    name: "TasteQuiz",
    params: { mode: "profile", initialPhase: "budget", source: "settings" },
  });
  assert.match(view.text(), /Any dietary needs\?/);
  assert.ok(view.findByText("Usual budget per dish"));
});

// --- SET4-4: analytics switch --------------------------------------------------------------

test("SET4-4: the Share usage analytics switch stops and resumes sending events", async () => {
  const sent: AnalyticsEventRecord[] = [];
  setAnalyticsSink((record) => sent.push(record));
  const view = await settingsScreen();
  assert.equal(useUIStore.getState().analyticsEnabled, true, "on by default");

  await view.press(view.findByLabel("Share usage analytics"));
  assert.equal(useUIStore.getState().analyticsEnabled, false);
  const sentWhileOff = sent.length;
  const { trackAnalyticsEvent } = await import("@/lib/analytics");
  trackAnalyticsEvent("search_submitted", { query_length: 4 });
  assert.equal(sent.length, sentWhileOff, "nothing is sent while off");
  assert.equal(
    sent.some((record) => record.properties.setting === "usage_analytics"),
    false,
    "turning it off is not itself reported",
  );

  await view.press(view.findByLabel("Share usage analytics"));
  assert.equal(useUIStore.getState().analyticsEnabled, true);
  trackAnalyticsEvent("search_submitted", { query_length: 5 });
  assert.ok(sent.some((record) => record.event === "search_submitted"));
});

// --- SET4-12: delete dialog ----------------------------------------------------------------

test("SET4-12: the delete dialog offers a data download first and an optional reason", async () => {
  const view = await settingsScreen();
  await view.press(view.findByText("Delete account"));

  assert.ok(view.findByText("Download my data first"));
  assert.ok(view.findByText("Why are you leaving? (optional)"));
  assert.ok(view.findByText("Email me a code"), "Delete stays one tap, with no reason needed");

  await view.press(view.findByText("Download my data first"));
  await view.settle();
  assert.ok(
    getTrackedAnalyticsEvents().some((record) => record.event === "settings_data_export_requested"),
    "the export runs from the dialog",
  );
  assert.ok(view.findByText("Email me a code"), "the dialog stays open afterwards");
});

test("SET4-12: the chosen reason is sent with the deletion request, none when skipped", async () => {
  const auth = getHungryService().auth;
  stub(auth, "getPendingAccountDeletion", async () => null);
  stub(auth, "getAccountDeletionBlocker", async () => null);
  stub(auth, "sendAccountDeletionCode", async () => undefined);
  stub(auth, "requestAccountDeletion", async () => ({
    scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }));

  async function deleteWith(chip: string | null) {
    clearTrackedAnalyticsEvents();
    await enterScenario("user");
    const view = await settingsScreen();
    await view.press(view.findByText("Delete account"));
    if (chip) await view.press(view.findByText(chip));
    await view.press(view.findByText("Email me a code"));
    await view.settle();
    const input = view.container.ownerDocument.querySelector("input") as HTMLInputElement | null;
    assert.ok(input, "the code dialog is open");
    await view.type(input, "12345678");
    const deleteButtons = Array.from(
      view.container.ownerDocument.querySelectorAll<HTMLElement>("*"),
    ).filter((node) => node.childNodes.length === 1 && node.textContent === "Delete account");
    await view.press(deleteButtons.at(-1) ?? null);
    await view.settle();
    await view.unmount();
    return getTrackedAnalyticsEvents().find(
      (record) => record.event === "account_deletion_requested",
    );
  }

  assert.equal((await deleteWith("Privacy concerns"))?.properties.reason_choice, "privacy");
  assert.equal((await deleteWith(null))?.properties.reason_choice, "none");
});

test("SET4-12: a picked reason can be unpicked, and is forgotten once the dialog closes", async () => {
  const continued: (string | null)[] = [];
  const dialog = (visible: boolean) =>
    createElement(AccountDeletionDialog, {
      visible,
      message: "What happens next.",
      onDownloadData() {},
      isDownloading: false,
      onContinue: (reason: string | null) => void continued.push(reason),
      onCancel() {},
    });
  const view = await render(dialog(true));

  await view.press(view.findByText("Too many notifications"));
  await view.press(view.findByText("Too many notifications"));
  await view.press(view.findByText("Email me a code"));
  await view.press(view.findByText("Not finding what I need"));
  await view.rerender(dialog(false));
  await view.rerender(dialog(true));
  await view.press(view.findByText("Email me a code"));

  assert.deepEqual(continued, [null, null], "unpicking clears it; reopening starts clean");
});

// --- SET4-13: settings_viewed --------------------------------------------------------------

test("SET4-13: settings_viewed fires once when Settings comes into focus", async () => {
  const view = await settingsScreen();
  await view.settle();
  const viewed = getTrackedAnalyticsEvents().filter((record) => record.event === "settings_viewed");
  assert.equal(viewed.length, 1);
  assert.equal(viewed[0].properties.signed_in, true);
});

// --- SET4-17: web-only rows ----------------------------------------------------------------

test("SET4-17: phone-permission rows are hidden on web, where there are no phone settings", async () => {
  const view = await settingsScreen();
  assert.equal(view.findByLabel("Phone permissions"), null);
  assert.equal(view.findByLabel("Location permission"), null);
});

// --- Redesign: profile card and six sections -----------------------------------------------

test("the profile card shows the name and email and opens Edit profile", async () => {
  useProfileStore.setState((state) => ({
    profile: { ...state.profile, displayName: "Mei Lin", email: "mei@example.sg" },
  }));
  const view = await settingsScreen();
  const card = view.findByLabel("Edit profile, Mei Lin, mei@example.sg");
  assert.ok(card);
  assert.ok(view.findByText("mei@example.sg"));
  await view.press(card);
  assert.deepEqual(
    view.navigation.calls.filter((call) => call.method === "navigate").map((call) => call.args[0]),
    ["EditProfile"],
  );
});

test("a signed-out visitor sees no profile card and no account rows", async () => {
  await enterScenario("guest");
  const view = await settingsScreen();
  assert.equal(view.findByLabel(/^Edit profile, /), null);
  assert.equal(view.findByText("Account & security"), null);
  assert.equal(view.findByText("Delete account"), null);
});

const SECTION_TITLES = [
  "Your taste",
  "Privacy & data",
  "Account & security",
  "Display & accessibility",
  "Help & legal",
];

test("every section title is a header, in the planned order", async () => {
  const view = await settingsScreen();
  const text = view.text();
  const positions = SECTION_TITLES.map((title) => {
    const heading = view.findByText(title);
    assert.ok(heading, title);
    assert.equal(heading.getAttribute("role"), "heading", `${title} is announced as a header`);
    return text.indexOf(title);
  });
  assert.deepEqual(
    positions,
    [...positions].sort((a, b) => a - b),
  );
});

test("no two rows in one section share an icon", async () => {
  const view = await settingsScreen();
  await openYourTaste(view);
  for (const title of [...SECTION_TITLES, "Notifications"]) {
    const heading = view.findByText(title) ?? view.findByLabel(new RegExp(`^${title}`));
    assert.ok(heading, title);
    // The section is the heading's container, or its parent when the heading is a fold button.
    const section = (heading.closest('[role="button"]') ?? heading).parentElement as HTMLElement;
    const icons = Array.from(section.querySelectorAll("[data-stub]"))
      .map((node) => node.getAttribute("data-stub"))
      .filter((name) => name && !/Chevron|ExternalLink|Check/.test(name));
    assert.deepEqual(icons, [...new Set(icons)], `${title} repeats an icon`);
  }
});

test("only Sign out and Delete account use the error red", async () => {
  const view = await settingsScreen();
  const red = "rgb(205, 3, 2)";
  const redNodes = Array.from(document.body.querySelectorAll<HTMLElement>("*")).filter((node) =>
    (node.getAttribute("style") ?? "").includes(red),
  );
  assert.ok(redNodes.length > 0, "Sign out and Delete are red");
  for (const node of redNodes) {
    const owner = node.closest('[aria-label="Sign out"]');
    const isDelete = (node.closest("button, [role=button]")?.textContent ?? "").includes(
      "Delete account",
    );
    assert.ok(owner || isDelete, `unexpected red element: ${node.textContent}`);
  }
  assert.ok(view.findByLabel("Sign out"));
});

test("Contact us offers email or the help centre in one dialog", async () => {
  const view = await settingsScreen();
  assert.equal(view.findByLabel("Email support"), null, "no separate Email support row");
  await view.press(view.findByLabel("Contact us"));
  assert.ok(view.findByText("Email us"));
  assert.ok(view.findByText("Help centre"));
});

test("the profile card wraps a long name at 2x text instead of cutting it", async () => {
  const originalGet = Dimensions.get;
  stub(Dimensions, "get", ((dimension: "window" | "screen") => ({
    ...originalGet(dimension),
    fontScale: 2,
    width: 320,
  })) as typeof Dimensions.get);
  const name = "Someone With A Very Long Display Name Indeed";
  const view = await render(
    createElement(SettingsProfileCard, { name, email: "long@example.sg", onPress() {} }),
  );
  assert.ok(view.findByText(name));
  assert.doesNotMatch(view.html(), /line-clamp|text-overflow: ellipsis/);
});

// --- Change password -----------------------------------------------------------------------

test("SET4-10: Change password has one show/hide control, not one per field", async () => {
  const { ChangePasswordScreen } =
    require("@/app/screens/profile/ChangePasswordScreen") as typeof import("@/app/screens/profile/ChangePasswordScreen");
  const view = await renderScreen(ChangePasswordScreen as never, { name: "ChangePassword" });
  const toggles = Array.from(document.body.querySelectorAll("[aria-label]")).filter((node) =>
    /^(Show|Hide) passwords$/.test(node.getAttribute("aria-label") ?? ""),
  );
  assert.equal(toggles.length, 1);
  await view.press(toggles[0] as HTMLElement);
  const fields = Array.from(document.body.querySelectorAll("input"));
  assert.equal(fields.length, 3);
  assert.ok(
    fields.every((field) => field.type === "text"),
    "one tap reveals all three fields",
  );
});
