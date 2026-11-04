import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

import { useHungryTheme } from "@/theme";
import { AppSymbol } from "./AppSymbol";
import { AppText } from "./AppText";

interface AppHeaderProps {
  title?: string;
  titleNode?: ReactNode;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  horizontalPadding?: number;
  style?: StyleProp<ViewStyle>;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  showBack?: boolean;
  onBackPress?: () => void;
  backIconSize?: number;
}

export function AppHeader({
  title,
  titleNode,
  subtitle,
  left,
  right,
  horizontalPadding = 0,
  style,
  titleStyle,
  subtitleStyle,
  showBack = true,
  onBackPress,
  backIconSize = 20,
}: AppHeaderProps) {
  const { componentRadii, componentSizes, palette, spacing, typography } = useHungryTheme();
  const navigation = useNavigation();
  const styles = createStyles(componentRadii, componentSizes, spacing, typography);
  const canGoBack = navigation.canGoBack();
  const shouldShowBack = showBack && !left && canGoBack;
  const resolvedOnBackPress = onBackPress ?? (() => navigation.goBack());

  const renderLeft = shouldShowBack ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={resolvedOnBackPress}
      style={styles.backButton}
    >
      <AppSymbol name="back" size={backIconSize} weight="medium" color={palette.text} />
    </Pressable>
  ) : (
    left
  );

  return (
    <View style={[styles.header, { paddingHorizontal: horizontalPadding }, style]}>
      {renderLeft ? <View style={styles.side}>{renderLeft}</View> : null}
      <View style={styles.copy}>
        {titleNode ? (
          titleNode
        ) : title ? (
          <AppText
            variant="h1"
            style={titleStyle ? [styles.title, titleStyle] : styles.title}
            numberOfLines={2}
          >
            {title}
          </AppText>
        ) : null}
        {subtitle ? (
          <AppText
            variant="bodySmall"
            tone="secondary"
            style={subtitleStyle ? [styles.subtitle, subtitleStyle] : styles.subtitle}
            numberOfLines={2}
          >
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ? <View style={styles.side}>{right}</View> : null}
    </View>
  );
}

const createStyles = (
  componentRadii: ReturnType<typeof useHungryTheme>["componentRadii"],
  componentSizes: ReturnType<typeof useHungryTheme>["componentSizes"],
  spacing: ReturnType<typeof useHungryTheme>["spacing"],
  typography: ReturnType<typeof useHungryTheme>["typography"],
) =>
  StyleSheet.create({
    header: {
      alignItems: "center",
      elevation: 20,
      flexDirection: "row",
      gap: spacing[3],
      // minHeight so large text sizes grow the header instead of clipping the title.
      minHeight: componentSizes.headerMinHeight,
      overflow: "visible",
      paddingBottom: spacing[1],
      paddingTop: spacing[1],
      zIndex: 20,
    },
    copy: {
      flex: 1,
      gap: spacing[1],
      alignItems: "flex-start",
      justifyContent: "center",
      minHeight: componentSizes.headerMinHeight,
    },
    title: {
      ...typography.h1,
    },
    subtitle: {
      ...typography.bodySmall,
    },
    side: {
      alignItems: "center",
      elevation: 21,
      justifyContent: "center",
      minHeight: componentSizes.headerMinHeight,
      overflow: "visible",
      zIndex: 21,
    },
    backButton: {
      alignItems: "center",
      borderRadius: componentRadii.iconButton,
      height: componentSizes.headerBackButton,
      justifyContent: "center",
      width: componentSizes.headerBackButton,
    },
  });
