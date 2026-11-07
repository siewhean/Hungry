import { useEffect, useMemo, useRef } from "react";
import { Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button } from "@/components/ui";
import { useReviewDishDetails } from "@/features/profile/useReviewDishDetails";
import {
  CONFIDENCE_WORDS,
  buildTastePalette,
  learnedFromSentence,
  type PaletteFoodType,
} from "@/features/profile/tastePalette";
import { hasTasteSignal } from "@/features/profile/tasteFingerprint";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = NativeStackScreenProps<RootStackParamList, "TastePalette">;

/** One taste as a bar out of 10 with the word a diner would use. */
function LevelBar({ label, level, word }: { label: string; level: number; word: string }) {
  const { palette, radii, spacing } = useHungryTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${word}, ${level} out of 10`}
      style={{ gap: spacing[1] }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <AppText variant="bodyBold">{label}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {word}
        </AppText>
      </View>
      <View style={{ backgroundColor: palette.bgSoft, borderRadius: radii.pill, height: 8 }}>
        <View
          style={{
            backgroundColor: palette.accentText,
            borderRadius: radii.pill,
            height: 8,
            width: `${Math.max(4, Math.min(100, level * 10))}%`,
          }}
        />
      </View>
    </View>
  );
}

function FoodTypeChips({
  rows,
  testID,
  onPress,
}: {
  rows: PaletteFoodType[];
  testID: string;
  onPress?: (row: PaletteFoodType) => void;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  return (
    <View testID={testID} style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
      {rows.map((row) => (
        <Pressable
          key={row.foodType}
          testID={`${testID}-${row.foodType}`}
          accessibilityRole={onPress ? "button" : "text"}
          accessibilityHint={onPress ? `Searches for ${row.label}` : undefined}
          disabled={!onPress}
          onPress={onPress ? () => onPress(row) : undefined}
          style={({ pressed }) => ({
            backgroundColor: pressed ? palette.bgSoft : palette.surface,
            borderColor: palette.border,
            borderRadius: radii.pill,
            borderWidth: 1,
            justifyContent: "center",
            minHeight: 44,
            paddingHorizontal: spacing[3],
          })}
        >
          <AppText variant="bodySmall">{row.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The Taste Palette: what Hungry has learned about your taste, how sure it is, what changed it
 * lately and what to try next. Everything comes from the phone; dish names for "What shaped
 * it" arrive in one batched read.
 */
export function TastePaletteScreen({ navigation }: Props) {
  const { componentRadii, palette: colors, spacing } = useHungryTheme();
  const vector = useProfileStore((state) => state.profile.tasteVector);
  const events = useProfileStore((state) => state.tasteInteractionEvents);
  const foodHistory = useProfileStore((state) => state.foodHistory);

  const tastePalette = useMemo(
    () => buildTastePalette({ vector, events, foodHistory }),
    [events, foodHistory, vector],
  );
  const hasPalate = hasTasteSignal(vector);
  const { infoFor } = useReviewDishDetails(tastePalette.shapedBy);

  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackAnalyticsEvent("taste_palette_viewed", {
      confidence: tastePalette.confidence,
      signal_count: tastePalette.signalCount,
    });
  }, [tastePalette.confidence, tastePalette.signalCount]);

  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: componentRadii.card,
    gap: spacing[3],
    padding: spacing[4],
  } as const;

  const retakeQuiz = () =>
    navigation.navigate("OnboardingStack", { screen: "TasteQuiz", params: { mode: "profile" } });

  if (!hasPalate) {
    return (
      <ProfileScreenShell title="Taste Palette" testID="taste-palette-screen">
        <View style={cardStyle} testID="taste-palette-empty">
          <AppText variant="bodyBold">Your palette starts with a quick quiz</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Six questions about spice, richness and the rest. Every save, like and review sharpens
            it after that.
          </AppText>
          <Button label="Take the taste quiz" onPress={retakeQuiz} />
        </View>
      </ProfileScreenShell>
    );
  }

  return (
    <ProfileScreenShell title="Taste Palette" testID="taste-palette-screen">
      <View style={cardStyle} testID="taste-palette-confidence">
        <AppText variant="h3">{CONFIDENCE_WORDS[tastePalette.confidence]}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {learnedFromSentence(tastePalette.signalCount)}
        </AppText>
        {tastePalette.drift ? (
          <AppText variant="bodySmall" testID="taste-palette-drift">
            {tastePalette.drift.sentence}
          </AppText>
        ) : null}
      </View>

      <View style={cardStyle} testID="taste-palette-axes">
        {tastePalette.axes.map((axis) => (
          <LevelBar key={axis.key} label={axis.label} level={axis.level} word={axis.word} />
        ))}
      </View>

      {tastePalette.loves.length > 0 ? (
        <View style={{ gap: spacing[2] }}>
          <AppText variant="h3" accessibilityRole="header">
            You keep coming back to
          </AppText>
          <FoodTypeChips rows={tastePalette.loves} testID="taste-palette-loves" />
        </View>
      ) : null}

      {tastePalette.skips.length > 0 ? (
        <View style={{ gap: spacing[2] }}>
          <AppText variant="h3" accessibilityRole="header">
            Not really your thing
          </AppText>
          <FoodTypeChips rows={tastePalette.skips} testID="taste-palette-skips" />
        </View>
      ) : null}

      {tastePalette.tryNext.length > 0 ? (
        <View style={{ gap: spacing[2] }}>
          <AppText variant="h3" accessibilityRole="header">
            Try next
          </AppText>
          <AppText variant="bodySmall" tone="secondary">
            Dishes that suit your palate and you have not tried yet.
          </AppText>
          <FoodTypeChips
            rows={tastePalette.tryNext}
            testID="taste-palette-try-next"
            onPress={(row) => navigation.navigate("SearchResults", { initialQuery: row.label })}
          />
        </View>
      ) : null}

      {tastePalette.shapedBy.length > 0 ? (
        <View style={cardStyle} testID="taste-palette-shaped-by">
          <AppText variant="bodyBold" accessibilityRole="header">
            What shaped it lately
          </AppText>
          {tastePalette.shapedBy.map((shaper) => {
            const info = infoFor(shaper.dishId);
            const name = info.status === "ready" ? info.name : "A dish";
            return (
              <Pressable
                key={shaper.id}
                testID={`taste-palette-shaper-${shaper.id}`}
                accessibilityRole="button"
                accessibilityHint="Opens the dish"
                onPress={() =>
                  shaper.dishId
                    ? navigation.navigate("DishDetail", {
                        dishId: shaper.dishId,
                        source: "profile",
                      })
                    : undefined
                }
                style={{ gap: 2, minHeight: 44, justifyContent: "center" }}
              >
                <AppText variant="bodySmall" numberOfLines={1}>
                  {shaper.action}: {name}
                </AppText>
                {shaper.moved ? (
                  <AppText variant="micro" tone="secondary">
                    {shaper.moved.change > 0 ? "More" : "Less"} {shaper.moved.label.toLowerCase()}
                  </AppText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Button label="Retake the taste quiz" variant="secondary" onPress={retakeQuiz} />
    </ProfileScreenShell>
  );
}
