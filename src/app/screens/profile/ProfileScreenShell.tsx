import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import { View, type RefreshControlProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

interface ProfileScreenShellProps {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  /** Replaces the back button, such as a Cancel on a form. */
  headerLeft?: ReactNode;
  showBack?: boolean;
  testID?: string;
  /** False when the body is its own virtualised list (it fills the screen under the header). */
  scroll?: boolean;
  /** Pull to refresh. */
  refreshControl?: ReactElement<RefreshControlProps>;
}

export function ProfileScreenShell({
  children,
  title,
  subtitle,
  headerRight,
  headerLeft,
  showBack = true,
  testID,
  scroll = true,
  refreshControl,
}: PropsWithChildren<ProfileScreenShellProps>) {
  const { spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  // Screen's SafeAreaView already pads the top inset; add breathing room only where the
  // inset is 0 (web, no notch) so the title is not flush with the top edge.
  const topPadding = insets.top > 0 ? 0 : spacing[4];

  return (
    <Screen
      title={title}
      subtitle={subtitle}
      headerRight={headerRight}
      headerLeft={headerLeft}
      showBack={showBack}
      headerGap={spacing[3]}
      contentContainerStyle={{ paddingTop: topPadding }}
      scroll={scroll}
      refreshControl={refreshControl}
    >
      <View testID={testID} style={[{ gap: spacing[4] }, !scroll && { flex: 1 }]}>
        {children}
      </View>
    </Screen>
  );
}
