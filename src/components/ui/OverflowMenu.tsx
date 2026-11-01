import { useRef, useState, type ReactNode } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";

import { useHungryTheme } from "@/theme";
import { AppSymbol, type AppSymbolName } from "./AppSymbol";
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
 * The "more" control of a screen: a small menu that belongs to the app (its own card, type and
 * icons) rather than the system's. On the phone it opens in a transparent layer under the
 * trigger and fades in; on the web it is a dropdown with the same items.
 */
export function OverflowMenu(props: OverflowMenuProps) {
  return Platform.OS === "web" ? <WebMenu {...props} /> : <PopupMenu {...props} />;
}

/** The rows of an open menu, shared by the phone popup and the web dropdown. */
function MenuRows({ items, onSelect }: { items: OverflowMenuItem[]; onSelect: () => void }) {
  const { palette, spacing } = useHungryTheme();
  return (
    <>
      {items.map((item, index) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={item.subtitle ? `${item.title}, ${item.subtitle}` : item.title}
          onPressIn={item.onPressIn}
          onPress={() => {
            onSelect();
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
    </>
  );
}

function PopupMenu({
  items,
  accessibilityLabel,
  openAccessibilityLabel = "Close menu",
  children,
  triggerStyle,
  testID,
}: OverflowMenuProps) {
  const { colorScheme, componentRadii, palette, shadows } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const triggerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const close = () => setAnchor(null);
  const open = () =>
    triggerRef.current?.measureInWindow((x, y, width, height) =>
      setAnchor({ top: y + height + 6, right: Math.max(12, screenWidth - (x + width)) }),
    );

  return (
    <View testID={testID}>
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={anchor ? openAccessibilityLabel : accessibilityLabel}
        accessibilityState={{ expanded: anchor !== null }}
        hitSlop={10}
        onPress={open}
        style={triggerStyle}
      >
        {children}
      </Pressable>
      <Modal
        visible={anchor !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={close}
        accessibilityViewIsModal
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={openAccessibilityLabel}
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        {anchor ? (
          <View
            accessibilityViewIsModal
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
              right: anchor.right,
              top: anchor.top,
            }}
          >
            <MenuRows items={items} onSelect={close} />
          </View>
        ) : null}
      </Modal>
    </View>
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
            <MenuRows items={items} onSelect={close} />
          </View>
        </>
      ) : null}
    </View>
  );
}
