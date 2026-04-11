import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, View, StyleSheet } from "react-native";
import { Heart, Share2, Sparkles, ChevronLeft, MapPin, Star } from "lucide-react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button, Card, Badge } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";
import type { TasteVector } from "@/types/domain";

type Props = NativeStackScreenProps<OnboardingStackParamList, "TasteProfileResult">;

export function TasteProfileResultScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const hasSkippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);
  
  // Find top 2 taste dimensions
  const sortedTastes = Object.entries(profile.tasteVector)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2);
  
  const profileTitle = sortedTastes[0][0].charAt(0).toUpperCase() + sortedTastes[0][0].slice(1) + " Explorer";
  const dishes = mockRepository.listPopularNearby().slice(0, 4);
  const selectedCravings = (profile.onboardingSelectedDishIds || [])
    .map(id => mockRepository.getDishById(id))
    .filter(Boolean);

  return (
    <View style={{ backgroundColor: palette.bg, flex: 1 }}>
      {/* Header Navigation */}
      <View style={{ 
        paddingTop: insets.top + spacing[2], 
        paddingHorizontal: spacing[4], 
        flexDirection: "row", 
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 10
      }}>
        <Pressable 
          onPress={() => navigation.navigate("TasteQuiz")}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center" }}
        >
          <ChevronLeft color={palette.text} size={24} />
        </Pressable>
        <Pressable 
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center" }}
        >
          <Share2 color={palette.text} size={20} />
        </Pressable>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
          paddingHorizontal: spacing[5], 
          paddingTop: spacing[4],
          paddingBottom: insets.bottom + 100,
          gap: spacing[8]
        }}
      >
        {/* Identity Block */}
        <View style={{ alignItems: "center", gap: spacing[4] }}>
          <View style={[shadows.floating, { 
            width: 120, height: 120, borderRadius: 60, 
            backgroundColor: palette.orangeLight, alignItems: "center", 
            justifyContent: "center", borderWidth: 4, borderColor: "#FFFFFF" 
          }]}>
            <Sparkles color={palette.orange} size={60} />
          </View>
          
          <View style={{ alignItems: "center", gap: 2 }}>
            <Badge label="GEN-Z TASTE" tone="orange" />
            <AppText style={{ fontSize: 32, fontWeight: "900", color: palette.text, textAlign: "center" }}>
              {profileTitle}
            </AppText>
            <AppText variant="body" tone="secondary" style={{ textAlign: "center", paddingHorizontal: spacing[4] }}>
              Your cravings lean towards <AppText style={{ fontWeight: "700", color: palette.text }}>{sortedTastes[0][0]}</AppText> and <AppText style={{ fontWeight: "700", color: palette.text }}>{sortedTastes[1][0]}</AppText> flavours.
            </AppText>
          </View>
        </View>

        {/* Selected Cravings - Displaying the food choices user chose */}
        {selectedCravings.length > 0 && (
          <View style={{ gap: spacing[4] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <AppText variant="h2">Your Cravings</AppText>
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>SAVE TO FAVS</AppText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[2] }}>
              {selectedCravings.map((dish) => {
                const isFav = profile.favouriteDishIds.includes(dish!.id);
                return (
                  <Pressable 
                    key={`craving-${dish!.id}`} 
                    style={[
                      shadows.card,
                      { width: 200, backgroundColor: palette.surface, borderRadius: 24, overflow: "hidden" }
                    ]}
                  >
                    <View style={{ height: 120, width: "100%", position: "relative" }}>
                      <Image source={{ uri: dish!.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      <Pressable 
                        onPress={() => toggleFavourite(dish!)}
                        style={{ 
                          position: "absolute", top: 8, right: 8, 
                          width: 32, height: 32, borderRadius: 16, 
                          backgroundColor: isFav ? palette.orange : "rgba(255,255,255,0.9)", 
                          alignItems: "center", justifyContent: "center" 
                        }}
                      >
                        <Heart size={16} color={isFav ? "#FFFFFF" : palette.error} fill={isFav ? "#FFFFFF" : "transparent"} />
                      </Pressable>
                    </View>
                    <View style={{ padding: spacing[3], gap: 2 }}>
                      <AppText style={{ fontWeight: "800", fontSize: 14 }} numberOfLines={1}>{dish!.name}</AppText>
                      <AppText variant="micro" tone="secondary" numberOfLines={1}>{dish!.venueName}</AppText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Detailed Breakdown */}
        <View style={{ gap: spacing[4] }}>
          <AppText variant="h2">Taste Analysis</AppText>
          <Card style={{ padding: spacing[5], gap: spacing[4], backgroundColor: palette.surfaceRaised }}>
            <TasteBar label="Spicy" value={profile.tasteVector.spicy} color={palette.orange} />
            <TasteBar label="Salty" value={profile.tasteVector.salty} color="#3B82F6" />
            <TasteBar label="Sweet" value={profile.tasteVector.sweet} color="#10B981" />
            <TasteBar label="Sour" value={profile.tasteVector.sour} color="#A855F7" />
          </Card>
        </View>

        {/* Perfect Matches */}
        <View style={{ gap: spacing[4] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <AppText variant="h2">Perfect Matches</AppText>
            <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>{dishes.length} FOUND</AppText>
          </View>
          
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[4], justifyContent: "space-between" }}>
            {dishes.map((dish) => {
              const isFav = profile.favouriteDishIds.includes(dish.id);
              return (
                <Pressable 
                  key={dish.id} 
                  style={[
                    shadows.card,
                    { width: "47%", backgroundColor: palette.surface, borderRadius: 24, overflow: "hidden" }
                  ]}
                >
                  <View style={{ height: 130, width: "100%", position: "relative" }}>
                    <Image source={{ uri: dish.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    <Pressable 
                      onPress={() => toggleFavourite(dish)}
                      style={{ 
                        position: "absolute", top: 8, right: 8, 
                        width: 32, height: 32, borderRadius: 16, 
                        backgroundColor: isFav ? palette.orange : "rgba(255,255,255,0.9)", 
                        alignItems: "center", justifyContent: "center" 
                      }}
                    >
                      <Heart size={16} color={isFav ? "#FFFFFF" : palette.error} fill={isFav ? "#FFFFFF" : "transparent"} />
                    </Pressable>
                  </View>
                  <View style={{ padding: spacing[3], gap: 4 }}>
                    <AppText style={{ fontWeight: "800", fontSize: 14 }} numberOfLines={1}>{dish.name}</AppText>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Star size={12} color={palette.amber} fill={palette.amber} />
                      <AppText variant="micro" style={{ fontWeight: "700" }}>{dish.rating.toFixed(1)}</AppText>
                      <AppText variant="micro" tone="secondary">• {Math.round(dish.distanceMeters)}m</AppText>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Action Footer */}
      <View style={{ 
        position: "absolute", bottom: 0, left: 0, right: 0, 
        padding: spacing[5], paddingBottom: Math.max(insets.bottom, spacing[5]),
        backgroundColor: palette.bg,
        borderTopWidth: 1,
        borderTopColor: palette.border
      }}>
        <Button
          label="Enter Hungry"
          onPress={() => {
            completeOnboarding(hasSkippedTasteQuiz);
            navigation.navigate("LocationPermission");
          }}
        />
      </View>
    </View>
  );
}

function TasteBar({ label, value, color }: { label: string; value: number; color: string }) {
  const { palette } = useHungryTheme();
  const width = `${(value / 10) * 100}%` as any;
  
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <AppText variant="bodySmall" style={{ fontWeight: "700" }}>{label}</AppText>
        <AppText variant="micro" tone="secondary">{value.toFixed(1)}</AppText>
      </View>
      <View style={{ height: 8, backgroundColor: palette.bgSoft, borderRadius: 4, overflow: "hidden" }}>
        <View style={{ height: "100%", width, backgroundColor: color, borderRadius: 4 }} />
      </View>
    </View>
  );
}
