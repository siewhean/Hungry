import React, { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";

import { AppText, Input } from "@/components/ui";
import { useHungryTheme } from "@/theme";

/** "YYYY-MM-DD" as a local calendar date (the picker shows calendar days, not instants). */
function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDisplayDate(value: string): string {
  return parseDateOnly(value).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * A calendar-day picker for promotion start/end dates. Native builds use the platform date
 * picker; web keeps the typed YYYY-MM-DD field.
 */
export function PromotionDateField({
  label,
  value,
  onChange,
  minimumDate,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimumDate?: string;
  error?: boolean;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const [isAndroidPickerOpen, setIsAndroidPickerOpen] = useState(false);
  const minimum = minimumDate ? parseDateOnly(minimumDate) : undefined;

  if (Platform.OS === "web") {
    return (
      <Input
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        leftIcon={<Calendar size={18} color={palette.textSecondary} />}
        error={error}
        errorText="Format: YYYY-MM-DD"
      />
    );
  }

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    setIsAndroidPickerOpen(false);
    if (event.type === "set" && date) onChange(formatDateOnly(date));
  };

  if (Platform.OS === "ios") {
    return (
      <View style={{ gap: spacing[1] }}>
        <AppText variant="bodySmallBold">{label}</AppText>
        <DateTimePicker
          accessibilityLabel={label}
          value={parseDateOnly(value)}
          mode="date"
          display="compact"
          minimumDate={minimum}
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
        accessibilityLabel={`${label}: ${formatDisplayDate(value)}. Change date`}
        onPress={() => setIsAndroidPickerOpen(true)}
        style={{
          alignItems: "center",
          borderColor: error ? palette.error : palette.border,
          borderRadius: componentRadii.input,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing[2],
          minHeight: 44,
          paddingHorizontal: spacing[3],
        }}
      >
        <Calendar size={18} color={palette.textSecondary} />
        <AppText variant="body">{formatDisplayDate(value)}</AppText>
      </Pressable>
      {isAndroidPickerOpen ? (
        <DateTimePicker
          value={parseDateOnly(value)}
          mode="date"
          display="default"
          minimumDate={minimum}
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}
