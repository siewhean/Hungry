import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { AppSymbol, AppText, Chip } from "@/components/ui";
import {
  FEEDBACK_PROMPTS,
  THUMB_DOWN_REASONS,
  dismissFeedbackPrompt,
  recordFeedbackPromptShown,
  shouldShowFeedbackPrompt,
  submitFeedbackThumb,
  submitFeedbackThumbReason,
  type FeedbackPromptId,
} from "@/features/feedback/feedback";
import { useHungryTheme } from "@/theme";

type Stage = "ask" | "reason" | "thanks" | "closed";

/**
 * A one-line "was this useful?" with thumbs up and down. It is asked at most once a day across
 * the app and once a month per question, never while "Share usage analytics" is off, and one tap
 * answers it. A thumbs down counts at once and then offers a reason to pick, which can be skipped.
 */
export function FeedbackThumbs({ promptId }: { promptId: FeedbackPromptId }) {
  const { palette, spacing, radii, componentSizes } = useHungryTheme();
  // Decided once when the screen opens, so answering it does not hide it mid-tap.
  const [eligible] = useState(() => shouldShowFeedbackPrompt(promptId));
  const [stage, setStage] = useState<Stage>("ask");
  const { question } = FEEDBACK_PROMPTS[promptId];

  useEffect(() => {
    if (eligible) recordFeedbackPromptShown(promptId);
  }, [eligible, promptId]);

  if (!eligible || stage === "closed") return null;

  const thumbStyle = {
    alignItems: "center" as const,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: componentSizes.touchTarget,
    justifyContent: "center" as const,
    width: componentSizes.touchTarget,
  };

  if (stage === "thanks") {
    return (
      <View style={{ paddingVertical: spacing[3] }}>
        <AppText variant="bodySmall" tone="secondary">
          Thanks, that helps us.
        </AppText>
      </View>
    );
  }

  if (stage === "reason") {
    return (
      <View style={{ gap: spacing[2], paddingVertical: spacing[3] }}>
        <AppText variant="bodySmall" tone="secondary">
          What was off? (optional)
        </AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          {THUMB_DOWN_REASONS.map((reason) => (
            <Chip
              key={reason.id}
              label={reason.label}
              onPress={() => {
                submitFeedbackThumbReason(promptId, reason.id);
                setStage("thanks");
              }}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip"
          hitSlop={8}
          onPress={() => setStage("closed")}
        >
          <AppText variant="bodySmall" tone="muted">
            Skip
          </AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="summary"
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: spacing[3],
        paddingVertical: spacing[3],
      }}
    >
      <AppText variant="bodySmall" tone="secondary" style={{ flex: 1 }}>
        {question}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${question} Yes`}
        onPress={() => {
          submitFeedbackThumb(promptId, "up");
          setStage("thanks");
        }}
        style={thumbStyle}
      >
        <AppSymbol name="thumbsUp" size={20} color={palette.text} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${question} No`}
        onPress={() => {
          submitFeedbackThumb(promptId, "down");
          setStage("reason");
        }}
        style={thumbStyle}
      >
        <AppSymbol name="thumbsDown" size={20} color={palette.text} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Not now"
        hitSlop={8}
        onPress={() => {
          dismissFeedbackPrompt(promptId);
          setStage("closed");
        }}
      >
        <AppSymbol name="close" size={16} color={palette.textMuted} />
      </Pressable>
    </View>
  );
}
