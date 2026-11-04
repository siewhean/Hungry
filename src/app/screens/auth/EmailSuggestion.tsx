import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/components/ui";
import { suggestEmailDomain } from "@/features/auth/validation";
import { useHungryTheme } from "@/theme";
import { AUTH_COPY } from "./authCopy";

/**
 * "Did you mean gmail.com?" state for an email field. Call `check(value)` on blur: a typo in
 * the domain of a common provider offers the fixed address; `clear()` on the next edit.
 */
export function useEmailSuggestion() {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const check = useCallback((email: string) => setSuggestion(suggestEmailDomain(email)), []);
  const clear = useCallback(() => setSuggestion(null), []);
  return { suggestion, check, clear };
}

/** One-tap fix for a mistyped email domain, shown under the field. */
export function EmailSuggestionHint({
  suggestion,
  onAccept,
}: {
  suggestion: string | null;
  onAccept: (email: string) => void;
}) {
  const { spacing } = useHungryTheme();
  if (!suggestion) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing[1] }}
    >
      <AppText variant="bodySmall" tone="secondary">
        {AUTH_COPY.emailCode.suggestionPrompt}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${AUTH_COPY.emailCode.suggestionAccept}: ${suggestion}`}
        onPress={() => onAccept(suggestion)}
        hitSlop={8}
        style={{ justifyContent: "center", minHeight: 44 }}
      >
        <AppText variant="bodySmall" tone="accent" style={{ fontWeight: "700" }}>
          {suggestion}?
        </AppText>
      </Pressable>
    </View>
  );
}
