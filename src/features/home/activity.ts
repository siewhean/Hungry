export type ActivityMediaType = "image" | "video";

export type ActivityMediaAttachment = {
  uri: string;
  mediaType: ActivityMediaType;
  fileName?: string;
  mimeType?: string;
};

export type ActivityMessage = {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  avatar: string;
  isOnline?: boolean;
  unread?: boolean;
  unreadCount?: number;
};

export type ActivityChatMessage = {
  id: string;
  text: string;
  sent: boolean;
  createdAt: string;
  media?: ActivityMediaAttachment;
  sharedPost?: SharedPostPayload;
};

export type SharedPostPayload = {
  postId: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  authorName: string;
};

export type ActivityUpdateKind =
  | "comment"
  | "like"
  | "share"
  | "submission"
  | "follow"
  | "follow_request";
export type ActivityItemType = "message" | "update";

export type ActivityUpdate = {
  id: string;
  kind: ActivityUpdateKind;
  postId: string;
  actorName: string;
  actorId?: string;
  actorAvatarUrl?: string;
  recipientUserId?: string;
  text: string;
  target: string;
  time: string;
  unread?: boolean;
};

export const ACTIVITY_MESSAGES: ActivityMessage[] = [
  {
    id: "1",
    name: "Ahmad",
    isOnline: true,
    lastMessage: "That chicken rice was amazing!",
    time: "2m",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop",
    unread: true,
    unreadCount: 3,
  },
  {
    id: "2",
    name: "Sarah",
    isOnline: false,
    lastMessage: "Are we still on for Maxwell later?",
    time: "1h",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop",
    unread: true,
    unreadCount: 1,
  },
  {
    id: "3",
    name: "Uncle Tan",
    isOnline: true,
    lastMessage: "The laksa here is very spicy ah.",
    time: "3h",
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100&auto=format&fit=crop",
  },
  {
    id: "4",
    name: "Wei Ling",
    isOnline: false,
    lastMessage: "Check out this new stall I found!",
    time: "5h",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=100&auto=format&fit=crop",
  },
];

export const ACTIVITY_CHAT_MESSAGES: Record<string, ActivityChatMessage[]> = {
  "1": [
    { id: "1-1", text: "That chicken rice was amazing!", sent: false, createdAt: "2m" },
    { id: "1-2", text: "The rice was fragrant right?", sent: true, createdAt: "1m" },
    { id: "1-3", text: "Yes, and the chilli was sharp.", sent: false, createdAt: "now" },
  ],
  "2": [
    { id: "2-1", text: "Are we still on for Maxwell later?", sent: false, createdAt: "1h" },
    { id: "2-2", text: "Yes, after 7 works.", sent: true, createdAt: "58m" },
  ],
  "3": [
    { id: "3-1", text: "The laksa here is very spicy ah.", sent: false, createdAt: "3h" },
    { id: "3-2", text: "Worth trying if I order less chilli?", sent: true, createdAt: "2h" },
    { id: "3-3", text: "Can. Ask for half chilli.", sent: false, createdAt: "2h" },
  ],
  "4": [
    { id: "4-1", text: "Check out this new stall I found!", sent: false, createdAt: "5h" },
    { id: "4-2", text: "Send me the post.", sent: true, createdAt: "5h" },
  ],
};

export const ACTIVITY_UPDATES: ActivityUpdate[] = [
  {
    id: "comment-1",
    kind: "comment",
    postId: "post-2",
    actorName: "Sarah",
    text: "commented on your laksa post",
    target: "Maxwell Food Centre",
    time: "8m",
    unread: true,
  },
  {
    id: "like-1",
    kind: "like",
    postId: "post-1",
    actorName: "Ahmad",
    text: "liked your chicken rice bite",
    target: "Tian Tian Hainanese Chicken Rice",
    time: "22m",
    unread: true,
  },
  {
    id: "like-2",
    kind: "like",
    postId: "post-3",
    actorName: "Wei Ling",
    text: "liked your satay recommendation",
    target: "Lau Pa Sat Satay Street",
    time: "1h",
  },
  {
    id: "comment-2",
    kind: "comment",
    postId: "post-3",
    actorName: "Uncle Tan",
    text: "commented on your satay post",
    target: "Lau Pa Sat Satay Street",
    time: "3h",
  },
];

export function getActivityReadKey(type: ActivityItemType, id: string) {
  return `${type}:${id}`;
}

export type ActivityEventRecord = {
  id: string;
  actorId: string;
  actorName: string;
  actorAvatarUrl?: string;
  eventType: "new_like" | "new_comment" | "new_reply" | "new_follower" | "follow_request";
  targetType: "post" | "comment" | "profile";
  targetId: string;
  /** The post a comment/reply target belongs to, resolved by the service. */
  postId?: string;
  readAt?: string;
  createdAt: string;
};

const ACTIVITY_EVENT_TEXT: Record<ActivityEventRecord["eventType"], string> = {
  new_like: "liked your post",
  new_comment: "commented on your post",
  new_reply: "replied to your comment",
  new_follower: "started following you",
  follow_request: "requested to follow you",
};

/**
 * Server activity event -> inbox row. `time` stays the ISO timestamp (for
 * sorting; the inbox formats it) and `target` is left empty so the inbox shows
 * a readable label (the dish) instead of a raw id.
 */
export function mapActivityEventToUpdate(event: ActivityEventRecord): ActivityUpdate {
  const kind: ActivityUpdateKind =
    event.eventType === "new_like"
      ? "like"
      : event.eventType === "new_follower"
        ? "follow"
        : event.eventType === "follow_request"
          ? "follow_request"
          : "comment";
  return {
    id: event.id,
    kind,
    postId: event.postId ?? (event.targetType === "post" ? event.targetId : ""),
    actorId: event.actorId,
    actorName: event.actorName,
    actorAvatarUrl: event.actorAvatarUrl,
    text: ACTIVITY_EVENT_TEXT[event.eventType] ?? "interacted with you",
    target: event.eventType === "follow_request" ? "Review follow requests" : "",
    time: event.createdAt,
    unread: !event.readAt,
  };
}

/** The updates the inbox lists: seeded demo updates in mock mode, server events otherwise. */
export function selectActivitySourceUpdates(
  mode: string,
  dbActivityEvents: ActivityUpdate[],
  localActivityUpdates: ActivityUpdate[],
): ActivityUpdate[] {
  return mode === "mock"
    ? [...ACTIVITY_UPDATES, ...localActivityUpdates]
    : [...dbActivityEvents, ...localActivityUpdates];
}

/** True when this update is addressed to the viewer (or to everyone). */
export function isActivityUpdateForViewer(update: ActivityUpdate, viewerId?: string) {
  return !update.recipientUserId || update.recipientUserId === viewerId;
}

/**
 * Unread updates count. Pass the viewer id so the Home bell and the inbox
 * count the same updates.
 */
export function getActivityUnreadCount(
  readActivityIds: string[] = [],
  activityUpdates: ActivityUpdate[] = ACTIVITY_UPDATES,
  viewerId?: string,
) {
  const readIds = new Set(readActivityIds);
  return activityUpdates.filter(
    (update) =>
      update.unread &&
      (viewerId === undefined || isActivityUpdateForViewer(update, viewerId)) &&
      !readIds.has(getActivityReadKey("update", update.id)),
  ).length;
}

/** One inbox row: a single update, or several likes on the same post folded together. */
export type ActivityRow = ActivityUpdate & {
  /** Ids of every update shown by this row, the row's own id first. */
  memberIds: string[];
  /** Any member still unread (server read_at, or a local read mark). */
  isUnread: boolean;
  /** People folded into the row; 1 for a plain update. */
  actorCount: number;
};

/**
 * Folds likes on the same post into one row ("Ahmad and 4 others liked your post").
 * Input order is kept: a group sits where its newest like was. Other kinds stay one
 * row each.
 */
export function groupActivityUpdates(
  updates: ActivityUpdate[],
  readActivityIds: string[] = [],
): ActivityRow[] {
  const readIds = new Set(readActivityIds);
  const isUnread = (update: ActivityUpdate) =>
    Boolean(update.unread) && !readIds.has(getActivityReadKey("update", update.id));
  const rows: ActivityRow[] = [];
  const likeRowByPost = new Map<string, ActivityRow>();
  for (const update of updates) {
    const groupKey = update.kind === "like" && update.postId ? update.postId : null;
    const existing = groupKey ? likeRowByPost.get(groupKey) : undefined;
    if (existing) {
      existing.memberIds.push(update.id);
      existing.actorCount += 1;
      existing.isUnread = existing.isUnread || isUnread(update);
      existing.unread = existing.isUnread;
      existing.text = `and ${existing.actorCount - 1} ${
        existing.actorCount === 2 ? "other" : "others"
      } liked your post`;
      continue;
    }
    const row: ActivityRow = {
      ...update,
      memberIds: [update.id],
      isUnread: isUnread(update),
      actorCount: 1,
    };
    rows.push(row);
    if (groupKey) likeRowByPost.set(groupKey, row);
  }
  return rows;
}

export function getActivityMessageUnreadCount(
  message: ActivityMessage,
  readActivityIds: string[] = [],
) {
  return message.unread && !readActivityIds.includes(getActivityReadKey("message", message.id))
    ? (message.unreadCount ?? 1)
    : 0;
}
