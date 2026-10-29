// Merchant round-four phase 3 in a React tree: the Merchant Centre gate (claims, Find your stall,
// sign-in return), the Verification Centre (licence copy, stepper, review time, pending-state
// buttons) and the "Get your stall ready" checklist behind merchant_setup_checklist_v1
// (ClaimStepper, FindYourStall, MerchantClaimsPanel and SetupChecklist render inside these).
// Run with `node scripts/test-render.mjs src/app/screens/merchant/merchant-r4-phase3.render.test.tsx`.

import assert from "node:assert/strict";
import { act } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { MerchantTabs } from "@/app/navigation/MerchantTabs";
import { VerificationCentreScreen } from "@/app/screens/merchant/VerificationCentreScreen";
import {
  EXPERIMENTS,
  resetExperimentSession,
  setExperimentFlagSource,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import { merchantAccount } from "@/lib/services/mock/data";
import { getHungryService } from "@/lib/services/serviceProvider";
import { getActiveOutlet, useMerchantStore } from "@/store/useMerchantStore";
import { useSessionStore } from "@/store/useSessionStore";
import { cleanup, createFakeNavigation, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { MerchantClaimSummary } from "@/lib/services/types";

type Service = ReturnType<typeof getHungryService>;
const restores: (() => void)[] = [];
function stub<N extends "merchant" | "supply", K extends keyof Service[N]>(
  namespace: N,
  name: K,
  impl: Service[N][K],
) {
  const target = getHungryService()[namespace];
  const original = target[name];
  target[name] = impl;
  restores.push(() => {
    target[name] = original;
  });
}

afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()?.();
  setExperimentFlagSource(undefined);
  resetExperimentSession();
});

function fakeFlags(flags: Record<string, string>) {
  const source: ExperimentFlagSource = {
    peek: (key) => flags[key],
    expose: (key) => flags[key],
    hasLoaded: () => true,
    onChange: () => () => undefined,
  };
  setExperimentFlagSource(source);
}

function claim(status: MerchantClaimSummary["status"]): MerchantClaimSummary {
  return {
    claimId: `claim-${status}`,
    venueId: "venue-tian-tian",
    venueName: "Tian Tian Chicken Rice",
    status,
    submittedAt: "2026-10-28T02:00:00Z",
  };
}

/** The Merchant Centre for a login that has no merchant account, with a fake root navigator. */
async function renderGate() {
  stub("merchant", "getMerchantAccount", async () => null as never);
  const rootNavigation = createFakeNavigation();
  const navigation = createFakeNavigation();
  (navigation as { getParent: unknown }).getParent = () => rootNavigation;
  const view = await renderScreen(MerchantTabs as never, { name: "MerchantTabs", navigation });
  await view.settle();
  return { view, rootNavigation };
}

// ─── R4-1: the gate ─────────────────────────────────────────────────────────

test("R4-1: a signed-in login with no merchant account sees its claim and where it stands", async () => {
  await enterScenario("user");
  stub("supply", "getMyMerchantClaims", async () => [claim("submitted")]);
  const { view } = await renderGate();
  assert.match(view.text(), /Your claims/);
  assert.match(view.text(), /Tian Tian Chicken Rice/);
  assert.ok(view.findByLabel("Step 1 of 4: Claim sent"));
  assert.match(view.text(), /usually replies within 2 working days/);
  assert.match(view.text(), /Find your stall/);
  assert.equal(view.findByText("Open Merchant Centre"), null, "nothing to open yet");
});

test("R4-1: an approved claim opens the Merchant Centre once the account exists", async () => {
  await enterScenario("user");
  stub("supply", "getMyMerchantClaims", async () => [claim("approved")]);
  const { view } = await renderGate();
  assert.ok(view.findByLabel("Step 2 of 4: Approved"));

  // The server created the account when ops approved the claim.
  stub("merchant", "getMerchantAccount", async () => JSON.parse(JSON.stringify(merchantAccount)));
  await view.press(view.findByText("Open Merchant Centre"));
  await view.settle();
  assert.doesNotMatch(view.text(), /Your claims/);
  assert.doesNotMatch(view.text(), /no merchant account yet/);
});

test("R4-1: a rejected claim says so and points to support", async () => {
  await enterScenario("user");
  stub("supply", "getMyMerchantClaims", async () => [claim("rejected")]);
  const { view } = await renderGate();
  assert.match(view.text(), /could not approve this claim/);
  assert.match(view.text(), /usehungrysingapore@gmail\.com/);
});

test("R4-1: a failed claims read offers a retry instead of an empty gate", async () => {
  await enterScenario("user");
  let fail = true;
  stub("supply", "getMyMerchantClaims", async () => {
    if (fail) throw new Error("offline");
    return [claim("in_review")];
  });
  const { view } = await renderGate();
  assert.match(view.text(), /Could not load your claims/);
  fail = false;
  await view.press(view.findByText("Try again"));
  await view.settle();
  assert.match(view.text(), /Hungry is checking your claim/);
});

test("R4-1: Find your stall searches the catalogue and opens the stall page for the claim", async () => {
  await enterScenario("user");
  stub("supply", "getMyMerchantClaims", async () => []);
  const { view, rootNavigation } = await renderGate();
  await view.type(view.findByLabel("Search for your stall"), "Tian Tian");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  await view.settle();
  const result = view.findByLabel(/^Open Tian Tian/);
  assert.ok(result, "the search found the stall");
  await view.press(result);
  const opened = rootNavigation.calls.filter((call) => call.method === "navigate").pop();
  assert.equal(opened?.args[0], "StallDetail");
  assert.match(String((opened?.args[1] as { venueId: string }).venueId), /./);
});

test("R4-1: a search with no match says so and gives a way to add the stall", async () => {
  await enterScenario("user");
  stub("supply", "getMyMerchantClaims", async () => []);
  const { view } = await renderGate();
  await view.type(view.findByLabel("Search for your stall"), "zzzzzzzz nothing");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
  await view.settle();
  assert.match(view.text(), /No stalls found/);
  assert.match(view.text(), /usehungrysingapore@gmail\.com/);
});

// ─── AUTH-X1: sign in returns to the Merchant Centre ───────────────────────

test("AUTH-X1: signing in from the Merchant Centre gate returns to the Merchant Centre", async () => {
  await enterScenario("guest");
  const { view, rootNavigation } = await renderGate();
  await view.press(view.findByText("Sign In"));
  assert.deepEqual(useSessionStore.getState().returnRoute, {
    name: "MerchantTabs",
    params: { screen: "Dashboard" },
  });
  const opened = rootNavigation.calls.filter((call) => call.method === "navigate").pop();
  assert.deepEqual(opened?.args, ["AuthStack", { screen: "Login" }]);
  useSessionStore.getState().setReturnRoute(undefined);
});

// ─── R4-10: licence copy and review time ────────────────────────────────────

function outletId() {
  const outlet = getActiveOutlet(useMerchantStore.getState());
  assert.ok(outlet, "merchant scenario has an outlet");
  return outlet.id;
}

test("R4-10: the document methods name the NEA hawker licence, the SFA licence and ACRA", async () => {
  await enterScenario("merchant");
  useMerchantStore.getState().setVerificationStatus(outletId(), "not_started");
  const view = await renderScreen(VerificationCentreScreen as never, {
    name: "VerificationCentre",
  });
  assert.match(view.text(), /NEA hawker licence, SFA food shop licence or ACRA business profile/);
  assert.doesNotMatch(view.text(), /your SFA licence or ACRA/);
});

test("R4-10 / R4-9: while Hungry reviews, the page gives the usual wait and jumps to Menu and Profile", async () => {
  await enterScenario("merchant");
  useMerchantStore.getState().setVerificationStatus(outletId(), "in_review");
  const view = await renderScreen(VerificationCentreScreen as never, {
    name: "VerificationCentre",
  });
  assert.match(view.text(), /usually takes 2 working days/);
  assert.ok(view.findByLabel("Step 3 of 4: Verified"));
  await view.press(view.findByText("Set up your menu"));
  await view.press(view.findByText("Set up your profile"));
  assert.deepEqual(
    view.navigation.calls.filter((call) => call.method === "navigate").map((call) => call.args[0]),
    ["Menu", "Profile"],
  );
});

test("R4-9: a verified stall that is not live yet is on the last step", async () => {
  await enterScenario("merchant");
  const outlet = getActiveOutlet(useMerchantStore.getState())!;
  useMerchantStore.getState().setVerificationStatus(outlet.id, "verified");
  useMerchantStore.getState().updateOutletProfile(outlet.id, { isLive: false });
  const view = await renderScreen(VerificationCentreScreen as never, {
    name: "VerificationCentre",
  });
  assert.ok(view.findByLabel("Step 4 of 4: Live"));
});

// ─── R4-9: the setup checklist test ─────────────────────────────────────────

function runChecklistTest() {
  const definition = EXPERIMENTS.merchant_setup_checklist_v1 as { status: string };
  const previous = definition.status;
  definition.status = "running";
  restores.push(() => {
    definition.status = previous;
  });
}

test("R4-9: it is a draft test, so the plain landing is what everyone sees", async () => {
  await enterScenario("merchant");
  useMerchantStore.getState().setVerificationStatus(outletId(), "not_started");
  fakeFlags({ merchant_setup_checklist_v1: "checklist" });
  const view = await renderScreen(VerificationCentreScreen as never, {
    name: "VerificationCentre",
  });
  assert.doesNotMatch(view.text(), /Get your stall ready/);
});

test("R4-9: in the checklist arm an unverified stall sees four steps and jumps to the right screen", async () => {
  await enterScenario("merchant");
  useMerchantStore.getState().setVerificationStatus(outletId(), "not_started");
  runChecklistTest();
  fakeFlags({ merchant_setup_checklist_v1: "checklist" });
  const view = await renderScreen(VerificationCentreScreen as never, {
    name: "VerificationCentre",
  });
  await view.settle();
  assert.match(view.text(), /Get your stall ready/);
  assert.match(view.text(), /of 4 done/);
  for (const label of ["Verify your stall", "Add 5 dishes", "Add opening hours", "Add a photo"]) {
    assert.match(view.text(), new RegExp(label));
  }
  // Verifying happens on this same screen, so that step has no button of its own.
  assert.equal(view.findByLabel("Verify your stall"), null);
  const add = view.findByLabel("Add 5 dishes");
  assert.ok(add, "the dish step has an Add button");
  await view.press(add);
  assert.equal(
    view.navigation.calls.filter((call) => call.method === "navigate").pop()?.args[0],
    "Menu",
  );
});

test("R4-9: the control arm and verified stalls never see the checklist", async () => {
  await enterScenario("merchant");
  runChecklistTest();
  fakeFlags({ merchant_setup_checklist_v1: "control" });
  useMerchantStore.getState().setVerificationStatus(outletId(), "not_started");
  const control = await renderScreen(VerificationCentreScreen as never, {
    name: "VerificationCentre",
  });
  assert.doesNotMatch(control.text(), /Get your stall ready/);
  await cleanup();

  fakeFlags({ merchant_setup_checklist_v1: "checklist" });
  useMerchantStore.getState().setVerificationStatus(outletId(), "verified");
  const verified = await renderScreen(VerificationCentreScreen as never, {
    name: "VerificationCentre",
  });
  assert.doesNotMatch(verified.text(), /Get your stall ready/);
});

beforeEach(() => {
  useSessionStore.getState().setReturnRoute(undefined);
});
