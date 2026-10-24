import React, { useCallback, useState, useEffect } from "react";
import { View, Platform } from "react-native";
import { ArrowLeftRight, BellRing, Shield, HelpCircle, X } from "lucide-react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AppText, Button, Screen, EmptyState, Skeleton } from "@/components/ui";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import { registerForStallAlerts } from "@/lib/notifications/push";
import type { MerchantNotification, MerchantWeeklySummary } from "@/types/domain";
import { WEB_LINKS } from "@/constants/links";
import { isVerificationCurrent } from "@/features/merchant/merchantGuards";
import {
  formatAverageRating,
  formatReviewCountLabel,
  getVerificationStatusInfo,
} from "@/features/merchant/merchantReadiness";
import { reportError } from "@/lib/monitoring/reportError";
import { useMerchantDialog } from "@/features/merchant/useMerchantDialog";

export function MerchantSettingsScreen() {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const navigation = useNavigation();
  const { showAlert, dialog } = useMerchantDialog();
  const rootNavigation = getRootNavigation(navigation as any);
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const account = useMerchantStore((state) => state.account);

  const [merchantNotifications, setMerchantNotifications] = useState<MerchantNotification[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<MerchantWeeklySummary | null>(null);
  const [lowRatingAlerts, setLowRatingAlerts] = useState(true);
  const [isDeviceRegistered, setIsDeviceRegistered] = useState(false);
  const [isSavingAlerts, setIsSavingAlerts] = useState(false);
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
      // Low-rating push alerts are the only merchant alert Hungry delivers. Team invites,
      // email alerts and the weekly email are not offered.
      // Every read is optional: a failure of any of them must not replace Settings, which holds
      // the "Switch to Customer Mode" and sign-out exits.
      const [notes, summary, prefs] = await Promise.all([
        service.merchant.getMerchantNotifications(account.id).catch(() => []),
        activeOutlet
          ? service.merchant.getWeeklySummaryStats(activeOutlet.id).catch(() => null)
          : Promise.resolve(null),
        service.merchant.getNotificationPreferences(account.id).catch(() => null),
      ]);
      setMerchantNotifications(notes);
      setWeeklySummary(summary);
      if (prefs) setLowRatingAlerts(prefs.lowRatingAlerts);
      // Keeps this phone's push token current without prompting for permission.
      void registerForStallAlerts({ askPermission: false })
        .then(setIsDeviceRegistered)
        .catch(() => setIsDeviceRegistered(false));
    } catch (e) {
      reportError(e, { screen: "MerchantSettings", action: "load_settings" });
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
        <View accessibilityLabel="Loading settings" style={{ gap: spacing[4], width: "100%" }}>
          <Skeleton height={96} borderRadius={componentRadii.card} />
          <Skeleton height={160} borderRadius={componentRadii.card} />
          <Skeleton height={96} borderRadius={componentRadii.card} />
        </View>
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
    showAlert(
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

  const handleToggleLowRatingAlerts = async (enabled: boolean) => {
    if (!account || isSavingAlerts) return;
    setIsSavingAlerts(true);
    try {
      if (enabled) setIsDeviceRegistered(await registerForStallAlerts().catch(() => false));
      await getHungryService().merchant.updateNotificationPreferences(account.id, {
        lowRatingAlerts: enabled,
      });
      setLowRatingAlerts(enabled);
    } catch (e) {
      reportError(e, { screen: "MerchantSettings", action: "update_alerts" });
      showAlert("Error", "Couldn't update low-rating alerts. Please try again.");
    } finally {
      setIsSavingAlerts(false);
    }
  };

  const handleAllowNotifications = async () => {
    const registered = await registerForStallAlerts().catch(() => false);
    setIsDeviceRegistered(registered);
    if (!registered) {
      showAlert(
        "Notifications are off",
        "Allow notifications for Hungry in your phone settings to get low-rating alerts on this phone.",
      );
    }
  };

  const isOutletVerified = isVerificationCurrent(activeOutlet?.verification);
  const verificationInfo = getVerificationStatusInfo(activeOutlet?.verification);

  return (
    <Screen title="Settings" contentContainerStyle={{ paddingBottom: spacing[6] }}>
      <View style={{ gap: spacing[5], width: "100%" }}>
        {/* Account Info */}
        <SettingsSection title="Business account">
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
          <SettingsRow
            label="Low-rating push alerts"
            description="A push to your phone when a review rated 2 stars or below is posted on your stall."
            icon={<BellRing size={20} color={palette.textSecondary} />}
            type="toggle"
            isEnabled={lowRatingAlerts}
            onToggle={(value) => void handleToggleLowRatingAlerts(value)}
            busy={isSavingAlerts}
          />
          <View style={{ gap: spacing[3], padding: spacing[4] }}>
            {lowRatingAlerts && !isOutletVerified ? (
              <AppText variant="bodySmall" tone="muted">
                Push alerts start once your stall is verified.
              </AppText>
            ) : null}
            {lowRatingAlerts && Platform.OS === "web" ? (
              <AppText variant="bodySmall" tone="muted">
                Low-rating alerts go to the Hungry app on your phone.
              </AppText>
            ) : null}
            {lowRatingAlerts && Platform.OS !== "web" && !isDeviceRegistered ? (
              <View style={{ gap: spacing[2] }}>
                <AppText variant="bodySmall" tone="muted">
                  Notifications are off on this phone, so alerts cannot reach it.
                </AppText>
                <Button
                  label="Allow notifications"
                  variant="secondary"
                  size="sm"
                  onPress={() => void handleAllowNotifications()}
                />
              </View>
            ) : null}
            <AppText variant="bodySmall" tone="muted">
              Hungry sends low-rating push alerts to the account owner as soon as the review is
              posted. Email alerts and weekly emails are not sent. Reviews rated 2 stars or below
              are also listed here. Team access is not available yet, so only the account owner can
              manage this business.
            </AppText>
            {weeklySummary ? (
              <View style={{ gap: spacing[1] }}>
                <AppText variant="bodyBold">
                  {weeklySummary.totalViews.toLocaleString()} views in the last 7 days
                </AppText>
                <AppText variant="bodySmall" tone="muted">
                  {formatReviewCountLabel(weeklySummary.newReviews, "in the last 7 days", {
                    zeroLabel: "No reviews in the last 7 days",
                  })}{" "}
                  · {weeklySummary.unrepliedReviews} unreplied · Avg rating{" "}
                  {formatAverageRating(weeklySummary.averageRating, weeklySummary.newReviews)}
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
            label="Verification status"
            value={verificationInfo.label}
            description={verificationInfo.nextStep || undefined}
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

        {/* A mode switch, not a destructive action: neutral icon and border. */}
        <Button
          label="Switch to Customer Mode"
          variant="secondary"
          leftIcon={<ArrowLeftRight size={18} color={palette.textSecondary} />}
          onPress={handleSwitchToCustomerMode}
        />
      </View>
      {dialog}
    </Screen>
  );
}
