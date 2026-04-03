import type { PropsWithChildren } from "react";
import { View } from "react-native";

import { AppText, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

interface ProfileScreenShellProps {
  title: string;
  subtitle?: string;
}

export function ProfileScreenShell({ children, title, subtitle }: PropsWithChildren<ProfileScreenShellProps>) {
  const { spacing } = useHungryTheme();

  return (
    <Screen title={title} subtitle={subtitle} scroll>
      <View style={{ gap: spacing[4] }}>{children}</View>
    </Screen>
  );
}

