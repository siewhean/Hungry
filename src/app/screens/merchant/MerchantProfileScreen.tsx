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
import { AppText, Screen, Avatar, Button, EmptyState } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { getActiveOutlet, useMerchantStore } from "@/store/useMerchantStore";
import { getDataRepository } from "@/lib/services/serviceProvider";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ProfileItemProps = {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
  onPress: () => void;
};

export function MerchantProfileScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const signOut = useSessionStore((state) => state.signOut);
  const account = useMerchantStore((state) => state.account);
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const repository = getDataRepository();
  const outletBuilding = activeOutlet?.buildingId
    ? repository.listBuildings().find((building) => building.id === activeOutlet.buildingId)
    : undefined;
  const outletPhoto =
    activeOutlet?.profilePhotoUrl ?? activeOutlet?.coverPhotoUrl ?? activeOutlet?.galleryUrls[0];
  const outletLocation = [outletBuilding?.name, activeOutlet?.floor, activeOutlet?.unitNumber]
    .filter(Boolean)
    .join(" ");
  const outletContact =
    activeOutlet?.contactPhone ?? activeOutlet?.contactEmail ?? "No contact added";
  const verificationLabel =
    activeOutlet?.verification.status === "verified" ? "Verified Merchant" : "Verification pending";

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: spacing[6] }}>
      <AppText variant="h3" style={{ marginBottom: spacing[3], fontWeight: "800" }}>
        {title}
      </AppText>
      <View style={{ gap: spacing[3] }}>{children}</View>
    </View>
  );

  const ProfileItem = ({ icon: Icon, label, value, onPress }: ProfileItemProps) => (
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

  if (!activeOutlet) {
    return (
      <Screen title="Stall Profile" subtitle="Manage your stall information">
        <View style={{ paddingVertical: spacing[8], gap: spacing[4] }}>
          <EmptyState
            title="No merchant outlet yet"
            body="No merchant outlet is linked to this account yet."
          />
          <Button
            label="Open verification"
            onPress={() => navigation.navigate("VerificationCentre" as any)}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Stall Profile" subtitle="Manage your stall information">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[12] }}
      >
        {/* Stall Identity */}
        <View style={{ alignItems: "center", marginVertical: spacing[6] }}>
          <Avatar uri={outletPhoto} name={activeOutlet.name} size={80} />
          <AppText variant="h2" style={{ marginTop: spacing[3] }}>
            {activeOutlet.name}
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <ShieldCheck size={14} color={palette.success} />
            <AppText variant="micro" style={{ color: palette.success }}>
              {verificationLabel}
            </AppText>
          </View>
        </View>

        <Section title="Basic Info">
          <ProfileItem
            icon={MapPin}
            label="Location"
            value={outletLocation || "Location not set"}
            onPress={() => navigation.navigate("BusinessProfileEditor" as any)}
          />
          <ProfileItem
            icon={Clock}
            label="Operating Hours"
            value={activeOutlet.operatingHours || "Hours not set"}
            onPress={() => navigation.navigate("BusinessProfileEditor" as any)}
          />
          <ProfileItem
            icon={Phone}
            label="Contact"
            value={outletContact}
            onPress={() => navigation.navigate("BusinessProfileEditor" as any)}
          />
        </Section>

        <Section title="Payouts & Billing">
          <ProfileItem
            icon={CreditCard}
            label="Bank Account"
            value={account?.role === "owner" ? "Configure in settings" : "Owner access required"}
            onPress={() => navigation.navigate("MerchantSettings" as any)}
          />
          <ProfileItem
            icon={SettingsIcon}
            label="Platform Fees"
            value="View current settings"
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
