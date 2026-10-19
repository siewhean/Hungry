import React, { useCallback, useState, useEffect } from "react";
import { View, Alert } from "react-native";
import { Shield, HelpCircle, LogOut, X } from "lucide-react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AppText, Button, Screen, EmptyState } from "@/components/ui";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import type { MerchantNotification, MerchantWeeklySummary } from "@/types/domain";
import { WEB_LINKS } from "@/constants/links";

export function MerchantSettingsScreen() {
  const { palette, spacing } = useHungryTheme();
  const navigation = useNavigation();
  const rootNavigation = getRootNavigation(navigation as any);
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const account = useMerchantStore((state) => state.account);

  const [merchantNotifications, setMerchantNotifications] = useState<MerchantNotification[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<MerchantWeeklySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettingsData = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    if (!account) {
      setError("No merchant account is currently available.");
      setIsLoading(false);
      return;
    }

    try {
      const service = getHungryService();
      // Team invites, push/email alerts and notification preferences are not delivered yet,
      // so this screen only shows the in-app alerts and the weekly numbers.
      const [notes, summary] = await Promise.all([
        service.merchant.getMerchantNotifications(account.id),
        activeOutlet
          ? service.merchant.getWeeklySummaryStats(activeOutlet.id)
          : Promise.resolve(null),
      ]);
      setMerchantNotifications(notes);
      setWeeklySummary(summary);
      if (activeOutlet) {
        void service.merchant.syncLowRatingNotifications(activeOutlet.id).then(async () => {
          setMerchantNotifications(await service.merchant.getMerchantNotifications(account.id));
        });
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load merchant settings.");
    } finally {
      setIsLoading(false);
    }
  }, [account, activeOutlet]);

  useEffect(() => {
    void loadSettingsData();
  }, [loadSettingsData]);

  if (isLoading) {
    return (
      <Screen title="Settings">
        <AppText>Loading settings...</AppText>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title="Settings">
        <EmptyState
          title="Unable to load settings"
          body="Merchant settings could not be loaded right now."
          icon={<X size={40} color={palette.error} />}
          errorMessage={error}
          sendErrorContext="Merchant settings"
          ctaLabel="Retry"
          onPress={loadSettingsData}
        />
      </Screen>
    );
  }

  const handleSwitchToCustomerMode = () => {
    Alert.alert(
      "Switch to Customer Mode",
      "You will leave Merchant Centre and return to the customer app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: () => {
            // Leave merchant mode only; keep the account so Profile can switch back.
            useMerchantStore.getState().setMerchantModeActive(false);
            rootNavigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: "MainTabs", params: { screen: "Home" } }],
              }),
            );
          },
        },
      ],
    );
  };

  return (
    <Screen title="Settings" contentContainerStyle={{ paddingBottom: spacing[6] }}>
      <View style={{ gap: spacing[5], width: "100%" }}>
        {/* Account Info */}
        <SettingsSection title="Business Account">
          <View style={{ padding: spacing[3] }}>
            <AppText variant="bodyBold">{account?.displayName}</AppText>
            <AppText variant="body" tone="muted" style={{ marginTop: 2 }}>
              {account?.email}
            </AppText>
            <AppText variant="bodySmall" tone="muted" style={{ marginTop: spacing[2] }}>
              {activeOutlet?.name ?? "No active outlet selected"}
            </AppText>
          </View>
        </SettingsSection>

        <SettingsSection title="Alerts">
          <View style={{ gap: spacing[3], padding: spacing[4] }}>
            <AppText variant="bodySmall" tone="muted">
              Hungry does not send push or email alerts to merchants yet. Reviews rated 2 stars or
              below are listed here when you open Merchant Centre. Team access is not available yet,
              so only the account owner can manage this business.
            </AppText>
            {weeklySummary ? (
              <View style={{ gap: spacing[1] }}>
                <AppText variant="bodyBold">
                  {weeklySummary.totalViews.toLocaleString()} total views this week
                </AppText>
                <AppText variant="bodySmall" tone="muted">
                  {weeklySummary.newReviews} reviews · {weeklySummary.unrepliedReviews} unreplied ·
                  Average rating {weeklySummary.averageRating.toFixed(1)}
                </AppText>
              </View>
            ) : (
              <AppText variant="bodySmall" tone="muted">
                Weekly numbers will appear after your stall has analytics data.
              </AppText>
            )}
            {merchantNotifications.slice(0, 3).map((notification) => (
              <View key={notification.id} style={{ gap: spacing[0.5] }}>
                <AppText variant="bodySmallBold">{notification.title}</AppText>
                <AppText variant="micro" tone="muted" numberOfLines={2}>
                  {notification.body}
                </AppText>
              </View>
            ))}
          </View>
        </SettingsSection>

        {/* Links & Legal */}
        <SettingsSection title="Support">
          <SettingsRow
            label="Verification Status"
            value={activeOutlet?.verification?.status === "verified" ? "Verified" : "Pending"}
            icon={<Shield size={20} color={palette.textSecondary} />}
            onPress={() => navigation.navigate("VerificationCentre" as never)}
          />
          <SettingsRow
            label="Help & Support"
            icon={<HelpCircle size={20} color={palette.textSecondary} />}
            onPress={() => void openTrustedExternalUrl(WEB_LINKS.help)}
            isLast
          />
        </SettingsSection>

        {/* Logout */}
        <Button
          label="Switch to Customer Mode"
          variant="secondary"
          leftIcon={<LogOut size={18} color={palette.error} />}
          onPress={handleSwitchToCustomerMode}
          style={{ borderColor: palette.errorSoft }}
        />
      </View>
    </Screen>
  );
}
