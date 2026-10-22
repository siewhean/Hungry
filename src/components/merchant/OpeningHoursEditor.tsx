import React, { useState } from "react";
import { Platform, Pressable, Switch, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Clock } from "lucide-react-native";

import { AppText, Button, Input } from "@/components/ui";
import { PromotionDateField } from "@/components/merchant/PromotionDateField";
import { useMerchantDialog } from "@/features/merchant/useMerchantDialog";
import { useHungryTheme } from "@/theme";
import type { OpeningSchedule, OpeningTimeRange } from "@/types/domain";
import { DAY_ORDER } from "@/utils/operatingHours";
import { MAX_RANGES_PER_DAY, MAX_SPECIAL_DAYS, OPENING_DAY_KEYS } from "@/utils/openingSchedule";

type SpecialDay = NonNullable<OpeningSchedule["special"]>[number];

const DEFAULT_RANGE: OpeningTimeRange = { open: "09:00", close: "21:00" };

function todaySingapore(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** A new special day starts tomorrow (SGT): today's hours are already running. */
function tomorrowSingapore(): string {
  return new Date(Date.now() + 32 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "HH:MM" as a Date on today's calendar day; "24:00" (midnight close) shows as 00:00. */
function parseTime(value: string): Date {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  const date = new Date();
  date.setHours(match ? Number(match[1]) % 24 : 9, match ? Number(match[2]) : 0, 0, 0);
  return date;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * One opening/closing time. Native builds use the platform time picker so a merchant cannot type
 * an invalid time; web keeps the typed HH:MM field.
 */
function TimeField({
  label,
  accessibilityLabel,
  value,
  onChange,
}: {
  label: string;
  accessibilityLabel: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const [isAndroidPickerOpen, setIsAndroidPickerOpen] = useState(false);

  if (Platform.OS === "web") {
    return (
      <Input
        label={label}
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChange}
        placeholder="09:00"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />
    );
  }

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    setIsAndroidPickerOpen(false);
    if (event.type === "set" && date) onChange(formatTime(date));
  };

  if (Platform.OS === "ios") {
    return (
      <View style={{ gap: spacing[1] }}>
        <AppText variant="bodySmallBold">{label}</AppText>
        <DateTimePicker
          accessibilityLabel={accessibilityLabel}
          value={parseTime(value)}
          mode="time"
          display="compact"
          onChange={handleChange}
          style={{ alignSelf: "flex-start" }}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing[1] }}>
      <AppText variant="bodySmallBold">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}: ${value}. Change time`}
        onPress={() => setIsAndroidPickerOpen(true)}
        style={{
          alignItems: "center",
          borderColor: palette.border,
          borderRadius: componentRadii.input,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing[2],
          minHeight: 44,
          paddingHorizontal: spacing[3],
        }}
      >
        <Clock size={18} color={palette.textSecondary} />
        <AppText variant="body">{value}</AppText>
      </Pressable>
      {isAndroidPickerOpen ? (
        <DateTimePicker
          value={parseTime(value)}
          mode="time"
          display="default"
          is24Hour
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}

function OpenSwitch({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { palette } = useHungryTheme();
  return (
    <Switch
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: palette.border, true: palette.orange }}
      thumbColor={palette.white}
      ios_backgroundColor={palette.border}
    />
  );
}

function RangeRows({
  label,
  ranges,
  onChange,
}: {
  label: string;
  ranges: OpeningTimeRange[];
  onChange: (ranges: OpeningTimeRange[]) => void;
}) {
  const { spacing } = useHungryTheme();
  const update = (index: number, patch: Partial<OpeningTimeRange>) =>
    onChange(ranges.map((range, i) => (i === index ? { ...range, ...patch } : range)));

  return (
    <View style={{ gap: spacing[2] }}>
      {ranges.map((range, index) => (
        <View key={index} style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing[2] }}>
          <View style={{ flex: 1 }}>
            <TimeField
              label="Opens"
              accessibilityLabel={`${label} opens, range ${index + 1}`}
              value={range.open}
              onChange={(open) => update(index, { open })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TimeField
              label="Closes"
              accessibilityLabel={`${label} closes, range ${index + 1}`}
              value={range.close}
              onChange={(close) => update(index, { close })}
            />
          </View>
          {ranges.length > 1 ? (
            <Button
              label="Remove"
              variant="ghost"
              size="sm"
              accessibilityLabel={`Remove ${label} range ${index + 1}`}
              onPress={() => onChange(ranges.filter((_, i) => i !== index))}
            />
          ) : null}
        </View>
      ))}
      {ranges.length < MAX_RANGES_PER_DAY ? (
        <Button
          label="Add a break or second session"
          variant="ghost"
          size="sm"
          accessibilityLabel={`Add hours to ${label}`}
          onPress={() => onChange([...ranges, { open: "17:00", close: "21:00" }])}
          style={{ alignSelf: "flex-start" }}
        />
      ) : null}
    </View>
  );
}

/**
 * Weekly opening hours plus special hours by date, in 24-hour Singapore time. A close time
 * earlier than the open time runs past midnight; "24:00" closes at midnight.
 */
export function OpeningHoursEditor({
  value,
  onChange,
  error,
}: {
  value: OpeningSchedule;
  onChange: (value: OpeningSchedule) => void;
  error?: string;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const special = value.special ?? [];
  const { showAlert, dialog } = useMerchantDialog();

  const setDay = (key: (typeof OPENING_DAY_KEYS)[number], ranges: OpeningTimeRange[]) =>
    onChange({ ...value, weekly: { ...value.weekly, [key]: ranges } });
  const setSpecial = (next: SpecialDay[]) => onChange({ ...value, special: next });
  const updateSpecial = (index: number, patch: Partial<SpecialDay>) =>
    setSpecial(special.map((day, i) => (i === index ? { ...day, ...patch } : day)));

  const cardStyle = {
    borderColor: palette.border,
    borderRadius: componentRadii.card,
    borderWidth: 1,
    padding: spacing[3],
    gap: spacing[2],
  } as const;

  return (
    <View style={{ gap: spacing[3] }}>
      <AppText variant="bodySmallBold">Opening hours</AppText>
      <AppText variant="bodySmall" tone="muted">
        24-hour Singapore time. Diners see &quot;Open now&quot; or &quot;Closed&quot; from these
        hours. A closing time before the opening time runs past midnight.
      </AppText>

      {error ? (
        <AppText
          variant="bodySmall"
          style={{ color: palette.error }}
          accessibilityLiveRegion="polite"
        >
          {error}
        </AppText>
      ) : null}

      {OPENING_DAY_KEYS.map((key, index) => {
        const dayLabel = DAY_ORDER[index];
        const ranges = value.weekly[key] ?? [];
        const isOpen = ranges.length > 0;
        return (
          <View key={key} style={cardStyle}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
              <AppText variant="bodyBold" style={{ flex: 1 }}>
                {dayLabel}
              </AppText>
              <AppText variant="bodySmall" tone="muted">
                {isOpen ? "Open" : "Closed"}
              </AppText>
              <OpenSwitch
                label={`Open on ${dayLabel}`}
                value={isOpen}
                onValueChange={(open) => setDay(key, open ? [DEFAULT_RANGE] : [])}
              />
            </View>
            {isOpen ? (
              <RangeRows label={dayLabel} ranges={ranges} onChange={(next) => setDay(key, next)} />
            ) : null}
          </View>
        );
      })}

      <Button
        label="Copy Monday to every day"
        variant="secondary"
        size="sm"
        onPress={() =>
          showAlert(
            "Copy Monday to every day?",
            "This replaces the hours you set for the other six days.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Copy",
                onPress: () =>
                  onChange({
                    ...value,
                    weekly: Object.fromEntries(
                      OPENING_DAY_KEYS.map((key) => [key, [...(value.weekly.mon ?? [])]]),
                    ),
                  }),
              },
            ],
          )
        }
      />

      <AppText variant="bodySmallBold">Special hours</AppText>
      <AppText variant="bodySmall" tone="muted">
        Public holidays, festive closures or one-off hours. They replace the weekly hours on that
        date.
      </AppText>
      {special.map((day, index) => {
        const isOpen = day.ranges.length > 0;
        const label = `Special day ${index + 1}`;
        return (
          <View key={index} style={cardStyle}>
            <PromotionDateField
              label="Date"
              value={day.date}
              minimumDate={todaySingapore()}
              onChange={(date) => updateSpecial(index, { date })}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
              <AppText variant="bodySmall" style={{ flex: 1 }}>
                {isOpen ? "Open with special hours" : "Closed all day"}
              </AppText>
              <OpenSwitch
                label={`${label} open`}
                value={isOpen}
                onValueChange={(open) =>
                  updateSpecial(index, { ranges: open ? [DEFAULT_RANGE] : [] })
                }
              />
            </View>
            {isOpen ? (
              <RangeRows
                label={label}
                ranges={day.ranges}
                onChange={(ranges) => updateSpecial(index, { ranges })}
              />
            ) : null}
            <Button
              label="Remove special day"
              variant="ghost"
              size="sm"
              accessibilityLabel={`Remove ${label}`}
              onPress={() => setSpecial(special.filter((_, i) => i !== index))}
              style={{ alignSelf: "flex-start" }}
            />
          </View>
        );
      })}
      {special.length < MAX_SPECIAL_DAYS ? (
        <Button
          label="Add special day"
          variant="secondary"
          size="sm"
          onPress={() => setSpecial([...special, { date: tomorrowSingapore(), ranges: [] }])}
        />
      ) : null}

      {dialog}
    </View>
  );
}
