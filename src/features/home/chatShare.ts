import type { ChatConversation } from "@/lib/services/types";

export type ChatShareRecipient = {
  id: string;
  avatar: string;
  name: string;
  lastMessage?: string;
};

export function toChatShareRecipient(conversation: ChatConversation): ChatShareRecipient {
  const otherParticipant = conversation.participants.find(
    (participant) => !participant.isCurrentUser,
  );
  return {
    id: conversation.id,
    avatar: conversation.avatarUrl ?? otherParticipant?.avatarUrl ?? "",
    name: conversation.title || otherParticipant?.displayName || "Hungry chat",
    lastMessage: conversation.lastMessage,
  };
}
