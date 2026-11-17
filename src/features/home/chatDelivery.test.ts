import assert from "node:assert/strict";
import { test } from "node:test";
import { chatConversations } from "@/lib/services/mock/data";
import { hungryService, clearMockChatAndStoryState } from "@/lib/services/mock/mockService";

test("mock chat service returns one authoritative delivery for repeated send nonce", async () => {
  clearMockChatAndStoryState();
  const conversation = chatConversations[0];
  const before = await hungryService.chat.listMessages(conversation.id);
  const input = {
    conversationId: conversation.id,
    body: conversation.title,
    clientNonce: `retry-${conversation.id}`,
  };
  const first = await hungryService.chat.sendMessage(input);
  const second = await hungryService.chat.sendMessage(input);
  const after = await hungryService.chat.listMessages(conversation.id);
  assert.equal(first.id, second.id);
  assert.equal(after.length, before.length + 1);
});

test("clearing account demos removes private story media and prior chat mutations", async () => {
  clearMockChatAndStoryState();
  assert.equal((await hungryService.social.getStories()).filter((story) => story.isOwn).length, 0);
  assert.deepEqual(
    (await hungryService.chat.listConversations()).map((item) => item.id).sort(),
    chatConversations.map((item) => item.id).sort(),
  );
});
