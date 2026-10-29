import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { AppText, Avatar } from "@/components/ui";
import { useHungryTheme } from "@/theme";

interface SettingsProfileCardProps {
  name: string;
  email?: string;
  avatarUrl?: string;
  onPress: () => void;
}

/** Top of Settings: who is signed in. One tap opens Edit profile (name, photo, bio, email). */
export function SettingsProfileCard({ name, email, avatarUrl, onPress }: SettingsProfileCardProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const shownEmail = email?.trim();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit profile, ${[name, shownEmail].filter(Boolean).join(", ")}`}
      accessibilityHint="Opens your name, photo, bio and email"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? palette.bgSoft : palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing[4],
        minHeight: 88,
        padding: spacing[4],
      })}
    >
      <Avatar uri={avatarUrl} name={name} size={56} />
      <View style={{ flex: 1, gap: spacing[1], minWidth: 0 }}>
        <AppText variant="h3">{name}</AppText>
        {shownEmail ? (
          <AppText variant="bodySmall" tone="muted">
            {shownEmail}
          </AppText>
        ) : null}
        <AppText variant="bodySmall" tone="accent">
          Edit profile
        </AppText>
      </View>
      <ChevronRight size={20} color={palette.textMuted} />
    </Pressable>
  );
}
