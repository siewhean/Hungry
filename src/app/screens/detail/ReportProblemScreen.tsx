import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CheckCircle2, Circle, Flag } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, Screen } from "@/components/ui";
import { selectHaptic } from "@/lib/haptics";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { CatalogCorrectionKind } from "@/lib/services/types";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ReportProblem">;

const STALL_REASONS: { kind: CatalogCorrectionKind; label: string; hint: string }[] = [
  { kind: "closed", label: "This stall is closed", hint: "Moved, shut down or gone for good" },
  { kind: "wrong_hours", label: "Opening hours are wrong", hint: "Open or closed at other times" },
  { kind: "wrong_price", label: "A price is wrong", hint: "The menu shows an old price" },
  { kind: "other", label: "Something else", hint: "Tell us below" },
];

const DISH_REASONS: { kind: CatalogCorrectionKind; label: string; hint: string }[] = [
  { kind: "wrong_price", label: "The price is wrong", hint: "It costs more or less now" },
  {
    kind: "wrong_dish_info",
    label: "The name, photo or details are wrong",
    hint: "It looks or is called something else",
  },
  { kind: "closed", label: "This stall is closed", hint: "Moved, shut down or gone for good" },
  { kind: "other", label: "Something else", hint: "Tell us below" },
];

const NOTE_MAX_LENGTH = 500;
/**
 * submit_catalog_correction refusals the server words for the user: the daily cap (54000) and
 * a bad stall, dish or kind (22023). They are expected, so they are not sent to Sentry.
 */
const EXPECTED_REFUSAL_CODES = new Set(["54000", "22023"]);
const SEND_FAILED_MESSAGE = "Couldn't send your report. Check your connection and try again.";

/**
 * "Something wrong? Tell us": pick what is wrong with a stall or dish, add a note if you
 * like, and it goes to the team's queue to check.
 */
export function ReportProblemScreen({ navigation, route }: Props) {
  const { venueId, dishId, subjectName } = route.params;
  const { componentRadii, palette, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const reasons = dishId ? DISH_REASONS : STALL_REASONS;
  const [kind, setKind] = useState<CatalogCorrectionKind | null>(null);
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);
  const subject = subjectName ?? (dishId ? "this dish" : "this stall");
  const needsNote = kind === "other" && note.trim().length === 0;

  const send = async () => {
    if (!kind || isSending || needsNote) return;
    setIsSending(true);
    try {
      await getHungryService().supply.submitCatalogCorrection({
        venueId,
        dishId,
        kind,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      showToast({ message: "Thanks, we'll check it.", tone: "success" });
      navigation.goBack();
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      const serverMessage = (error as { message?: unknown } | null)?.message;
      const expected = typeof code === "string" && EXPECTED_REFUSAL_CODES.has(code);
      if (!expected) {
        reportError(error, { screen: "ReportProblem", action: "submitCatalogCorrection" });
      }
      showToast({
        // Network and unknown errors get plain words, never the raw error text.
        message:
          expected && typeof serverMessage === "string" && serverMessage
            ? serverMessage
            : SEND_FAILED_MESSAGE,
        tone: "error",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Screen title="Something wrong?" subtitle={`Tell us about ${subject}`} keyboardAvoiding>
      <View style={{ gap: spacing[5] }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: palette.orangeLight,
            borderRadius: componentRadii.card,
            flexDirection: "row",
            gap: spacing[3],
            padding: spacing[4],
          }}
        >
          <Flag color={palette.orange} size={22} />
          <AppText variant="bodySmall" style={{ flex: 1 }}>
            Stall details come from public listings and can go out of date. Your report helps us fix
            them for everyone.
          </AppText>
        </View>

        <View accessibilityRole="radiogroup" style={{ gap: spacing[2] }}>
          <AppText variant="h3">What&apos;s wrong?</AppText>
          {reasons.map((reason) => {
            const selected = kind === reason.kind;
            const Icon = selected ? CheckCircle2 : Circle;
            return (
              <Pressable
                key={reason.kind}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={reason.label}
                accessibilityHint={reason.hint}
                onPress={() => {
                  selectHaptic();
                  setKind(reason.kind);
                }}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: selected ? palette.orangeLight : palette.surface,
                  borderColor: selected ? palette.orange : palette.border,
                  borderRadius: componentRadii.card,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: spacing[3],
                  minHeight: 56,
                  opacity: pressed ? 0.85 : 1,
                  padding: spacing[3],
                })}
              >
                <Icon color={selected ? palette.orange : palette.textMuted} size={22} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyBold">{reason.label}</AppText>
                  <AppText variant="micro" tone="secondary">
                    {reason.hint}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: spacing[2] }}>
          <AppText variant="h3">{kind === "other" ? "Tell us more" : "Anything to add?"}</AppText>
          <TextInput
            accessibilityLabel="Details about the problem"
            multiline
            maxLength={NOTE_MAX_LENGTH}
            onChangeText={setNote}
            placeholder={
              dishId ? "For example: it's S$6.50 now" : "For example: it closes at 3pm on Sundays"
            }
            placeholderTextColor={palette.textMuted}
            style={{
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
              borderWidth: 1,
              color: palette.text,
              fontSize: 16,
              minHeight: 110,
              padding: spacing[3],
              textAlignVertical: "top",
            }}
            value={note}
          />
          <AppText variant="micro" tone="muted" style={{ textAlign: "right" }}>
            {`${note.length}/${NOTE_MAX_LENGTH}`}
          </AppText>
        </View>

        {!kind || needsNote ? (
          <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
            {!kind ? "Pick what's wrong to send" : "Tell us more to send"}
          </AppText>
        ) : null}
        <Button
          label="Send report"
          loading={isSending}
          disabled={!kind || needsNote}
          onPress={() => void send()}
        />
      </View>
    </Screen>
  );
}
