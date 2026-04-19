import { useCallback } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, ScrollView, View, Share } from "react-native";
import { Image } from "expo-image";
import {
  ChevronRight,
  Settings,
  Star,
  Utensils,
  Heart,
  Edit2,
  Share2,
  BarChart3,
  LogOut,
} from "lucide-react-native";

import { AppText, Card, Button } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { isDishDetail } from "./profileGuards";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "ProfileHome">;

export function ProfileHomeScreen_Legacy({ navigation }: Props) {
  const { palette, spacing, radii, shadows, colorScheme } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const signOut = useSessionStore((state) => state.signOut);
  const repository = getDataRepository();
  const rootNavigation = getRootNavigation(
    navigation as NativeStackNavigationProp<ProfileStackParamList, "ProfileHome">,
  );
  const favourites = profile.favouriteDishIds
    .map((dishId) => repository.getDishById(dishId))
    .filter(isDishDetail);

  const initials = profile.displayName
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleShareTaste = useCallback(async () => {
    if (!isAuthenticated) return;
    const topTastes = Object.entries(profile.tasteVector)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(
        ([key, val]) =>
          `${key.charAt(0).toUpperCase() + key.slice(1)} (${Math.round((val / 10) * 100)}%)`,
      );

    const message = `Check out my Taste Fingerprint on Hungry! 🍜\n\nMy top traits:\n${topTastes.join("\n")}\n\nDiscover your own at hungry.sg`;

    try {
      await Share.share({ message });
    } catch (error) {
      console.error("Error sharing taste fingerprint:", error);
    }
  }, [profile.tasteVector, isAuthenticated]);

  return (
    <ProfileScreenShell
      title="Profile"
      subtitle={
        isAuthenticated
          ? "Your established list-based profile."
          : "Join Hungry to save dishes and find your taste."
      }
    >
      <View style={{ gap: spacing[6], paddingBottom: spacing[8] }}>
        {/* Profile Header Block */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[4],
            marginBottom: spacing[2],
          }}
        >
          <View style={{ position: "relative" }}>
            <View
              style={[
                shadows.card,
                {
                  alignItems: "center",
                  backgroundColor: palette.orangeLight,
                  borderRadius: radii.pill,
                  height: 80,
                  justifyContent: "center",
                  width: 80,
                  borderWidth: 2,
                  borderColor: palette.surface,
                },
              ]}
            >
              <AppText
                style={{
                  color: palette.orange,
                  fontSize: 24,
                  fontWeight: "800",
                }}
              >
                {isAuthenticated ? initials : "U"}
              </AppText>
            </View>
            {isAuthenticated && (
              <Pressable
                onPress={() => navigation.navigate("EditProfile")}
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  backgroundColor: palette.orange,
                  width: 28,
                  height: 28,
                  borderRadius: radii.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: palette.surface,
                }}
              >
                <Edit2 color={palette.white} size={14} />
              </Pressable>
            )}
          </View>

          <View style={{ flex: 1, gap: spacing[1] }}>
            <AppText style={{ fontSize: 24, fontWeight: "900", color: palette.text }}>
              {isAuthenticated ? profile.displayName : "Guest User"}
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              {isAuthenticated
                ? `${profile.stats.dishesReviewed} reviews · ${profile.stats.stallsVisited} stalls visited`
                : "Sign in to see your culinary journey"}
            </AppText>
          </View>
        </View>

        {!isAuthenticated ? (
          <Card
            style={{
              gap: spacing[4],
              padding: spacing[5],
              backgroundColor: palette.bgSoft,
              borderColor: palette.orange,
            }}
          >
            <View style={{ gap: spacing[2] }}>
              <AppText variant="h2">Unlock your taste profile</AppText>
              <AppText tone="secondary">
                Save your favorite dishes, review hawker stalls, and build your personalized taste
                fingerprint.
              </AppText>
            </View>
            <Button
              label="Sign In / Create Account"
              onPress={() => navigation.navigate("AuthStack" as any, { screen: "Login" })}
            />
          </Card>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: spacing[3] }}>
              <StatBlock
                label="Reviews"
                value={profile.stats.dishesReviewed}
                icon={<Star size={14} color={palette.orange} />}
              />
              <StatBlock
                label="Stalls"
                value={profile.stats.stallsVisited}
                icon={<Utensils size={14} color={palette.orange} />}
              />
              <StatBlock
                label="Saved"
                value={profile.stats.favouritesCount}
                icon={<Heart size={14} color={palette.orange} />}
              />
            </View>

            {/* Favourites Preview (Legacy Carousel) */}
            <View style={{ gap: spacing[4] }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: spacing[1],
                }}
              >
                <AppText variant="h2">Recently Saved</AppText>
                <Pressable onPress={() => navigation.navigate("Favourites")}>
                  <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                    SEE ALL
                  </AppText>
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing[3] }}
              >
                {favourites.map((dish) => (
                  <Pressable
                    key={dish.id}
                    onPress={() => rootNavigation.navigate("DishDetail", { dishId: dish.id })}
                    style={[
                      shadows.card,
                      {
                        width: 140,
                        backgroundColor: palette.surface,
                        borderRadius: radii.lg,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: dish.imageUrl }}
                      style={{ width: "100%", height: 100 }}
                      contentFit="cover"
                    />
                    <View style={{ padding: spacing[2], gap: 2 }}>
                      <AppText variant="bodySmallBold" numberOfLines={1}>
                        {dish.name}
                      </AppText>
                      <AppText variant="micro" tone="secondary">
                        {dish.venueName}
                      </AppText>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Taste Fingerprint Section */}
            <View style={{ gap: spacing[4] }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: spacing[1],
                }}
              >
                <AppText variant="h2">Taste Fingerprint</AppText>
                <Pressable
                  onPress={handleShareTaste}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Share2 size={16} color={palette.orange} />
                  <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                    SHARE
                  </AppText>
                </Pressable>
              </View>

              <View
                style={[
                  shadows.card,
                  {
                    backgroundColor: palette.surface,
                    borderRadius: radii.xl,
                    padding: spacing[5],
                    borderWidth: 1,
                    borderColor: palette.border,
                    gap: spacing[4],
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing[3],
                  }}
                >
                  <View
                    style={{
                      backgroundColor: palette.orangeLight,
                      width: 40,
                      height: 40,
                      borderRadius: radii.pill,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <BarChart3 size={20} color={palette.orange} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontWeight: "700", fontSize: 16 }}>Detailed Analysis</AppText>
                    <AppText variant="micro" tone="secondary">
                      Updated based on your last 5 reviews
                    </AppText>
                  </View>
                </View>

                <View style={{ gap: spacing[2] }}>
                  <TasteBar
                    label="Spicy"
                    value={profile.tasteVector.spicy}
                    max={10}
                    color={palette.orange}
                  />
                  <TasteBar
                    label="Salty"
                    value={profile.tasteVector.salty}
                    max={10}
                    color={palette.info}
                  />
                  <TasteBar
                    label="Sweet"
                    value={profile.tasteVector.sweet}
                    max={10}
                    color={palette.statusFast}
                  />
                </View>
              </View>
            </View>
          </>
        )}

        {/* Quick Access List */}
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h2" style={{ paddingHorizontal: spacing[1] }}>
            Quick Access
          </AppText>
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

          {isAuthenticated && (
            <Button
              label="Sign Out"
              variant="secondary"
              onPress={signOut}
              style={{ marginTop: spacing[4] }}
              leftIcon={<LogOut size={18} color={palette.error} />}
            />
          )}
        </View>
      </View>
    </ProfileScreenShell>
  );
}

function TasteBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const { palette, spacing, radii } = useHungryTheme();
  const width = `${(value / max) * 100}%` as any;

  return (
    <View style={{ gap: spacing[1] }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <AppText variant="micro" style={{ fontWeight: "700" }}>
          {label}
        </AppText>
        <AppText variant="micro" tone="secondary">
          {value.toFixed(1)}
        </AppText>
      </View>
      <View
        style={{
          height: 6,
          backgroundColor: palette.border,
          borderRadius: radii.pill,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width,
            backgroundColor: color,
            borderRadius: radii.pill,
          }}
        />
      </View>
    </View>
  );
}

function StatBlock({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  const { palette, spacing, radii, colorScheme } = useHungryTheme();
  return (
    <View
      style={{
        backgroundColor: colorScheme === "dark" ? palette.surfaceRaised : palette.bgSoft,
        borderRadius: radii.lg,
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[3],
        alignItems: "center",
        flex: 1,
        gap: spacing[1],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
        {icon}
        <AppText style={{ fontSize: 18, fontWeight: "900", color: palette.text }}>{value}</AppText>
      </View>
      <AppText
        variant="micro"
        tone="secondary"
        style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        {label}
      </AppText>
    </View>
  );
}

function MenuRow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const { palette, spacing, radii } = useHungryTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: pressed ? palette.bgSoft : palette.surface,
          borderRadius: radii.lg,
          padding: spacing[4],
          gap: spacing[3],
          borderWidth: 1,
          borderColor: palette.border,
        },
      ]}
    >
      {icon}
      <AppText style={{ flex: 1, fontWeight: "600", color: palette.text }}>{label}</AppText>
      <ChevronRight color={palette.textMuted} size={18} />
    </Pressable>
  );
}
