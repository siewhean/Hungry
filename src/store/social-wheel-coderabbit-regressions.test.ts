import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { type TestContext } from "node:test";
import { userProfile, dishes } from "@/lib/services/mock/data";
import { hungryService } from "@/lib/services/mock/mockService";
import { dataRepositoryMock } from "@/lib/services/mock/repositories";
import { similarityScore } from "@/lib/ai/similarityScore";
import { setServiceProvider, resetServiceProvider } from "@/lib/services/serviceProvider";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useUIStore } from "./useUIStore";
import { useActivityStore } from "./useActivityStore";
import { useSocialStore, type SocialComment } from "./useSocialStore";
import { createWheelStore } from "./useWheelStore";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function expectedErrors(t: TestContext) {
  const errors: unknown[][] = [];
  const original = console.error.bind(console);
  t.mock.method(console, "error", (...args: unknown[]) => {
    if (args[1] instanceof Error && args[1].message.startsWith("expected ")) errors.push(args);
    else original(...args);
  });
  return errors;
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const broadcast = () => new Promise<void>((resolve) => setTimeout(resolve, 75));

function enableMockWheel(t: TestContext) {
  const descriptor = Object.getOwnPropertyDescriptor(FEATURE_FLAGS, "wheelPartyEnabled");
  assert.ok(descriptor, "wheel party flag must have a restorable property descriptor");
  Object.defineProperty(FEATURE_FLAGS, "wheelPartyEnabled", { ...descriptor, value: true });
  t.after(() => Object.defineProperty(FEATURE_FLAGS, "wheelPartyEnabled", descriptor));
}

function configure(social: Partial<typeof hungryService.social>) {
  useSocialStore.getState().clearAccountScopedState();
  useActivityStore.getState().clearAccountScopedState();
  useUIStore.setState({ hapticFeedbackEnabled: false });
  setServiceProvider({
    mode: "supabase",
    service: { ...hungryService, social: { ...hungryService.social, ...social } },
    repository: dataRepositoryMock,
    similarityScore,
  });
}
function comment(): SocialComment {
  return {
    id: randomUUID(),
    userId: userProfile.id,
    authorName: userProfile.displayName,
    text: dishes[0].name,
    createdAt: new Date().toISOString(),
  };
}
function accepted(input: SocialComment, parentCommentId?: string) {
  return {
    id: randomUUID(),
    userId: userProfile.id,
    authorName: input.authorName,
    body: input.text,
    createdAt: input.createdAt,
    parentCommentId,
  };
}

test("CR-S14 failed like rolls back only its fields after save and share succeed", async (t) => {
  const errors = expectedErrors(t);
  const like = deferred<void>();
  configure({
    reactToBite: (_id, reaction) => (reaction === "craving" ? like.promise : Promise.resolve()),
    shareBite: async () => undefined,
  });
  t.after(resetServiceProvider);
  const postId = randomUUID();
  useSocialStore.getState().toggleLike(postId);
  useSocialStore.getState().toggleSave(postId);
  useSocialStore.getState().incrementShare(postId);
  like.reject(new Error("expected like rejection"));
  await flush();
  const actual = useSocialStore.getState().interactions[postId];
  assert.equal(actual.liked, false);
  assert.equal(actual.likeCount, 0);
  assert.equal(actual.saved, true);
  assert.equal(actual.saveCount, 1);
  assert.equal(actual.shareCount, 1);
  assert.equal(errors.length, 1, "injected rejection is handled and logged");
});

test("CR-S14 old rollback cannot undo a later like with identical optimistic values", async (t) => {
  const errors = expectedErrors(t);
  const first = deferred<void>();
  let calls = 0;
  configure({ reactToBite: () => (++calls === 1 ? first.promise : Promise.resolve()) });
  t.after(resetServiceProvider);
  const postId = randomUUID();
  useSocialStore.getState().toggleLike(postId);
  useSocialStore.getState().toggleLike(postId);
  useSocialStore.getState().toggleLike(postId);
  await flush();
  first.reject(new Error("expected older rejection"));
  await flush();
  assert.equal(useSocialStore.getState().interactions[postId].liked, true);
  assert.equal(useSocialStore.getState().interactions[postId].likeCount, 1);
  assert.equal(errors.length, 1, "injected rejection is handled and logged");
});

test("CR-S14 each rejected share removes only its own additive contribution", async (t) => {
  const errors = expectedErrors(t);
  const first = deferred<void>();
  let calls = 0;
  configure({ shareBite: () => (++calls === 1 ? first.promise : Promise.resolve()) });
  t.after(resetServiceProvider);
  const postId = randomUUID();
  useSocialStore.getState().incrementShare(postId);
  useSocialStore.getState().incrementShare(postId);
  first.reject(new Error("expected share rejection"));
  await flush();
  assert.equal(useSocialStore.getState().interactions[postId].shareCount, 1);
  assert.equal(errors.length, 1, "injected rejection is handled and logged");
});

test("CR-S14 a rejected share cannot change a newer authoritative interaction snapshot", async (t) => {
  const errors = expectedErrors(t);
  const mutation = deferred<void>();
  configure({ shareBite: () => mutation.promise });
  t.after(resetServiceProvider);
  const postId = randomUUID();
  useSocialStore.getState().incrementShare(postId);
  const current = useSocialStore.getState().interactions[postId];
  useSocialStore.getState().setInteraction(postId, { ...current, shareCount: 20 });
  mutation.reject(new Error("expected stale share rejection"));
  await flush();
  assert.equal(useSocialStore.getState().interactions[postId].shareCount, 20);
  assert.equal(errors.length, 1);
});

test("CR-S12 rejected comment and reply disappear with counters and no false activity", async (t) => {
  const errors = expectedErrors(t);
  const failure = deferred<ReturnType<typeof accepted>>();
  configure({ createComment: () => failure.promise });
  t.after(resetServiceProvider);
  const postId = randomUUID();
  const root = comment();
  const reply = { ...comment(), parentCommentId: root.id };
  useSocialStore.getState().addComment(postId, root);
  useSocialStore.getState().addReply(postId, reply);
  assert.equal(useSocialStore.getState().interactions[postId].commentCount, 2);
  assert.deepEqual(useActivityStore.getState().activityUpdates, []);
  failure.reject(new Error("expected submission rejection"));
  await flush();
  assert.deepEqual(useSocialStore.getState().commentsByPostId[postId], []);
  assert.deepEqual(useSocialStore.getState().repliesByCommentId[root.id], []);
  assert.equal(useSocialStore.getState().interactions[postId].commentCount, 0);
  assert.deepEqual(useActivityStore.getState().activityUpdates, []);
  assert.equal(errors.length, 2, "injected rejection is handled and logged");
});

test("CR-S13 stale load cannot replace a newly accepted comment or its counter", async (t) => {
  const load = deferred<Awaited<ReturnType<typeof hungryService.social.listCommentsForPost>>>();
  configure({
    listCommentsForPost: () => load.promise,
    createComment: async (_id, body) => accepted({ ...comment(), text: body }),
  });
  t.after(resetServiceProvider);
  const postId = randomUUID();
  const pending = useSocialStore.getState().loadCommentsForPost(postId);
  useSocialStore.getState().addComment(postId, comment());
  await flush();
  load.resolve([]);
  await pending;
  assert.equal(useSocialStore.getState().commentsByPostId[postId].length, 1);
  assert.equal(useSocialStore.getState().interactions[postId].commentCount, 1);
  assert.equal(useActivityStore.getState().activityUpdates.length, 1);
});

test("CR-S13 a load during pending creation preserves the pending comment", async (t) => {
  const mutation = deferred<ReturnType<typeof accepted>>();
  configure({ listCommentsForPost: async () => [], createComment: () => mutation.promise });
  t.after(resetServiceProvider);
  const postId = randomUUID();
  const root = comment();
  useSocialStore.getState().addComment(postId, root);
  await useSocialStore.getState().loadCommentsForPost(postId);
  assert.equal(useSocialStore.getState().commentsByPostId[postId][0].id, root.id);
  mutation.resolve(accepted(root));
  await flush();
  assert.equal(useSocialStore.getState().interactions[postId].commentCount, 1);
});

test("CR-S16 guest reset or creation cannot delete the host's mock party", async (t) => {
  enableMockWheel(t);
  const host = createWheelStore();
  const guest = createWheelStore();
  const newcomer = createWheelStore();
  t.after(() => {
    host.getState().closeParty();
    guest.getState().closeParty();
    guest.getState().reset();
    newcomer.getState().reset();
  });
  const party = await host.getState().createParty("classic", "manual");
  await guest.getState().joinParty(party.code, userProfile.displayName);
  guest.getState().closeParty();
  assert.equal(
    guest.getState().party?.code,
    party.code,
    "guest cannot explicitly close host party",
  );
  await guest.getState().createParty("classic", "manual");
  await newcomer.getState().joinParty(party.code, userProfile.displayName);
  assert.equal(newcomer.getState().party?.id, party.id);
});

test("CR-S17 late join receives trigger, limit, removed entries and current spin snapshot", async (t) => {
  enableMockWheel(t);
  const host = createWheelStore();
  const guest = createWheelStore();
  t.after(() => {
    host.getState().closeParty();
    guest.getState().reset();
  });
  const party = await host.getState().createParty("classic", "manual");
  for (const dish of dishes.slice(0, 3))
    host.getState().addEntry(dish.venueId, dish.buildingId, dish.name, dish.imageUrl);
  host.getState().removeEntry(host.getState().entries[0].id);
  host.getState().updateEntryLimit(4);
  host.getState().updateTrigger("manual");
  host.getState().triggerSpin();
  await guest.getState().joinParty(party.code, userProfile.displayName);
  assert.equal(guest.getState().party?.status, "spinning");
  assert.equal(guest.getState().party?.spinStartedAt, host.getState().party?.spinStartedAt);
  assert.equal(guest.getState().party?.winnerEntryId, host.getState().party?.winnerEntryId);
  assert.equal(guest.getState().party?.maxEntriesPerMember, 4);
  assert.deepEqual(guest.getState().entries, host.getState().entries);
});

test("CR-S17 lagging guest writes cannot rewind the shared spinning or next-round snapshot", async (t) => {
  enableMockWheel(t);
  const host = createWheelStore();
  const guest = createWheelStore();
  const late = createWheelStore();
  t.after(() => {
    host.getState().closeParty();
    guest.getState().reset();
    late.getState().reset();
  });
  const choices = [...new Map(dishes.map((dish) => [dish.venueId, dish])).values()].slice(0, 3);
  const party = await host.getState().createParty("classic", "manual");
  for (const dish of choices.slice(0, 2))
    host.getState().addEntry(dish.venueId, dish.buildingId, dish.name, dish.imageUrl);
  await guest.getState().joinParty(party.code, userProfile.displayName);
  host.getState().triggerSpin();
  const startedAt = host.getState().party!.spinStartedAt!;
  const next = choices[2];
  // The guest has not received the 50ms broadcast and still sees the lobby.
  guest.getState().addEntry(next.venueId, next.buildingId, next.name, next.imageUrl);
  guest.setState({ members: [...guest.getState().members] });
  await late.getState().joinParty(party.code, userProfile.displayName);
  assert.equal(late.getState().party?.status, "spinning");
  assert.equal(late.getState().party?.spinStartedAt, startedAt);
  assert.equal(late.getState().party?.winnerEntryId, host.getState().party?.winnerEntryId);
  assert.equal(
    late.getState().entries.length,
    2,
    "shared spin phase rejects a stale lobby insertion",
  );
  // Resolve and prepare before the queued first-round broadcast reaches the guest.
  host.getState().finishSpin(startedAt);
  host.getState().prepareNextSpin();
  guest
    .getState()
    ._onEvent({
      type: "spin_triggered",
      seed: 0,
      startedAt,
      activeEntryIds: host.getState().entries.map((entry) => entry.id),
    });
  late.getState().reset();
  await late.getState().joinParty(party.code, userProfile.displayName);
  assert.equal(late.getState().party?.currentRound, 2);
  assert.equal(late.getState().party?.status, "lobby");
  assert.equal(late.getState().party?.spinStartedAt, undefined);
  assert.equal(late.getState().party?.winnerEntryId, undefined);
});

test("CR-S18 all mock participants advance and can add entries in the next lobby", async (t) => {
  enableMockWheel(t);
  const host = createWheelStore();
  const guest = createWheelStore();
  t.after(() => {
    host.getState().closeParty();
    guest.getState().reset();
  });
  const party = await host.getState().createParty("classic", "manual");
  for (const dish of dishes.slice(0, 2))
    host.getState().addEntry(dish.venueId, dish.buildingId, dish.name, dish.imageUrl);
  await guest.getState().joinParty(party.code, userProfile.displayName);
  host.getState().triggerSpin();
  await broadcast();
  host.getState().finishSpin(host.getState().party!.spinStartedAt!);
  await broadcast();
  host.getState().prepareNextSpin();
  await broadcast();
  assert.equal(guest.getState().party?.status, "lobby");
  assert.equal(guest.getState().party?.currentRound, 2);
  assert.equal(guest.getState().party?.spinStartedAt, undefined);
  assert.equal(guest.getState().party?.winnerEntryId, undefined);
  const next = dishes.find(
    (dish) => !guest.getState().entries.some((entry) => entry.venueId === dish.venueId),
  )!;
  const before = guest.getState().entries.length;
  guest.getState().addEntry(next.venueId, next.buildingId, next.name, next.imageUrl);
  assert.equal(guest.getState().entries.length, before + 1);
});
