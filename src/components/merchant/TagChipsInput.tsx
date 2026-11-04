import { X } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, View } from "react-native";

import { AppSymbol, AppText, Input } from "@/components/ui";
import { addTags } from "@/features/merchant/tagSuggestions";
import { selectHaptic } from "@/lib/haptics";
import { useHungryTheme } from "@/theme";

/**
 * Tags as chips: type one and press return (or a comma) to add it, tap a chip to remove it, and
 * tap a suggestion to add it. `suggestions` that are already tags are left out.
 */
export function TagChipsInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = "Add a tag",
}: {
  tags: readonly string[];
  onChange: (tags: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const [draft, setDraft] = useState("");
  const taken = new Set(tags.map((tag) => tag.toLowerCase()));
  const offered = suggestions.filter((tag) => !taken.has(tag.toLowerCase()));

  const commit = (text: string) => {
    onChange(addTags(tags, text.split(",")));
    setDraft("");
  };

  const pill = {
    alignItems: "center" as const,
    borderRadius: componentRadii.button,
    flexDirection: "row" as const,
    gap: spacing[1.5],
    minHeight: 36,
    paddingHorizontal: spacing[3],
  };

  return (
    <View style={{ gap: spacing[2] }}>
      {tags.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          {tags.map((tag) => (
            <Pressable
              key={tag}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${tag}`}
              onPress={() => {
                selectHaptic();
                onChange(tags.filter((item) => item !== tag));
              }}
              style={[pill, { backgroundColor: palette.orangeLight }]}
            >
              <AppText variant="bodySmallBold" style={{ color: palette.orangeText }}>
                {tag}
              </AppText>
              <AppSymbol name="xmark" fallback={X} size={10} color={palette.orangeText} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <Input
        accessibilityLabel="Add a tag"
        value={draft}
        onChangeText={(text) => (text.includes(",") ? commit(text) : setDraft(text))}
        onSubmitEditing={() => commit(draft)}
        onBlur={() => draft.trim() && commit(draft)}
        placeholder={placeholder}
        returnKeyType="done"
        blurOnSubmit={false}
      />
      {offered.length > 0 ? (
        <View style={{ gap: spacing[1] }}>
          <AppText variant="micro" tone="muted">
            Your most used tags
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {offered.map((tag) => (
              <Pressable
                key={tag}
                accessibilityRole="button"
                accessibilityLabel={`Add ${tag}`}
                onPress={() => {
                  selectHaptic();
                  onChange(addTags(tags, [tag]));
                }}
                style={[
                  pill,
                  { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1 },
                ]}
              >
                <AppText variant="bodySmall">{tag}</AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
