import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { alertCalls } from "@/test/reactNativeStub";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  clearCommunitySafetySessionState,
  getBlockedAuthorIdsForSession,
  getHiddenPostIdsForSession,
  isContentHiddenForSession,
  loadBlockedAuthorsForSession,
  markPostRemovedForSession,
  promptBlockReviewAuthor,
  promptCommentSafetyActions,
  promptPostSafetyActions,
  promptReportReview,
  promptReviewSafetyActions,
  targetAuthorKey,
  unblockUserForSession,
  unhidePostForSession,
} from "@/lib/security/communitySafety";
import { getHungryService, setMockServiceProvider } from "@/lib/services/serviceProvider";
import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";

type SafetyService = Record<string, (...args: never[]) => unknown>;
const restores: (() => void)[] = [];

function overrideSafety(overrides: SafetyService) {
  const safety = getHungryService().communitySafety as unknown as SafetyService;
  for (const [key, value] of Object.entries(overrides)) {
    const original = safety[key];
    safety[key] = value;
    restores.push(() => {
      safety[key] = original;
    });
  }
}

async function settle() {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

function lastToast() {
  return useUIStore.getState().toast;
}

function eventNames() {
  return getTrackedAnalyticsEvents().map((event) => event.event);
}

beforeEach(() => {
  setConfiguredDataSource("mock");
  setMockServiceProvider();
  clearCommunitySafetySessionState();
  useSessionStore.setState({ isAuthenticated: true });
  useUIStore.setState({ toast: null, safetyMenu: null });
  alertCalls.length = 0;
  clearTrackedAnalyticsEvents();
});

afterEach(() => {
  while (restores.length) restores.pop()?.();
});

test("targetAuthorKey makes a stable slug and caps its length", () => {
  assert.equal(targetAuthorKey("  Mei  Ling Tan "), "mei-ling-tan");
  assert.equal(targetAuthorKey("A".repeat(200)).length, 80);
});

test("hidden posts and blocked authors both hide content; blank author ids never match", async () => {
  assert.equal(isContentHiddenForSession({ id: "p1" }), false);
  markPostRemovedForSession("p1");
  assert.equal(isContentHiddenForSession({ id: "p1" }), true);
  assert.ok(getHiddenPostIdsForSession().has("p1"));

  await getHungryService().communitySafety.blockUser({ blockedUserId: "u-bad", reason: "x" });
  await loadBlockedAuthorsForSession();
  assert.equal(isContentHiddenForSession({ id: "p2", authorId: "u-bad" }), true);
  assert.equal(isContentHiddenForSession({ id: "p2", authorId: "  " }), false);
  assert.equal(isContentHiddenForSession({ id: "p2", authorId: null }), false);

  clearCommunitySafetySessionState();
  assert.equal(isContentHiddenForSession({ id: "p1", authorId: "u-bad" }), false);
  await getHungryService().communitySafety.unblockUser("u-bad");
});

test("loadBlockedAuthorsForSession keeps what it knew when the server read fails", async () => {
  overrideSafety({
    getBlockedUsers: async () => [
      { blockedUserId: " u1 ", createdAt: "" },
      { blockedUserId: "", createdAt: "" },
    ],
  });
  await loadBlockedAuthorsForSession();
  assert.deepEqual([...getBlockedAuthorIdsForSession()], ["u1"]);

  overrideSafety({
    getBlockedUsers: async () => {
      throw new Error("offline");
    },
  });
  const result = await loadBlockedAuthorsForSession();
  assert.deepEqual([...result], ["u1"]);
});

test("unblocking and unhiding call the server, then show the content again and track it", async () => {
  const calls: string[] = [];
  overrideSafety({
    unblockUser: async (id: never) => {
      calls.push(`unblock:${id}`);
    },
    unhidePost: async (id: never) => {
      calls.push(`unhide:${id}`);
    },
  });
  markPostRemovedForSession("p1");
  overrideSafety({ getBlockedUsers: async () => [{ blockedUserId: "u1", createdAt: "" }] });
  await loadBlockedAuthorsForSession();

  await unblockUserForSession("u1");
  await unhidePostForSession("p1");

  assert.deepEqual(calls, ["unblock:u1", "unhide:p1"]);
  assert.equal(isContentHiddenForSession({ id: "p1", authorId: "u1" }), false);
  assert.deepEqual(eventNames(), ["user_unblocked", "post_unhidden"]);
});

test("a failed unblock leaves the author blocked", async () => {
  overrideSafety({
    getBlockedUsers: async () => [{ blockedUserId: "u1", createdAt: "" }],
    unblockUser: async () => {
      throw new Error("offline");
    },
  });
  await loadBlockedAuthorsForSession();
  await assert.rejects(() => unblockUserForSession("u1"), /offline/);
  assert.equal(getBlockedAuthorIdsForSession().has("u1"), true);
});

test("a guest is told to sign in instead of getting a report menu", () => {
  useSessionStore.setState({ isAuthenticated: false });
  promptPostSafetyActions({ postId: "p1", authorName: "Mei", authorId: "u1" });
  assert.equal(useUIStore.getState().safetyMenu, null);
  assert.equal(alertCalls[0]?.title, "Sign in to report or block");
});

test("the post menu offers hide and block only when it can, and seeded authors cannot be blocked", () => {
  promptPostSafetyActions({ postId: "p1", authorName: "Mei", authorId: "u1" });
  let menu = useUIStore.getState().safetyMenu;
  assert.ok(menu);
  assert.deepEqual([menu.label, menu.canHide, menu.canBlock], ["post", true, true]);

  promptPostSafetyActions({ postId: "p1", authorName: "Seeded", authorId: " " });
  menu = useUIStore.getState().safetyMenu;
  assert.equal(menu?.canBlock, false);

  promptCommentSafetyActions({ commentId: "c1", authorName: "Mei", authorId: "u1" });
  menu = useUIStore.getState().safetyMenu;
  assert.deepEqual([menu?.label, menu?.canHide, menu?.canBlock], ["comment", false, true]);

  promptCommentSafetyActions({ commentId: "c1", authorName: "Mei", authorId: "u1", postId: "p9" });
  assert.equal(useUIStore.getState().safetyMenu?.canHide, true);
});

test("reporting sends the id-keyed report, tracks it and confirms with a toast", async () => {
  const reports: unknown[] = [];
  overrideSafety({
    reportContent: async (request: never) => {
      reports.push(request);
    },
  });
  promptPostSafetyActions({ postId: "p1", authorName: "Mei Ling", authorId: "u1" });
  useUIStore.getState().safetyMenu?.onReport("spam" as never);
  await settle();

  assert.deepEqual(reports, [
    {
      targetType: "post",
      targetId: "p1",
      targetAuthorKey: "u1",
      reason: "user_reported_post_spam",
    },
  ]);
  assert.equal(lastToast()?.tone, "success");
  assert.deepEqual(eventNames(), ["content_report_submitted"]);
});

test("a failed report shows an error toast and tracks nothing", async () => {
  overrideSafety({
    reportContent: async () => {
      throw new Error("offline");
    },
  });
  promptPostSafetyActions({ postId: "p1", authorName: "Mei", authorId: null });
  useUIStore.getState().safetyMenu?.onReport("spam" as never);
  await settle();
  assert.equal(lastToast()?.tone, "error");
  assert.deepEqual(eventNames(), []);
});

test("hiding records the post, calls onHidden, and a failed hide changes nothing", async () => {
  const hidden: string[] = [];
  promptPostSafetyActions({ postId: "p1", authorName: "Mei", onHidden: (id) => hidden.push(id) });
  useUIStore.getState().safetyMenu?.onHide();
  await settle();
  assert.deepEqual(hidden, ["p1"]);
  assert.equal(getHiddenPostIdsForSession().has("p1"), true);
  assert.ok(eventNames().includes("post_hidden"));

  clearCommunitySafetySessionState();
  overrideSafety({
    hidePost: async () => {
      throw new Error("offline");
    },
  });
  promptPostSafetyActions({ postId: "p2", authorName: "Mei", onHidden: (id) => hidden.push(id) });
  useUIStore.getState().safetyMenu?.onHide();
  await settle();
  assert.deepEqual(hidden, ["p1"]);
  assert.equal(getHiddenPostIdsForSession().has("p2"), false);
  assert.equal(lastToast()?.tone, "error");
});

test("blocking a comment author hides them everywhere and a failed block does not", async () => {
  const blocked: string[] = [];
  promptCommentSafetyActions({
    commentId: "c1",
    authorName: "Mei",
    authorId: "u-new",
    onBlocked: (id) => blocked.push(id),
  });
  useUIStore.getState().safetyMenu?.onBlock();
  await settle();
  assert.deepEqual(blocked, ["u-new"]);
  assert.equal(isContentHiddenForSession({ id: "any", authorId: "u-new" }), true);
  assert.ok(eventNames().includes("user_blocked"));
  await getHungryService().communitySafety.unblockUser("u-new");

  clearCommunitySafetySessionState();
  overrideSafety({
    blockUser: async () => {
      throw new Error("offline");
    },
  });
  promptCommentSafetyActions({
    commentId: "c2",
    authorName: "Mei",
    authorId: "u-2",
    onBlocked: (id) => blocked.push(id),
  });
  useUIStore.getState().safetyMenu?.onBlock();
  await settle();
  assert.deepEqual(blocked, ["u-new"]);
  assert.equal(isContentHiddenForSession({ id: "any", authorId: "u-2" }), false);
});

test("reporting a review asks first, then hides it for the reporter", async () => {
  const hidden: string[] = [];
  promptReportReview({
    reviewId: "r1",
    authorName: "Mei",
    authorId: "u1",
    onHidden: (id) => hidden.push(id),
  });
  const alert = alertCalls[0];
  assert.match(alert.title, /Report review/);
  assert.deepEqual(hidden, []);

  alert.buttons?.find((button) => button.text === "Report")?.onPress?.();
  await settle();
  assert.deepEqual(hidden, ["r1"]);
  assert.equal(isContentHiddenForSession({ id: "r1" }), true);
  assert.ok(eventNames().includes("content_report_submitted"));
});

test("blocking a review author needs an account id; otherwise the person is pointed to Report", async () => {
  promptBlockReviewAuthor({ reviewId: "r1", authorName: "Seeded", authorId: undefined });
  assert.equal(alertCalls[0].title, "Cannot block this author");

  promptBlockReviewAuthor({ reviewId: "r1", authorName: "Mei", authorId: "u-rev" });
  alertCalls[1].buttons?.find((button) => button.text === "Block")?.onPress?.();
  await settle();
  assert.equal(getBlockedAuthorIdsForSession().has("u-rev"), true);
  await getHungryService().communitySafety.unblockUser("u-rev");
});

test("the review action sheet offers report and block for a review with an author account", async () => {
  const hidden: string[] = [];
  promptReviewSafetyActions({
    reviewId: "r1",
    authorName: "Mei",
    authorId: "u1",
    onHidden: (id) => hidden.push(id),
  });
  const menu = useUIStore.getState().safetyMenu;
  assert.equal(menu?.label, "review");
  assert.equal(menu?.canHide, false);
  assert.equal(menu?.canBlock, true);
  assert.equal(alertCalls.length, 0);

  menu?.onReport("spam");
  await settle();
  assert.deepEqual(hidden, ["r1"]);
  assert.equal(isContentHiddenForSession({ id: "r1" }), true);
  useUIStore.getState().closeSafetyMenu();
});

test("the review action sheet cannot block a seeded review with no author account", () => {
  promptReviewSafetyActions({ reviewId: "r2", authorName: "Seeded" });
  assert.equal(useUIStore.getState().safetyMenu?.canBlock, false);
  useUIStore.getState().closeSafetyMenu();
});
