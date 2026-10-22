import assert from "node:assert/strict";
import test from "node:test";
import { useWheelStore } from "@/store/useWheelStore";
import { MockRealtimeChannel } from "@/lib/services/realtime/MockRealtimeChannel";
import { getHungryService, setMockServiceProvider } from "@/lib/services/serviceProvider";
import { useChecklistStore } from "@/store/useChecklistStore";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useCollectionStore } from "@/store/useCollectionStore";
import { useProfileStore } from "@/store/useProfileStore";
test("solo wheel chooses an integer winner including zero, rejects duplicate venues and resolves once", async () => {
  const store = useWheelStore.getState();
  await store.createParty("classic", "manual");
  store.addEntry("venue-a", "building-a", "A", "");
  store.addEntry("venue-a", "building-a", "Duplicate", "");
  store.addEntry("venue-b", "building-a", "B", "");
  assert.equal(useWheelStore.getState().entries.length, 2);
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    store.triggerSpin();
    const party = useWheelStore.getState().party!;
    assert.equal(party.spinSeed, 0);
    assert.equal(party.winnerEntryId, useWheelStore.getState().entries[0].id);
    store.finishSpin(party.spinStartedAt!);
    store.finishSpin(party.spinStartedAt!);
    assert.equal(useWheelStore.getState().party?.status, "resolved");
    store.prepareNextSpin();
    assert.equal(useWheelStore.getState().party?.status, "lobby");
    assert.equal(useWheelStore.getState().party?.winnerEntryId, undefined);
  } finally {
    Math.random = originalRandom;
    store.reset();
  }
});

test("clearing a mock channel rejects queued events", async () => {
  let count = 0;
  const channel = new MockRealtimeChannel("discarded-account");
  channel.subscribe(
    () => count++,
    () => undefined,
  );
  channel.broadcast({ type: "entry_removed", entryId: "old" });
  MockRealtimeChannel.clearChannel("discarded-account");
  await new Promise((resolve) => setTimeout(resolve, 75));
  assert.equal(count, 0);
});

test("reset rejects a late private checklist load instead of repopulating the next account", async () => {
  setMockServiceProvider();
  const service = getHungryService();
  const original = service.checklist.getChecklists;
  let release!: () => void;
  service.checklist.getChecklists = () =>
    new Promise((resolve) => {
      release = () => resolve([]);
    });
  try {
    const pending = useChecklistStore.getState().loadChecklists();
    useChecklistStore.getState()._reset();
    release();
    await assert.rejects(pending, /Account changed/);
    assert.equal(useChecklistStore.getState().isLoaded, false);
    assert.deepEqual(useChecklistStore.getState().checklists, []);
  } finally {
    service.checklist.getChecklists = original;
  }
});

test("portfolio rejects arbitrary precision rather than silently rounding", async () => {
  setMockServiceProvider();
  usePortfolioStore.getState()._reset();
  const portfolio = await usePortfolioStore
    .getState()
    .createPortfolio({ name: "Precision regression", type: "ranking", visibility: "private" });
  await assert.rejects(
    usePortfolioStore
      .getState()
      .addItem({ portfolioId: portfolio.id, itemType: "dish", dishId: "dish-laksa", score: 8.25 }),
    /score must/,
  );
});

test("portfolio nullable patches clear notes and score while omitted fields stay unchanged", async () => {
  setMockServiceProvider();
  const service = getHungryService();
  const portfolio = await service.portfolio.createPortfolio({
    name: "Patch regression",
    description: "Clear me",
    type: "ranking",
    visibility: "private",
  });
  const item = await service.portfolio.addPortfolioItem({
    portfolioId: portfolio.id,
    itemType: "dish",
    dishId: "dish-laksa",
    score: 8.2,
    publicNotes: "Public",
    privateNotes: "Private",
  });
  await service.portfolio.updatePortfolioItem(item.id, {
    publicNotes: null,
    privateNotes: null,
    score: null,
  });
  await service.portfolio.updatePortfolio(portfolio.id, { description: null });
  const [cleared] = await service.portfolio.getPortfolioItems(portfolio.id);
  assert.equal(cleared.score, undefined);
  assert.equal(cleared.publicNotes, undefined);
  assert.equal(cleared.privateNotes, undefined);
  assert.equal((await service.portfolio.getPortfolio(portfolio.id)).description, undefined);
  await service.portfolio.updatePortfolioItem(item.id, { publicNotes: "Kept" });
  await service.portfolio.updatePortfolioItem(item.id, {});
  assert.equal((await service.portfolio.getPortfolioItems(portfolio.id))[0].publicNotes, "Kept");
});

test("checklist tried state supports explicit undo and planned time clearing", async () => {
  setMockServiceProvider();
  const store = useChecklistStore.getState();
  const list = await store.createChecklist("Undo regression");
  const item = await store.addItem({
    checklistId: list.id,
    itemType: "custom",
    customText: "Lunch",
    reminderAt: "2026-10-21T04:00:00Z",
  });
  await store.markItemTried(item.id, true);
  await store.markItemTried(item.id, false);
  await store.updateItem(item.id, { reminderAt: null, plannedVisitDate: null });
  const [actual] = useChecklistStore.getState().items[list.id];
  assert.equal(actual.triedAt, undefined);
  assert.ok(!actual.reminderAt);
});

test("moderation removal excludes a portfolio from ordinary, search and shared reads", async () => {
  setMockServiceProvider();
  const service = getHungryService();
  const portfolio = await service.portfolio.createPortfolio({
    name: "Moderation regression",
    type: "ranking",
    visibility: "public",
  });
  await service.portfolio.flagPortfolio(portfolio.id, "inappropriate");
  const flag = (await service.portfolio.getPortfolioFlags()).find(
    (entry) => entry.portfolioId === portfolio.id,
  )!;
  await service.portfolio.resolvePortfolioFlag(flag.id, "removed");
  await assert.rejects(service.portfolio.getPortfolio(portfolio.id), /not found/);
  assert.equal(await service.portfolio.getPublicPortfolio(portfolio.id), null);
  assert.equal(
    (await service.portfolio.searchPortfolios("Moderation regression")).some(
      (entry) => entry.id === portfolio.id,
    ),
    false,
  );
  assert.equal(
    (await service.portfolio.getPortfolios()).some((entry) => entry.id === portfolio.id),
    false,
  );
});

test("collection save persists through store reset and authoritative reload", async () => {
  setMockServiceProvider();
  const store = useCollectionStore.getState();
  store._reset();
  await store.loadCollections();
  const collection = useCollectionStore.getState().collections[0];
  assert.ok(collection);
  const userId = useProfileStore.getState().profile.id;
  await store.toggleSaveCollection(userId, collection.id);
  const expected = useCollectionStore.getState().isSaved(collection.id);
  store._reset();
  await store.loadCollections();
  assert.equal(useCollectionStore.getState().isSaved(collection.id), expected);
});

test("a delayed collection load reloads after a confirmed save and cannot overwrite it", async () => {
  setMockServiceProvider();
  const store = useCollectionStore.getState();
  store._reset();
  const service = getHungryService().collections;
  const originalList = service.listSavedCollectionIds;
  const originalSave = service.setCollectionSaved;
  let release!: (ids: string[]) => void;
  let calls = 0;
  const saved = new Set<string>();
  service.listSavedCollectionIds = () => {
    calls++;
    return calls === 1
      ? new Promise((resolve) => {
          release = resolve;
        })
      : Promise.resolve([...saved]);
  };
  service.setCollectionSaved = async (id, value) => {
    if (value) saved.add(id);
    else saved.delete(id);
  };
  try {
    const pending = store.loadCollections();
    await store.toggleSaveCollection(
      useProfileStore.getState().profile.id,
      "collection-regression",
    );
    release([]);
    await pending;
    assert.equal(calls, 2, "a snapshot older than a confirmed save must be fetched again");
    assert.equal(useCollectionStore.getState().isSaved("collection-regression"), true);
  } finally {
    service.listSavedCollectionIds = originalList;
    service.setCollectionSaved = originalSave;
    store._reset();
  }
});

test("newer simultaneous collection load wins and failed saves never create confirmed state", async () => {
  setMockServiceProvider();
  const store = useCollectionStore.getState();
  store._reset();
  const service = getHungryService().collections;
  const originalList = service.listSavedCollectionIds;
  const originalSave = service.setCollectionSaved;
  const releases: ((ids: string[]) => void)[] = [];
  service.listSavedCollectionIds = () =>
    new Promise((resolve) => {
      releases.push(resolve);
    });
  service.setCollectionSaved = async () => {
    throw new Error("Save unavailable");
  };
  try {
    const first = store.loadCollections();
    const second = store.loadCollections();
    releases[1](["newer-snapshot"]);
    await second;
    releases[0](["older-snapshot"]);
    await first;
    assert.deepEqual([...useCollectionStore.getState().savedCollectionIds], ["newer-snapshot"]);
    await assert.rejects(
      store.toggleSaveCollection(useProfileStore.getState().profile.id, "failed-save"),
      /Save unavailable/,
    );
    assert.equal(useCollectionStore.getState().isSaved("failed-save"), false);
    assert.deepEqual([...useCollectionStore.getState().savedCollectionIds], ["newer-snapshot"]);
  } finally {
    service.listSavedCollectionIds = originalList;
    service.setCollectionSaved = originalSave;
    store._reset();
  }
});
