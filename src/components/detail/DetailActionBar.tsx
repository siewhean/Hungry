import { useEffect, useState, type ComponentType } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, MoreHorizontal } from "lucide-react-native";

import { AppText } from "@/components/ui/AppText";
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
  /** Lucide-style icon: receives size, color and an optional fill. */
  icon: IconComponent;
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
  /** Icon-only buttons on the right. Each may have its own hold menu. */
  actions: DetailAction[];
  /** The "More" (three dots) menu at the far right. */
  secondaryActions?: DetailAction[];
  /** The orange button at the left end, e.g. "Review". */
  cta?: DetailCallToAction;
  testID?: string;
};

const ICON_SIZE = 22;
const TARGET_SIZE = 48;
const LONG_PRESS_MS = 320;
const MORE_MENU_ID = "__more__";

function playToggleHaptic(action: DetailAction) {
  if (action.fillWhenActive || action.role === "checkbox") {
    if (!action.active) confirmHaptic();
    else tapHaptic();
  } else {
    tapHaptic();
  }
}

type MenuRow = {
  id: string;
  label: string;
  icon?: IconComponent;
  onPress: () => void;
  selected?: boolean;
  active?: boolean;
  fillWhenActive?: boolean;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  role?: "button" | "checkbox";
};

/**
 * The sticky bottom bar on dish and stall pages: the orange call to action on the left and
 * icon-only buttons on the right. Holding a button opens its own small menu above it (share
 * options, tried / not tried, collections); "More" opens the rest.
 */
export function DetailActionBar({ actions, secondaryActions = [], cta, testID }: Props) {
  const { componentRadii, palette, radii, shadows, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  // The last menu shown, kept while it animates closed.
  const [shownMenuId, setShownMenuId] = useState<string | null>(null);
  const [menuProgress] = useState(() => new Animated.Value(0));
  const [barWidth, setBarWidth] = useState(0);
  const [buttonRight, setButtonRight] = useState<Record<string, number>>({});
  const hasMore = secondaryActions.length > 0;
  const barBottomPadding = Math.max(insets.bottom, spacing[3]);
  const menuOpen = openMenuId !== null;

  useEffect(() => {
    Animated.spring(menuProgress, {
      toValue: menuOpen ? 1 : 0,
      damping: 18,
      mass: 0.6,
      stiffness: 260,
      useNativeDriver: true,
    }).start();
  }, [menuOpen, menuProgress]);

  const openMenu = (id: string) => {
    selectHaptic();
    setShownMenuId(id);
    setOpenMenuId(id);
  };
  const closeMenu = () => setOpenMenuId(null);

  const heldAction = actions.find((action) => action.id === shownMenuId);
  const menuTitle = shownMenuId === MORE_MENU_ID ? undefined : heldAction?.holdTitle;
  const menuRows: MenuRow[] =
    shownMenuId === MORE_MENU_ID
      ? secondaryActions
      : (heldAction?.holdOptions ?? []).map((option) => ({ ...option }));
  const menuLoading = shownMenuId !== MORE_MENU_ID && Boolean(heldAction?.holdLoading);
  // Line the menu's right edge up with the held button, inside the screen edge.
  const anchorRight = shownMenuId ? buttonRight[shownMenuId] : undefined;
  const menuRight =
    barWidth > 0 && anchorRight !== undefined
      ? Math.max(spacing[4], barWidth - anchorRight - spacing[1])
      : spacing[4];

  return (
    <>
      {menuOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={closeMenu}
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.mediaScrimSubtle }]}
        />
      ) : null}

      {shownMenuId ? (
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
              maxWidth: 280,
              minWidth: 200,
              opacity: menuProgress,
              paddingVertical: spacing[1],
              position: "absolute",
              right: menuRight,
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
          {menuTitle ? (
            <AppText
              variant="micro"
              tone="secondary"
              style={{
                fontWeight: "800",
                letterSpacing: 0.6,
                paddingHorizontal: spacing[4],
                paddingTop: spacing[2],
                textTransform: "uppercase",
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
            const highlighted = row.active || row.selected;
            const color = highlighted ? palette.orange : palette.text;
            return (
              <Pressable
                key={row.id}
                accessibilityHint={row.accessibilityHint}
                accessibilityLabel={row.accessibilityLabel ?? row.label}
                accessibilityRole={row.role ?? "button"}
                accessibilityState={
                  row.role === "checkbox"
                    ? { checked: Boolean(row.active), disabled: row.disabled }
                    : { selected: Boolean(highlighted), disabled: row.disabled }
                }
                disabled={row.disabled || row.loading}
                onPress={() => {
                  if (row.selected === undefined) playToggleHaptic(row as DetailAction);
                  else tapHaptic();
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
                {row.loading ? (
                  <ActivityIndicator color={palette.orange} size="small" />
                ) : Icon ? (
                  <Icon
                    color={color}
                    fill={row.active && row.fillWhenActive ? palette.orange : "none"}
                    size={20}
                  />
                ) : null}
                <AppText variant="bodyBold" numberOfLines={1} style={{ color, flexShrink: 1 }}>
                  {row.label}
                </AppText>
                {row.selected ? (
                  <View style={{ marginLeft: "auto" }}>
                    <Check color={palette.orange} size={18} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}

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
          gap: spacing[1],
          left: 0,
          paddingBottom: barBottomPadding,
          paddingHorizontal: spacing[4],
          paddingTop: spacing[2],
          position: "absolute",
          right: 0,
        }}
      >
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
        <View style={{ flex: 1 }} />
        {actions.map((action) => {
          const Icon = action.icon;
          const color = action.active ? palette.orange : palette.text;
          const hasHold = Boolean(action.holdOptions?.length || action.onHoldOpen);
          const openHold = () => {
            if (!hasHold) return;
            action.onHoldOpen?.();
            openMenu(action.id);
          };
          return (
            <Pressable
              key={action.id}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                setButtonRight((current) =>
                  current[action.id] === x + width
                    ? current
                    : { ...current, [action.id]: x + width },
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
              onLongPress={hasHold ? openHold : undefined}
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
                  color={openMenuId === action.id ? palette.orange : color}
                  fill={action.active && action.fillWhenActive ? palette.orange : "none"}
                  size={ICON_SIZE}
                />
              )}
            </Pressable>
          );
        })}
        {hasMore ? (
          <Pressable
            onLayout={(event) => {
              const { x, width } = event.nativeEvent.layout;
              setButtonRight((current) =>
                current[MORE_MENU_ID] === x + width
                  ? current
                  : { ...current, [MORE_MENU_ID]: x + width },
              );
            }}
            accessibilityRole="button"
            accessibilityLabel="More actions"
            accessibilityHint={secondaryActions.map((action) => action.label).join(", ")}
            accessibilityState={{ expanded: openMenuId === MORE_MENU_ID }}
            onPress={() => (openMenuId === MORE_MENU_ID ? closeMenu() : openMenu(MORE_MENU_ID))}
            style={({ pressed }) => ({
              alignItems: "center",
              height: TARGET_SIZE,
              justifyContent: "center",
              transform: [{ scale: pressed ? 0.9 : 1 }],
              width: TARGET_SIZE,
            })}
          >
            <MoreHorizontal
              color={openMenuId === MORE_MENU_ID ? palette.orange : palette.text}
              size={ICON_SIZE}
            />
          </Pressable>
        ) : null}
      </View>
    </>
  );
}
