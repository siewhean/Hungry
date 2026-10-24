// Settings and account fixes from the round-three page audit (SET-*). Run with
// `node scripts/test-render.mjs src/app/screens/profile/settings-account.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import { Alert, Dimensions } from "react-native";
import test, { afterEach, beforeEach } from "node:test";
import type * as ClipboardModule from "expo-clipboard";
import type * as ImagePickerModule from "expo-image-picker";

import { AddStallScreen } from "@/app/screens/profile/AddStallScreen";
import { SettingsScreen } from "@/app/screens/profile/SettingsScreen";
import { StallSubmissionsScreen } from "@/app/screens/profile/StallSubmissionsScreen";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { StallAlertsSettings } from "@/components/settings/StallAlertsSettings";
import { PendingDeletionBanner } from "@/features/auth/PendingDeletionBanner";
import {
  clearExperimentOverrides,
  resetExperimentSession,
  setExperimentFlagSource,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useStallSubmissionStore } from "@/store/useStallSubmissionStore";
import { useUIStore } from "@/store/useUIStore";
import { DEFAULT_PUSH_PREFERENCES } from "@/types/domain";
import { cleanup, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

// The module stubs themselves (src/test/renderPreload.cjs), so a test can swap one function.
const Clipboard = require("expo-clipboard") as typeof ClipboardModule;
const ImagePicker = require("expo-image-picker") as typeof ImagePickerModule;

type AlertCall = { title: string; message?: string };
let alerts: AlertCall[] = [];
const originalAlert = Alert.alert;
const restores: (() => void)[] = [];

/** Swaps a property for the length of one test. */
function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

beforeEach(async () => {
  await enterScenario("user");
  alerts = [];
  Alert.alert = ((title: string, message?: string) => {
    alerts.push({ title, message });
  }) as typeof Alert.alert;
});

afterEach(async () => {
  await cleanup();
  Alert.alert = originalAlert;
  while (restores.length) restores.pop()?.();
  setExperimentFlagSource(undefined);
  resetExperimentSession();
  clearExperimentOverrides();
});

function fakeFlags(flags: Record<string, string> | undefined) {
  const state = { flags, exposed: [] as string[] };
  const source: ExperimentFlagSource = {
    peek: (key) => state.flags?.[key],
    expose: (key) => {
      state.exposed.push(key);
      return state.flags?.[key];
    },
    hasLoaded: () => state.flags !== undefined,
    onChange: () => () => undefined,
  };
  return { state, source };
}

const pendingIn30Days = () => ({
  scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
});

// --- SET-10: pending deletion -------------------------------------------------------------

test("with a deletion pending, Settings shows Keep my account first and hides Delete account", async () => {
  stub(getHungryService().auth, "getPendingAccountDeletion", async () => pendingIn30Days());
  const view = await renderScreen(SettingsScreen as never, { name: "Settings" });
  const text = view.text();
  assert.match(text, /Keep my account/);
  assert.ok(
    text.indexOf("Deletion scheduled for") < text.indexOf("Dining preferences"),
    "the banner comes before the first section",
  );
  assert.equal(view.findByText("Delete account"), null);
});

test("without a pending deletion, Delete account is offered", async () => {
  stub(getHungryService().auth, "getPendingAccountDeletion", async () => null);
  const view = await renderScreen(SettingsScreen as never, { name: "Settings" });
  assert.ok(view.findByText("Delete account"));
  assert.doesNotMatch(view.text(), /Keep my account/);
});

// --- SET-X2: Keep my account when nothing was cancelled --------------------------------------

test("Keep my account does not claim success when the deletion already started", async () => {
  stub(getHungryService().auth, "getPendingAccountDeletion", async () => pendingIn30Days());
  stub(getHungryService().auth, "cancelAccountDeletion", async () => false);
  const view = await render(createElement(PendingDeletionBanner));
  await view.press(view.findByText("Keep my account"));
  await view.settle();
  assert.notEqual(useUIStore.getState().toast?.message, "Account deletion cancelled.");
  assert.deepEqual(
    alerts.map((call) => call.title),
    ["Deletion already started"],
  );
});

test("Keep my account confirms when the request was cancelled", async () => {
  let pending: { scheduledFor: string } | null = pendingIn30Days();
  stub(getHungryService().auth, "getPendingAccountDeletion", async () => pending);
  stub(getHungryService().auth, "cancelAccountDeletion", async () => {
    pending = null;
    return true;
  });
  const reported: boolean[] = [];
  const view = await render(
    <PendingDeletionBanner onPendingChange={(value: boolean) => void reported.push(value)} />,
  );
  await view.press(view.findByText("Keep my account"));
  await view.settle();
  assert.equal(useUIStore.getState().toast?.message, "Account deletion cancelled.");
  assert.doesNotMatch(view.text(), /Keep my account/);
  assert.equal(reported.at(-1), false);
});

test("a failed cancel names the support address", async () => {
  stub(getHungryService().auth, "getPendingAccountDeletion", async () => pendingIn30Days());
  stub(getHungryService().auth, "cancelAccountDeletion", async () => {
    throw new Error("offline");
  });
  const view = await render(createElement(PendingDeletionBanner));
  await view.press(view.findByText("Keep my account"));
  await view.settle();
  assert.equal(alerts[0]?.title, "Could not cancel deletion");
  assert.match(alerts[0]?.message ?? "", /usehungrysingapore@gmail\.com/);
});

// --- SET-11: merchant owner refused by the deletion RPC -------------------------------------

test("a deletion refused because the user owns a business explains the hand-over", async () => {
  const auth = getHungryService().auth;
  stub(auth, "getPendingAccountDeletion", async () => null);
  stub(auth, "getAccountDeletionBlocker", async () => null);
  stub(auth, "sendAccountDeletionCode", async () => undefined);
  stub(auth, "requestAccountDeletion", async () => {
    throw new Error('new row violates "merchant_owner_must_transfer"');
  });
  const view = await renderScreen(SettingsScreen as never, { name: "Settings" });
  await view.press(view.findByText("Delete account"));
  await view.press(view.findByText("Email me a code"));
  await view.settle();
  const input = view.container.ownerDocument.querySelector("input") as HTMLInputElement | null;
  assert.ok(input, "the code dialog is open");
  await view.type(input, "12345678");
  // The code dialog's own "Delete account" button is the last one on the page.
  const deleteButtons = Array.from(
    view.container.ownerDocument.querySelectorAll<HTMLElement>("*"),
  ).filter((node) => node.childNodes.length === 1 && node.textContent === "Delete account");
  await view.press(deleteButtons.at(-1) ?? null);
  await view.settle();
  assert.match(view.text(), /Transfer your business first/);
  assert.doesNotMatch(view.text(), /Deletion request failed/);
});

// --- SET-12 + experiment settings_dining_unfolded_v1 -----------------------------------------

test("the folded Dining header reads its summary with the title", async () => {
  const view = await renderScreen(SettingsScreen as never, { name: "Settings" });
  const header = view.findByLabel(/^Dining preferences, /);
  assert.ok(header, "the summary is part of the header label");
  assert.match(header.getAttribute("aria-label") ?? "", /food|new|adventur|try|open/i);
  assert.equal(view.findByText("Meal budget"), null, "control starts folded");
});

test("the unfolded variant shows the dining rows open and is exposed", async () => {
  const fake = fakeFlags({ settings_dining_unfolded_v1: "unfolded" });
  setExperimentFlagSource(fake.source);
  const view = await renderScreen(SettingsScreen as never, { name: "Settings" });
  assert.ok(view.findByText("Meal budget"));
  assert.ok(fake.state.exposed.includes("settings_dining_unfolded_v1"));
});

test("the control variant starts folded", async () => {
  const fake = fakeFlags({ settings_dining_unfolded_v1: "control" });
  setExperimentFlagSource(fake.source);
  const view = await renderScreen(SettingsScreen as never, { name: "Settings" });
  assert.equal(view.findByText("Meal budget"), null);
  assert.ok(fake.state.exposed.includes("settings_dining_unfolded_v1"));
});

test("a signed-out viewer is never exposed to the dining experiment", async () => {
  await enterScenario("guest");
  const fake = fakeFlags({ settings_dining_unfolded_v1: "unfolded" });
  setExperimentFlagSource(fake.source);
  const view = await renderScreen(SettingsScreen as never, { name: "Settings" });
  assert.equal(view.findByText("Meal budget"), null, "falls back to control");
  assert.equal(fake.state.exposed.includes("settings_dining_unfolded_v1"), false);
});

// --- SET-4, SET-15, SET-19, SET-14 ----------------------------------------------------------

test("Settings drops archived-posts copy, shows left-handed mode only to merchants, and Email support is a link", async () => {
  const view = await renderScreen(SettingsScreen as never, { name: "Settings" });
  assert.doesNotMatch(view.text(), /posts/i);
  assert.equal(view.findByText("Left-handed mode"), null);
  assert.equal(view.findByText("Sign in or create an account"), null);
  assert.ok(view.findByText("Blocked people"), "hidden posts are archived, so only blocks list");
  const email = view.findByLabel("Email support");
  assert.equal(email?.getAttribute("role"), "link");

  await enterScenario("merchant");
  const merchantView = await renderScreen(SettingsScreen as never, { name: "Settings" });
  assert.ok(merchantView.findByText("Left-handed mode"));
  assert.match(merchantView.text(), /add button on your merchant menu/);
});

test("a tap on the Version row copies it", async () => {
  const copied: string[] = [];
  stub(Clipboard, "setStringAsync", (async (value: string) => {
    copied.push(value);
    return true;
  }) as typeof Clipboard.setStringAsync);
  const view = await renderScreen(SettingsScreen as never, { name: "Settings" });
  await view.press(view.findByLabel("Version"));
  await view.settle();
  assert.equal(copied.length, 1);
  assert.match(copied[0], /^Hungry /);
  assert.equal(useUIStore.getState().toast?.message, "Version copied.");
});

// --- SET-13 ---------------------------------------------------------------------------------

test("row labels and values are not cut off at 2x text", async () => {
  const longValue = "someone.with.a.very.long.email.address@example.com.sg";
  const before = await render(
    createElement(SettingsRow, { editorial: true, label: "Email", value: longValue, onPress() {} }),
  );
  assert.match(before.html(), /line-clamp|text-overflow: ellipsis|-webkit-box/);
  await before.unmount();

  const originalGet = Dimensions.get;
  stub(Dimensions, "get", ((dimension: "window" | "screen") => ({
    ...originalGet(dimension),
    fontScale: 2,
  })) as typeof Dimensions.get);
  const large = await render(
    createElement(SettingsRow, { editorial: true, label: "Email", value: longValue, onPress() {} }),
  );
  assert.doesNotMatch(large.html(), /line-clamp|text-overflow: ellipsis|-webkit-box/);
});

// --- SET-3, SET-16 --------------------------------------------------------------------------

test("Notifications has a Follow requests switch that saves social_activity", async () => {
  const updates: Record<string, unknown>[] = [];
  const push = getHungryService().push;
  stub(push, "getPreferences", async () => ({ ...DEFAULT_PUSH_PREFERENCES }));
  stub(push, "updatePreferences", async (next) => {
    updates.push(next);
    return { ...DEFAULT_PUSH_PREFERENCES, ...next };
  });
  const view = await render(createElement(StallAlertsSettings, { onOpenFollowedStalls() {} }));
  const row = view.findByLabel("Follow requests");
  await view.press(row);
  await view.settle();
  // The row toggles to the opposite of what it shows, so false proves it showed on (the default).
  assert.deepEqual(updates, [{ socialActivity: false }]);
});

test("while the phone blocks notifications, a saved alert still shows on and can be turned off", async () => {
  const notifications = require("expo-notifications") as {
    getPermissionsAsync: () => Promise<{ granted: boolean; status: string }>;
  };
  stub(notifications, "getPermissionsAsync", async () => ({ granted: false, status: "denied" }));
  const updates: Record<string, unknown>[] = [];
  const push = getHungryService().push;
  stub(push, "getPreferences", async () => ({ ...DEFAULT_PUSH_PREFERENCES, weeklyPicks: true }));
  stub(push, "updatePreferences", async (next) => {
    updates.push(next);
    return { ...DEFAULT_PUSH_PREFERENCES, ...next };
  });
  const view = await render(createElement(StallAlertsSettings, { onOpenFollowedStalls() {} }));
  assert.match(view.text(), /Notifications are off for Hungry/);
  const weekly = view.findByLabel("Weekly picks");
  await view.press(weekly);
  await view.settle();
  // false proves the switch showed the saved "on" despite the block.
  assert.deepEqual(updates, [{ weeklyPicks: false }]);
  assert.equal(alerts.length, 0, "turning off never asks for permission");
});

// --- SET-22 ---------------------------------------------------------------------------------

test("AddStall says so when the photo picker fails instead of failing silently", async () => {
  stub(ImagePicker, "launchImageLibraryAsync", (async () => {
    throw new Error("picker unavailable");
  }) as typeof ImagePicker.launchImageLibraryAsync);
  const view = await renderScreen(AddStallScreen as never, { name: "AddStall" });
  await view.press(view.findByLabel("Choose stall photos"));
  await view.settle();
  assert.equal(
    useUIStore.getState().toast?.message,
    "Couldn't open your photos. Please try again.",
  );
});

// --- SET-21 ---------------------------------------------------------------------------------

test("a submission card reads its status detail and date", async () => {
  const createdAt = new Date("2026-10-01T04:00:00Z").toISOString();
  const rows = [
    {
      id: "s1",
      userId: "u1",
      stallName: "Ah Seng Wanton Mee",
      imageUrl: "",
      status: "pending",
      createdAt,
      updatedAt: createdAt,
      menuItems: [],
      deliveryLinks: [],
    },
  ];
  stub(getHungryService().contributions, "listMyDiscoveredStalls", (async () => rows) as never);
  useStallSubmissionStore.setState({ submissions: rows, isLoaded: true } as never);
  const view = await renderScreen(StallSubmissionsScreen as never, { name: "StallSubmissions" });
  const card = view.findByLabel(/^Ah Seng Wanton Mee, /);
  assert.ok(card);
  assert.match(card.getAttribute("aria-label") ?? "", /Submitted /);
});
