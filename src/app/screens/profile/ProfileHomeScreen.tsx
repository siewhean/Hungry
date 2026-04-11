import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { ChevronRight, Settings, Star, Utensils, Heart, Edit2, Share2, BarChart3, FileEdit, Clock } from "lucide-react-native";

import { AppText, Badge, Card, Button } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useProfileStore } from "@/store/useProfileStore";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useHungryTheme } from "@/theme";
import { isDishDetail } from "./profileGuards";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";
import type { TasteVector } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "ProfileHome">;

export function ProfileHomeScreen({ navigation }: Props) {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const draft = useReviewDraftStore((state) => state.draft);
  const favourites = profile.favouriteDishIds.map((dishId) => mockRepository.getDishById(dishId)).filter(isDishDetail);
  
  const initials = profile.displayName
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const hasActiveDraft = !!(draft.selectedDishId || draft.text || draft.photos.length > 0);

  return (
    <ProfileScreenShell title="Profile">
      <View style={{ gap: spacing[6], paddingBottom: spacing[8] }}>
        
        {/* Profile Header Block */}
        <View style={{ alignItems: "center", gap: spacing[4], paddingTop: spacing[2] }}>
          <View style={{ position: "relative" }}>
            <View
              style={[
                shadows.floating,
                {
                  alignItems: "center",
                  backgroundColor: palette.orangeLight,
                  borderRadius: 60,
                  height: 120,
                  justifyContent: "center",
                  width: 120,
                  borderWidth: 4,
                  borderColor: "#FFFFFF",
                }
              ]}
            >
              <AppText style={{ color: palette.orange, fontSize: 36, fontWeight: "900" }}>
                {initials || "U"}
              </AppText>
            </View>
            <Pressable 
              onPress={() => navigation.navigate("EditProfile")}
              style={{ 
                position: "absolute", bottom: 0, right: 0, 
                backgroundColor: palette.orange, width: 36, height: 36, 
                borderRadius: 18, alignItems: "center", justifyContent: "center",
                borderWidth: 3, borderColor: "#FFFFFF"
              }}
            >
              <Edit2 color="#FFFFFF" size={16} />
            </Pressable>
          </View>

          <View style={{ alignItems: "center", gap: 2 }}>
            <AppText style={{ fontSize: 28, fontWeight: "900", color: palette.text }}>
              {profile.displayName}
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              Level 12 • Foodie Scout
            </AppText>
          </View>

          <View style={{ flexDirection: "row", gap: spacing[3], marginTop: spacing[2] }}>
            <StatBlock label="Reviews" value={profile.stats.dishesReviewed} icon={<Star size={14} color={palette.orange} />} />
            <StatBlock label="Stalls" value={profile.stats.stallsVisited} icon={<Utensils size={14} color={palette.orange} />} />
            <StatBlock label="Favourites" value={profile.stats.favouritesCount} icon={<Heart size={14} color={palette.orange} />} />
          </View>
        </View>

        {/* Drafts Section - NEW */}
        {hasActiveDraft && (
          <View style={{ gap: spacing[3] }}>
            <AppText variant="h2" style={{ paddingHorizontal: spacing[1] }}>Unfinished Posts</AppText>
            <Pressable 
              onPress={() => {
                const rootNav = getRootNavigation(navigation as any);
                rootNav.navigate("ReviewStack", { screen: "PostComposer" });
              }}
              style={({ pressed }) => [
                shadows.card,
                { 
                  backgroundColor: pressed ? palette.bgSoft : palette.surface, 
                  borderRadius: 20, 
                  padding: spacing[4],
                  borderWidth: 1,
                  borderColor: palette.orange,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3]
                }
              ]}
            >
              <View style={{ backgroundColor: palette.orangeLight, width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
                <FileEdit size={20} color={palette.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: "700" }}>Continue Review</AppText>
                <AppText variant="micro" tone="secondary">
                  {draft.selectedDishId ? mockRepository.getDishById(draft.selectedDishId)?.name : "Unnamed Dish"} • Saved just now
                </AppText>
              </View>
              <Clock size={16} color={palette.textMuted} />
            </Pressable>
          </View>
        )}

        {/* Taste Fingerprint Section */}
        <View style={{ gap: spacing[4] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing[1] }}>
            <AppText variant="h2">Taste Fingerprint</AppText>
            <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Share2 size={16} color={palette.orange} />
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>SHARE</AppText>
            </Pressable>
          </View>
          
          <Pressable 
            style={({ pressed }) => [
              shadows.card,
              { 
                backgroundColor: pressed ? palette.bgSoft : palette.surface, 
                borderRadius: 24, 
                padding: spacing[5],
                borderWidth: 1,
                borderColor: palette.border,
                gap: spacing[4]
              }
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
              <View style={{ backgroundColor: palette.orangeLight, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}>
                <BarChart3 size={20} color={palette.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: "700", fontSize: 16 }}>Detailed Analysis</AppText>
                <AppText variant="micro" tone="secondary">Updated based on your last 5 reviews</AppText>
              </View>
              <ChevronRight size={20} color={palette.textMuted} />
            </View>

            <View style={{ gap: spacing[2] }}>
              <TasteBar label="Spicy" value={profile.tasteVector.spicy} max={10} color={palette.orange} />
              <TasteBar label="Salty" value={profile.tasteVector.salty} max={10} color="#3B82F6" />
              <TasteBar label="Sweet" value={profile.tasteVector.sweet} max={10} color="#10B981" />
            </View>

            <View style={{ backgroundColor: palette.bgSoft, padding: spacing[3], borderRadius: 12 }}>
              <AppText variant="bodySmall" tone="secondary" style={{ lineHeight: 18 }}>
                Your profile leans heavily towards <AppText style={{ fontWeight: "700", color: palette.text }}>Spicy</AppText> flavours. You've discovered <AppText style={{ fontWeight: "700", color: palette.text }}>8 new stalls</AppText> this month, putting you in the <AppText style={{ fontWeight: "700", color: palette.orange }}>top 5%</AppText> of explorers in Tanjong Pagar.
              </AppText>
            </View>
          </Pressable>
        </View>

        {/* Quick Access List */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h2" style={{ paddingHorizontal: spacing[1] }}>Quick Access</AppText>
          <View style={{ gap: spacing[2] }}>
            <MenuRow 
              label="My Favourites" 
              icon={<Heart size={20} color={palette.text} />} 
              onPress={() => navigation.navigate("Favourites")} 
            />
            <MenuRow 
              label="Review History" 
              icon={<Star size={20} color={palette.text} />} 
              onPress={() => navigation.navigate("ReviewHistory")} 
            />
            <MenuRow 
              label="Settings" 
              icon={<Settings size={20} color={palette.text} />} 
              onPress={() => navigation.navigate("Settings")} 
            />
          </View>
        </View>

        {/* Favourites Preview */}
        <View style={{ gap: spacing[4] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing[1] }}>
            <AppText variant="h2">Recently Favourited</AppText>
            <Pressable onPress={() => navigation.navigate("Favourites")}>
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>SEE ALL</AppText>
            </Pressable>
          </View>
          
          {favourites.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[3] }}>
              {favourites.slice(0, 4).map((dish) => (
                <Pressable 
                  key={dish.id}
                  style={[
                    shadows.card,
                    { width: 160, backgroundColor: palette.surface, borderRadius: 20, overflow: "hidden" }
                  ]}
                >
                  <Image source={{ uri: dish.imageUrl }} style={{ width: "100%", height: 110 }} contentFit="cover" />
                  <View style={{ padding: spacing[3], gap: 2 }}>
                    <AppText variant="bodySmall" style={{ fontWeight: "700" }} numberOfLines={1}>{dish.name}</AppText>
                    <AppText variant="micro" tone="secondary">S${dish.price.toFixed(2)}</AppText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Card style={{ padding: spacing[6], alignItems: "center" }}>
              <AppText tone="secondary">No favourites yet. Start exploring!</AppText>
            </Card>
          )}
        </View>

      </View>
    </ProfileScreenShell>
  );
}

function TasteBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const { palette } = useHungryTheme();
  const width = `${(value / max) * 100}%` as any;
  
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <AppText variant="micro" style={{ fontWeight: "700" }}>{label}</AppText>
        <AppText variant="micro" tone="secondary">{value.toFixed(1)}</AppText>
      </View>
      <View style={{ height: 6, backgroundColor: palette.border, borderRadius: 3, overflow: "hidden" }}>
        <View style={{ height: "100%", width, backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

function StatBlock({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const { palette, spacing } = useHungryTheme();
  return (
    <View style={{ 
      backgroundColor: palette.bgSoft, 
      borderRadius: 16, 
      paddingVertical: spacing[3], 
      paddingHorizontal: spacing[4], 
      alignItems: "center",
      minWidth: 90,
      gap: 2
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {icon}
        <AppText style={{ fontSize: 18, fontWeight: "900", color: palette.text }}>{value}</AppText>
      </View>
      <AppText variant="micro" tone="secondary" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</AppText>
    </View>
  );
}

function MenuRow({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  const { palette, spacing } = useHungryTheme();
  return (
    <Pressable 
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: pressed ? palette.bgSoft : palette.surface,
          borderRadius: 16,
          padding: spacing[4],
          gap: spacing[3],
          borderWidth: 1,
          borderColor: palette.border,
        }
      ]}
    >
      {icon}
      <AppText style={{ flex: 1, fontWeight: "600", color: palette.text }}>{label}</AppText>
      <ChevronRight color={palette.textMuted} size={18} />
    </Pressable>
  );
}
