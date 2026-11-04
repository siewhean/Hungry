import React, { type ComponentType } from "react";
import { View, StyleSheet } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { SFSymbol } from "expo-symbols";
import {
  type LucideProps,
  Clock,
  MapPin,
  Phone,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Store,
} from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import {
  AppSymbol,
  AppText,
  Screen,
  Avatar,
  EmptyState,
  Button,
  PressableScale,
} from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { getActiveOutlet, useMerchantStore } from "@/store/useMerchantStore";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { prefetchMerchantTab } from "@/features/navigation/prefetch";
import { isVerificationCurrent } from "@/features/merchant/merchantGuards";
import {
  formatContactPhone,
  getVerificationStatusInfo,
} from "@/features/merchant/merchantReadiness";
import { useMerchantDialog } from "@/features/merchant/useMerchantDialog";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ProfileItemProps = {
  icon: ComponentType<LucideProps>;
  symbol: SFSymbol;
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

function ProfileItem({ icon, symbol, label, value, onPress, onPressIn }: ProfileItemProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      onPressIn={onPressIn}
      style={[
        styles.item,
        {
          backgroundColor: palette.surfaceRaised,
          borderRadius: componentRadii.card,
          minHeight: 44,
          padding: spacing[4],
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], flex: 1 }}>
        <AppSymbol name={symbol} fallback={icon} size={20} color={palette.orange} />
        <View style={{ flex: 1 }}>
          <AppText variant="micro" tone="muted">
            {label}
          </AppText>
          <AppText variant="bodyBold">{value}</AppText>
        </View>
      </View>
      <AppSymbol name="chevron.right" fallback={ChevronRight} size={18} color={palette.textMuted} />
    </PressableScale>
  );
}

export function MerchantProfileScreen() {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const rootNavigation = getRootNavigation(navigation);
  const signOut = useSessionStore((state) => state.signOut);
  const account = useMerchantStore((state) => state.account);
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const { showAlert, dialog } = useMerchantDialog();
  const repository = getDataRepository();
  const outletBuilding = activeOutlet?.buildingId
    ? repository.listBuildings().find((building) => building.id === activeOutlet.buildingId)
    : undefined;
  const outletPhoto =
    activeOutlet?.profilePhotoUrl ?? activeOutlet?.coverPhotoUrl ?? activeOutlet?.galleryUrls[0];
  const outletLocation = [outletBuilding?.name, activeOutlet?.floor, activeOutlet?.unitNumber]
    .filter(Boolean)
    .join(" ");
  // `||` after trimming: an empty phone must fall through to the email, then to the fallback.
  // Contact details are never cached, so before the account sync lands they are unknown, not empty.
  const contactKnown = useMerchantStore((state) => state.accountSyncedAt !== null);
  const outletContact =
    formatContactPhone(activeOutlet?.contactPhone) ||
    activeOutlet?.contactEmail?.trim() ||
    (contactKnown ? "No contact added" : "Loading…");
  const isVerified = isVerificationCurrent(activeOutlet?.verification);
  const verificationInfo = getVerificationStatusInfo(activeOutlet?.verification);
  const verificationLabel = verificationInfo.profileLabel;
  const verificationColor = isVerified ? palette.success : palette.warningText;
  const openMerchantRoute = (route: string) => navigation.navigate(route as any);
  const openEditorSection = (section: "location" | "hours" | "contact") =>
    navigation.navigate("BusinessProfileEditor" as any, { section } as any);
  const prefetchRoute = (route: string) =>
    prefetchMerchantTab(route, activeOutlet?.id, account?.id);

  if (!activeOutlet) {
    return (
      <Screen title="Stall profile" subtitle="Manage your stall information" showBack={false}>
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
    <Screen title="Stall profile" subtitle="Manage your stall information" showBack={false}>
      <View style={{ paddingBottom: spacing[12], width: "100%" }}>
        {/* Stall Identity */}
        <View style={{ alignItems: "center", marginVertical: spacing[6] }}>
          <Avatar uri={outletPhoto} name={activeOutlet.name} size={80} />
          <AppText variant="h2" style={{ marginTop: spacing[3] }}>
            {activeOutlet.name}
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <AppSymbol
              name="checkmark.shield"
              fallback={ShieldCheck}
              size={14}
              color={verificationColor}
            />
            <AppText variant="micro" style={{ color: verificationColor }}>
              {verificationLabel}
            </AppText>
          </View>
        </View>

        <Section title="Basic info">
          <ProfileItem
            icon={MapPin}
            symbol="mappin.and.ellipse"
            label="Location"
            value={outletLocation || "Location not set"}
            onPress={() => openEditorSection("location")}
          />
          <ProfileItem
            icon={Clock}
            symbol="clock"
            label="Operating hours"
            value={activeOutlet.operatingHours || "Hours not set"}
            onPress={() => openEditorSection("hours")}
          />
          <ProfileItem
            icon={Phone}
            symbol="phone"
            label="Contact"
            value={outletContact}
            onPress={() => openEditorSection("contact")}
          />
        </Section>

        <Section title="Manage">
          <ProfileItem
            icon={Store}
            symbol="storefront"
            label="Business details"
            value="Name, photos, cuisine and links"
            onPressIn={() => prefetchRoute("BusinessProfileEditor")}
            onPress={() => openMerchantRoute("BusinessProfileEditor")}
          />
          <ProfileItem
            icon={ShieldCheck}
            symbol="checkmark.shield"
            label="Verification"
            value={verificationInfo.nextStep || verificationInfo.label}
            onPressIn={() => prefetchRoute("VerificationCentre")}
            onPress={() => openMerchantRoute("VerificationCentre")}
          />
        </Section>

        <View style={{ marginTop: spacing[2], gap: spacing[3] }}>
          <Button
            label="Switch to customer mode"
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
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={() =>
              showAlert("Sign out?", "You will need to sign in again to use Hungry.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Sign out",
                  style: "destructive",
                  onPress: () => {
                    signOut();
                    rootNavigation.reset({
                      index: 0,
                      routes: [{ name: "AuthStack", params: { screen: "Login" } }],
                    });
                  },
                },
              ])
            }
            style={[
              styles.item,
              {
                justifyContent: "flex-start",
                gap: spacing[3],
                backgroundColor: palette.surfaceRaised,
                borderRadius: componentRadii.card,
                minHeight: 44,
                padding: spacing[4],
              },
            ]}
          >
            <AppSymbol
              name="rectangle.portrait.and.arrow.right"
              fallback={LogOut}
              size={20}
              color={palette.error}
            />
            <AppText variant="bodyBold" style={{ color: palette.error }}>
              Sign out
            </AppText>
          </PressableScale>
        </View>
      </View>
      {dialog}
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
