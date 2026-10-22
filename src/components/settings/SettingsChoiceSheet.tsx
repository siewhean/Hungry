import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";

import { AppText, Button } from "@/components/ui";
import { useHungryTheme } from "@/theme";

export interface SettingsChoiceOption<T extends string> {
  value: T;
  label: string;
  /** One line on what this choice does. */
  description?: string;
}

interface SettingsChoiceSheetProps<T extends string> {
  visible: boolean;
  title: string;
  /** One line shown under the title, e.g. what the setting covers. */
  message?: string;
  options: SettingsChoiceOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}

/**
 * Bottom sheet with radio rows for a setting that has a few named choices.
 * Accessibility: the rows are a radio group; the current choice has
 * `accessibilityState.selected` (no "✓" glyph in the label for screen readers to read out).
 */
export function SettingsChoiceSheet<T extends string>({
  visible,
  title,
  message,
  options,
  selected,
  onSelect,
  onClose,
}: SettingsChoiceSheetProps<T>) {
  const { componentRadii, palette, spacing } = useHungryTheme();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={[styles.overlay, { backgroundColor: palette.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          accessibilityHint={`Closes ${title} without changing it`}
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: palette.surface,
            borderTopLeftRadius: componentRadii.card,
            borderTopRightRadius: componentRadii.card,
            gap: spacing[3],
            padding: spacing[5],
            paddingBottom: spacing[6],
          }}
        >
          <AppText variant="h3" accessibilityRole="header">
            {title}
          </AppText>
          {message ? (
            <AppText variant="bodySmall" tone="secondary">
              {message}
            </AppText>
          ) : null}
          <View accessibilityRole="radiogroup">
            {options.map((option) => {
              const isSelected = option.value === selected;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityHint={option.description}
                  accessibilityState={{ selected: isSelected, checked: isSelected }}
                  onPress={() => onSelect(option.value)}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: pressed ? palette.bgSoft : "transparent",
                    flexDirection: "row",
                    gap: spacing[3],
                    minHeight: 56,
                    paddingVertical: spacing[2],
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="body" style={{ fontWeight: isSelected ? "700" : "500" }}>
                      {option.label}
                    </AppText>
                    {option.description ? (
                      <AppText variant="bodySmall" tone="muted">
                        {option.description}
                      </AppText>
                    ) : null}
                  </View>
                  <View style={{ width: 24 }} importantForAccessibility="no-hide-descendants">
                    {isSelected ? <Check size={20} color={palette.orange} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
});
