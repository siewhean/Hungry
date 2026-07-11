import React from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Screen, Button } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { HUNGRY_LOGO_STANDARD_WORDMARK_SIZE } from "@/constants/brandAssets";

// Brand Logos
import { WordmarkLogoV2 } from "@/components/icons/brand/WordmarkLogoV2";
import { IconWordmarkLogoV2 } from "@/components/icons/brand/IconWordmarkLogoV2";
import { LogomarkLogoV2 } from "@/components/icons/brand/LogomarkLogoV2";

// Mascot
import { MascotGraphicV2 } from "@/components/icons/food/MascotGraphicV2";

// Illustrations
import { WheelIllustrationV2 } from "@/components/icons/food/WheelIllustrationV2";
import { BowlIllustrationV2 } from "@/components/icons/food/BowlIllustrationV2";
import { FoodPlatterIllustrationV2 } from "@/components/icons/food/FoodPlatterIllustrationV2";

// Line Icons
import { RamenIconV2 } from "@/components/icons/food/RamenIconV2";
import { ChickenRiceIconV2 } from "@/components/icons/food/ChickenRiceIconV2";
import { LaksaIconV2 } from "@/components/icons/food/LaksaIconV2";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function DesignGalleryScreen() {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={[styles.section, { borderBottomColor: palette.border }]}>
      <AppText variant="h2" style={{ marginBottom: spacing[4] }}>
        {title}
      </AppText>
      <View style={styles.grid}>{children}</View>
    </View>
  );

  const Item = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View
      style={[styles.item, { backgroundColor: palette.bgSoft, borderRadius: componentRadii.card }]}
    >
      <View style={styles.iconContainer}>{children}</View>
      <AppText variant="micro" tone="muted" style={{ textAlign: "center", marginTop: spacing[2] }}>
        {label}
      </AppText>
    </View>
  );

  return (
    <Screen title="Design Gallery V2" subtitle="Preview Phase B brand and icon assets">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[20] }}
      >
        <Section title="B3 — Brand Logos">
          <Item label="WordmarkLogoV2">
            <WordmarkLogoV2 size={HUNGRY_LOGO_STANDARD_WORDMARK_SIZE} />
          </Item>
          <Item label="IconWordmarkLogoV2">
            <IconWordmarkLogoV2 size={HUNGRY_LOGO_STANDARD_WORDMARK_SIZE} />
          </Item>
          <Item label="LogomarkLogoV2">
            <LogomarkLogoV2 size={HUNGRY_LOGO_STANDARD_WORDMARK_SIZE} />
          </Item>
        </Section>

        <Section title="B6 — Custom Mascot">
          <Item label="Happy">
            <MascotGraphicV2 size={64} expression="happy" />
          </Item>
          <Item label="Hungry">
            <MascotGraphicV2 size={64} expression="hungry" />
          </Item>
          <Item label="Thinking">
            <MascotGraphicV2 size={64} expression="thinking" />
          </Item>
        </Section>

        <Section title="B5 — Flat Illustrations">
          <Item label="WheelIllustrationV2">
            <WheelIllustrationV2 size={64} />
          </Item>
          <Item label="BowlIllustrationV2">
            <BowlIllustrationV2 size={64} />
          </Item>
          <Item label="PlatterIllustrationV2">
            <FoodPlatterIllustrationV2 size={64} />
          </Item>
        </Section>

        <Section title="B5 — Line-art Icons">
          <Item label="RamenIconV2">
            <RamenIconV2 size={32} />
          </Item>
          <Item label="ChickenRiceIconV2">
            <ChickenRiceIconV2 size={32} />
          </Item>
          <Item label="LaksaIconV2">
            <LaksaIconV2 size={32} />
          </Item>
        </Section>

        <View style={{ marginTop: spacing[8] }}>
          <Button label="Back to Launcher" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingVertical: 24,
    borderBottomWidth: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  item: {
    padding: 16,
    width: "30%",
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
});
