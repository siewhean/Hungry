import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";
import { GripHorizontal } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText, Card } from "../ui";

interface MapBottomSheetProps {
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
}

export function MapBottomSheet({
  children,
  title,
  subtitle,
  headerRight,
}: PropsWithChildren<MapBottomSheetProps>) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <Card
      accessibilityLabel="Building information sheet"
      accessibilityRole="adjustable"
      style={{
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        gap: spacing[3],
        marginTop: -spacing[2],
        paddingHorizontal: spacing[3],
        paddingTop: spacing[3],
      }}
    >
      <View style={{ alignItems: "center", gap: spacing[2] }}>
        <View 
          accessibilityLabel="Expand building details"
          accessibilityRole="button"
          style={{ width: "100%", alignItems: "center" }}
        >
          <GripHorizontal size={18} color={palette.textMuted} />
        </View>
        {(title || subtitle || headerRight) && (
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, width: "100%" }}>
            <View style={{ flex: 1, gap: 4 }}>
              {title ? <AppText variant="h3">{title}</AppText> : null}
              {subtitle ? <AppText variant="bodySmall" tone="secondary">{subtitle}</AppText> : null}
            </View>
            {headerRight}
          </View>
        )}
      </View>
      {children}
    </Card>
  );
}
