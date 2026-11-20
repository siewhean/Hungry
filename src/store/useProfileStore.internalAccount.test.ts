import assert from "node:assert/strict";
import test from "node:test";

// PostHog on, with the stub client: the real email can load after the person is identified.
process.env.EXPO_PUBLIC_POSTHOG_API_KEY = "phc_test";
delete process.env.EXPO_PUBLIC_DISABLE_POSTHOG;
const PostHogStub = (require("@/test/posthogStub") as typeof import("@/test/posthogStub")).default;
const sink = require("@/lib/analytics/posthogSink") as typeof import("@/lib/analytics/posthogSink");
const { useProfileStore } = require("./useProfileStore") as typeof import("./useProfileStore");

test("a team email that loads after sign-in marks the identified person as internal", () => {
  const profile = useProfileStore.getState().profile;
  sink.resetPostHogUser();
  sink.identifyPostHogUser(profile.id, { plan: "free" });
  PostHogStub.personProperties = [];

  useProfileStore.getState().applyProfile({ ...profile, email: "diner1@example.com" });
  assert.deepEqual(PostHogStub.personProperties, [], "a real diner's email is not marked");

  useProfileStore.getState().applyProfile({ ...profile, email: "diner1@internal.hungry.test" });
  assert.deepEqual(PostHogStub.personProperties, [{ is_internal: true }]);
  sink.resetPostHogUser();
});
