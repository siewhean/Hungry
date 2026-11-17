import assert from "node:assert/strict";
import { test } from "node:test";
import { chatConversations, chatMessages } from "@/lib/services/mock/data";
import { ACTIVITY_UPDATES, getActivityUnreadCount, selectVisibleActivityUpdates } from "./activity";
import { filterConversations, mergeChatMessages, storyAuthorKey } from "./socialState";

test("history snapshots preserve a concurrent realtime message and read acknowledgement", () => {
  const messages = Object.values(chatMessages).find((items) => items.length > 1)!;
  const history = messages.slice(0, -1);
  const incoming = { ...messages.at(-1)!, readAt: messages.at(-1)!.createdAt };
  const merged = mergeChatMessages(history, [incoming], history);
  assert.equal(merged.length, messages.length);
  assert.equal(merged.find((item) => item.id === incoming.id)?.readAt, incoming.readAt);
});
test("message retries reconcile by stable nonce without duplicating a delivery", () => {
  const message = Object.values(chatMessages)[0][0];
  const first = { ...message, clientNonce: "attempt" };
  const confirmed = { ...first, id: `${message.id}-confirmed` };
  assert.equal(mergeChatMessages([first], [confirmed]).length, 1);
  assert.equal(mergeChatMessages([first], [confirmed])[0].id, confirmed.id);
});
test("conversation search is normalized and searches message text", () => {
  assert.deepEqual(filterConversations(chatConversations, "   "), chatConversations);
  assert.ok(
    filterConversations(chatConversations, ` ${chatConversations[0].title.toUpperCase()} `).some(
      (item) => item.id === chatConversations[0].id,
    ),
  );
  assert.equal(filterConversations(chatConversations, "no-such-conversation-427").length, 0);
});
test("recipient filtering and unread badge use the same visible events", () => {
  const base = ACTIVITY_UPDATES[0];
  const updates = [
    { ...base, recipientUserId: "owner" },
    { ...base, id: `${base.id}-other`, recipientUserId: "other" },
  ];
  assert.equal(selectVisibleActivityUpdates(updates, "owner").length, 1);
  assert.equal(getActivityUnreadCount([], updates, "owner"), 1);
  assert.equal(getActivityUnreadCount([`update:${base.id}`], updates, "owner"), 0);
});
test("same-name story authors stay distinct and unknown author uses story identity", () => {
  assert.notEqual(
    storyAuthorKey({ id: "one", authorId: "author-one" }),
    storyAuthorKey({ id: "two", authorId: "author-two" }),
  );
  assert.equal(storyAuthorKey({ id: "unknown" }), "unknown");
});
