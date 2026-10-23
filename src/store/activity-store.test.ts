import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { getActivityReadKey } from "@/features/home/activity";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import {
  resetServiceProvider,
  setMockServiceProvider,
  setServiceProvider,
} from "@/lib/services/serviceProvider";
import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import type { HungryService } from "@/lib/services/types";
import { ACTIVITY_PAGE_SIZE, useActivityStore } from "@/store/useActivityStore";
import { useUIStore } from "@/store/useUIStore";

type ServerEvent = {
  id: string;
  actorId: string;
  actorName: string;
  eventType: "new_like" | "new_comment" | "new_reply" | "new_follower" | "follow_request";
  targetType: "post" | "comment" | "profile";
  targetId: string;
  postId?: string;
  readAt?: string;
  createdAt: string;
};

function event(id: string, patch: Partial<ServerEvent> = {}): ServerEvent {
  return {
    id,
    actorId: `actor-${id}`,
    actorName: `Actor ${id}`,
    eventType: "new_like",
    targetType: "post",
    targetId: `post-${id}`,
    createdAt: "2026-10-22T00:00:00.000Z",
    ...patch,
  };
}

type Notifications = {
  listActivityEvents: (page?: { limit?: number; offset?: number }) => Promise<ServerEvent[]>;
  markActivityRead: (id: string) => Promise<void>;
  markAllActivityRead: () => Promise<void>;
};

function installServer(
  notifications: Partial<Notifications>,
  chatSend?: (m: unknown) => Promise<unknown>,
) {
  setServiceProvider({
    mode: "supabase",
    repository: dataRepositoryMock,
    service: {
      notifications,
      chat: { sendMessage: chatSend ?? (async () => undefined) },
    } as unknown as HungryService,
    similarityScore: () => 1,
  });
}

function toast() {
  return useUIStore.getState().toast;
}

beforeEach(() => {
  setConfiguredDataSource("mock");
  setMockServiceProvider();
  useActivityStore.getState().clearAccountScopedState();
  useUIStore.setState({ toast: null });
});

test("fetching maps server events, flags unread by read_at, and knows when older pages exist", async () => {
  const page = Array.from({ length: ACTIVITY_PAGE_SIZE }, (_, i) =>
    event(`e${i}`, i === 0 ? { readAt: "2026-10-22T01:00:00.000Z" } : {}),
  );
  installServer({ listActivityEvents: async () => page });
  await useActivityStore.getState().fetchActivityEvents();

  const state = useActivityStore.getState();
  assert.equal(state.dbActivityEvents.length, ACTIVITY_PAGE_SIZE);
  assert.equal(state.dbActivityEvents[0].unread, false);
  assert.equal(state.dbActivityEvents[1].unread, true);
  assert.equal(state.hasMoreActivity, true);
  assert.equal(state.hasLoadedActivity, true);
  assert.equal(state.getUnreadCount(), ACTIVITY_PAGE_SIZE - 1);
  resetServiceProvider();
});

test("a failed fetch keeps the last good list and flags the failure for the inbox banner", async () => {
  installServer({ listActivityEvents: async () => [event("a")] });
  await useActivityStore.getState().fetchActivityEvents();
  installServer({
    listActivityEvents: async () => {
      throw new Error("offline");
    },
  });
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    await useActivityStore.getState().fetchActivityEvents();
  } finally {
    console.warn = warn;
  }

  const state = useActivityStore.getState();
  assert.equal(state.activityLoadFailed, true);
  assert.equal(state.hasLoadedActivity, true);
  assert.deepEqual(
    state.dbActivityEvents.map((update) => update.id),
    ["a"],
  );
  resetServiceProvider();
});

test("older pages append without duplicates, use the right offset, and cannot run twice at once", async () => {
  const offsets: number[] = [];
  let release: (events: ServerEvent[]) => void = () => {};
  installServer({
    listActivityEvents: async (page) => {
      offsets.push(page?.offset ?? -1);
      if (page?.offset === 0)
        return Array.from({ length: ACTIVITY_PAGE_SIZE }, (_, i) => event(`e${i}`));
      return new Promise<ServerEvent[]>((resolve) => {
        release = resolve;
      });
    },
  });
  await useActivityStore.getState().fetchActivityEvents();

  const first = useActivityStore.getState().fetchMoreActivityEvents();
  const second = useActivityStore.getState().fetchMoreActivityEvents();
  assert.equal(useActivityStore.getState().isLoadingMoreActivity, true);
  release([event("e0"), event("older")]);
  await Promise.all([first, second]);

  const state = useActivityStore.getState();
  assert.deepEqual(offsets, [0, ACTIVITY_PAGE_SIZE]);
  assert.equal(state.dbActivityEvents.length, ACTIVITY_PAGE_SIZE + 1);
  assert.equal(state.hasMoreActivity, false);
  assert.equal(state.isLoadingMoreActivity, false);
  resetServiceProvider();
});

test("a failed older-page load frees the button and tells the person", async () => {
  installServer({
    listActivityEvents: async (page) => {
      if (page?.offset === 0)
        return Array.from({ length: ACTIVITY_PAGE_SIZE }, (_, i) => event(`e${i}`));
      throw new Error("offline");
    },
  });
  await useActivityStore.getState().fetchActivityEvents();
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    await useActivityStore.getState().fetchMoreActivityEvents();
  } finally {
    console.warn = warn;
  }
  assert.equal(useActivityStore.getState().isLoadingMoreActivity, false);
  assert.equal(toast()?.tone, "error");
  resetServiceProvider();
});

test("marking a server event read clears it in place and tells the server; nothing is kept on the device", async () => {
  const marked: string[] = [];
  installServer({
    listActivityEvents: async () => [event("a"), event("b")],
    markActivityRead: async (id) => {
      marked.push(id);
    },
  });
  await useActivityStore.getState().fetchActivityEvents();
  useActivityStore.getState().markActivityRead("update", "a");

  const state = useActivityStore.getState();
  assert.equal(state.dbActivityEvents.find((update) => update.id === "a")?.unread, false);
  assert.deepEqual(state.readActivityIds, []);
  assert.deepEqual(marked, ["a"]);
  assert.equal(state.getUnreadCount(), 1);
  resetServiceProvider();
});

test("local updates are remembered as read once, and the remembered list is capped", () => {
  const store = useActivityStore.getState();
  store.markActivityRead("update", "local-1");
  store.markActivityRead("update", "local-1");
  assert.deepEqual(useActivityStore.getState().readActivityIds, [
    getActivityReadKey("update", "local-1"),
  ]);

  for (let i = 0; i < 600; i += 1) useActivityStore.getState().markActivityRead("update", `u${i}`);
  const ids = useActivityStore.getState().readActivityIds;
  assert.equal(ids.length, 500);
  assert.equal(ids[ids.length - 1], getActivityReadKey("update", "u599"));

  assert.equal(store.isActivityUnread("update", "u599", true), false);
  assert.equal(store.isActivityUnread("update", "never-read", true), true);
  assert.equal(store.isActivityUnread("update", "never-read", false), false);
});

test("mark all read clears server and local unread; if the server call fails the list is restored", async () => {
  let failMarkAll = false;
  installServer({
    listActivityEvents: async () => [event("a"), event("b")],
    markAllActivityRead: async () => {
      if (failMarkAll) throw new Error("offline");
    },
  });
  await useActivityStore.getState().fetchActivityEvents();
  useActivityStore.getState().addActivityUpdate({
    kind: "like",
    postId: "p",
    actorId: "x",
    actorName: "X",
    text: "liked",
    target: "",
    time: "now",
  } as never);
  assert.equal(useActivityStore.getState().getUnreadCount(), 3);

  await useActivityStore.getState().markAllActivityRead();
  assert.equal(useActivityStore.getState().getUnreadCount(), 0);

  installServer({
    listActivityEvents: async () => [event("a"), event("b")],
    markAllActivityRead: async () => {
      throw new Error("offline");
    },
  });
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    failMarkAll = true;
    await useActivityStore.getState().markAllActivityRead();
  } finally {
    console.warn = warn;
  }
  assert.equal(toast()?.tone, "error");
  // The refetch puts back what the server still has as unread.
  assert.equal(
    useActivityStore.getState().dbActivityEvents.filter((update) => update.unread).length,
    2,
  );
  resetServiceProvider();
});

test("mock mode never calls the server", async () => {
  await useActivityStore.getState().fetchActivityEvents();
  await useActivityStore.getState().fetchMoreActivityEvents();
  await useActivityStore.getState().markAllActivityRead();
  assert.equal(useActivityStore.getState().hasLoadedActivity, false);
  assert.deepEqual(useActivityStore.getState().dbActivityEvents, []);
});

test("sharing a post to chat sends the message with a link and keeps the rich card locally", async () => {
  const sent: { conversationId: string; body: string }[] = [];
  installServer({}, async (message) => {
    sent.push(message as never);
  });
  await useActivityStore.getState().sharePostToChat("chat-1", {
    postId: "p1",
    title: "Laksa",
    subtitle: "Katong",
  } as never);

  assert.equal(sent.length, 1);
  assert.equal(sent[0].conversationId, "chat-1");
  assert.match(sent[0].body, /^Shared Laksa\nKatong\nhttps?:\/\/.+p1/);
  const [message] = useActivityStore.getState().sharedPostMessages["chat-1"];
  assert.equal(message.sent, true);
  assert.equal(message.sharedPost?.postId, "p1");

  // A failed send leaves no phantom message.
  installServer({}, async () => {
    throw new Error("offline");
  });
  await assert.rejects(() =>
    useActivityStore
      .getState()
      .sharePostToChat("chat-2", { postId: "p2", title: "T", subtitle: "S" } as never),
  );
  assert.equal(useActivityStore.getState().sharedPostMessages["chat-2"], undefined);
  resetServiceProvider();
});

test("clearAccountScopedState wipes everything a previous account left behind", async () => {
  useActivityStore.getState().markActivityRead("update", "x");
  useActivityStore.setState({
    hasLoadedActivity: true,
    activityLoadFailed: true,
    hasMoreActivity: true,
  });
  useActivityStore.getState().clearAccountScopedState();
  const state = useActivityStore.getState();
  assert.deepEqual(
    [
      state.readActivityIds,
      state.sharedPostMessages,
      state.activityUpdates,
      state.dbActivityEvents,
    ],
    [[], {}, [], []],
  );
  assert.deepEqual(
    [state.hasLoadedActivity, state.activityLoadFailed, state.hasMoreActivity],
    [false, false, false],
  );
});
