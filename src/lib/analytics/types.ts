export type AnalyticsEventName =
  | "app_launched"
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
  | "dish_favourited"
  | "dish_unfavourited"
  | "review_started"
  | "review_submitted";

export interface AnalyticsEventRecord {
  event: AnalyticsEventName | (string & {});
  properties: Record<string, unknown>;
  session_id: string;
  user_id?: string;
  timestamp: string;
}

export type AnalyticsSink = (event: AnalyticsEventRecord) => void;
