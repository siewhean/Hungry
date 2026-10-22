import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";

import { AppText, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

interface ProfileScreenShellProps {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  showBack?: boolean;
  testID?: string;
  /** False when the body is its own virtualised list (it fills the screen under the header). */
  scroll?: boolean;
}

export function ProfileScreenShell({
  children,
  title,
  subtitle,
  headerRight,
  showBack = true,
  testID,
  scroll = true,
}: PropsWithChildren<ProfileScreenShellProps>) {
  const { spacing } = useHungryTheme();

  return (
    <Screen
      title={title}
      subtitle={subtitle}
      headerRight={headerRight}
      showBack={showBack}
      headerGap={spacing[3]}
      contentContainerStyle={{ paddingTop: 0 }}
      scroll={scroll}
    >
      <View testID={testID} style={[{ gap: spacing[4] }, !scroll && { flex: 1 }]}>
        {children}
      </View>
    </Screen>
  );
}
