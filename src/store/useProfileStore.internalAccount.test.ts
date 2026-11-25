import assert from "node:assert/strict";
import test from "node:test";

// PostHog on, with the stub client: the real email can load after the person is identified.
process.env.EXPO_PUBLIC_POSTHOG_API_KEY = "phc_test";
delete process.env.EXPO_PUBLIC_DISABLE_POSTHOG;
const PostHogStub = (require("@/test/posthogStub") as typeof import("@/test/posthogStub")).default;
const sink = require("@/lib/analytics/posthogSink") as typeof import("@/lib/analytics/posthogSink");
const { useProfileStore } = require("./useProfileStore") as typeof import("./useProfileStore");
const { useSessionStore } = require("./useSessionStore") as typeof import("./useSessionStore");

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

test("restoring a Supabase session marks a team account even while the profile email is still empty", async () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const previousProfile = useProfileStore.getState().profile;
  sink.resetPostHogUser();
  PostHogStub.identified = [];
  useProfileStore.setState({
    profile: { ...previousProfile, id: userId, email: "" },
  });

  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: true,
    userId,
    email: "diner01@internal.hungry.test",
  });
  await new Promise((resolve) => setTimeout(resolve, 20));

  const identified = PostHogStub.identified.find((entry) => entry.userId === userId);
  assert.equal(identified?.properties?.is_internal, true);

  useSessionStore.getState().clearSession();
  useProfileStore.setState({ profile: previousProfile });
  sink.resetPostHogUser();
});

test("profile hydration finishing before the deferred identify still marks the team account", async () => {
  const userId = "22222222-2222-4222-8222-222222222222";
  const previousProfile = useProfileStore.getState().profile;
  sink.resetPostHogUser();
  PostHogStub.identified = [];
  useProfileStore.setState({
    profile: { ...previousProfile, id: userId, email: "" },
  });

  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: true,
    userId,
  });
  useProfileStore.getState().applyProfile({
    ...previousProfile,
    id: userId,
    email: "diner02@internal.hungry.test",
  });
  await new Promise((resolve) => setTimeout(resolve, 20));

  const identified = PostHogStub.identified.find((entry) => entry.userId === userId);
  assert.equal(identified?.properties?.is_internal, true);

  useSessionStore.getState().clearSession();
  useProfileStore.setState({ profile: previousProfile });
  sink.resetPostHogUser();
});
