import React, { useCallback, useEffect } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, ScrollView, View, Share, StyleSheet } from "react-native";
import { Image } from "expo-image";
import {
  ChevronRight,
  Settings,
  Star,
  Utensils,
  Heart,
  Edit2,
  Share2,
  TrendingUp,
} from "lucide-react-native";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from "react-native-reanimated";

import { AppText, Badge, Card, Button } from "@/components/ui";
import { TasteRadar } from "@/components/dish/TasteRadar";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { isDishDetail } from "./profileGuards";
import { ProfileScreenShell } from "./ProfileScreenShell";
import type { ProfileStackParamList } from "./ProfileStack";

type Props = NativeStackScreenProps<ProfileStackParamList, "ProfileHome">;

export function ProfileHomeScreen({ navigation }: Props) {
  const { palette, spacing, radii, shadows, motion } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const repository = getDataRepository();
  const rootNavigation = getRootNavigation(
    navigation as NativeStackNavigationProp<ProfileStackParamList, "ProfileHome">,
  );

  const favourites = profile.favouriteDishIds
    .map((dishId) => repository.getDishById(dishId))
    .filter(isDishDetail);

  const handleShareTaste = useCallback(async () => {
    const topTastes = Object.entries(profile.tasteVector)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(
        ([key, val]) =>
          `${key.charAt(0).toUpperCase() + key.slice(1)} (${Math.round((val / 10) * 100)}%)`,
      );

    const message = `Check out my Taste Fingerprint on Hungry! 🍜\n\nMy traits:\n${topTastes.join("\n")}`;
    await Share.share({ message });
  }, [profile.tasteVector]);

  return (
    <ProfileScreenShell title="My Dashboard" subtitle="Your culinary journey, visualized.">
      <View style={{ gap: spacing[6], paddingBottom: spacing[12] }}>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center" }}>
          <Pressable
            onPress={() => navigation.navigate("Settings")}
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.pill,
              backgroundColor: palette.bgSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Settings color={palette.text} size={22} />
          </Pressable>
        </View>

        {/* ─── 1. PROFILE HEADER ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View style={styles.avatarWrap}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: palette.orangeLight, borderColor: palette.surface },
              ]}
            >
              <AppText style={{ color: palette.orange, fontSize: 32, fontWeight: "900" }}>
                {profile.displayName.charAt(0)}
              </AppText>
            </View>
            <Pressable
              onPress={() => navigation.navigate("EditProfile")}
              style={[styles.editBtn, { backgroundColor: palette.orange }]}
            >
              <Edit2 color="#fff" size={14} />
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="displayBold" style={{ fontSize: 28 }}>
              {profile.displayName}
            </AppText>
            <AppText variant="body" tone="secondary">
              Level 12 Gastronome
            </AppText>
          </View>
        </Animated.View>

        {/* ─── 2. STATS DOCK ────────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <StatCard
            label="Reviews"
            value={profile.stats.dishesReviewed}
            delay={100}
            icon={<Star size={16} color={palette.orange} />}
          />
          <StatCard
            label="Stalls"
            value={profile.stats.stallsVisited}
            delay={200}
            icon={<Utensils size={16} color={palette.orange} />}
          />
          <StatCard
            label="Saved"
            value={profile.stats.favouritesCount}
            delay={300}
            icon={<Heart size={16} color={palette.orange} />}
          />
        </View>

        {/* ─── 3. TASTE SIGNATURE ────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(400)} style={{ gap: spacing[4] }}>
          <View style={styles.sectionHeader}>
            <AppText variant="h2">Taste Signature</AppText>
            <Button
              variant="ghost"
              label="Share"
              size="sm"
              onPress={handleShareTaste}
              leftIcon={<Share2 size={16} color={palette.orange} />}
            />
          </View>

          <Card style={styles.radarCard}>
            <TasteRadar tasteVector={profile.tasteVector} size={300} />
            <View style={styles.insightBox}>
              <TrendingUp size={18} color={palette.orange} />
              <AppText variant="bodySmall" tone="secondary" style={{ flex: 1 }}>
                Your palate is evolving! You&apos;ve explored{" "}
                <AppText variant="bodySmallBold">3 new spicy dishes</AppText> this week.
              </AppText>
            </View>
          </Card>
        </Animated.View>

        {/* ─── 4. RECENTLY SAVED ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(500)} style={{ gap: spacing[4] }}>
          <View style={styles.sectionHeader}>
            <AppText variant="h2">Recently Saved</AppText>
            <Pressable onPress={() => navigation.navigate("Favourites")}>
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                VIEW ALL
              </AppText>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[4] }}
          >
            {favourites.slice(0, 5).map((dish) => (
              <Pressable
                key={dish.id}
                onPress={() => rootNavigation.navigate("DishDetail", { dishId: dish.id })}
                style={[styles.favCard, shadows.card, { backgroundColor: palette.surface }]}
              >
                <Image source={{ uri: dish.imageUrl }} style={styles.favImg} contentFit="cover" />
                <View style={{ padding: spacing[2] }}>
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
        </Animated.View>
        {/* ─── 5. SETTINGS & MORE ───────────────────────────────────────── */}
        <View style={{ gap: spacing[2] }}>
          <MenuLink
            label="Review History"
            icon={<Star size={20} color={palette.text} />}
            onPress={() => navigation.navigate("ReviewHistory")}
          />
        </View>
      </View>
    </ProfileScreenShell>
  );
}

function StatCard({
  label,
  value,
  icon,
  delay,
}: {
  label: string;
  value: number;
  icon: any;
  delay: number;
}) {
  const { palette, spacing, radii } = useHungryTheme();
  return (
    <Animated.View
      entering={FadeInDown.delay(delay)}
      style={[styles.statCard, { backgroundColor: palette.bgSoft, borderRadius: radii.lg }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon}
        <AppText style={{ fontSize: 20, fontWeight: "900" }}>{value}</AppText>
      </View>
      <AppText variant="micro" tone="secondary" style={{ letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </AppText>
    </Animated.View>
  );
}

function MenuLink({ label, icon, onPress }: { label: string; icon: any; onPress: () => void }) {
  const { palette, spacing, radii } = useHungryTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuLink,
        {
          backgroundColor: pressed ? palette.bgSoft : palette.surface,
          borderRadius: radii.lg,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={[styles.menuIcon, { backgroundColor: palette.bgSoft }]}>{icon}</View>
      <AppText variant="bodyBold" style={{ flex: 1 }}>
        {label}
      </AppText>
      <ChevronRight color={palette.textMuted} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  statCard: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  radarCard: {
    padding: 24,
    alignItems: "center",
    borderRadius: 24,
  },
  insightBox: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 12,
    alignItems: "center",
  },
  favCard: {
    width: 150,
    borderRadius: 16,
    overflow: "hidden",
  },
  favImg: {
    width: "100%",
    height: 100,
  },
  menuLink: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 16,
    borderWidth: 1,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
