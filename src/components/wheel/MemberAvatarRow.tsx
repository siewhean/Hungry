import { View } from "react-native";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { WheelMember } from "@/types/domain";

interface Props {
  members: WheelMember[];
  maxVisible?: number;
}

export function MemberAvatarRow({ members, maxVisible = 8 }: Props) {
  const { palette, radii, spacing } = useHungryTheme();

  const present = Array.from(
    new Map(
      members
        .filter((member) => member.isPresent)
        .map((member) => [member.id, member] as const),
    ).values(),
  );
  const visible = present.slice(0, maxVisible);
  const overflow = present.length - maxVisible;
  const avatarSize = 36;

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}
    >
      {visible.map((member) => (
        <View
          key={member.id}
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            backgroundColor: member.isHost ? palette.orange : palette.bgSoft,
            borderWidth: 2,
            borderColor: member.isHost ? palette.orangeDark : palette.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AppText
            variant="micro"
            style={{
              color: member.isHost ? palette.textOnDark : palette.text,
              fontFamily: "Nunito_700Bold",
            }}
          >
            {member.displayName.slice(0, 2).toUpperCase()}
          </AppText>
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            backgroundColor: palette.surface,
            borderWidth: 2,
            borderColor: palette.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AppText variant="micro" tone="secondary">
            +{overflow}
          </AppText>
        </View>
      )}
    </View>
  );
}
