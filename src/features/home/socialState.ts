import type { ChatConversation, ChatMessage } from "@/lib/services/types";

/** Merge server snapshots with realtime delivery without discarding concurrent messages. */
export function mergeChatMessages(...groups: ChatMessage[][]): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (const message of groups.flat()) {
    const index = result.findIndex(
      (item) =>
        item.id === message.id ||
        Boolean(
          message.clientNonce &&
          item.clientNonce === message.clientNonce &&
          item.sender.userId === message.sender.userId,
        ),
    );
    if (index < 0) result.push(message);
    else
      result[index] = {
        ...result[index],
        ...message,
        readAt: message.readAt ?? result[index].readAt,
      };
  }
  return result.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function filterConversations(conversations: ChatConversation[], query: string) {
  const search = query.trim().toLocaleLowerCase();
  return conversations.filter(
    (item) =>
      !search || `${item.title} ${item.lastMessage ?? ""}`.toLocaleLowerCase().includes(search),
  );
}

export function storyAuthorKey(story: { id: string; authorId?: string }) {
  return story.authorId || story.id;
}
