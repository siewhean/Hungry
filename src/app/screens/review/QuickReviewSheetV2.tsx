import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Check, Camera, Star, X } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, Card, Input } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

type Props = NativeStackScreenProps<RootStackParamList, "QuickReviewV2">;

const TASTE_TAGS = [
  "🌶️ Spicy",
  "🧂 Savoury",
  "🍯 Sweet",
  "🍋 Sour",
  "💪 Generous",
  "🌿 Fresh",
  "💰 Worth it",
  "🧊 Cold",
  "🫙 Rich broth",
  "🥢 Chewy",
  "🔥 Hot",
  "⚡ Quick",
];

export function QuickReviewSheetV2({ navigation, route }: Props) {
  const { componentRadii, palette, spacing, radii, shadows } = useHungryTheme();
  const onClose = () => navigation.goBack();
  const onSubmit = (review: any) => navigation.goBack();

  const [step, setStep] = useState(1);
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else onSubmit({ rating, selectedTags, note });
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else onClose();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Progress Bar */}
      <View style={{ height: 4, backgroundColor: palette.border }}>
        <View
          style={{
            width: `${(step / 4) * 100}%` as any,
            height: "100%",
            backgroundColor: step === 4 ? palette.success : palette.orange,
          }}
        />
      </View>

      {/* Header */}
      <View style={{ padding: spacing[4], paddingBottom: spacing[2] }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing[1],
          }}
        >
          <AppText variant="micro" tone="muted" style={{ textTransform: "uppercase" }}>
            {step === 1
              ? "Which dish?"
              : step === 2
                ? "Rate it"
                : step === 3
                  ? "How did it taste?"
                  : "Done!"}
          </AppText>
          {step < 4 && (
            <Pressable onPress={onClose}>
              <X size={20} color={palette.textMuted} />
            </Pressable>
          )}
        </View>
        {step < 4 && (
          <AppText variant="h2" style={{ fontWeight: "900" }}>
            {step === 1
              ? "Which dish are you reviewing?"
              : step === 2
                ? "How was it overall?"
                : "Select taste tags"}
          </AppText>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {step === 1 && (
          <ScrollView style={{ paddingHorizontal: spacing[4] }}>
            <View style={{ gap: spacing[3] }}>
              <Pressable
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                  padding: spacing[3],
                  backgroundColor: palette.orangeLight,
                  borderWidth: 2,
                  borderColor: palette.orange,
                  borderRadius: componentRadii.card,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: radii.md,
                    backgroundColor: palette.bgSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AppText style={{ fontSize: 28 }}>🍜</AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyBold">Wanton Noodles</AppText>
                  <AppText variant="micro" tone="secondary">
                    S$4.50 · Most ordered
                  </AppText>
                </View>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: palette.orange,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={14} color="white" strokeWidth={3} />
                </View>
              </Pressable>

              <Card
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                  padding: spacing[3],
                  backgroundColor: palette.bgSoft,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: radii.md,
                    backgroundColor: palette.bgMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AppText style={{ fontSize: 28 }}>🥟</AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyBold">Steamed Wantons</AppText>
                  <AppText variant="micro" tone="secondary">
                    S$3.50
                  </AppText>
                </View>
              </Card>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                  padding: spacing[3],
                  borderStyle: "dashed",
                  borderWidth: 1,
                  borderColor: palette.border,
                  borderRadius: componentRadii.card,
                  backgroundColor: palette.bgSoft,
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: radii.md,
                    backgroundColor: palette.bgMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Camera size={24} color={palette.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodySmallBold" tone="secondary">
                    Add a photo of your dish
                  </AppText>
                  <AppText variant="micro" tone="muted">
                    Optional — helps others
                  </AppText>
                </View>
              </View>
            </View>
          </ScrollView>
        )}

        {step === 2 && (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: spacing[6],
            }}
          >
            <View style={{ flexDirection: "row", gap: spacing[4], marginBottom: spacing[6] }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Pressable key={i} onPress={() => setRating(i)}>
                  <Star
                    size={48}
                    color={i <= rating ? palette.amber : palette.border}
                    fill={i <= rating ? palette.amber : "transparent"}
                  />
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
              <AppText variant="micro" tone="muted">
                Disappointing
              </AppText>
              <AppText variant="micro" tone="muted">
                Will come back
              </AppText>
            </View>
          </View>
        )}

        {step === 3 && (
          <ScrollView style={{ paddingHorizontal: spacing[4] }}>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing[2],
                marginBottom: spacing[6],
              }}
            >
              {TASTE_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: radii.pill,
                      backgroundColor: isSelected ? palette.orangeLight : palette.bgSoft,
                      borderWidth: 1,
                      borderColor: isSelected ? palette.orange : palette.border,
                    }}
                  >
                    <AppText
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: isSelected ? palette.orange : palette.textSecondary,
                      }}
                    >
                      {tag}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <View
              style={{ height: 1, backgroundColor: palette.border, marginBottom: spacing[4] }}
            />
            <AppText
              variant="bodySmallBold"
              tone="muted"
              style={{ marginBottom: spacing[2], textAlign: "center" }}
            >
              Optional: add a note
            </AppText>
            <Input
              placeholder="Add anything else… (140 chars max)"
              multiline
              maxLength={140}
              value={note}
              onChangeText={setNote}
              style={{ height: 80, textAlignVertical: "top" }}
            />
            <AppText variant="micro" tone="muted" style={{ textAlign: "right", marginTop: 4 }}>
              {note.length} / 140
            </AppText>
          </ScrollView>
        )}

        {step === 4 && (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: spacing[8],
            }}
          >
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: componentRadii.iconButton,
                backgroundColor: palette.successSoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing[4],
              }}
            >
              <AppText style={{ fontSize: 40 }}>✅</AppText>
            </View>
            <AppText variant="h1" style={{ textAlign: "center", marginBottom: spacing[2] }}>
              Review posted!
            </AppText>
            <AppText
              variant="bodySmall"
              tone="secondary"
              style={{ textAlign: "center", marginBottom: spacing[6] }}
            >
              Thanks for helping the Hungry community find great food 🙏
            </AppText>

            <View
              style={{
                width: "100%",
                backgroundColor: palette.orange,
                borderRadius: componentRadii.card,
                padding: spacing[5],
                alignItems: "center",
              }}
            >
              <AppText variant="micro" tone="inverse" style={{ opacity: 0.8, letterSpacing: 1 }}>
                POINTS EARNED
              </AppText>
              <AppText
                style={{ fontSize: 36, fontWeight: "900", color: "white", marginVertical: 4 }}
              >
                +25 pts
              </AppText>
              <AppText variant="micro" tone="inverse" style={{ opacity: 0.8 }}>
                Total: 340 pts · Level 3 Foodie
              </AppText>
              <View
                style={{
                  width: "100%",
                  height: 6,
                  backgroundColor: palette.inverseSurfaceSubtle,
                  borderRadius: 3,
                  marginTop: 12,
                  overflow: "hidden",
                }}
              >
                <View style={{ width: "68%" as any, height: "100%", backgroundColor: "white" }} />
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Actions */}
      <View
        style={{
          padding: spacing[4],
          borderTopWidth: 1,
          borderTopColor: palette.border,
          flexDirection: "row",
          gap: spacing[3],
          paddingBottom: 34,
        }}
      >
        {step < 4 ? (
          <>
            <Button
              variant="secondary"
              label={step === 1 ? "Cancel" : "Back"}
              style={{ flex: 1 }}
              onPress={handleBack}
            />
            <Button
              variant="primary"
              label={step === 1 ? "Next → Rate" : step === 2 ? "Next → Tags" : "Submit review"}
              style={{ flex: 2 }}
              onPress={handleNext}
              disabled={step === 2 && rating === 0}
            />
          </>
        ) : (
          <Button variant="primary" label="Back to stall" style={{ flex: 1 }} onPress={onClose} />
        )}
      </View>
    </View>
  );
}
