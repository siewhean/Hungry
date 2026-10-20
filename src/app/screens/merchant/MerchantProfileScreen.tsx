import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Clock,
  MapPin,
  Phone,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Store,
  Megaphone,
  Users,
  Settings,
} from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AppText, Screen, Avatar, EmptyState, Button } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { getActiveOutlet, useMerchantStore } from "@/store/useMerchantStore";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { prefetchMerchantTab } from "@/features/navigation/prefetch";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ProfileItemProps = {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
  onPress: () => void;
  onPressIn?: () => void;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { spacing } = useHungryTheme();
  return (
    <View style={{ marginBottom: spacing[6] }}>
      <AppText
        variant="h3"
        accessibilityRole="header"
        style={{ marginBottom: spacing[3], fontWeight: "800" }}
      >
        {title}
      </AppText>
      <View style={{ gap: spacing[3] }}>{children}</View>
    </View>
  );
}

function ProfileItem({ icon: Icon, label, value, onPress, onPressIn }: ProfileItemProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      onPressIn={onPressIn}
      style={({ pressed }) => [
        styles.item,
        {
          backgroundColor: palette.surfaceRaised,
          borderRadius: componentRadii.card,
          minHeight: 44,
          opacity: pressed ? 0.78 : 1,
          padding: spacing[4],
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], flex: 1 }}>
        <Icon size={20} color={palette.orange} />
        <View style={{ flex: 1 }}>
          <AppText variant="micro" tone="muted">
            {label}
          </AppText>
          <AppText variant="bodyBold">{value}</AppText>
        </View>
      </View>
      <ChevronRight size={18} color={palette.textMuted} />
    </Pressable>
  );
}

export function MerchantProfileScreen() {
  const { palette, spacing } = useHungryTheme();
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
  const isVerified = activeOutlet?.verification.status === "verified";
  const verificationLabel = isVerified ? "Verified Merchant" : "Verification pending";
  const verificationColor = isVerified ? palette.success : palette.warningText;
  const openMerchantRoute = (route: string) => navigation.navigate(route as any);
  const prefetchRoute = (route: string) =>
    prefetchMerchantTab(route, activeOutlet?.id, account?.id);

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
      <View style={{ paddingBottom: spacing[12], width: "100%" }}>
        {/* Stall Identity */}
        <View style={{ alignItems: "center", marginVertical: spacing[6] }}>
          <Avatar uri={outletPhoto} name={activeOutlet.name} size={80} />
          <AppText variant="h2" style={{ marginTop: spacing[3] }}>
            {activeOutlet.name}
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <ShieldCheck size={14} color={verificationColor} />
            <AppText variant="micro" style={{ color: verificationColor }}>
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

        <Section title="Manage">
          <ProfileItem
            icon={Store}
            label="Business details"
            value="Name, photos, cuisine and links"
            onPressIn={() => prefetchRoute("BusinessProfileEditor")}
            onPress={() => openMerchantRoute("BusinessProfileEditor")}
          />
          <ProfileItem
            icon={ShieldCheck}
            label="Verification"
            value={verificationLabel}
            onPressIn={() => prefetchRoute("VerificationCentre")}
            onPress={() => openMerchantRoute("VerificationCentre")}
          />
          <ProfileItem
            icon={Megaphone}
            label="Promotions"
            value="Create and manage offers"
            onPressIn={() => prefetchRoute("PromotionList")}
            onPress={() => openMerchantRoute("PromotionList")}
          />
          <ProfileItem
            icon={Users}
            label="Featured visitors"
            value="Pin diners on your stall page"
            onPressIn={() => prefetchRoute("FeaturedVisitors")}
            onPress={() => openMerchantRoute("FeaturedVisitors")}
          />
          <ProfileItem
            icon={Settings}
            label="Settings"
            value="Alerts and support"
            onPressIn={() => prefetchRoute("MerchantSettings")}
            onPress={() => openMerchantRoute("MerchantSettings")}
          />
        </Section>

        <View style={{ marginTop: spacing[2], gap: spacing[3] }}>
          <Button
            label="Switch to Customer Mode"
            variant="secondary"
            onPress={() => {
              // Leave merchant mode only; keep the account so Profile can switch back.
              useMerchantStore.getState().setMerchantModeActive(false);
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
      </View>
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
