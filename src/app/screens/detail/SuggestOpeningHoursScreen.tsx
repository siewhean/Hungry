import { useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { OpeningHoursEditor, RangeRows } from "@/components/merchant/OpeningHoursEditor";
import { AnimatedSwitch } from "@/components/ui/AnimatedSwitch";
import { AppText, Button, Screen, SegmentedControl } from "@/components/ui";
import {
  DEFAULT_SUGGESTED_RANGE,
  buildSuggestedSchedule,
  describeSuggestedHours,
  emptySuggestedHoursDraft,
  suggestedHoursProblem,
  type SuggestedHoursDraft,
  type SuggestedHoursMode,
} from "@/features/detail/suggestedOpeningHours";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "SuggestOpeningHours">;

const MODE_OPTIONS = [
  { value: "daily", label: "Every day", accessibilityLabel: "Same hours every day" },
  {
    value: "weekdayWeekend",
    label: "Weekdays and weekends",
    accessibilityLabel: "Different hours on weekdays and weekends",
  },
  { value: "custom", label: "Day by day", accessibilityLabel: "Set each day and special dates" },
] as const;

/** submit_catalog_correction refusals the server words for the user (daily cap, bad stall). */
const EXPECTED_REFUSAL_CODES = new Set(["54000", "22023"]);
const SEND_FAILED_MESSAGE = "Couldn't send the hours. Check your connection and try again.";

/**
 * "Add opening hours": a page of its own to say when a stall is open — the same hours every
 * day, one set for weekdays and one for the weekend, or each day (and special dates) by itself.
 * The hours go to the team to check; they are not published until someone has.
 */
export function SuggestOpeningHoursScreen({ navigation, route }: Props) {
  const { venueId, subjectName } = route.params;
  const { componentRadii, palette, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const [draft, setDraft] = useState<SuggestedHoursDraft>(emptySuggestedHoursDraft);
  const [isSending, setIsSending] = useState(false);
  const problem = suggestedHoursProblem(draft);
  const weekendOpen = draft.weekend.length > 0;

  const patch = (next: Partial<SuggestedHoursDraft>) =>
    setDraft((current) => ({ ...current, ...next }));

  const send = async () => {
    if (problem || isSending) return;
    setIsSending(true);
    try {
      await getHungryService().supply.submitCatalogCorrection({
        venueId,
        kind: "wrong_hours",
        note: describeSuggestedHours(buildSuggestedSchedule(draft)),
      });
      showToast({ message: "Thanks, we'll check the hours.", tone: "success" });
      // A guest who signed in to add hours lands here above Home: send them back to the stall.
      const state = navigation.getState();
      const previous = state?.routes[(state.index ?? 0) - 1]?.name;
      if (previous === "StallDetail") navigation.goBack();
      else navigation.replace("StallDetail", { venueId });
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      const serverMessage = (error as { message?: unknown } | null)?.message;
      const expected = typeof code === "string" && EXPECTED_REFUSAL_CODES.has(code);
      if (!expected) {
        reportError(error, { screen: "SuggestOpeningHours", action: "submitCatalogCorrection" });
      }
      showToast({
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

  const sectionStyle = {
    borderColor: palette.border,
    borderRadius: componentRadii.card,
    borderWidth: 1,
    gap: spacing[2],
    padding: spacing[3],
  } as const;

  return (
    <Screen
      title="Opening hours"
      subtitle={subjectName ? `When is ${subjectName} open?` : "When is this stall open?"}
      keyboardAvoiding
    >
      <View style={{ gap: spacing[4] }}>
        <SegmentedControl<SuggestedHoursMode>
          accessibilityLabel="How to set the hours"
          options={MODE_OPTIONS}
          value={draft.mode}
          onChange={(mode) => patch({ mode })}
        />
        <AppText variant="bodySmall" tone="muted">
          24-hour Singapore time. A closing time before the opening time runs past midnight.
        </AppText>

        {draft.mode === "daily" ? (
          <View style={sectionStyle}>
            <AppText variant="bodyBold">Every day</AppText>
            <RangeRows
              label="Every day"
              ranges={draft.daily}
              onChange={(daily) => patch({ daily })}
            />
          </View>
        ) : null}

        {draft.mode === "weekdayWeekend" ? (
          <>
            <View style={sectionStyle}>
              <AppText variant="bodyBold">Monday to Friday</AppText>
              <RangeRows
                label="Weekdays"
                ranges={draft.weekday}
                onChange={(weekday) => patch({ weekday })}
              />
            </View>
            <View style={sectionStyle}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
                <AppText variant="bodyBold" style={{ flex: 1 }}>
                  Saturday and Sunday
                </AppText>
                <AppText variant="bodySmall" tone="muted">
                  {weekendOpen ? "Open" : "Closed"}
                </AppText>
                <AnimatedSwitch
                  accessibilityLabel="Open on weekends"
                  value={weekendOpen}
                  onValueChange={(open) =>
                    patch({ weekend: open ? [{ ...DEFAULT_SUGGESTED_RANGE }] : [] })
                  }
                />
              </View>
              {weekendOpen ? (
                <RangeRows
                  label="Weekends"
                  ranges={draft.weekend}
                  onChange={(weekend) => patch({ weekend })}
                />
              ) : null}
            </View>
          </>
        ) : null}

        {draft.mode === "custom" ? (
          <OpeningHoursEditor value={draft.custom} onChange={(custom) => patch({ custom })} />
        ) : null}

        {problem ? (
          <AppText
            variant="bodySmall"
            tone="secondary"
            style={{ textAlign: "center" }}
            accessibilityLiveRegion="polite"
          >
            {problem}
          </AppText>
        ) : null}
        <Button
          label="Send opening hours"
          loading={isSending}
          disabled={Boolean(problem)}
          onPress={() => void send()}
        />
      </View>
    </Screen>
  );
}
