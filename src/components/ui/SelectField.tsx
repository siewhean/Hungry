import { useRef } from "react";
import { Pressable, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Check, ChevronDown } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";
import { BottomSheet } from "./BottomSheet";

export type SelectFieldOption<T extends string = string> = {
  label: string;
  value: T;
  description?: string;
};

interface SelectFieldProps<T extends string = string> {
  label: string;
  value: T;
  options: readonly SelectFieldOption<T>[];
  onChange: (value: T) => void;
}

export function SelectField<T extends string = string>({
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const { componentCornerCurve, componentRadii, palette, spacing } = useHungryTheme();
  const selectedOption = options.find((option) => option.value === value);

  return (
    <View style={{ gap: spacing[2] }}>
      <AppText variant="bodySmall" tone="secondary">
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${selectedOption?.label ?? "not selected"}`}
        onPress={() => sheetRef.current?.present()}
        style={{
          alignItems: "center",
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderCurve: componentCornerCurve.borderCurve,
          borderRadius: componentRadii.input,
          borderWidth: 1,
          flexDirection: "row",
          justifyContent: "space-between",
          minHeight: 54,
          paddingHorizontal: spacing[3],
        }}
      >
        <AppText variant="body" style={{ flex: 1 }}>
          {selectedOption?.label ?? "Select"}
        </AppText>
        <ChevronDown size={18} color={palette.textMuted} />
      </Pressable>
      <BottomSheet ref={sheetRef} accessibilityLabel={label} snapPoints={["45%"]}>
        <View style={{ gap: spacing[2] }}>
          <AppText variant="h2">{label}</AppText>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  onChange(option.value);
                  sheetRef.current?.dismiss();
                }}
                style={{
                  alignItems: "center",
                  borderBottomColor: palette.border,
                  borderBottomWidth: 1,
                  flexDirection: "row",
                  gap: spacing[3],
                  minHeight: 54,
                  paddingVertical: spacing[3],
                }}
              >
                <View style={{ flex: 1, gap: spacing[0.5] }}>
                  <AppText variant="bodyBold">{option.label}</AppText>
                  {option.description ? (
                    <AppText variant="bodySmall" tone="muted">
                      {option.description}
                    </AppText>
                  ) : null}
                </View>
                {selected ? <Check size={18} color={palette.orange} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}
