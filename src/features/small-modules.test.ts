import assert from "node:assert/strict";
import test from "node:test";

import {
  NO_ACCOUNT_EMAIL_MESSAGE,
  isNoAccountEmailError,
} from "@/features/auth/accountDeletionErrors";
import {
  trackAuthFailed,
  trackAuthScreenViewed,
  trackGuestContinued,
  trackPasswordResetRequested,
} from "@/features/auth/authAnalytics";
import {
  CURRENT_PLACE_LEAVE_RADIUS_METERS,
  isStillInPlace,
} from "@/features/discover/currentPlace";
import { toChatShareRecipient } from "@/features/home/chatShare";
import {
  listComposerCollaboratorOptions,
  listComposerLocationOptions,
} from "@/features/post/composerOptions";
import { TRENDING_MUSIC } from "@/features/review/musicData";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { toRecommendationGeoCell } from "@/lib/geo/recommendationGeoCell";
import { getDataRepository } from "@/lib/services/serviceProvider";
import type { ChatConversation } from "@/lib/services/types";

test("only the exact no-email error is recognised as such", () => {
  assert.equal(isNoAccountEmailError(new Error(NO_ACCOUNT_EMAIL_MESSAGE)), true);
  assert.equal(isNoAccountEmailError(new Error("something else")), false);
  assert.equal(isNoAccountEmailError(NO_ACCOUNT_EMAIL_MESSAGE), false);
  assert.equal(isNoAccountEmailError(null), false);
});

test("auth funnel events carry the screen, flow, method and a safe failure reason", () => {
  clearTrackedAnalyticsEvents();
  trackAuthScreenViewed("login");
  trackGuestContinued("sign_up");
  trackPasswordResetRequested();
  trackAuthFailed("sign_in", "password", { error_code: "invalid_credentials", message: "Invalid" });
  trackAuthFailed("sign_in", "google", { message: "User Cancelled the flow" });
  trackAuthFailed("sign_up", "password", { code: "weak_password" });
  trackAuthFailed("sign_up", "password", new Error("boom"));
  trackAuthFailed("sign_up", "password", undefined);

  const events = getTrackedAnalyticsEvents();
  assert.deepEqual(
    events.map((event) => event.event),
    [
      "auth_screen_viewed",
      "auth_guest_continued",
      "password_reset_requested",
      "auth_failed",
      "auth_failed",
      "auth_failed",
      "auth_failed",
      "auth_failed",
    ],
  );
  assert.deepEqual(events[0].properties, { screen: "login" });
  assert.deepEqual(events[3].properties, {
    flow: "sign_in",
    method: "password",
    reason: "invalid_credentials",
  });
  assert.equal(events[4].properties.reason, "cancelled");
  assert.equal(events[5].properties.reason, "weak_password");
  assert.equal(events[6].properties.reason, "unknown");
  assert.equal(events[7].properties.reason, "unknown");
  for (const event of events) {
    assert.equal(
      JSON.stringify(event.properties).includes("boom"),
      false,
      "never log raw error text",
    );
  }
});

test("a chat share picks the other person's name and avatar unless the chat has its own", () => {
  const base = {
    id: "c1",
    title: "",
    lastMessage: "see you",
    participants: [
      { id: "me", displayName: "Me", avatarUrl: "me.png", isCurrentUser: true },
      { id: "u2", displayName: "Mei", avatarUrl: "mei.png", isCurrentUser: false },
    ],
  } as unknown as ChatConversation;

  assert.deepEqual(toChatShareRecipient(base), {
    id: "c1",
    avatar: "mei.png",
    name: "Mei",
    lastMessage: "see you",
  });
  const group = toChatShareRecipient({
    ...base,
    title: "Makan crew",
    avatarUrl: "group.png",
  } as ChatConversation);
  assert.equal(group.name, "Makan crew");
  assert.equal(group.avatar, "group.png");
  const lonely = toChatShareRecipient({
    ...base,
    title: "",
    participants: [],
  } as unknown as ChatConversation);
  assert.deepEqual([lonely.name, lonely.avatar], ["Hungry chat", ""]);
});

test("composer options come from real buildings and de-duplicated post authors", () => {
  const locations = listComposerLocationOptions();
  assert.equal(locations.length, getDataRepository().listBuildings().length);
  assert.ok(locations.length > 0);
  for (const location of locations) {
    assert.match(location.address, /, Singapore$/);
    assert.equal(typeof location.coordinate.latitude, "number");
  }

  const collaborators = listComposerCollaboratorOptions();
  assert.equal(new Set(collaborators.map((entry) => entry.handle)).size, collaborators.length);
  for (const collaborator of collaborators) {
    assert.match(collaborator.handle, /^@[a-z0-9_]+$/);
    assert.equal(collaborator.id, `collab-${collaborator.handle.slice(1)}`);
  }
});

test("geo cells are stable within ~500 m and differ across cells", () => {
  const a = toRecommendationGeoCell(1.3, 103.8);
  assert.equal(toRecommendationGeoCell(1.3001, 103.8001), a);
  assert.notEqual(toRecommendationGeoCell(1.32, 103.8), a);
  assert.notEqual(toRecommendationGeoCell(1.3, 103.83), a);
  assert.match(a, /^-?\d+:-?\d+$/);
  // Near the poles the longitude cell widens instead of dividing by ~0.
  assert.match(toRecommendationGeoCell(89.9, 10), /^-?\d+:-?\d+$/);
  // Negative coordinates floor consistently.
  assert.notEqual(toRecommendationGeoCell(-0.001, -0.001), toRecommendationGeoCell(0.001, 0.001));
});

test("leaving a place needs the larger radius so the label does not flicker", () => {
  const place = { id: "p", name: "JEM", latitude: 1.333, longitude: 103.7434 } as never;
  assert.equal(isStillInPlace(place, { latitude: 1.333, longitude: 103.7434 }), true);
  // ~111 m north: inside the leave radius.
  assert.equal(isStillInPlace(place, { latitude: 1.334, longitude: 103.7434 }), true);
  // ~220 m north: outside.
  assert.equal(isStillInPlace(place, { latitude: 1.335, longitude: 103.7434 }), false);
  assert.equal(CURRENT_PLACE_LEAVE_RADIUS_METERS, 160);
  assert.equal(
    isStillInPlace({ id: "p", name: "x" } as never, { latitude: 1, longitude: 1 }),
    false,
  );
});

test("trending music has unique ids, 30 second previews and https urls", () => {
  assert.ok(TRENDING_MUSIC.length > 0);
  assert.equal(new Set(TRENDING_MUSIC.map((track) => track.id)).size, TRENDING_MUSIC.length);
  for (const track of TRENDING_MUSIC) {
    assert.equal(track.duration, 30);
    assert.match(track.url, /^https:\/\//);
    assert.ok(track.title && track.artist);
  }
});
