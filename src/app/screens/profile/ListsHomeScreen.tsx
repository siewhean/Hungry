import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BarChart3, Bookmark, ChevronRight, ListChecks } from "lucide-react-native";

import { AppText, Card } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { preloadRoute } from "@/features/navigation/prefetch";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "ListsHome">;

/**
 * One "Lists" area (decision 21): Saved, your lists (portfolios) and checklists
 * open from here instead of separate menu rows. Each row reuses the existing screen.
 */
export function ListsHomeScreen({ navigation }: Props) {
  const { palette } = useHungryTheme();
  const savedCount = useProfileStore((state) => state.profile.favouriteDishIds.length);

  return (
    <ProfileScreenShell title="Lists" subtitle="Everything you've saved and listed, in one place.">
      <View style={{ gap: 12 }}>
        <ListsHubRow
          title="Saved"
          body={`${savedCount} saved ${savedCount === 1 ? "dish" : "dishes"}, plus stalls and lists`}
          icon={<Bookmark color={palette.orange} size={20} />}
          onPressIn={() => preloadRoute(navigation, "Favourites")}
          onPress={() => navigation.navigate("Favourites")}
        />
        {FEATURE_FLAGS.portfoliosEnabled ? (
          <ListsHubRow
            title="Your lists"
            body="Rankings, food trails and recommendations to share"
            icon={<BarChart3 color={palette.orange} size={20} />}
            onPressIn={() => preloadRoute(navigation, "PortfoliosHome")}
            onPress={() => navigation.navigate("PortfoliosHome")}
          />
        ) : null}
        {FEATURE_FLAGS.collectionsEnabled ? (
          <ListsHubRow
            title="Checklists"
            body="Places to try, ticked off as you go"
            icon={<ListChecks color={palette.orange} size={20} />}
            onPressIn={() => preloadRoute(navigation, "ChecklistsHome")}
            onPress={() => navigation.navigate("ChecklistsHome")}
          />
        ) : null}
      </View>
    </ProfileScreenShell>
  );
}

function ListsHubRow({
  title,
  body,
  icon,
  onPress,
  onPressIn,
}: {
  title: string;
  body: string;
  icon: ReactNode;
  onPress: () => void;
  onPressIn?: () => void;
}) {
  const { palette, spacing } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      onPressIn={onPressIn}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Card
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[3],
          minHeight: 64,
        }}
      >
        {icon}
        <View style={{ flex: 1, gap: spacing[1] }}>
          <AppText variant="bodyBold">{title}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {body}
          </AppText>
        </View>
        <ChevronRight color={palette.textMuted} size={18} />
      </Card>
    </Pressable>
  );
}
