import type { colors } from "./tokens";

type Palette = (typeof colors)[keyof typeof colors];

/**
 * The palette with Increase Contrast (iOS) or High contrast text (Android) on. Apple asks for "a
 * higher contrast color scheme when the system setting Increase Contrast is turned on"
 * (HIG, Accessibility > Color and effects). Two swaps cover the app:
 * - Light: the brand orange becomes the darker control orange, so white text on orange buttons
 *   goes from 3.7:1 to 5.9:1 and orange icons and active tabs read more strongly.
 * - Both: muted grey text (captions, metadata) becomes the secondary text colour.
 * Dark keeps its orange: its buttons already carry dark text at a high ratio.
 */
export function applyIncreaseContrast(palette: Palette, colorScheme: "light" | "dark"): Palette {
  return {
    ...palette,
    orange: colorScheme === "light" ? palette.orangeControl : palette.orange,
    textMuted: palette.textSecondary,
    // The palette types are the exact hex literals of each scheme; the swapped values are other
    // tokens of the same scheme, so the shape is unchanged.
  } as unknown as Palette;
}
