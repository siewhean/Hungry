/**
 * brandColors.ts
 *
 * External brand constants for delivery platforms and other third-party services.
 * These are not part of the internal Hungry design system palette but are required
 * for accurate brand representation.
 */

export const BRAND_COLORS = {
  grab: "#00B14F",
  foodpanda: "#D70F64",
  deliveroo: "#00CCBC",
} as const;

/** Label colour on each delivery button: white is 5.07:1 on foodpanda but only 2.84:1 on Grab and 2.03:1 on Deliveroo. */
export const BRAND_BUTTON_TEXT_COLORS = {
  grab: "#0B1220",
  foodpanda: "#FFFFFF",
  deliveroo: "#0B1220",
} as const;
