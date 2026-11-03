import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";

import { AppText, Button, Chip, DismissibleSheet, Input } from "@/components/ui";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX_LENGTH,
  sendFeedback,
  type FeedbackCategory,
} from "@/features/feedback/feedback";
import { reportError } from "@/lib/monitoring/reportError";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import { useHungryTheme } from "@/theme";

type Props = { visible: boolean; onClose: () => void };

/** Settings > Send feedback: pick what it is about, write a few lines, send. */
export function FeedbackSheet({ visible, onClose }: Props) {
  const { spacing } = useHungryTheme();
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const close = () => {
    onClose();
    setMessage("");
    setNotice(null);
    setSent(false);
  };

  const submit = () => {
    const result = sendFeedback(category, message);
    if (result.status === "sent") {
      setSent(true);
      setNotice(null);
    } else if (result.status === "too_many") {
      setNotice("That is a lot of feedback for one day. Please try again tomorrow.");
    } else if (result.status === "use_email") {
      // Usage analytics is off, so nothing is sent from here: the person's mail app opens instead.
      openTrustedExternalUrl(result.mailto)
        .then(close)
        .catch((error: unknown) => {
          reportError(error, { area: "feedback_email" });
          setNotice("We could not open your mail app. Please email us from Contact us.");
        });
    }
  };

  return (
    <DismissibleSheet
      visible={visible}
      onClose={close}
      closeLabel="Close feedback"
      maxHeightRatio={0.85}
      header={
        <View style={{ padding: spacing[4] }}>
          <AppText variant="h2">Send feedback</AppText>
        </View>
      }
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ gap: spacing[3], paddingBottom: spacing[3], paddingHorizontal: spacing[4] }}>
          {sent ? (
            <>
              <AppText>Thank you. We read every note.</AppText>
              <Button label="Done" onPress={close} />
            </>
          ) : (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                {FEEDBACK_CATEGORIES.map((entry) => (
                  <Chip
                    key={entry.id}
                    label={entry.label}
                    selected={entry.id === category}
                    onPress={() => setCategory(entry.id)}
                  />
                ))}
              </View>
              <Input
                accessibilityLabel="Your feedback"
                placeholder="What do you like, or what should we fix?"
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={FEEDBACK_MAX_LENGTH}
                style={{ minHeight: 110, textAlignVertical: "top" }}
                errorText={notice ?? undefined}
                error={Boolean(notice)}
              />
              <Button label="Send" disabled={message.trim().length === 0} onPress={submit} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </DismissibleSheet>
  );
}
