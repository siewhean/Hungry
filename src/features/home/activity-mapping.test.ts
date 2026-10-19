import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { mapActivityEventToUpdate } from "./activity";

const base = {
  id: "evt-1",
  actorId: "user-2",
  actorName: "Ahmad",
  targetId: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-10-19T08:00:00.000Z",
};

test("activity events never use raw ids or timestamps as the visible target", () => {
  const like = mapActivityEventToUpdate({ ...base, eventType: "new_like", targetType: "post" });
  assert.equal(like.kind, "like");
  assert.equal(like.postId, base.targetId);
  assert.equal(like.target, "");
  assert.equal(like.unread, true);
});

test("new followers open the follower's profile, not a dead share row", () => {
  const follow = mapActivityEventToUpdate({
    ...base,
    eventType: "new_follower",
    targetType: "profile",
    readAt: "2026-10-19T09:00:00.000Z",
  });
  assert.equal(follow.kind, "follow");
  assert.equal(follow.postId, "");
  assert.equal(follow.actorId, "user-2");
  assert.equal(follow.unread, false);
});

test("reply events point at the comment's post when the service resolved it", () => {
  const reply = mapActivityEventToUpdate({
    ...base,
    eventType: "new_reply",
    targetType: "comment",
    postId: "post-9",
  });
  assert.equal(reply.kind, "comment");
  assert.equal(reply.postId, "post-9");
  assert.equal(reply.text, "replied to your comment");
});

test("inbox formats times and routes follows to UserProfile", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/screens/home/ActivityInboxScreen.tsx"),
    "utf8",
  );
  assert.match(source, /\{formatTimeAgo\(update\.time\)\}/);
  assert.match(source, /update\.kind === "follow"\) \{\s*navigation\.navigate\("UserProfile"/);
  assert.doesNotMatch(source, /Open update for \$\{update\.target\}/);
  // Each update row shows who acted.
  assert.match(
    source,
    /<Avatar uri=\{update\.actorAvatarUrl\} name=\{update\.actorName\} size=\{40\} \/>/,
  );
});
