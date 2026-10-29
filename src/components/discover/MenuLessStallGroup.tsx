import { Pressable, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";

import { AppText } from "@/components/ui";
import { StallLogoMark } from "@/components/stall/StallLogoMark";
import { useHungryTheme } from "@/theme";

const MAX_LOGOS = 4;
const LOGO_SIZE = 36;

interface MenuLessStallGroupProps {
  stalls: readonly { id: string; name: string; logoUrl?: string }[];
  expanded: boolean;
  onToggle: () => void;
}

/** One row for the stalls nearby whose menus are not in yet; it opens to list them. */
export function MenuLessStallGroup({ stalls, expanded, onToggle }: MenuLessStallGroupProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  if (stalls.length === 0) return null;
  const Chevron = expanded ? ChevronUp : ChevronDown;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`More stalls nearby, menus coming. ${stalls.length} ${
        stalls.length === 1 ? "stall" : "stalls"
      }`}
      accessibilityState={{ expanded }}
      onPress={onToggle}
      style={{
        alignItems: "center",
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing[3],
        minHeight: 56,
        padding: spacing[3],
      }}
    >
      <View style={{ flexDirection: "row" }}>
        {stalls.slice(0, MAX_LOGOS).map((stall, index) => (
          <StallLogoMark
            key={stall.id}
            borderWidth={1}
            imageSize={LOGO_SIZE - 4}
            logoUrl={stall.logoUrl}
            name={stall.name}
            size={LOGO_SIZE}
            style={{ marginLeft: index === 0 ? 0 : -spacing[2] }}
          />
        ))}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodySmallBold" numberOfLines={1}>
          More stalls nearby · menus coming
        </AppText>
        <AppText variant="micro" tone="secondary" numberOfLines={1}>
          {`${stalls.length} ${stalls.length === 1 ? "stall" : "stalls"}`}
        </AppText>
      </View>
      <Chevron color={palette.textMuted} size={20} />
    </Pressable>
  );
}
