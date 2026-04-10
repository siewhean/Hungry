import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, View } from "react-native";
import { Heart } from "lucide-react-native";
import { Image } from "expo-image";

import { AppText, Button, Card } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteProfileResult">;

export function TasteProfileResultScreen({ navigation }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const hasSkippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);
  const dishes = mockRepository.listPopularNearby().slice(0, 4);

  return (
    <View style={{ backgroundColor: palette.bg, flex: 1 }}>
      <ScrollView contentContainerStyle={{ gap: spacing[4], padding: spacing[4], paddingBottom: spacing[12] }}>
        <View style={{ gap: spacing[1] }}>
          <AppText variant="h1">Your taste profile is ready</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Here are dishes aligned with your current preferences.
          </AppText>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3], justifyContent: "space-between" }}>
          {dishes.map((dish) => (
            <Card key={dish.id} style={{ borderRadius: radii.md, overflow: "hidden", padding: 0, width: "48%" }}>
              <Image source={{ uri: dish.imageUrl }} contentFit="cover" style={{ height: 120, width: "100%" }} />
              <View style={{ gap: spacing[1], padding: spacing[2] }}>
                <AppText variant="body" numberOfLines={1} style={{ fontFamily: "Nunito_700Bold" }}>
                  {dish.name}
                </AppText>
                <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                  <AppText variant="micro" tone="secondary" numberOfLines={1}>
                    {dish.tasteTags.slice(0, 2).join(" · ")}
                  </AppText>
                  <Pressable onPress={() => toggleFavourite(dish)} style={{ padding: spacing[1] }}>
                    <Heart color={palette.orange} size={15} />
                  </Pressable>
                </View>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>

      <View style={{ padding: spacing[4], paddingBottom: spacing[6] }}>
        <Button
          label="Continue"
          onPress={() => {
            completeOnboarding(hasSkippedTasteQuiz);
            navigation.navigate("LocationPermission");
          }}
        />
      </View>
    </View>
  );
}
