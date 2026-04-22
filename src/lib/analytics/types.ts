export type AnalyticsEventName =
  | "app_launched"
  | "sign_up_completed"
  | "sign_in_completed"
  | "sign_out"
  | "onboarding_completed"
  | "taste_quiz_completed"
  | "dietary_preferences_set"
  | "location_permission_result"
  | "search_submitted"
  | "category_chip_tapped"
  | "dietary_chip_tapped"
  | "taste_filter_applied"
  | "map_pin_tapped"
  | "floor_switched"
  | "dish_viewed"
  | "decide_for_me_triggered"
  | "decide_for_me_result_shown"
  | "decide_for_me_no_match"
  | "decide_for_me_radius_expanded"
  | "delivery_link_tapped"
  | "dish_favourited"
  | "dish_unfavourited"
  | "review_started"
  | "review_submitted"
  | "claim_this_stall_tapped";

export interface AnalyticsEventRecord {
  event: AnalyticsEventName | (string & {});
  properties: Record<string, unknown>;
  session_id: string;
  user_id?: string;
  timestamp: string;
}

export type AnalyticsSink = (event: AnalyticsEventRecord) => void;
