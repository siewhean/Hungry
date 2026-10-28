import { forwardRef } from "react";
import { View, type TextInput } from "react-native";
import { User } from "lucide-react-native";

import { AppText, Input } from "@/components/ui";
import { MAX_DISPLAY_NAME_LENGTH } from "@/features/auth/validation";
import { useHungryTheme } from "@/theme";
import { AUTH_COPY } from "./authCopy";

interface DisplayNameFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  errorText?: string;
  onSubmitEditing?: () => void;
  /** Placeholder-only variant used on the onboarding account step. */
  placeholder?: string;
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
      placeholder,
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
          label={placeholder ? undefined : label}
          placeholder={placeholder}
          helperText={placeholder ? undefined : helperText}
          value={value}
          onChangeText={onChangeText}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          textContentType="name"
          autoComplete="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={onSubmitEditing}
          leftIcon={<User color={palette.textMuted} size={18} />}
          error={!!errorText}
          errorText={errorText}
        />
        <AppText
          variant="micro"
          tone={nearLimit ? "secondary" : "muted"}
          style={{ textAlign: "right" }}
          accessibilityLabel={`${value.length} of ${MAX_DISPLAY_NAME_LENGTH} characters`}
        >
          {AUTH_COPY.emailCode.nameCounter
            .replace("{count}", String(value.length))
            .replace("{max}", String(MAX_DISPLAY_NAME_LENGTH))}
        </AppText>
      </View>
    );
  },
);
DisplayNameField.displayName = "DisplayNameField";
