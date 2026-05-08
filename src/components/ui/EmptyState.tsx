import type { ReactNode } from "react";
import { View } from "react-native";
import { Info } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  body: string;
  icon?: ReactNode;
  ctaLabel?: string;
  onPress?: () => void;
}

export function EmptyState({ title, body, icon, ctaLabel, onPress }: EmptyStateProps) {
  const { spacing, palette } = useHungryTheme();
  const renderIcon = icon ?? <Info size={34} color={palette.textSecondary} />;

  return (
    <View
      style={{
        alignItems: "center",
        gap: spacing[2],
        padding: spacing[4],
      }}
    >
      <View style={{ alignItems: "center", justifyContent: "center", opacity: 0.9 }}>
        {renderIcon}
      </View>
      <AppText variant="h3" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      <AppText tone="secondary" style={{ textAlign: "center" }}>
        {body}
      </AppText>
      {ctaLabel ? <Button label={ctaLabel} onPress={onPress} /> : null}
    </View>
  );
}
