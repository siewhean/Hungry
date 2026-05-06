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
import { ArrowLeft } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

interface AppHeaderProps {
  title?: string;
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
  const { spacing, palette, typography } = useHungryTheme();
  const navigation = useNavigation();
  const styles = createStyles(spacing, typography);
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
      <ArrowLeft size={backIconSize} color={palette.text} />
    </Pressable>
  ) : (
    left
  );

  return (
    <View style={[styles.header, { paddingHorizontal: horizontalPadding }, style]}>
      {renderLeft ? <View style={styles.side}>{renderLeft}</View> : null}
      <View style={styles.copy}>
        {title ? (
          <AppText
            variant="h1"
            style={titleStyle ? [styles.title, titleStyle] : styles.title}
            numberOfLines={1}
          >
            {title}
          </AppText>
        ) : null}
        {subtitle ? (
          <AppText
            variant="bodySmall"
            tone="secondary"
            style={subtitleStyle ? [styles.subtitle, subtitleStyle] : styles.subtitle}
            numberOfLines={1}
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
  spacing: ReturnType<typeof useHungryTheme>["spacing"],
  typography: ReturnType<typeof useHungryTheme>["typography"],
) =>
  StyleSheet.create({
    header: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[3],
      minHeight: 56,
      paddingBottom: spacing[2],
      paddingTop: spacing[1],
    },
    copy: {
      flex: 1,
      gap: spacing[1],
      justifyContent: "flex-start",
      minHeight: 56,
    },
    title: {
      ...typography.h1,
    },
    subtitle: {
      ...typography.bodySmall,
    },
    side: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
    },
    backButton: {
      alignItems: "center",
      borderRadius: 999,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
  });
