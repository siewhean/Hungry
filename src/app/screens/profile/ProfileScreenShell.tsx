import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";

import { AppText, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

interface ProfileScreenShellProps {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  showBack?: boolean;
}

export function ProfileScreenShell({
  children,
  title,
  subtitle,
  headerRight,
  showBack = true,
}: PropsWithChildren<ProfileScreenShellProps>) {
  const { spacing } = useHungryTheme();

  return (
    <Screen
      title={title}
      subtitle={subtitle}
      headerRight={headerRight}
      showBack={showBack}
      contentContainerStyle={{ paddingTop: 0 }}
      scroll
    >
      <View style={{ gap: spacing[4] }}>{children}</View>
    </Screen>
  );
}
