/**
 * The home indicator sits inside the bottom safe area, so the tab labels can sit closer to the
 * screen edge than the full inset. Trimming it keeps the bar from looking padded at the bottom.
 */
const HOME_INDICATOR_TRIM = 12;

export function tabBarBottomPadding(insetBottom: number, minimum: number): number {
  return Math.max(insetBottom - HOME_INDICATOR_TRIM, minimum);
}
