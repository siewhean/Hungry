/**
 * missionTemplates.ts — Weekly mission definitions
 *
 * Static pool of mission templates. Active missions are selected weekly
 * (5 per week at launch). All users see the same pool in Phase 1.
 *
 * Rotation: missions with the same weekStart are active together.
 * In production, a backend job populates weekly_missions with 5 records
 * drawn from this pool. For MVP/mock, we hard-code a current week's set.
 */

import type { WeeklyMission } from "@/types/domain";

// ─── Mission Template Pool ────────────────────────────────────────────────────

/**
 * Master pool of mission templates.
 * `weekStart` / `weekEnd` are placeholders — the mock layer substitutes
 * current-week dates at runtime.
 */
export const MISSION_TEMPLATE_POOL: Omit<WeeklyMission, "weekStart" | "weekEnd" | "isActive">[] = [
  {
    id: "mission-save-3-stalls",
    title: "Save 3 new places",
    description: "Save 3 stalls or restaurants you haven't saved before.",
    missionType: "save_stalls",
    requirementCount: 3,
    rewardType: "food_cred",
    rewardValue: 10,
  },
  {
    id: "mission-write-review",
    title: "Write a review",
    description: "Share your experience at a place you've visited.",
    missionType: "write_review",
    requirementCount: 1,
    rewardType: "food_cred",
    rewardValue: 20,
  },
  {
    id: "mission-mark-tried",
    title: "Mark 2 places as tried",
    description: "Visited somewhere new? Mark it as tried.",
    missionType: "mark_tried",
    requirementCount: 2,
    rewardType: "food_cred",
    rewardValue: 15,
  },
  {
    id: "mission-post-photo",
    title: "Post a food photo",
    description: "Share what you're eating with the Hungry community.",
    missionType: "create_post",
    requirementCount: 1,
    rewardType: "food_cred",
    rewardValue: 15,
  },
  {
    id: "mission-add-new-stall",
    title: "Add a stall find",
    description: "Submit a stall you found online with a photo and useful details.",
    missionType: "add_stall",
    requirementCount: 1,
    rewardType: "food_cred",
    rewardValue: 20,
  },
  {
    id: "mission-add-collection",
    title: "Add 2 stalls to a list",
    description: "Build your personal food lists.",
    missionType: "add_to_collection",
    requirementCount: 2,
    rewardType: "food_cred",
    rewardValue: 10,
  },
  {
    id: "mission-helpful-vote",
    title: "Mark a review as helpful",
    description: "Help others find trustworthy reviews.",
    missionType: "helpful_vote",
    requirementCount: 2,
    rewardType: "food_cred",
    rewardValue: 5,
  },
];

// ─── Current Week Helper ──────────────────────────────────────────────────────

/** Returns ISO date string for the most recent Monday (start of current week) */
function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

/** Returns ISO date string for the coming Sunday (end of current week) */
function getWeekEnd(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

// ─── Active Mock Missions ─────────────────────────────────────────────────────

/**
 * The 5 missions active for the current week.
 * Drawn from the first 5 templates in the pool.
 * Production: replaced by DB query for `weekly_missions WHERE is_active = true`.
 */
export const MOCK_ACTIVE_MISSIONS: WeeklyMission[] = MISSION_TEMPLATE_POOL.slice(0, 5).map(
  (template) => ({
    ...template,
    weekStart: getWeekStart(),
    weekEnd: getWeekEnd(),
    isActive: true,
  }),
);
