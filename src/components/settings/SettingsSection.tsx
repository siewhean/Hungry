import { useEffect, useState, type PropsWithChildren } from "react";
import { Pressable, View, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { AppSymbol, AppText } from "../ui";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { selectHaptic } from "@/lib/haptics";
import { EASE_OUT } from "@/lib/motion/uiMotion";
import { useHungryTheme } from "@/theme";
import { componentRadii } from "@/theme/tokens";

/** Folding a section takes 200 ms (ease-out, under 300 ms), and none under Reduce Motion. */
const FOLD_MS = 200;

interface SettingsSectionProps {
  title?: string;
  description?: string;
  editorial?: boolean;
  /** The title becomes a button that folds and unfolds the rows (needs a title). */
  collapsible?: boolean;
  /** Collapsible sections start folded unless this is false. */
  defaultCollapsed?: boolean;
  /** Shown next to the title while folded, for example "3 selected", and read with the title. */
  collapsedSummary?: string;
}

export function SettingsSection({
  title,
  description,
  editorial = false,
  collapsible = false,
  defaultCollapsed = true,
  collapsedSummary,
  children,
}: PropsWithChildren<SettingsSectionProps>) {
  const { componentRadii, spacing, palette } = useHungryTheme();
  const reduceMotion = useReduceMotion();
  const canFold = collapsible && Boolean(title);
  const [collapsed, setCollapsed] = useState(canFold && defaultCollapsed);

  // A small secondary header, like the system grouped list; the card below carries the weight.
  const headerStyle = { marginLeft: spacing[4], color: palette.textSecondary };

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(FOLD_MS)}
      style={{ marginBottom: spacing[6] }}
    >
      {title && canFold ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            collapsed && collapsedSummary ? `${title}, ${collapsedSummary}` : title
          }
          accessibilityState={{ expanded: !collapsed }}
          accessibilityHint={collapsed ? "Shows these settings" : "Hides these settings"}
          onPress={() => {
            selectHaptic();
            setCollapsed((value) => !value);
          }}
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: spacing[2],
            minHeight: 44,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText
              variant={editorial ? "bodySmallBold" : "micro"}
              accessibilityRole="header"
              style={editorial ? headerStyle : undefined}
            >
              {title}
            </AppText>
            {collapsed && collapsedSummary ? (
              <AppText
                tone="muted"
                variant="bodySmall"
                style={editorial ? { marginLeft: spacing[4] } : undefined}
              >
                {collapsedSummary}
              </AppText>
            ) : null}
          </View>
          <FoldChevron open={!collapsed} reduceMotion={reduceMotion} color={palette.textMuted} />
        </Pressable>
      ) : title ? (
        <AppText
          variant={editorial ? "bodySmallBold" : "micro"}
          accessibilityRole="header"
          style={editorial ? { ...headerStyle, marginBottom: spacing[2] } : styles.title}
        >
          {title}
        </AppText>
      ) : null}

      {collapsed ? null : (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(FOLD_MS)}
          exiting={reduceMotion ? undefined : FadeOut.duration(FOLD_MS)}
          style={[
            styles.content,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
            },
          ]}
        >
          {children}
        </Animated.View>
      )}

      {description ? (
        <AppText variant="micro" tone="muted" style={styles.description}>
          {description}
        </AppText>
      ) : null}
    </Animated.View>
  );
}

/** The fold arrow turns over with the section (instantly under Reduce Motion). */
function FoldChevron({
  open,
  reduceMotion,
  color,
}: {
  open: boolean;
  reduceMotion: boolean;
  color: string;
}) {
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.set(
      reduceMotion
        ? open
          ? 1
          : 0
        : withTiming(open ? 1 : 0, { duration: FOLD_MS, easing: EASE_OUT }),
    );
  }, [open, reduceMotion, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 180}deg` }] }));
  return (
    <Animated.View style={style}>
      <AppSymbol name="chevronDown" size={16} weight="semibold" color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingLeft: 16,
    marginBottom: 8,
    letterSpacing: 1,
    fontWeight: "700",
    // Visual only: screen readers read the title as written, not letter by letter.
  },
  content: {
    borderRadius: componentRadii.card,
    borderWidth: 1,
    overflow: "hidden",
  },
  description: {
    paddingHorizontal: 16,
    marginTop: 8,
    lineHeight: 16,
  },
});
