import { forwardRef } from "react";
import { View, type TextInput } from "react-native";

import { AppText, Input, AppSymbol } from "@/components/ui";
import { MAX_DISPLAY_NAME_LENGTH } from "@/features/auth/validation";
import { useHungryTheme } from "@/theme";
import { AUTH_COPY } from "./authCopy";

interface DisplayNameFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  errorText?: string;
  onSubmitEditing?: () => void;
  label?: string;
  helperText?: string;
}

/** The name shown on reviews: capped at the server's 40 characters, with a live counter. */
export const DisplayNameField = forwardRef<TextInput, DisplayNameFieldProps>(
  (
    {
      value,
      onChangeText,
      errorText,
      onSubmitEditing,
      label = AUTH_COPY.signUp.displayNameLabel,
      helperText = AUTH_COPY.signUp.displayNameHelper,
    },
    ref,
  ) => {
    const { palette, spacing } = useHungryTheme();
    const nearLimit = value.length >= MAX_DISPLAY_NAME_LENGTH - 5;
    return (
      <View style={{ gap: spacing[1] }}>
        <Input
          ref={ref}
          label={label}
          value={value}
          onChangeText={onChangeText}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          textContentType="name"
          autoComplete="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={onSubmitEditing}
          leftIcon={
            <AppSymbol name="person" color={palette.textMuted} size={18} weight="regular" />
          }
          error={!!errorText}
          errorText={errorText}
        />
        {/* Helper and counter share a row, so the name field costs one line of height. */}
        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[2] }}>
          <AppText variant="micro" tone="muted" style={{ flex: 1 }}>
            {helperText}
          </AppText>
          <AppText
            variant="micro"
            tone={nearLimit ? "secondary" : "muted"}
            accessibilityLabel={`${value.length} of ${MAX_DISPLAY_NAME_LENGTH} characters`}
          >
            {AUTH_COPY.emailCode.nameCounter
              .replace("{count}", String(value.length))
              .replace("{max}", String(MAX_DISPLAY_NAME_LENGTH))}
          </AppText>
        </View>
      </View>
    );
  },
);
DisplayNameField.displayName = "DisplayNameField";
