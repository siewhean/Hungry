export type ActivityUpdateKind =
  | "comment"
  | "like"
  | "share"
  | "submission"
  | "follow"
  | "follow_request"
  | "board";
export type ActivityItemType = "update";

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
  eventType:
    | "new_like"
    | "new_comment"
    | "new_reply"
    | "new_follower"
    | "follow_request"
    | "board_top_ten";
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
  board_top_ten: "You made this week's top ten",
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
          : event.eventType === "board_top_ten"
            ? "board"
            : "comment";
  return {
    id: event.id,
    kind,
    postId: event.postId ?? (event.targetType === "post" ? event.targetId : ""),
    actorId: event.actorId,
    // The board row is about you: it is titled by the board, not by your own name.
    actorName: event.eventType === "board_top_ten" ? "This week's board" : event.actorName,
    actorAvatarUrl: event.actorAvatarUrl,
    text: ACTIVITY_EVENT_TEXT[event.eventType] ?? "interacted with you",
    target:
      event.eventType === "follow_request"
        ? "Review follow requests"
        : event.eventType === "board_top_ten"
          ? "See the Leaderboard"
          : "",
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
