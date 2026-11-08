// Activity inbox header: Mark all read is the header's trailing action (Apple design pass).
// Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { ActivityInboxScreen } from "@/app/screens/home/ActivityInboxScreen";
import { useActivityStore } from "@/store/useActivityStore";
import { useProfileStore } from "@/store/useProfileStore";
import { cleanup, renderScreen } from "@/test/render";

afterEach(async () => {
  await cleanup();
  useActivityStore.setState({ activityUpdates: [], readActivityIds: [] });
});

test("Mark all read sits in the header while there are unread updates, and clears them", async () => {
  const viewerId = useProfileStore.getState().profile.id;
  useActivityStore.setState({ activityUpdates: [], readActivityIds: [] });
  useActivityStore.getState().addActivityUpdate({
    kind: "follow",
    postId: "",
    actorName: "Mei",
    actorId: "user-mei",
    recipientUserId: viewerId,
    text: "started following you",
    target: "",
    time: new Date().toISOString(),
  });

  const view = await renderScreen(ActivityInboxScreen as never, { name: "ActivityInbox" });
  const button = view.findByTestId("activity-mark-all-read");
  assert.ok(button, "header shows Mark all read");
  assert.match(button.textContent ?? "", /Mark all read/);

  await view.press(button);
  assert.equal(view.findByTestId("activity-mark-all-read"), null, "gone once all are read");
});
