import assert from "node:assert/strict";
import test from "node:test";

import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  trackFoodCredEarned,
  trackFoodCredLevelChanged,
  trackMissionCompleted,
  trackMissionProgressed,
  trackMissionViewed,
  trackPassportStampEarned,
  trackPassportViewed,
  trackReviewMarkedHelpful,
  trackStallMarkedTried,
  trackStallSaved,
} from "@/lib/analytics/gamificationEvents";

function lastEvent() {
  const events = getTrackedAnalyticsEvents();
  return events[events.length - 1];
}

test("gamification trackers emit the event name and snake_case properties analytics expects", () => {
  clearTrackedAnalyticsEvents();

  trackPassportViewed("banner");
  assert.deepEqual(
    [lastEvent().event, lastEvent().properties],
    ["passport_viewed", { source: "banner" }],
  );

  trackPassportStampEarned({ categoryId: "noodles", stampIndex: 2, triggerAction: "review" });
  assert.equal(lastEvent().event, "passport_stamp_earned");
  assert.equal(lastEvent().properties.stampIndex, 2);

  trackFoodCredEarned({ amount: 10, sourceAction: "review", newTotal: 40, newLevel: "Regular" });
  assert.deepEqual(lastEvent().properties, {
    amount: 10,
    source_action: "review",
    new_total: 40,
    new_level: "Regular",
  });

  trackFoodCredLevelChanged({ oldLevel: "Newbie", newLevel: "Regular", totalPoints: 40 });
  assert.deepEqual(lastEvent().properties, {
    old_level: "Newbie",
    new_level: "Regular",
    total_points: 40,
  });

  trackMissionViewed();
  assert.equal(lastEvent().event, "mission_viewed");

  trackMissionProgressed({ missionId: "m1", oldCount: 1, newCount: 2 });
  assert.deepEqual(lastEvent().properties, { mission_id: "m1", old_count: 1, new_count: 2 });

  trackMissionCompleted({ missionId: "m1", timeToCompleteHours: 5 });
  assert.deepEqual(lastEvent().properties, { mission_id: "m1", time_to_complete_hours: 5 });

  trackStallSaved({ stallId: "s1", sourceScreen: "StallDetail" });
  assert.deepEqual(
    [lastEvent().event, lastEvent().properties],
    ["stall_saved", { stall_id: "s1", source_screen: "StallDetail" }],
  );

  trackStallMarkedTried({ stallId: "s1", sourceScreen: "DishDetail" });
  assert.equal(lastEvent().event, "stall_marked_tried");

  trackReviewMarkedHelpful({ reviewId: "r1", reviewerId: "u1" });
  assert.deepEqual(lastEvent().properties, { review_id: "r1", reviewer_id: "u1" });

  assert.equal(getTrackedAnalyticsEvents().length, 10);
});
