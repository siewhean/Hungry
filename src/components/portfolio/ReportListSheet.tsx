import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { AppText, Button, Chip, Input } from "@/components/ui";
import {
  PORTFOLIO_REPORT_REASONS,
  type PortfolioReportReason,
} from "@/features/checklistPortfolio/listLabels";
import { useHungryTheme } from "@/theme";

interface ReportListSheetProps {
  visible: boolean;
  isSending?: boolean;
  onSubmit: (reason: PortfolioReportReason, details?: string) => void;
  onClose: () => void;
}

/** Asks why a list is being reported (the reasons the database allows) and for optional details. */
export function ReportListSheet({
  visible,
  isSending = false,
  onSubmit,
  onClose,
}: ReportListSheetProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const [reason, setReason] = useState<PortfolioReportReason>("inappropriate");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!visible) return;
    setReason("inappropriate");
    setDetails("");
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={[styles.flex, { backgroundColor: palette.overlay }]}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: palette.bg,
            borderTopLeftRadius: radii.xxl,
            borderTopRightRadius: radii.xxl,
            maxHeight: "85%",
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: spacing[3], padding: spacing[5] }}
          >
            <AppText variant="h2">Report this list</AppText>
            <AppText variant="bodySmall" tone="secondary">
              Tell us what is wrong. Our team reviews every report.
            </AppText>
            <View style={styles.reasons}>
              {PORTFOLIO_REPORT_REASONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={reason === option.value}
                  onPress={() => setReason(option.value)}
                />
              ))}
            </View>
            <Input
              label="Details (optional)"
              value={details}
              onChangeText={setDetails}
              placeholder="Anything that helps us review it"
              maxLength={500}
              multiline
            />
            <Button
              label="Send report"
              loading={isSending}
              disabled={isSending}
              onPress={() => onSubmit(reason, details.trim() || undefined)}
            />
            <Button label="Cancel" variant="secondary" onPress={onClose} disabled={isSending} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  reasons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
