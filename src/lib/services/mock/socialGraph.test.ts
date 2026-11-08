// The mock social graph methods behave like the get_profile_relationship, get_taste_matches,
// get_taste_comparison, get_people_suggestions and get_network_stall_picks RPCs: never yourself,
// never a private stranger, steady scores, and picks only once you follow someone.

import assert from "node:assert/strict";
import test from "node:test";

import { hungryService } from "@/lib/services/mock/mockService";

test("taste matches skip yourself and private strangers and are steady per person", async () => {
  const me = (await hungryService.profile.getProfile()).id;
  const suggestions = await hungryService.social.listPeopleSuggestions(50);
  const someone = suggestions[0]?.userId;
  assert.ok(someone, "the mock knows at least one public person");
  const first = await hungryService.social.getTasteMatches([me, someone, "user-emma"]);
  assert.equal(first[me], undefined);
  assert.equal(first["user-emma"], undefined, "Emma is private and not followed");
  assert.ok(first[someone] >= 55 && first[someone] <= 96);
  const again = await hungryService.social.getTasteMatches([someone]);
  assert.equal(again[someone], first[someone]);
});

test("relationship is null for yourself and says whether someone follows you", async () => {
  const me = (await hungryService.profile.getProfile()).id;
  assert.equal(await hungryService.social.getProfileRelationship(me), null);
  const followers = await hungryService.social.listFollowers(me);
  const follower = followers[0]?.userId;
  if (follower) {
    const relationship = await hungryService.social.getProfileRelationship(follower);
    assert.equal(relationship?.followsYou, true);
    assert.equal(relationship?.mutualCount, 0);
  }
  const stranger = await hungryService.social.getProfileRelationship("user-nobody-follows-you");
  assert.equal(stranger?.followsYou, false);
});

test("suggestions leave out people you follow, best match first, capped at 50", async () => {
  const before = await hungryService.social.listPeopleSuggestions(50);
  assert.ok(before.length <= 50);
  for (let index = 1; index < before.length; index += 1) {
    assert.ok((before[index - 1].tasteMatch ?? 0) >= (before[index].tasteMatch ?? 0));
  }
  assert.ok(before.every((person) => person.userId !== "user-emma"));
  const target = before[0];
  assert.ok(target);
  await hungryService.social.followUser(target.userId);
  const after = await hungryService.social.listPeopleSuggestions(50);
  assert.ok(after.every((person) => person.userId !== target.userId));
  assert.ok((await hungryService.social.listPeopleSuggestions(1)).length <= 1);

  const picks = await hungryService.social.listNetworkStallPicks(10);
  assert.ok(picks.length > 0, "following someone gives picks");
  assert.ok(picks.every((pick) => pick.source === "following" && pick.people.length > 0));
  await hungryService.social.unfollowUser(target.userId);
});

test("taste comparison: both palates for a public person, nothing for a private stranger", async () => {
  const someone = (await hungryService.social.listPeopleSuggestions(1))[0]?.userId;
  assert.ok(someone);
  assert.equal(await hungryService.social.getTasteComparison("user-emma"), null);
  const result = await hungryService.social.getTasteComparison(someone);
  const profile = await hungryService.profile.getProfile();
  const neutral = Object.values(profile.tasteVector).every((value) => Math.abs(value - 5) < 1);
  if (neutral) {
    assert.equal(result, null, "a neutral palate has nothing to compare");
  } else {
    assert.ok(result);
    assert.deepEqual(result.mine, profile.tasteVector);
    assert.ok(Object.values(result.theirs).every((value) => value >= 0 && value <= 10));
  }
});

test("getPlacePeople lists reviewers and posters at a stall or dish, followed first", async () => {
  const stall = await hungryService.social.getPlacePeople({ venueId: "venue-tian-tian" });
  const ids = stall.people.map((person) => person.userId);
  assert.ok(ids.includes("user-sarah") && ids.includes("user-1"), "both posters are listed");
  assert.equal(stall.totalPeople, stall.people.length);
  const dish = await hungryService.social.getPlacePeople({ dishId: "dish-chicken-rice" });
  assert.ok(dish.people.some((person) => person.userId === "user-sarah"));

  await hungryService.social.followUser("user-sarah");
  try {
    const followedFirst = await hungryService.social.getPlacePeople({ venueId: "venue-tian-tian" });
    assert.equal(followedFirst.people[0]?.userId, "user-sarah");
    assert.equal(followedFirst.people[0]?.isFollowed, true);
    const one = await hungryService.social.getPlacePeople({ venueId: "venue-tian-tian" }, 1);
    assert.equal(one.people.length, 1);
    assert.ok(one.totalPeople >= 2, "the total still counts everyone");
  } finally {
    await hungryService.social.unfollowUser("user-sarah");
  }

  const neither = await hungryService.social.getPlacePeople({} as never);
  assert.deepEqual(neither, { people: [], totalPeople: 0 });
});
