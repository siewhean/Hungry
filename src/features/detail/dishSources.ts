/**
 * Where a diner opened a dish page from: sent as `source` on `dish_viewed`. Every
 * navigate("DishDetail") passes one of these (a source contract test checks it), and a
 * shared link sets "deep_link", so no dish view is attributed to "unknown".
 */
export const DISH_DETAIL_SOURCES = [
  "activity_post",
  "catalog_detail",
  "collection",
  "collection_view",
  "deep_link",
  "developer",
  "feed",
  "home",
  "home_pick",
  "more_from_stall",
  "profile",
  "quick_bites",
  "report_problem",
  "review_detail",
  "review_feed",
  "review_history",
  "saved",
  "search",
  "search_featured",
  "search_typeahead",
  "similar_nearby",
  "social_grid",
  "social_post",
  "stall_menu",
  "stall_promotion",
  "stall_review",
  "taste_result",
  "user_profile",
  "welcome_back",
] as const;

export type DishDetailSource = (typeof DISH_DETAIL_SOURCES)[number];
