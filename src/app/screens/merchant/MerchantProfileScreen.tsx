import React from "react";
import { ScrollView, View, StyleSheet, Pressable } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Clock, MapPin, Phone, LogOut, ChevronRight, ShieldCheck } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AppText, Screen, Avatar, EmptyState, Button } from "@/components/ui";
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
  const { componentRadii, palette, spacing } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const rootNavigation = getRootNavigation(navigation);
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
        {
          backgroundColor: palette.surfaceRaised,
          borderRadius: componentRadii.card,
          padding: spacing[4],
        },
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
        <EmptyState
          title="No merchant outlet yet"
          body="No merchant outlet is linked to this account yet."
          errorMessage="No active outlet is currently linked to this account."
          sendErrorContext="Merchant profile"
          ctaLabel="Open verification"
          onPress={() => navigation.navigate("VerificationCentre" as any)}
        />
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

        <View style={{ marginTop: spacing[8], gap: spacing[3] }}>
          <Button
            label="Switch to Customer Mode"
            variant="secondary"
            onPress={() => {
              // Leave merchant mode only; keep the account so Profile can switch back.
              rootNavigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: "MainTabs", params: { screen: "Home" } }],
                }),
              );
            }}
          />
          <Button
            label="Sign Out"
            variant="destructive"
            onPress={() => {
              signOut();
              rootNavigation.reset({
                index: 0,
                routes: [{ name: "AuthStack", params: { screen: "Login" } }],
              });
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
