import { useEffect, useState, type ComponentType } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MoreHorizontal } from "lucide-react-native";

import { AppText } from "@/components/ui/AppText";
import { confirmHaptic, selectHaptic, tapHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

export type DetailAction = {
  id: string;
  label: string;
  /** Lucide-style icon: receives size, color and an optional fill. */
  icon: ComponentType<{ size?: number; color?: string; fill?: string }>;
  onPress: () => void;
  /** True once the diner has done this (saved, liked, tried): shown in the brand colour. */
  active?: boolean;
  /** Fill the icon when active (bookmark, heart). */
  fillWhenActive?: boolean;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** "checkbox" for a tried toggle; defaults to button. */
  role?: "button" | "checkbox";
};

export type DetailCallToAction = {
  label: string;
  icon?: ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
  accessibilityLabel?: string;
};

type Props = {
  /** Icon-only buttons, right-aligned. */
  actions: DetailAction[];
  /** Shown in a small menu when any icon is held (or "More" is tapped). */
  secondaryActions?: DetailAction[];
  /** The orange button at the right end, e.g. "Review". */
  cta?: DetailCallToAction;
  testID?: string;
};

const ICON_SIZE = 22;
const TARGET_SIZE = 48;
const LONG_PRESS_MS = 320;

function playToggleHaptic(action: DetailAction) {
  if (action.fillWhenActive || action.role === "checkbox") {
    if (!action.active) confirmHaptic();
    else tapHaptic();
  } else {
    tapHaptic();
  }
}

/**
 * The sticky bottom bar on dish and stall pages: icon-only buttons aligned to the right and an
 * optional orange call to action. Holding any icon opens a small menu of the secondary actions
 * (share, mark tried, save), like a long-press context menu.
 */
export function DetailActionBar({ actions, secondaryActions = [], cta, testID }: Props) {
  const { componentRadii, palette, radii, shadows, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuProgress] = useState(() => new Animated.Value(0));
  const hasMenu = secondaryActions.length > 0;
  const barBottomPadding = Math.max(insets.bottom, spacing[3]);

  useEffect(() => {
    Animated.spring(menuProgress, {
      toValue: menuOpen ? 1 : 0,
      damping: 18,
      mass: 0.6,
      stiffness: 260,
      useNativeDriver: true,
    }).start();
  }, [menuOpen, menuProgress]);

  const openMenu = () => {
    if (!hasMenu) return;
    selectHaptic();
    setMenuOpen(true);
  };

  return (
    <>
      {menuOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={() => setMenuOpen(false)}
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.mediaScrimSubtle }]}
        />
      ) : null}

      {hasMenu ? (
        <Animated.View
          pointerEvents={menuOpen ? "auto" : "none"}
          accessibilityViewIsModal={menuOpen}
          style={[
            shadows.floating,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
              borderWidth: 1,
              bottom: barBottomPadding + TARGET_SIZE + spacing[4],
              minWidth: 200,
              opacity: menuProgress,
              paddingVertical: spacing[1],
              position: "absolute",
              right: spacing[4],
              transform: [
                {
                  translateY: menuProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
                {
                  scale: menuProgress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }),
                },
              ],
            },
          ]}
        >
          {secondaryActions.map((action) => {
            const Icon = action.icon;
            const color = action.active ? palette.orange : palette.text;
            return (
              <Pressable
                key={action.id}
                accessibilityHint={action.accessibilityHint}
                accessibilityLabel={action.accessibilityLabel ?? action.label}
                accessibilityRole={action.role ?? "button"}
                accessibilityState={
                  action.role === "checkbox"
                    ? { checked: Boolean(action.active), disabled: action.disabled }
                    : { selected: Boolean(action.active), disabled: action.disabled }
                }
                disabled={action.disabled || action.loading}
                onPress={() => {
                  playToggleHaptic(action);
                  setMenuOpen(false);
                  action.onPress();
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
                {action.loading ? (
                  <ActivityIndicator color={palette.orange} size="small" />
                ) : (
                  <Icon
                    color={color}
                    fill={action.active && action.fillWhenActive ? palette.orange : "none"}
                    size={20}
                  />
                )}
                <AppText variant="bodyBold" style={{ color }}>
                  {action.label}
                </AppText>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}

      <View
        testID={testID}
        style={{
          alignItems: "center",
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          bottom: 0,
          flexDirection: "row",
          gap: spacing[1],
          justifyContent: "flex-end",
          left: 0,
          paddingBottom: barBottomPadding,
          paddingHorizontal: spacing[4],
          paddingTop: spacing[2],
          position: "absolute",
          right: 0,
        }}
      >
        {actions.map((action) => {
          const Icon = action.icon;
          const color = action.active ? palette.orange : palette.text;
          return (
            <Pressable
              key={action.id}
              accessibilityHint={
                action.accessibilityHint ?? (hasMenu ? "Hold for share, tried and save" : undefined)
              }
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              accessibilityRole={action.role ?? "button"}
              accessibilityState={
                action.role === "checkbox"
                  ? { checked: Boolean(action.active), disabled: action.disabled }
                  : { selected: Boolean(action.active), disabled: action.disabled }
              }
              accessibilityActions={
                hasMenu ? [{ name: "longpress", label: "More actions" }] : undefined
              }
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === "longpress") openMenu();
              }}
              delayLongPress={LONG_PRESS_MS}
              disabled={action.disabled || action.loading}
              onLongPress={hasMenu ? openMenu : undefined}
              onPress={() => {
                playToggleHaptic(action);
                action.onPress();
              }}
              style={({ pressed }) => ({
                alignItems: "center",
                borderRadius: radii.pill,
                height: TARGET_SIZE,
                justifyContent: "center",
                opacity: action.disabled ? 0.5 : 1,
                transform: [{ scale: pressed ? 0.9 : 1 }],
                width: TARGET_SIZE,
              })}
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
            </Pressable>
          );
        })}
        {hasMenu ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More actions"
            accessibilityHint="Share, mark tried or save"
            accessibilityState={{ expanded: menuOpen }}
            onPress={() => (menuOpen ? setMenuOpen(false) : openMenu())}
            style={({ pressed }) => ({
              alignItems: "center",
              height: TARGET_SIZE,
              justifyContent: "center",
              transform: [{ scale: pressed ? 0.9 : 1 }],
              width: TARGET_SIZE,
            })}
          >
            <MoreHorizontal color={menuOpen ? palette.orange : palette.text} size={ICON_SIZE} />
          </Pressable>
        ) : null}
        {cta ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cta.accessibilityLabel ?? cta.label}
            onPress={() => {
              tapHaptic();
              cta.onPress();
            }}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: palette.orange,
              borderRadius: componentRadii.button,
              flexDirection: "row",
              gap: spacing[1.5],
              height: 44,
              justifyContent: "center",
              marginLeft: spacing[2],
              paddingHorizontal: spacing[4],
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            {cta.icon ? <cta.icon color={palette.textOnOrange} size={18} /> : null}
            <AppText variant="bodyBold" style={{ color: palette.textOnOrange }}>
              {cta.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}
