import { useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UtensilsCrossed } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, ExpandableSearchLauncher } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";

import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "NotFound">;

export function NotFoundScreen({ navigation, route }: Props) {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState("");
  const title = route.params?.title ?? "The kitchen is currently quiet.";
  const body =
    route.params?.body ??
    "We couldn't find the dish, stall or page you're looking for. It might have been taken off the menu.";
  const searchBarWidth = useMemo(
    () => Math.max(screenWidth - spacing[4] * 2, 240),
    [screenWidth, spacing],
  );

  const submitSearch = () => {
    const query = searchQuery.trim();
    // Keep what was typed: the results screen runs the search.
    navigation.navigate("SearchResults", { initialQuery: query || undefined });
    setSearchQuery("");
  };

  return (
    <SafeAreaView
      style={{ backgroundColor: palette.bgSoft, flex: 1 }}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: spacing[6] }}>
        <View style={{ alignItems: "center", gap: spacing[5] }}>
          <AppText
            style={{
              color: `${palette.orange}15`,
              fontWeight: "700",
              fontSize: 96,
              lineHeight: 96,
            }}
          >
            404
          </AppText>
          <View
            style={{
              alignItems: "center",
              backgroundColor: palette.bgMuted,
              borderRadius: radii.pill,
              height: 60,
              justifyContent: "center",
              marginTop: -54,
              width: 60,
            }}
          >
            <UtensilsCrossed color={palette.orange} size={26} />
          </View>
          <AppText variant="display" style={{ textAlign: "center" }}>
            {title}
          </AppText>
          <AppText variant="bodyLarge" tone="secondary" style={{ textAlign: "center" }}>
            {body}
          </AppText>
          <Button
            label={FEATURE_FLAGS.socialFeedEnabled ? "Back to Feed" : "Back to Discover"}
            onPress={() =>
              navigation.navigate("MainTabs", {
                screen: FEATURE_FLAGS.socialFeedEnabled ? "Home" : "Discover",
              })
            }
            style={{ borderRadius: componentRadii.button, minHeight: 56, width: 220 }}
          />
          <ExpandableSearchLauncher
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSubmit={submitSearch}
            onClear={() => setSearchQuery("")}
            placeholder="Search for dishes"
            expandedWidth={searchBarWidth}
            barHeight={44}
            iconAlignment="left"
            borderColor={palette.border}
            backgroundColor={palette.bgSoft}
            textColor={palette.orange}
            placeholderColor={palette.textSecondary}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
