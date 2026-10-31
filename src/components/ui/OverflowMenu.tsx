import { MenuView, type MenuAction } from "@react-native-menu/menu";
import { useState, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppSymbol, appSymbolIosName, type AppSymbolName } from "./AppSymbol";
import { AppText } from "./AppText";

export type OverflowMenuItem = {
  id: string;
  title: string;
  /** A second line under the title, such as a count. */
  subtitle?: string;
  symbol: AppSymbolName;
  /** Red text, set apart from the other items. */
  destructive?: boolean;
  onPress: () => void;
  /** Web only: warm the next screen as the finger lands. */
  onPressIn?: () => void;
};

type OverflowMenuProps = {
  items: OverflowMenuItem[];
  /** What a screen reader says for the closed trigger, such as "Open quick access". */
  accessibilityLabel: string;
  /** Web only: the trigger's label while the menu is open. */
  openAccessibilityLabel?: string;
  /** The trigger's picture: an icon, plus a badge if there is one. */
  children: ReactNode;
  triggerStyle?: ViewStyle;
  testID?: string;
};

/**
 * The "more" control of a screen. On iOS and Android it opens the system menu (a real UIMenu or
 * popup), which dims nothing, animates itself and reads out for VoiceOver. The web build has no
 * system menu, so it gets a small dropdown with the same items.
 */
export function OverflowMenu(props: OverflowMenuProps) {
  return Platform.OS === "web" ? <WebMenu {...props} /> : <NativeMenu {...props} />;
}

function toNativeAction(item: OverflowMenuItem, errorColor: string, ios: boolean): MenuAction {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    attributes: item.destructive ? { destructive: true } : undefined,
    // Android reads this as a drawable resource name, so it is an iOS-only picture.
    image: ios ? appSymbolIosName(item.symbol) : undefined,
    titleColor: item.destructive ? errorColor : undefined,
  };
}

/**
 * The native menu's actions: the items in order, with the destructive ones in their own inline
 * group, which iOS draws behind a divider (Sign out is never one tap from Settings).
 */
export function buildNativeActions(
  items: OverflowMenuItem[],
  options: { errorColor: string; ios: boolean },
): MenuAction[] {
  const toAction = (item: OverflowMenuItem) =>
    toNativeAction(item, options.errorColor, options.ios);
  const regular = items.filter((item) => !item.destructive).map(toAction);
  const destructive = items.filter((item) => item.destructive).map(toAction);
  return destructive.length
    ? [
        ...regular,
        { id: "destructive-group", title: "", displayInline: true, subactions: destructive },
      ]
    : regular;
}

function NativeMenu({
  items,
  accessibilityLabel,
  children,
  triggerStyle,
  testID,
}: OverflowMenuProps) {
  const { palette } = useHungryTheme();
  const actions = buildNativeActions(items, {
    errorColor: palette.error,
    ios: Platform.OS === "ios",
  });

  return (
    <MenuView
      testID={testID}
      actions={actions}
      isAnchoredToRight
      onPressAction={({ nativeEvent }) =>
        items.find((item) => item.id === nativeEvent.event)?.onPress()
      }
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={10}
        style={triggerStyle}
      >
        {children}
      </View>
    </MenuView>
  );
}

function WebMenu({
  items,
  accessibilityLabel,
  openAccessibilityLabel = "Close menu",
  children,
  triggerStyle,
  testID,
}: OverflowMenuProps) {
  const { colorScheme, componentRadii, palette, shadows, spacing } = useHungryTheme();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <View testID={testID} style={{ alignItems: "flex-end", position: "relative", zIndex: 30 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? openAccessibilityLabel : accessibilityLabel}
        accessibilityState={{ expanded: open }}
        hitSlop={10}
        onPress={() => setOpen((current) => !current)}
        // Above the backdrop, so the same button that opened the menu can close it.
        style={[{ position: "relative", zIndex: 10 }, triggerStyle]}
      >
        {children}
      </Pressable>
      {open ? (
        <>
          {/* The trigger already closes it, and Escape does too: the backdrop is not a second
              "close" control for a screen reader. */}
          <Pressable
            accessible={false}
            importantForAccessibility="no"
            onPress={close}
            style={{ position: "fixed" as "absolute", inset: 0, zIndex: 5 }}
          />
          <View
            accessibilityViewIsModal
            onAccessibilityEscape={close}
            style={{
              ...shadows.floating,
              ...(colorScheme === "dark"
                ? { shadowColor: palette.white, shadowOpacity: 0.24, shadowRadius: 14 }
                : {}),
              backgroundColor: palette.surface,
              borderRadius: componentRadii.card,
              minWidth: 230,
              overflow: "hidden",
              position: "absolute",
              right: 0,
              top: "100%",
              zIndex: 20,
            }}
          >
            {items.map((item, index) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.subtitle ? `${item.title}, ${item.subtitle}` : item.title}
                onPressIn={item.onPressIn}
                onPress={() => {
                  close();
                  item.onPress();
                }}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: pressed ? palette.bgSoft : palette.surface,
                  borderTopColor: palette.border,
                  borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                  flexDirection: "row",
                  gap: spacing[3],
                  minHeight: 48,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[2],
                })}
              >
                <AppSymbol
                  name={item.symbol}
                  size={20}
                  color={item.destructive ? palette.error : palette.text}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText
                    numberOfLines={1}
                    style={{
                      color: item.destructive ? palette.error : palette.text,
                      fontWeight: "600",
                    }}
                  >
                    {item.title}
                  </AppText>
                  {item.subtitle ? (
                    <AppText variant="micro" tone="secondary">
                      {item.subtitle}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
