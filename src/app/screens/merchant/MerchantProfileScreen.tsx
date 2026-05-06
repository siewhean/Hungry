import React from "react";
import { ScrollView, View, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Clock,
  MapPin,
  Phone,
  LogOut,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Settings as SettingsIcon,
} from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Screen, Avatar, Button } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useSessionStore } from "@/store/useSessionStore";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function MerchantProfileScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const signOut = useSessionStore((state) => state.signOut);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: spacing[6] }}>
      <AppText variant="h3" style={{ marginBottom: spacing[3], fontWeight: "800" }}>
        {title}
      </AppText>
      <View style={{ gap: spacing[3] }}>{children}</View>
    </View>
  );

  const ProfileItem = ({ icon: Icon, label, value, onPress }: any) => (
    <Pressable
      onPress={onPress}
      style={[
        styles.item,
        { backgroundColor: palette.surfaceRaised, borderRadius: radii.lg, padding: spacing[4] },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], flex: 1 }}>
        <Icon size={20} color={palette.orange} />
        <View>
          <AppText variant="micro" tone="muted">
            {label}
          </AppText>
          <AppText variant="bodyBold">{value}</AppText>
        </View>
      </View>
      <ChevronRight size={18} color={palette.textMuted} />
    </Pressable>
  );

  return (
    <Screen title="Stall Profile" subtitle="Manage your stall information">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[12] }}
      >
        {/* Stall Identity */}
        <View style={{ alignItems: "center", marginVertical: spacing[6] }}>
          <Avatar
            uri="https://images.unsplash.com/photo-1552611052-33e04de081de?w=200"
            name="Maxwell Laksa"
            size={80}
          />
          <AppText variant="h2" style={{ marginTop: spacing[3] }}>
            Maxwell Laksa
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <ShieldCheck size={14} color={palette.success} />
            <AppText variant="micro" style={{ color: palette.success }}>
              Verified Merchant
            </AppText>
          </View>
        </View>

        <Section title="Basic Info">
          <ProfileItem
            icon={MapPin}
            label="Location"
            value="Maxwell Food Centre #01-15"
            onPress={() => navigation.navigate("BusinessProfileEditor" as any)}
          />
          <ProfileItem
            icon={Clock}
            label="Operating Hours"
            value="Daily, 10am - 8pm"
            onPress={() => navigation.navigate("BusinessProfileEditor" as any)}
          />
          <ProfileItem
            icon={Phone}
            label="Contact"
            value="+65 9123 4567"
            onPress={() => navigation.navigate("BusinessProfileEditor" as any)}
          />
        </Section>

        <Section title="Payouts & Billing">
          <ProfileItem
            icon={CreditCard}
            label="Bank Account"
            value="DBS **** 8821"
            onPress={() => navigation.navigate("MerchantSettings" as any)}
          />
          <ProfileItem
            icon={SettingsIcon}
            label="Platform Fees"
            value="1.5% Hungry Fee"
            onPress={() => navigation.navigate("MerchantSettings" as any)}
          />
        </Section>

        <View style={{ marginTop: spacing[8], gap: spacing[3] }}>
          <Button
            label="Switch to Customer Mode"
            variant="secondary"
            onPress={() => navigation.navigate("MainTabs" as any)}
          />
          <Button
            label="Sign Out"
            variant="destructive"
            onPress={() => {
              signOut();
              navigation.reset({ index: 0, routes: [{ name: "AuthStack" as any }] });
            }}
            leftIcon={<LogOut size={20} color="white" />}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
