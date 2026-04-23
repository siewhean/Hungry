import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Edit2, Trash2 } from "lucide-react-native";

import { AppText, Button } from "@/components/ui";
import { useHungryTheme } from "@/theme";

export function MerchantMenuScreen() {
  const { palette, spacing, radii } = useHungryTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <View
        style={{
          padding: spacing[4],
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <AppText variant="h1" style={{ fontWeight: "900" }}>
          Your Menu
        </AppText>
        <Button
          label="Add Item"
          variant="primary"
          leftIcon={<Plus size={18} color={palette.white} />}
          style={{ width: 120 }}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }}>
        {[
          { name: "Signature Wonton Mee", price: "$4.50", stock: "Available" },
          { name: "Shredded Chicken Hor Fun", price: "$4.00", stock: "Available" },
          { name: "Dumpling Soup", price: "$5.00", stock: "Sold Out" },
        ].map((item, i) => (
          <View
            key={i}
            style={{
              backgroundColor: palette.surface,
              padding: spacing[4],
              borderRadius: radii.lg,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              borderWidth: 1,
              borderColor: palette.border,
            }}
          >
            <View>
              <AppText variant="bodyBold">{item.name}</AppText>
              <AppText variant="bodySmall" tone="muted">
                {item.price} • {item.stock}
              </AppText>
            </View>
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              <View style={{ padding: 8, backgroundColor: palette.bgSoft, borderRadius: 8 }}>
                <Edit2 size={16} color={palette.textSecondary} />
              </View>
              <View style={{ padding: 8, backgroundColor: palette.errorSoft, borderRadius: 8 }}>
                <Trash2 size={16} color={palette.error} />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
