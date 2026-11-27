import assert from "node:assert/strict";
import test from "node:test";

import type { LeagueStatus } from "@/lib/services/types";

import {
  leagueGoalLabel,
  leaguePlaceLabel,
  leagueProgress,
  leagueTierName,
  weekTimeLeftLabel,
} from "./leagues";

const now = new Date("2026-11-27T04:00:00Z");
const status = (patch: Partial<LeagueStatus> = {}): LeagueStatus => ({
  tier: 3,
  isMember: true,
  cohortSize: 30,
  rank: 9,
  weekPoints: 40,
  promotionLinePoints: 52,
  pointsToPromotion: 13,
  promoteCount: 7,
  relegateCount: 5,
  weekStart: "2026-11-23",
  weekEndsAt: "2026-11-29T16:00:00Z",
  ...patch,
});

test("tiers are named from 1 (Bronze) to 5 (Diamond) and clamp outside that", () => {
  assert.equal(leagueTierName(1), "Bronze");
  assert.equal(leagueTierName(5), "Diamond");
  assert.equal(leagueTierName(0), "Bronze");
  assert.equal(leagueTierName(9), "Diamond");
});

test("the week clock counts down in days, hours and minutes", () => {
  assert.equal(weekTimeLeftLabel("2026-11-29T16:00:00Z", now), "2d 12h left");
  assert.equal(weekTimeLeftLabel("2026-11-27T09:30:00Z", now), "5h left");
  assert.equal(weekTimeLeftLabel("2026-11-27T04:12:00Z", now), "12m left");
  assert.equal(weekTimeLeftLabel("2026-11-27T04:00:30Z", now), "Ends soon");
});

test("the goal line shows points to promotion, the zone, or the top-tier hold", () => {
  assert.equal(leaguePlaceLabel(status()), "Gold league · #9");
  assert.equal(leagueGoalLabel(status(), now), "13 points to promotion · 2d 12h left");
  assert.equal(
    leagueGoalLabel(status({ pointsToPromotion: 0, rank: 3 }), now),
    "In the promotion zone · 2d 12h left",
  );
  assert.equal(leagueGoalLabel(status({ tier: 5 }), now), "Stay in the top 25 · 2d 12h left");
  assert.match(leagueGoalLabel(status({ isMember: false, rank: null }), now), /to join/);
  assert.equal(leaguePlaceLabel(status({ isMember: false, rank: null })), "Gold league");
});

test("progress fills toward the promotion line", () => {
  assert.equal(leagueProgress(status({ weekPoints: 39, pointsToPromotion: 13 })), 0.75);
  assert.equal(leagueProgress(status({ pointsToPromotion: 0 })), 1);
  assert.equal(leagueProgress(status({ isMember: false })), 0);
});
