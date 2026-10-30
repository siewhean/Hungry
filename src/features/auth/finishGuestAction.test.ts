import assert from "node:assert/strict";
import test from "node:test";

import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { useAchievementTallyStore } from "@/store/useAchievementTallyStore";
import { useProfileStore } from "@/store/useProfileStore";
import type { DishDetail } from "@/types/domain";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useSocialStore } from "@/store/useSocialStore";
import { useStallFollowStore } from "@/store/useStallFollowStore";
import {
  followStallAfterSignIn,
  followUserAfterSignIn,
  likePostAfterSignIn,
  markDishTried,
  markDishTriedAfterSignIn,
  saveDishAfterSignIn,
  saveDishesAfterSignIn,
  savePostAfterSignIn,
  saveStallAfterSignIn,
} from "./finishGuestAction";

const dish = { id: "dish-already-saved" } as DishDetail;

function stubToggle() {
  const calls: string[] = [];
  const original = useProfileStore.getState().toggleFavourite;
  useProfileStore.setState({
    toggleFavourite: async (target) => {
      calls.push(target.id);
      return { status: "saved" };
    },
  });
  return { calls, restore: () => useProfileStore.setState({ toggleFavourite: original }) };
}

function stubServerFavourites(result: () => Promise<string[]>) {
  const profileService = getHungryService().profile;
  const original = profileService.getFavouriteDishIds;
  profileService.getFavouriteDishIds = result;
  return () => {
    profileService.getFavouriteDishIds = original;
  };
}

function clearLocalFavourites() {
  // Right after sign-in the account's favourites have not loaded locally yet.
  const current = useProfileStore.getState().profile;
  useProfileStore.setState({ profile: { ...current, favouriteDishIds: [] } });
}

test("finishing a guest save never toggles off a dish the account already saved", async () => {
  clearLocalFavourites();
  const toggle = stubToggle();
  const restoreService = stubServerFavourites(async () => [dish.id]);
  try {
    await saveDishAfterSignIn(dish);
    assert.deepEqual(toggle.calls, []);
  } finally {
    restoreService();
    toggle.restore();
  }
});

test("finishing a guest save adds the dish when the account does not have it", async () => {
  clearLocalFavourites();
  const toggle = stubToggle();
  const restoreService = stubServerFavourites(async () => []);
  try {
    await saveDishAfterSignIn(dish);
    assert.deepEqual(toggle.calls, [dish.id]);
  } finally {
    restoreService();
    toggle.restore();
  }
});

test("finishing a guest save does nothing when the account's saves cannot be read", async () => {
  clearLocalFavourites();
  const toggle = stubToggle();
  const restoreService = stubServerFavourites(() => Promise.reject(new Error("offline")));
  try {
    await saveDishAfterSignIn(dish);
    assert.deepEqual(toggle.calls, []);
  } finally {
    restoreService();
    toggle.restore();
  }
});

test("a guest's Tried tap is finished after sign-in like a signed-in tap (DISH-X4, DISH-V4)", async () => {
  const calls: [string, boolean][] = [];
  const stallMarks: string[] = [];
  const original = useProfileStore.getState().setDishTried;
  const stalls = useStallInteractionStore.getState();
  const originalStalls = { loadInteractions: stalls.loadInteractions, markTried: stalls.markTried };
  useProfileStore.setState({
    setDishTried: async (dishId, tried) => {
      calls.push([dishId, tried]);
      return true;
    },
  });
  useStallInteractionStore.setState({
    interactions: {},
    loadInteractions: async () => undefined,
    markTried: async (_userId, stallId) => {
      stallMarks.push(stallId);
      return { pointsAwarded: 5 } as Awaited<ReturnType<typeof stalls.markTried>>;
    },
  });
  clearTrackedAnalyticsEvents();
  const userId = useProfileStore.getState().profile.id;
  try {
    const result = await markDishTriedAfterSignIn(
      { id: "dish-pending-tried", venueId: "venue-pending" },
      { spicy: true, sweet: false, budget: false },
    );
    assert.deepEqual(result, { saved: true, pointsAwarded: 5, stallMarkFailed: false });
    assert.deepEqual(calls, [["dish-pending-tried", true]]);
    assert.deepEqual(stallMarks, ["venue-pending"], "the stall is marked visited");
    assert.equal(
      useAchievementTallyStore.getState().triedByUser[userId]?.["dish-pending-tried"]?.spicy,
      true,
      "the achievement tally counts it",
    );
    assert.ok(
      getTrackedAnalyticsEvents().some(
        (event) =>
          event.event === "dish_marked_tried" && event.properties?.dish_id === "dish-pending-tried",
      ),
    );
  } finally {
    useProfileStore.setState({ setDishTried: original });
    useStallInteractionStore.setState(originalStalls);
  }
});

function stubStallWrites(serverSaved: string[]) {
  const repo = getDataRepository();
  const originalList = repo.listStallInteractions;
  const originalUpsert = repo.upsertStallInteraction;
  const writes: { stallId: string; isSaved?: boolean }[] = [];
  repo.listStallInteractions = async (userId) =>
    serverSaved.map((stallId) => ({
      userId,
      stallId,
      isSaved: true,
      isTried: false,
      isReviewed: false,
    }));
  repo.upsertStallInteraction = async (_userId, stallId, patch) => {
    writes.push({ stallId, isSaved: patch.isSaved });
    return null;
  };
  useStallInteractionStore.getState()._reset();
  return {
    writes,
    restore: () => {
      repo.listStallInteractions = originalList;
      repo.upsertStallInteraction = originalUpsert;
      useStallInteractionStore.getState()._reset();
    },
  };
}

test("finishing a guest stall save saves the stall once", async () => {
  const stub = stubStallWrites([]);
  try {
    let confirmed = 0;
    assert.equal(await saveStallAfterSignIn("stall-new", () => (confirmed += 1)), true);
    assert.deepEqual(stub.writes, [{ stallId: "stall-new", isSaved: true }]);
    assert.equal(confirmed, 1, "a new save is confirmed and counted (STALL-X1)");
    assert.equal(useStallInteractionStore.getState().interactions["stall-new"]?.isSaved, true);
  } finally {
    stub.restore();
  }
});

test("finishing a guest stall save never un-saves a stall the account already saved", async () => {
  const stub = stubStallWrites(["stall-saved"]);
  try {
    let confirmed = 0;
    assert.equal(await saveStallAfterSignIn("stall-saved", () => (confirmed += 1)), true);
    assert.deepEqual(stub.writes, []);
    assert.equal(confirmed, 0, "an existing save is not counted again");
    assert.equal(useStallInteractionStore.getState().interactions["stall-saved"]?.isSaved, true);
  } finally {
    stub.restore();
  }
});

test("finishing several guest saves adds only the dishes the account lacks and returns the failures", async () => {
  const added: string[][] = [];
  const original = useProfileStore.getState().addFavourites;
  useProfileStore.setState({
    addFavourites: async (dishes) => {
      added.push(dishes.map((entry) => entry.id));
      return dishes.filter((entry) => entry.id === "dish-fails");
    },
  });
  const restoreService = stubServerFavourites(async () => ["dish-have"]);
  const dishes = ["dish-have", "dish-new", "dish-fails"].map((id) => ({ id }) as DishDetail);
  try {
    const failed = await saveDishesAfterSignIn(dishes);
    assert.deepEqual(added, [["dish-new", "dish-fails"]], "one write for the missing dishes");
    assert.deepEqual(
      failed.map((entry) => entry.id),
      ["dish-fails"],
    );
  } finally {
    restoreService();
    useProfileStore.setState({ addFavourites: original });
  }
});

test("finishing several guest saves reports every dish when the account's saves cannot be read", async () => {
  const added: string[] = [];
  const original = useProfileStore.getState().addFavourites;
  useProfileStore.setState({
    addFavourites: async (dishes) => {
      added.push(...dishes.map((entry) => entry.id));
      return [];
    },
  });
  const restoreService = stubServerFavourites(() => Promise.reject(new Error("offline")));
  const dishes = [{ id: "dish-a" }, { id: "dish-b" }] as DishDetail[];
  try {
    assert.deepEqual(await saveDishesAfterSignIn(dishes), dishes);
    assert.deepEqual(added, []);
  } finally {
    restoreService();
    useProfileStore.setState({ addFavourites: original });
  }
});

test("finishing a guest save reports a failed toggle and skips a dish already saved locally", async () => {
  const restoreService = stubServerFavourites(async () => []);
  const originalToggle = useProfileStore.getState().toggleFavourite;
  const calls: string[] = [];
  useProfileStore.setState({
    toggleFavourite: async (target) => {
      calls.push(target.id);
      return { status: "failed", reason: "sync_failed", message: "Could not save" };
    },
  });
  const current = useProfileStore.getState().profile;
  try {
    useProfileStore.setState({ profile: { ...current, favouriteDishIds: [] } });
    assert.equal(await saveDishAfterSignIn(dish), false, "a failed write resolves false");
    useProfileStore.setState({ profile: { ...current, favouriteDishIds: [dish.id] } });
    assert.equal(await saveDishAfterSignIn(dish), true);
    assert.deepEqual(calls, [dish.id], "a local save is not toggled again");
  } finally {
    restoreService();
    useProfileStore.setState({ profile: current, toggleFavourite: originalToggle });
  }
});

function stubTried(options: {
  saved: boolean;
  alreadyTried?: boolean;
  loadFails?: boolean;
  markFails?: boolean;
}) {
  const original = useProfileStore.getState().setDishTried;
  const stalls = useStallInteractionStore.getState();
  const originalStalls = {
    interactions: stalls.interactions,
    loadInteractions: stalls.loadInteractions,
    markTried: stalls.markTried,
  };
  const stallMarks: string[] = [];
  useProfileStore.setState({ setDishTried: async () => options.saved });
  useStallInteractionStore.setState({
    interactions: options.alreadyTried
      ? {
          "venue-tried": {
            userId: "u",
            stallId: "venue-tried",
            isSaved: false,
            isTried: true,
            isReviewed: false,
          },
        }
      : {},
    loadInteractions: async () => {
      if (options.loadFails) throw new Error("offline");
    },
    markTried: async (_userId, stallId) => {
      stallMarks.push(stallId);
      if (options.markFails) throw new Error("write failed");
      return { pointsAwarded: 3 } as Awaited<ReturnType<typeof stalls.markTried>>;
    },
  });
  return {
    stallMarks,
    restore: () => {
      useProfileStore.setState({ setDishTried: original });
      useStallInteractionStore.setState(originalStalls);
    },
  };
}

const facts = { spicy: false, sweet: false, budget: false };

test("a Tried mark that the server refuses changes nothing else", async () => {
  const stub = stubTried({ saved: false });
  try {
    assert.deepEqual(await markDishTried({ id: "dish-x", venueId: "venue-x" }, facts), {
      saved: false,
      pointsAwarded: 0,
      stallMarkFailed: false,
    });
    assert.deepEqual(stub.stallMarks, []);
  } finally {
    stub.restore();
  }
});

test("a Tried mark never marks an already-visited stall again", async () => {
  const stub = stubTried({ saved: true, alreadyTried: true });
  try {
    assert.deepEqual(await markDishTried({ id: "dish-x", venueId: "venue-tried" }, facts), {
      saved: true,
      pointsAwarded: 0,
      stallMarkFailed: false,
    });
    assert.deepEqual(stub.stallMarks, []);
  } finally {
    stub.restore();
  }
});

test("a Tried mark keeps the dish marked when the stall mark fails", async () => {
  const stub = stubTried({ saved: true, loadFails: true, markFails: true });
  try {
    assert.deepEqual(await markDishTried({ id: "dish-x", venueId: "venue-x" }, facts), {
      saved: true,
      pointsAwarded: 0,
      stallMarkFailed: true,
    });
    assert.deepEqual(stub.stallMarks, ["venue-x"], "a failed load still tries the stall mark");
  } finally {
    stub.restore();
  }
});

test("a guest's post like and save are finished after sign-in and never toggled off", () => {
  const social = useSocialStore.getState();
  const original = {
    interactions: social.interactions,
    toggleLike: social.toggleLike,
    toggleSave: social.toggleSave,
  };
  const likes: string[] = [];
  const saves: string[] = [];
  useSocialStore.setState({
    interactions: {
      "post-liked": {
        liked: true,
        saved: true,
        likeCount: 1,
        saveCount: 1,
        shareCount: 0,
        commentCount: 0,
      },
    },
    toggleLike: (postId) => likes.push(postId),
    toggleSave: (postId) => saves.push(postId),
  });
  try {
    likePostAfterSignIn("post-liked");
    likePostAfterSignIn("post-new");
    savePostAfterSignIn("post-liked");
    savePostAfterSignIn("post-new");
    assert.deepEqual(likes, ["post-new"]);
    assert.deepEqual(saves, ["post-new"]);
  } finally {
    useSocialStore.setState(original);
  }
});

test("a guest's follow is finished after sign-in unless already followed or requested", () => {
  const social = useSocialStore.getState();
  const original = {
    followedUserIds: social.followedUserIds,
    requestedUserIds: social.requestedUserIds,
    toggleFollow: social.toggleFollow,
  };
  const follows: string[] = [];
  useSocialStore.setState({
    followedUserIds: { "user-followed": true },
    requestedUserIds: { "user-requested": true },
    toggleFollow: (userId) => {
      follows.push(userId);
    },
  });
  try {
    followUserAfterSignIn("user-followed");
    followUserAfterSignIn("user-requested");
    followUserAfterSignIn("user-new");
    assert.deepEqual(follows, ["user-new"]);
  } finally {
    useSocialStore.setState(original);
  }
});

test("a guest's stall follow is finished after sign-in and survives failed reads and writes", async () => {
  const original = useStallFollowStore.getState();
  const follows: string[] = [];
  useStallFollowStore.setState({
    followedStallIds: ["stall-followed"],
    loadFollowedStalls: async () => {
      throw new Error("offline");
    },
    toggleFollow: async (stallId) => {
      follows.push(stallId);
      throw new Error("write failed");
    },
  });
  try {
    await followStallAfterSignIn("stall-followed");
    await followStallAfterSignIn("stall-new");
    assert.deepEqual(follows, ["stall-new"]);
  } finally {
    useStallFollowStore.setState({
      followedStallIds: original.followedStallIds,
      loadFollowedStalls: original.loadFollowedStalls,
      toggleFollow: original.toggleFollow,
    });
  }
});

test("finishing a guest stall save resolves false when the saves cannot be read or stored", async () => {
  const stalls = useStallInteractionStore.getState();
  const original = { loadInteractions: stalls.loadInteractions, toggleSaved: stalls.toggleSaved };
  let confirmed = 0;
  try {
    useStallInteractionStore.setState({
      loadInteractions: async () => {
        throw new Error("offline");
      },
    });
    assert.equal(await saveStallAfterSignIn("stall-x", () => (confirmed += 1)), false);
    useStallInteractionStore.setState({
      interactions: {},
      loadInteractions: async () => undefined,
      toggleSaved: async () => {
        throw new Error("write failed");
      },
    });
    assert.equal(await saveStallAfterSignIn("stall-x", () => (confirmed += 1)), false);
    assert.equal(confirmed, 0, "nothing is confirmed when nothing was stored");
  } finally {
    useStallInteractionStore.setState(original);
    useStallInteractionStore.getState()._reset();
  }
});
