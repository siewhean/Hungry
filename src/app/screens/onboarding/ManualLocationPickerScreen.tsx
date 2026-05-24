import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, View } from "react-native";
import { ArrowLeft, MapPin } from "lucide-react-native";

import { AppText, Button, Card, Input } from "@/components/ui";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";
import type { OnboardingStackParamList } from "./OnboardingStack";

type Props = NativeStackScreenProps<OnboardingStackParamList, "ManualLocationPicker">;

export function ManualLocationPickerScreen({ navigation }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const repository = getDataRepository();
  const setManualSelection = useLocationStore((state) => state.setManualSelection);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const hasSkippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);

  const buildings = repository.listBuildings().slice(0, 10);

  return (
    <View
      style={{
        backgroundColor: palette.bg,
        flex: 1,
        paddingHorizontal: spacing[3],
        paddingTop: spacing[6],
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", marginBottom: spacing[4] }}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ marginRight: spacing[3], padding: spacing[2] }}
        >
          <ArrowLeft color={palette.text} size={18} />
        </Pressable>
        <AppText variant="h2">Pick a location</AppText>
      </View>

      <Input placeholder="Search Singapore location" />

      <ScrollView
        contentContainerStyle={{
          gap: spacing[2],
          paddingBottom: spacing[6],
          paddingTop: spacing[3],
        }}
        showsVerticalScrollIndicator={false}
      >
        {buildings.map((building) => (
          <Pressable
            key={building.id}
            onPress={() => {
              setManualSelection(building.name, building.coordinate);
              completeOnboarding(hasSkippedTasteQuiz);
            }}
          >
            <Card style={{ borderRadius: radii.md, padding: spacing[3] }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                <MapPin color={palette.orange} size={16} />
                <View style={{ flex: 1, gap: spacing[1] }}>
                  <AppText variant="bodyBold">{building.name}</AppText>
                  <AppText variant="bodySmall" tone="secondary">
                    {building.coordinate.latitude.toFixed(4)},{" "}
                    {building.coordinate.longitude.toFixed(4)}
                  </AppText>
                </View>
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ paddingBottom: spacing[4] }}>
        <Button
          label="Use current location instead"
          variant="secondary"
          onPress={() => navigation.navigate("LocationPermission")}
        />
      </View>
    </View>
  );
}
