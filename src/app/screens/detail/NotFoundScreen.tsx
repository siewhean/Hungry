import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, UtensilsCrossed } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button } from "@/components/ui";

import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "NotFound">;

export function NotFoundScreen({ navigation, route }: Props) {
  const { palette, spacing, radii } = useHungryTheme();
  const title = route.params?.title ?? "The kitchen is currently quiet.";
  const body =
    route.params?.body ??
    "We couldn't find the recipe or page you're looking for. It might have been taken off the menu.";

  return (
    <SafeAreaView style={{ backgroundColor: palette.bgSoft, flex: 1 }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: spacing[6] }}>
        <View style={{ alignItems: "center", gap: spacing[5] }}>
          <AppText style={{ color: `${palette.orange}15`, fontWeight: "700", fontSize: 96, lineHeight: 96 }}>404</AppText>
          <View style={{ alignItems: "center", backgroundColor: palette.bgMuted, borderRadius: radii.pill, height: 60, justifyContent: "center", marginTop: -54, width: 60 }}>
            <UtensilsCrossed color={palette.orange} size={26} />
          </View>
          <AppText variant="display" style={{ textAlign: "center" }}>
            {title}
          </AppText>
          <AppText variant="bodyLarge" tone="secondary" style={{ textAlign: "center" }}>
            {body}
          </AppText>
          <Button label="Back to Feed" onPress={() => navigation.navigate("MainTabs", { screen: "Home" })} style={{ borderRadius: radii.pill, minHeight: 56, width: 220 }} />
          <Pressable onPress={() => navigation.navigate("SearchHome")} style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
            <Search color={palette.orange} size={14} />
            <AppText variant="bodyBold" tone="accent">Search for recipes</AppText>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
