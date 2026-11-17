import assert from "node:assert/strict";
import { test } from "node:test";
import { chatConversations } from "@/lib/services/mock/data";
import { useChatDraftStore } from "./useChatDraftStore";

test("drafts survive composer remount, preserve retry identity, and isolate account keys", () => {
  const chatId = chatConversations[0].id;
  const store = useChatDraftStore.getState();
  store.clearAccountScopedState();
  store.setDraft(`a:${chatId}`, chatConversations[0].title);
  const nonce = store.getNonce(`a:${chatId}`);
  assert.equal(store.getNonce(`a:${chatId}`), nonce);
  assert.equal(useChatDraftStore.getState().drafts[`b:${chatId}`], undefined);
  store.setDraft(`a:${chatId}`, `${chatConversations[0].title} new text`);
  assert.notEqual(store.getNonce(`a:${chatId}`), nonce);
  store.clearDraft(`a:${chatId}`, chatConversations[0].title);
  assert.ok(useChatDraftStore.getState().drafts[`a:${chatId}`]);
  store.clearAccountScopedState();
  assert.deepEqual(useChatDraftStore.getState().drafts, {});
});

test("account-scoped chat drafts restore after logout and reject another account's draft", async () => {
  const chat = chatConversations[0];
  const store = useChatDraftStore.getState();
  store.clearAccountScopedState();
  await store.setAccountScope("chat-draft-owner-a");
  store.setDraft(`a:${chat.id}`, chat.title);
  const nonce = store.getNonce(`a:${chat.id}`);
  store.clearAccountScopedState();
  assert.deepEqual(useChatDraftStore.getState().drafts, {});
  await store.setAccountScope("chat-draft-owner-b");
  assert.equal(useChatDraftStore.getState().drafts[`a:${chat.id}`], undefined);
  store.setDraft(`b:${chat.id}`, chat.lastMessage ?? chat.title);
  await store.setAccountScope("chat-draft-owner-a");
  assert.equal(useChatDraftStore.getState().drafts[`a:${chat.id}`]?.text, chat.title);
  assert.equal(useChatDraftStore.getState().drafts[`a:${chat.id}`]?.nonce, nonce);
  assert.equal(useChatDraftStore.getState().drafts[`b:${chat.id}`], undefined);
  store.clearAccountScopedState();
});
