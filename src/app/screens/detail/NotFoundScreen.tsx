import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, UtensilsCrossed } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button } from "@/components/ui";

type Props = NativeStackScreenProps<RootStackParamList, "NotFound">;

export function NotFoundScreen({ navigation, route }: Props) {
  const title = route.params?.title ?? "The kitchen is currently quiet.";
  const body =
    route.params?.body ??
    "We couldn't find the recipe or page you're looking for. It might have been taken off the menu.";

  return (
    <SafeAreaView style={{ backgroundColor: "#FFF8F2", flex: 1 }} edges={["top", "left", "right", "bottom"]}>
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
        <View style={{ alignItems: "center", gap: 20 }}>
          <AppText style={{ color: "rgba(209,67,11,0.08)", fontFamily: "Nunito_700Bold", fontSize: 96, lineHeight: 96 }}>404</AppText>
          <View style={{ alignItems: "center", backgroundColor: "#EFE7DE", borderRadius: 30, height: 60, justifyContent: "center", marginTop: -54, width: 60 }}>
            <UtensilsCrossed color="#A93100" size={26} />
          </View>
          <AppText variant="display" style={{ textAlign: "center" }}>
            {title}
          </AppText>
          <AppText tone="secondary" style={{ fontSize: 18, lineHeight: 29, textAlign: "center" }}>
            {body}
          </AppText>
          <Button label="Back to Feed" onPress={() => navigation.navigate("MainTabs", { screen: "Home" })} style={{ borderRadius: 24, minHeight: 56, width: 220 }} />
          <Pressable onPress={() => navigation.navigate("SearchHome")} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Search color="#A93100" size={14} />
            <AppText tone="accent" style={{ fontFamily: "Nunito_700Bold", fontSize: 16 }}>Search for recipes</AppText>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
