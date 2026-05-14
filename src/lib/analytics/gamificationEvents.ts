/**
 * gamificationEvents.ts
 *
 * Typed wrappers around trackAnalyticsEvent for all gamification surfaces.
 * Add a call site whenever a user triggers a gamification action.
 *
 * Production swap: when Supabase is live, these events can be mirrored to the
 * `food_cred_events` table via a server-side Supabase function.
 */

import { trackAnalyticsEvent } from "@/lib/analytics";

// ─── Passport ────────────────────────────────────────────────────────────────

export function trackPassportViewed(source: "profile" | "banner") {
  trackAnalyticsEvent("passport_viewed", { source });
}

export function trackPassportStampEarned(params: {
  categoryId: string;
  stampIndex: number;
  triggerAction: string;
}) {
  trackAnalyticsEvent("passport_stamp_earned", params);
}

// ─── Food Cred ────────────────────────────────────────────────────────────────

export function trackFoodCredEarned(params: {
  amount: number;
  sourceAction: string;
  newTotal: number;
  newLevel: string;
}) {
  trackAnalyticsEvent("food_cred_earned", {
    amount: params.amount,
    source_action: params.sourceAction,
    new_total: params.newTotal,
    new_level: params.newLevel,
  });
}

export function trackFoodCredLevelChanged(params: {
  oldLevel: string;
  newLevel: string;
  totalPoints: number;
}) {
  trackAnalyticsEvent("food_cred_level_changed", {
    old_level: params.oldLevel,
    new_level: params.newLevel,
    total_points: params.totalPoints,
  });
}

// ─── Collections ─────────────────────────────────────────────────────────────

export function trackCollectionViewed(params: {
  collectionId: string;
  createdBy: "hungry" | "user";
}) {
  trackAnalyticsEvent("collection_viewed", {
    collection_id: params.collectionId,
    created_by: params.createdBy,
  });
}

export function trackCollectionSaved(collectionId: string) {
  trackAnalyticsEvent("collection_saved", { collection_id: collectionId });
}

// ─── Missions ────────────────────────────────────────────────────────────────

export function trackMissionViewed() {
  trackAnalyticsEvent("mission_viewed", {});
}

export function trackMissionProgressed(params: {
  missionId: string;
  oldCount: number;
  newCount: number;
}) {
  trackAnalyticsEvent("mission_progressed", {
    mission_id: params.missionId,
    old_count: params.oldCount,
    new_count: params.newCount,
  });
}

export function trackMissionCompleted(params: { missionId: string; timeToCompleteHours: number }) {
  trackAnalyticsEvent("mission_completed", {
    mission_id: params.missionId,
    time_to_complete_hours: params.timeToCompleteHours,
  });
}

// ─── Stall interactions ───────────────────────────────────────────────────────

export function trackStallSaved(params: {
  stallId: string;
  sourceScreen: "StallDetail" | "StallDetailV2" | "CollectionDetail" | "SearchResults";
}) {
  trackAnalyticsEvent("stall_saved", {
    stall_id: params.stallId,
    source_screen: params.sourceScreen,
  });
}

export function trackStallMarkedTried(params: {
  stallId: string;
  sourceScreen: "StallDetail" | "StallDetailV2" | "CollectionDetail" | "SearchResults";
}) {
  trackAnalyticsEvent("stall_marked_tried", {
    stall_id: params.stallId,
    source_screen: params.sourceScreen,
  });
}

export function trackStallAddedToCollection(params: { stallId: string; collectionId: string }) {
  trackAnalyticsEvent("stall_added_to_collection", {
    stall_id: params.stallId,
    collection_id: params.collectionId,
  });
}

export function trackReviewMarkedHelpful(params: { reviewId: string; reviewerId: string }) {
  trackAnalyticsEvent("review_marked_helpful", {
    review_id: params.reviewId,
    reviewer_id: params.reviewerId,
  });
}
