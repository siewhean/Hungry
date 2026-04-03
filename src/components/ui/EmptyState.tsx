import { View } from "react-native";

import { useHungryTheme } from "@/theme";
import { Card } from "./Card";
import { AppText } from "./AppText";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  body: string;
  ctaLabel?: string;
  onPress?: () => void;
}

export function EmptyState({ title, body, ctaLabel, onPress }: EmptyStateProps) {
  const { spacing } = useHungryTheme();

  return (
    <Card>
      <View style={{ gap: spacing[2] }}>
        <AppText variant="h3">{title}</AppText>
        <AppText tone="secondary">{body}</AppText>
      </View>
      {ctaLabel ? <Button label={ctaLabel} onPress={onPress} /> : null}
    </Card>
  );
}

