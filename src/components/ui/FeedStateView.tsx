import { ActivityIndicator, View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";
import { EmptyState } from "./EmptyState";

interface FeedStateViewProps {
  state: "loading" | "error" | "empty";
  title?: string;
  body?: string;
  ctaLabel?: string;
  loadingMessage?: string;
  onPress?: () => void;
}

export function FeedStateView({
  state,
  title,
  body,
  ctaLabel,
  loadingMessage,
  onPress,
}: FeedStateViewProps) {
  const { palette, spacing } = useHungryTheme();

  if (state === "loading") {
    return (
      <View
        style={{
          alignItems: "center",
          flex: 1,
          gap: spacing[2],
          justifyContent: "center",
          paddingHorizontal: spacing[3],
        }}
      >
        <ActivityIndicator color={palette.orange} />
        <AppText tone="secondary">{loadingMessage ?? "Loading feed..."}</AppText>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: spacing[3],
      }}
    >
      <EmptyState
        title={title ?? (state === "error" ? "Unable to load feed" : "Nothing to show")}
        body={
          body ??
          (state === "error" ? "Please try again." : "Try adjusting filters and check again.")
        }
        ctaLabel={ctaLabel}
        onPress={onPress}
      />
    </View>
  );
}
