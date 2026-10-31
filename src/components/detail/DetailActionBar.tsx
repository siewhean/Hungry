import { useEffect, useState, type ComponentType } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CheckmarkSymbol } from "@/components/dish/dishSymbols";
import { AppText } from "@/components/ui/AppText";
import { PressableScale } from "@/components/ui/PressableScale";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { confirmHaptic, selectHaptic, tapHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

type IconComponent = ComponentType<{ size?: number; color?: string; fill?: string }>;

/** One choice in the menu that opens when its bar button is held. */
export type DetailHoldOption = {
  id: string;
  label: string;
  icon?: IconComponent;
  onPress: () => void;
  /** Shown with a check, e.g. the current tried state or a collection that holds the dish. */
  selected?: boolean;
  accessibilityLabel?: string;
};

export type DetailAction = {
  id: string;
  label: string;
  /** Short text shown under the icon; defaults to `label`. */
  caption?: string;
  /** Lucide-style icon: receives size, color and an optional fill. */
  icon: IconComponent;
  onPress: () => void;
  /** True once the diner has done this (saved, liked, tried): shown in the brand colour. */
  active?: boolean;
  /** Fill the icon when active (bookmark, heart). */
  fillWhenActive?: boolean;
  /** Grey instead of ink while not active (e.g. a dish not tried yet). */
  mutedWhenInactive?: boolean;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** "checkbox" for a tried toggle; defaults to button. */
  role?: "button" | "checkbox";
  /** Holding this button opens these choices (share apps, tried / not tried, collections). */
  holdOptions?: DetailHoldOption[];
  /** Heading of the hold menu, e.g. "Save to". */
  holdTitle?: string;
  /** Runs as the hold menu opens, e.g. to load the diner's collections. */
  onHoldOpen?: () => void;
  /** Shown in the hold menu while its options load. */
  holdLoading?: boolean;
};

export type DetailCallToAction = {
  label: string;
  icon?: ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
  accessibilityLabel?: string;
};

type Props = {
  /** Icon buttons on the right, each captioned. Each may have its own hold menu. */
  actions: DetailAction[];
  /** The orange button at the left end, e.g. "Write a review". */
  cta?: DetailCallToAction;
  /**
   * Draws the call to action in the darker control orange. The brand orange under white text
   * measures 3.7:1 and passes only because the label is bold; this measures 5.9:1.
   */
  highContrastCta?: boolean;
  testID?: string;
};

const ICON_SIZE = 22;
const TARGET_SIZE = 48;
/** Icon buttons sit close together: narrower than tall, with hit slop making up the rest. */
const ICON_BUTTON_MIN_WIDTH = 44;
const LONG_PRESS_MS = 320;
/** Apple's two spring parameters: how long it takes to settle, and how bouncy it is (1 = none). */
const MENU_SPRING = { duration: 300, dampingRatio: 0.8 } as const;
const MENU_SPRING_MS = 300;
/** Under Reduce Motion the menu only fades: no travel, no scale. */
const MENU_FADE_MS = 150;
/** At or above this text size the orange button may wrap to two lines instead of truncating. */
const LARGE_TEXT_SCALE = 1.3;
/** Above the page and the floating back button while a hold menu is open. */
const OVERLAY_Z = 20;

function playToggleHaptic(action: DetailAction) {
  if (action.fillWhenActive || action.role === "checkbox") {
    if (!action.active) confirmHaptic();
    else tapHaptic();
  } else {
    tapHaptic();
  }
}

/**
 * The sticky bottom bar on dish and stall pages: the orange call to action on the left and
 * captioned icon buttons on the right. Holding a button that has options (tried / not tried,
 * collections) dims the page and opens a small menu above it; only that button stays lit.
 */
export function DetailActionBar({ actions, cta, highContrastCta = false, testID }: Props) {
  const { componentRadii, palette, shadows, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  // The last menu shown, kept while it animates closed.
  const [shownMenuId, setShownMenuId] = useState<string | null>(null);
  const reduceMotion = useReduceMotion();
  const menuProgress = useSharedValue(0);
  const [barWidth, setBarWidth] = useState(0);
  const [buttonFrames, setButtonFrames] = useState<Record<string, { x: number; width: number }>>(
    {},
  );
  const barBottomPadding = Math.max(insets.bottom, spacing[3]);
  const { fontScale } = useWindowDimensions();
  const ctaLines = fontScale >= LARGE_TEXT_SCALE ? 2 : 1;
  const menuOpen = openMenuId !== null;
  const ctaTextColor = highContrastCta ? palette.textOnPrimary : palette.textOnOrange;

  useEffect(() => {
    menuProgress.value = reduceMotion
      ? withTiming(menuOpen ? 1 : 0, { duration: MENU_FADE_MS })
      : withSpring(menuOpen ? 1 : 0, { ...MENU_SPRING, reduceMotion: ReduceMotion.System });
    if (menuOpen) return;
    // Unmount the closed menu once it has settled, so its rows can't be focused or activated
    // while invisible. A timer, not an animation callback: it also covers the stubbed test run.
    const id = setTimeout(() => setShownMenuId(null), reduceMotion ? MENU_FADE_MS : MENU_SPRING_MS);
    return () => clearTimeout(id);
  }, [menuOpen, menuProgress, reduceMotion]);

  // A popover grows out of the button that opened it (its bottom right corner), from 0.95.
  const menuAnimatedStyle = useAnimatedStyle(() => ({
    opacity: menuProgress.value,
    transform: reduceMotion
      ? []
      : [
          { translateY: interpolate(menuProgress.value, [0, 1], [12, 0]) },
          { scale: interpolate(menuProgress.value, [0, 1], [0.95, 1]) },
        ],
  }));

  const openMenu = (id: string) => {
    selectHaptic();
    setShownMenuId(id);
    setOpenMenuId(id);
  };
  const closeMenu = () => setOpenMenuId(null);

  const heldAction = actions.find((action) => action.id === shownMenuId);
  const menuTitle = heldAction?.holdTitle;
  const menuRows = heldAction?.holdOptions ?? [];
  const menuLoading = Boolean(heldAction?.holdLoading);
  // Line the menu's right edge up with the held button, inside the screen edge.
  const heldFrame = shownMenuId ? buttonFrames[shownMenuId] : undefined;
  const menuRight =
    barWidth > 0 && heldFrame
      ? Math.max(spacing[4], barWidth - (heldFrame.x + heldFrame.width) - spacing[1])
      : spacing[4];

  const renderBar = () => (
    <View
      testID={testID}
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      style={{
        alignItems: "center",
        backgroundColor: palette.surface,
        borderTopColor: palette.border,
        borderTopWidth: 1,
        bottom: 0,
        flexDirection: "row",
        left: 0,
        paddingBottom: barBottomPadding,
        paddingHorizontal: spacing[4],
        paddingTop: spacing[2],
        position: "absolute",
        right: 0,
      }}
    >
      {cta ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={cta.accessibilityLabel ?? cta.label}
          onPress={() => {
            tapHaptic();
            cta.onPress();
          }}
          style={{
            alignItems: "center",
            backgroundColor: highContrastCta ? palette.orangeControl : palette.orange,
            borderRadius: componentRadii.button,
            flexDirection: "row",
            flexShrink: 1,
            gap: spacing[1.5],
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: spacing[3],
          }}
        >
          {cta.icon ? <cta.icon color={ctaTextColor} size={18} /> : null}
          <AppText
            variant="bodyBold"
            numberOfLines={ctaLines}
            style={{ color: ctaTextColor, textAlign: "center" }}
          >
            {cta.label}
          </AppText>
        </PressableScale>
      ) : null}
      <View style={{ flex: 1 }} />
      {actions.map((action) => {
        const Icon = action.icon;
        const color = action.active
          ? palette.orange
          : action.mutedWhenInactive
            ? palette.textMuted
            : palette.text;
        const hasHold = Boolean(action.holdOptions?.length || action.onHoldOpen);
        const openHold = () => {
          if (!hasHold) return;
          action.onHoldOpen?.();
          openMenu(action.id);
        };
        return (
          <PressableScale
            key={action.id}
            onLayout={(event) => {
              const { x, width } = event.nativeEvent.layout;
              setButtonFrames((current) =>
                current[action.id]?.x === x && current[action.id]?.width === width
                  ? current
                  : { ...current, [action.id]: { x, width } },
              );
            }}
            accessibilityHint={
              action.accessibilityHint ??
              (hasHold ? `Hold for more ${action.label.toLowerCase()} options` : undefined)
            }
            accessibilityLabel={action.accessibilityLabel ?? action.label}
            accessibilityRole={action.role ?? "button"}
            accessibilityState={
              action.role === "checkbox"
                ? { checked: Boolean(action.active), disabled: action.disabled }
                : { selected: Boolean(action.active), disabled: action.disabled }
            }
            accessibilityActions={
              hasHold ? [{ name: "longpress", label: `${action.label} options` }] : undefined
            }
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === "longpress") openHold();
            }}
            delayLongPress={LONG_PRESS_MS}
            disabled={action.disabled || action.loading}
            hitSlop={{ left: 2, right: 2 }}
            onLongPress={hasHold ? openHold : undefined}
            onPress={() => {
              playToggleHaptic(action);
              action.onPress();
            }}
            style={{
              alignItems: "center",
              borderRadius: componentRadii.button,
              justifyContent: "center",
              minHeight: TARGET_SIZE,
              minWidth: ICON_BUTTON_MIN_WIDTH,
              opacity: action.disabled ? 0.5 : 1,
              paddingHorizontal: spacing[1],
            }}
          >
            {action.loading ? (
              <ActivityIndicator color={palette.orange} size="small" />
            ) : (
              <Icon
                color={color}
                fill={action.active && action.fillWhenActive ? palette.orange : "none"}
                size={ICON_SIZE}
              />
            )}
            <AppText
              variant="micro"
              numberOfLines={1}
              style={{
                color: action.active ? palette.orangeText : color,
                fontWeight: action.active ? "800" : "600",
                marginTop: 2,
              }}
            >
              {action.caption ?? action.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );

  return (
    <>
      {renderBar()}

      {menuOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={closeMenu}
          style={[
            StyleSheet.absoluteFill,
            // Clear: the page stays as it is; a tap anywhere closes the menu.
            { elevation: OVERLAY_Z, zIndex: OVERLAY_Z },
          ]}
        />
      ) : null}

      {shownMenuId ? (
        <Animated.View
          pointerEvents={menuOpen ? "auto" : "none"}
          accessibilityViewIsModal={menuOpen}
          // While it fades out, screen readers must not reach the hidden rows (TalkBack ignores
          // pointerEvents and could double-tap "Not tried").
          aria-hidden={!menuOpen}
          accessibilityElementsHidden={!menuOpen}
          importantForAccessibility={menuOpen ? "auto" : "no-hide-descendants"}
          style={[
            shadows.floating,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
              borderWidth: 1,
              bottom: barBottomPadding + TARGET_SIZE + spacing[4],
              elevation: OVERLAY_Z + 1,
              maxWidth: 280,
              minWidth: 200,
              paddingVertical: spacing[1],
              position: "absolute",
              right: menuRight,
              transformOrigin: "right bottom",
              zIndex: OVERLAY_Z + 1,
            },
            menuAnimatedStyle,
          ]}
        >
          {menuTitle ? (
            <AppText
              variant="micro"
              tone="secondary"
              style={{
                fontWeight: "800",
                letterSpacing: 0.6,
                paddingHorizontal: spacing[4],
                paddingTop: spacing[2],
              }}
            >
              {menuTitle}
            </AppText>
          ) : null}
          {menuLoading ? (
            <View
              style={{ alignItems: "center", minHeight: TARGET_SIZE, justifyContent: "center" }}
            >
              <ActivityIndicator color={palette.orange} size="small" />
            </View>
          ) : null}
          {menuRows.map((row) => {
            const Icon = row.icon;
            const highlighted = row.selected;
            const color = highlighted ? palette.orange : palette.text;
            return (
              <Pressable
                key={row.id}
                accessibilityLabel={row.accessibilityLabel ?? row.label}
                accessibilityRole="button"
                accessibilityState={{ selected: Boolean(highlighted), disabled: !menuOpen }}
                disabled={!menuOpen}
                onPress={() => {
                  tapHaptic();
                  closeMenu();
                  row.onPress();
                }}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: pressed ? palette.bgSoft : "transparent",
                  flexDirection: "row",
                  gap: spacing[3],
                  minHeight: TARGET_SIZE,
                  paddingHorizontal: spacing[4],
                })}
              >
                {Icon ? <Icon color={color} fill="none" size={20} /> : null}
                <AppText variant="bodyBold" numberOfLines={1} style={{ color, flexShrink: 1 }}>
                  {row.label}
                </AppText>
                {row.selected ? (
                  <View style={{ marginLeft: "auto" }}>
                    <CheckmarkSymbol color={palette.orange} size={18} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}
    </>
  );
}
