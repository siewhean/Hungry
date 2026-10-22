import assert from "node:assert/strict";
import { test } from "node:test";
import { userProfile } from "./data";
import { dataRepositoryMock } from "./repositories";
import { hungryService } from "./mockService";

test("mock follows, blocks, deletion and push preferences isolate A/B and survive A returning", async () => {
  const emailA = `account-qa-a+${userProfile.email}`;
  const emailB = `account-qa-b+${userProfile.email}`;
  const accountA = await hungryService.auth.signUp(emailA, "password123", userProfile.displayName);
  assert.ok(accountA);
  const subjectA = accountA.profile.id;
  const stallId = dataRepositoryMock.listPopularNearby()[0].venueId;
  await hungryService.social.followUser(userProfile.id);
  await hungryService.profile.setStallFollow(stallId, true);
  await hungryService.communitySafety.blockUser({
    blockedUserKey: userProfile.id,
    reason: "qa-isolation",
  });
  const originalPreferences = await hungryService.push.getPreferences();
  const changedPreferences = {
    ...originalPreferences,
    weeklyPicks: !originalPreferences.weeklyPicks,
  };
  await hungryService.push.updatePreferences(changedPreferences);
  await hungryService.auth.requestAccountDeletion({ reason: "qa-isolation" });
  const accountB = await hungryService.auth.signUp(emailB, "password123", userProfile.displayName);
  assert.ok(accountB);
  const subjectB = accountB.profile.id;
  assert.notEqual(subjectA, subjectB);
  assert.equal(await hungryService.social.isFollowing(userProfile.id), false);
  assert.deepEqual(await hungryService.profile.getFollowedStallIds(), []);
  assert.deepEqual(await hungryService.communitySafety.getBlockedUsers(), []);
  assert.equal(await hungryService.auth.getPendingAccountDeletion(), null);
  assert.deepEqual(await hungryService.push.getPreferences(), originalPreferences);
  assert.deepEqual(
    (await hungryService.social.listFollowing(subjectA)).map((person) => person.userId),
    [userProfile.id],
  );
  assert.deepEqual(await hungryService.social.listFollowing(subjectB), []);
  await hungryService.auth.cancelAccountDeletion();
  const resumed = await hungryService.auth.signIn(emailA, "password123");
  assert.equal(resumed.profile.id, subjectA);
  assert.equal(await hungryService.social.isFollowing(userProfile.id), true);
  assert.deepEqual(await hungryService.profile.getFollowedStallIds(), [stallId]);
  assert.deepEqual(
    (await hungryService.communitySafety.getBlockedUsers()).map((user) => user.blockedUserKey),
    [userProfile.id],
  );
  assert.deepEqual(await hungryService.push.getPreferences(), changedPreferences);
  assert.ok(await hungryService.auth.getPendingAccountDeletion());
  assert.equal(await hungryService.auth.cancelAccountDeletion(), true);
  assert.equal(await hungryService.auth.getPendingAccountDeletion(), null);
  await hungryService.auth.signOut();
});
