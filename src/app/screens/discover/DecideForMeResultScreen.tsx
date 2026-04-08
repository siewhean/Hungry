/**
 * DecideForMeResultScreen — AI-powered dish roulette with explainability
 *
 * Upgraded with:
 *  - blendedMatchScore from tasteEngine (replaces legacy similarityScore)
 *  - Animated match percentage counter (0 → final value)
 *  - Taste radar mini-bars showing which dimensions matched
 *  - "Why this dish?" explainability text
 *  - Animated entrance for the card
 */

import { useEffect, useRef } from "react";
import { Animated, Easing, Linking, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Sparkles } from "lucide-react-native";

import { AppText, Badge, Button, Card, EmptyState, Screen } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { blendedMatchScore, buildTasteVectorFromQuiz, TASTE_EMOJIS } from "@/lib/ai/tasteEngine";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { findBuildingById } from "@/features/discovery/discovery";
import type { TasteVector } from "@/types/domain";

// ─── Mini taste bar ───────────────────────────────────────────────────────────

function TasteMiniBar({
  label,
  emoji,
  userVal,
  dishVal,
  accentColor,
}: {
  label: string;
  emoji: string;
  userVal: number;
  dishVal: number;
  accentColor: string;
}) {
  const { palette, radii } = useHungryTheme();
  const diff = Math.abs(userVal - dishVal);
  const match = Math.round((1 - diff / 10) * 100);

  return (
    <View style={{ flex: 1, minWidth: "30%", gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <AppText variant="micro">
          {emoji} {label}
        </AppText>
        <AppText variant="micro" tone="muted">
          {match}%
        </AppText>
      </View>
      <View
        style={{
          height: 4,
          borderRadius: radii.pill,
          backgroundColor: palette.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${match}%`,
            height: "100%",
            borderRadius: radii.pill,
            backgroundColor: match >= 70 ? accentColor : palette.textMuted,
          }}
        />
      </View>
    </View>
  );
}

// ─── Match counter animation ──────────────────────────────────────────────────

function AnimatedMatchBadge({ percent }: { percent: number }) {
  const { palette, radii, spacing } = useHungryTheme();
  const counter = useRef(new Animated.Value(0)).current;
  const counterDisplay = useRef(0);

  useEffect(() => {
    Animated.timing(counter, {
      toValue: percent,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percent]);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing[2],
        backgroundColor: `${palette.orange}22`,
        borderRadius: radii.pill,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        alignSelf: "flex-start",
      }}
    >
      <Sparkles size={14} color={palette.orange} />
      <Animated.Text
        style={{
          fontSize: 13,
          fontFamily: "Nunito_800ExtraBold",
          color: palette.orange,
        }}
      >
        <>{counter.interpolate({ inputRange: [0, percent], outputRange: [0, percent] })}</>
      </Animated.Text>
      <AppText
        variant="bodySmall"
        style={{ color: palette.orange, fontFamily: "Nunito_700Bold" }}
      >
        % taste match
      </AppText>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function DecideForMeResultScreen() {
  const navigation = useNavigation<any>();
  const { palette, spacing, radii } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const selectedDish = useDiscoveryStore((state) => state.decideForMe);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);

  const dish = selectedDish ?? mockRepository.getDecideForMe(profile.tasteVector);

  // Card entrance animation
  const cardAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (dish) {
      cardAnim.setValue(0);
      Animated.spring(cardAnim, {
        toValue: 1,
        damping: 14,
        mass: 0.9,
        stiffness: 140,
        useNativeDriver: true,
      }).start();
    }
  }, [dish?.id]);

  if (!dish) {
    return (
      <Screen title="Dish Roulette" subtitle="A single dish picked just for you.">
        <EmptyState
          title="No match found"
          body="We couldn't find a dish that fits your taste profile right now. Try adjusting your preferences."
        />
        <Button
          label="Adjust taste filters"
          onPress={() => navigation.navigate("TasteFilter")}
        />
      </Screen>
    );
  }

  const venue = mockRepository.getVenueById(dish.venueId);
  const building = findBuildingById(dish.buildingId);
  const match = Math.round(blendedMatchScore(profile.tasteVector, dish.tasteVector) * 100);

  // Build taste dimension comparison
  const tasteDims: Array<{ key: keyof TasteVector; label: string }> = [
    { key: "sweet", label: "Sweet" },
    { key: "spicy", label: "Spicy" },
    { key: "sour", label: "Sour" },
    { key: "salty", label: "Salty" },
    { key: "rich", label: "Rich" },
    { key: "aromatic", label: "Aroma" },
  ];

  // Explanation: top matching dims
  const sortedDims = tasteDims
    .map((d) => ({
      ...d,
      diff: Math.abs(profile.tasteVector[d.key] - dish.tasteVector[d.key]),
    }))
    .sort((a, b) => a.diff - b.diff);

  const topMatch = sortedDims[0];
  const explanation =
    match >= 80
      ? `This dish is dialled in to your taste profile — especially the ${topMatch.label.toLowerCase()}.`
      : match >= 60
      ? `A solid pick based on your ${topMatch.label.toLowerCase()} and ${sortedDims[1].label.toLowerCase()} preferences.`
      : `A decent pick in your area — you may discover something new here.`;

  return (
    <Screen title="Dish Roulette 🎲" subtitle="One dish, picked just for you — based on your taste DNA.">
      <View style={{ gap: spacing[5] }}>
        <Animated.View
          style={{
            opacity: cardAnim,
            transform: [
              {
                translateY: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
              {
                scale: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          }}
        >
          <Card style={{ gap: spacing[4], padding: 0, overflow: "hidden" }}>
            {/* Hero image */}
            <Image
              source={{ uri: dish.imageUrl }}
              style={{ height: 240, width: "100%" }}
              contentFit="cover"
            />

            <View style={{ padding: spacing[4], gap: spacing[4] }}>
              {/* Match badge */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[2],
                  backgroundColor: `${palette.orange}22`,
                  borderRadius: radii.pill,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  alignSelf: "flex-start",
                }}
              >
                <Sparkles size={14} color={palette.orange} />
                <AppText
                  style={{
                    fontSize: 13,
                    fontFamily: "Nunito_800ExtraBold",
                    color: palette.orange,
                  }}
                >
                  {match}% taste match
                </AppText>
              </View>

              {/* Dish info */}
              <View style={{ gap: spacing[1] }}>
                <AppText variant="h1">{dish.name}</AppText>
                <AppText tone="secondary">{venue?.name}</AppText>
                <AppText tone="muted">
                  {building?.name}
                  {venue ? ` · ${venue.floor} ${venue.unitNumber}` : ""}
                </AppText>
                <AppText variant="price" style={{ marginTop: spacing[1] }}>
                  S${dish.price.toFixed(2)}
                </AppText>
              </View>

              {/* Taste tags */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                {dish.tasteTags.slice(0, 4).map((tag) => (
                  <Badge key={tag} label={tag} tone="amber" />
                ))}
              </View>

              {/* AI explanation */}
              <View
                style={{
                  backgroundColor: palette.surfaceRaised,
                  borderRadius: radii.md,
                  padding: spacing[3],
                  borderLeftWidth: 3,
                  borderLeftColor: palette.orange,
                }}
              >
                <AppText variant="micro" style={{ color: palette.orange, fontFamily: "Nunito_700Bold", marginBottom: 4 }}>
                  WHY THIS DISH?
                </AppText>
                <AppText tone="secondary" style={{ lineHeight: 20 }}>
                  {explanation}
                </AppText>
              </View>

              {/* Taste dimension bars */}
              <View>
                <AppText variant="h3" style={{ marginBottom: spacing[3] }}>
                  Taste dimensions
                </AppText>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
                  {tasteDims.map((dim) => (
                    <TasteMiniBar
                      key={dim.key}
                      label={dim.label}
                      emoji={TASTE_EMOJIS[dim.key]}
                      userVal={profile.tasteVector[dim.key]}
                      dishVal={dish.tasteVector[dim.key]}
                      accentColor={palette.orange}
                    />
                  ))}
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Actions */}
        <Button
          label="View stall"
          onPress={() => navigation.navigate("StallDetail", { venueId: dish.venueId })}
        />
        <Button
          label="Order now"
          variant="secondary"
          onPress={() => {
            const link = venue?.deliveryLinks[0];
            if (link) void Linking.openURL(link.nativeUrl || link.webUrl);
          }}
        />
        <Button
          label="🎲  Try another dish"
          variant="ghost"
          onPress={() => {
            const next = mockRepository.getDecideForMe(profile.tasteVector);
            setDecideForMe(next);
          }}
        />
        <Button label="Go back" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  );
}
