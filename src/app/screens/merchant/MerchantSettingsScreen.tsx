import React, { useCallback, useState, useEffect } from "react";
import { View, StyleSheet, Switch, Alert, Pressable } from "react-native";
import { Shield, HelpCircle, LogOut, ChevronRight, UserPlus, Trash2, X } from "lucide-react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AppText, Button, IconButton, Input, Screen, Chip, EmptyState } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import type {
  MerchantNotification,
  MerchantNotificationPreferences,
  MerchantTeamMember,
  MerchantWeeklySummary,
} from "@/types/domain";

export function MerchantSettingsScreen() {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const navigation = useNavigation();
  const rootNavigation = getRootNavigation(navigation as any);
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const account = useMerchantStore((state) => state.account);
  const clearMerchant = useMerchantStore((state) => state.clearMerchant);

  const [teamMembers, setTeamMembers] = useState<MerchantTeamMember[]>([]);
  const [merchantNotifications, setMerchantNotifications] = useState<MerchantNotification[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<MerchantWeeklySummary | null>(null);
  const [notifications, setNotifications] = useState<MerchantNotificationPreferences>({
    newReviews: true,
    lowRatingAlerts: true,
    newComments: true,
    promotionUpdates: true,
    weeklyDigest: true,
    aiInsights: true,
  });
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MerchantTeamMember["role"]>("staff");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isSendingWeekly, setIsSendingWeekly] = useState(false);
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
      const [members, prefs, notes, summary] = await Promise.all([
        service.merchant.getTeamMembers(account.id),
        service.merchant.getNotificationPreferences(account.id),
        service.merchant.getMerchantNotifications(account.id),
        activeOutlet
          ? service.merchant.getWeeklySummaryStats(activeOutlet.id)
          : Promise.resolve(null),
      ]);
      setTeamMembers(members);
      if (prefs) setNotifications(prefs);
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

  const handleToggleNotification = async (key: keyof MerchantNotificationPreferences) => {
    if (!account) return;

    const nextPrefs = { ...notifications, [key]: !notifications[key] };
    setNotifications(nextPrefs);

    try {
      await getHungryService().merchant.updateNotificationPreferences(account.id, nextPrefs);
    } catch (e) {
      // Revert on failure
      setNotifications(notifications);
      Alert.alert("Error", "Failed to update preference.");
    }
  };

  const handleSwitchToCustomerMode = () => {
    Alert.alert(
      "Switch to Customer Mode",
      "You will leave Merchant Centre and return to the customer app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: () => {
            clearMerchant();
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

  const handleRemoveTeamMember = (member: MerchantTeamMember) => {
    Alert.alert(
      "Remove Staff",
      `Are you sure you want to remove ${member.displayName} from this business account?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (!account) return;
            try {
              await getHungryService().merchant.removeTeamMember(member.id);
              setTeamMembers((prev) => prev.filter((m) => m.id !== member.id));
            } catch (e) {
              Alert.alert("Error", "Failed to remove team member.");
            }
          },
        },
      ],
    );
  };

  const handleInviteTeamMember = async () => {
    const email = inviteEmail.trim().toLowerCase();
    const name = inviteName.trim();
    setInviteError(null);
    if (!account || isInviting) {
      return;
    }
    if (!name) {
      setInviteError("Name is required.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError("Enter a valid email address.");
      return;
    }

    setIsInviting(true);
    try {
      const newMember = await getHungryService().merchant.addTeamMember(
        account.id,
        email,
        inviteRole,
        name,
      );
      setTeamMembers((prev) => [...prev, newMember]);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("staff");
      const notes = await getHungryService().merchant.getMerchantNotifications(account.id);
      setMerchantNotifications(notes);
      Alert.alert("Invite sent", `${newMember.email} has a pending ${newMember.role} invite.`);
    } catch (e) {
      Alert.alert(
        "Invite failed",
        e instanceof Error ? e.message : "Check the details and try again.",
      );
    } finally {
      setIsInviting(false);
    }
  };

  const handleSendWeeklySummary = async () => {
    if (!account || !activeOutlet || isSendingWeekly) return;
    setIsSendingWeekly(true);
    try {
      const [summary, notes] = await Promise.all([
        getHungryService().merchant.getWeeklySummaryStats(activeOutlet.id),
        getHungryService().merchant.sendWeeklySummaryNotifications(activeOutlet.id),
      ]);
      setWeeklySummary(summary);
      setMerchantNotifications((prev) => [...notes, ...prev]);
      Alert.alert("Weekly summary sent", "Every active team member has been notified.");
    } catch (e) {
      Alert.alert("Unable to send summary", e instanceof Error ? e.message : "Try again later.");
    } finally {
      setIsSendingWeekly(false);
    }
  };

  return (
    <Screen title="Settings" contentContainerStyle={{ paddingBottom: spacing[6] }}>
      <View style={{ gap: spacing[5], width: "100%" }}>
        {/* Account Info */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
            },
          ]}
        >
          <View
            style={{ padding: spacing[3], borderBottomWidth: 1, borderBottomColor: palette.border }}
          >
            <AppText variant="bodySmallBold" tone="muted" style={{ textTransform: "uppercase" }}>
              Business Account
            </AppText>
          </View>
          <View style={{ padding: spacing[3] }}>
            <AppText variant="bodyBold">{account?.displayName}</AppText>
            <AppText variant="body" tone="muted" style={{ marginTop: 2 }}>
              {account?.email}
            </AppText>
            <AppText variant="bodySmall" tone="muted" style={{ marginTop: spacing[2] }}>
              {activeOutlet?.name ?? "No active outlet selected"}
            </AppText>
          </View>
        </View>

        {/* Team Management */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
            },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: spacing[3],
              borderBottomWidth: 1,
              borderBottomColor: palette.border,
            }}
          >
            <AppText variant="bodySmallBold" tone="muted" style={{ textTransform: "uppercase" }}>
              Team Management
            </AppText>
            <UserPlus size={18} color={palette.textSecondary} />
          </View>

          {account?.role === "owner" ? (
            <View style={{ gap: spacing[2], padding: spacing[3] }}>
              <Input
                accessibilityLabel="Team member name"
                onChangeText={setInviteName}
                placeholder="Team member name"
                value={inviteName}
              />
              <Input
                accessibilityLabel="Team member email"
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setInviteEmail}
                placeholder="staff@example.com"
                value={inviteEmail}
              />
              <View style={{ flexDirection: "row", gap: spacing[2] }}>
                {(["manager", "staff"] as const).map((role) => (
                  <Pressable key={role} onPress={() => setInviteRole(role)}>
                    <Chip
                      label={role === "manager" ? "Manager" : "Staff"}
                      selected={inviteRole === role}
                    />
                  </Pressable>
                ))}
              </View>
              {inviteError ? (
                <AppText variant="micro" style={{ color: palette.error }}>
                  {inviteError}
                </AppText>
              ) : null}
              <Button
                label={isInviting ? "Inviting..." : "Invite staff"}
                variant="secondary"
                size="sm"
                disabled={isInviting || !inviteEmail.trim() || !inviteName.trim()}
                onPress={handleInviteTeamMember}
              />
            </View>
          ) : (
            <View style={{ padding: spacing[3] }}>
              <AppText variant="bodySmall" tone="muted">
                Only the business owner can invite or remove team members.
              </AppText>
            </View>
          )}

          {teamMembers.map((member, index) => (
            <View
              key={member.id}
              style={[
                styles.teamMemberRow,
                { borderBottomColor: palette.border, padding: spacing[4] },
                index === teamMembers.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                  <AppText variant="bodyBold">{member.displayName}</AppText>
                  {member.role === "owner" && (
                    <View
                      style={{
                        backgroundColor: palette.orangeLight,
                        borderRadius: componentRadii.card,
                      }}
                    >
                      <Chip label="Owner" selected={true} />
                    </View>
                  )}
                  {member.role === "manager" && <Chip label="Manager" selected={false} />}
                  {member.role === "staff" && <Chip label="Staff" selected={false} />}
                </View>
                <AppText variant="bodySmall" tone="muted" style={{ marginTop: 2 }}>
                  {member.email}
                </AppText>
                <View style={{ marginTop: spacing[1], alignSelf: "flex-start" }}>
                  <Chip
                    label={member.inviteStatus === "accepted" ? "Accepted" : "Pending invite"}
                    selected={member.inviteStatus === "accepted"}
                  />
                </View>
              </View>
              {member.role !== "owner" && account?.role === "owner" && (
                <IconButton
                  accessibilityLabel="Remove team member"
                  icon={<Trash2 size={18} color={palette.error} />}
                  onPress={() => handleRemoveTeamMember(member)}
                />
              )}
            </View>
          ))}
        </View>

        {/* Notifications */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
            },
          ]}
        >
          <View
            style={{ padding: spacing[3], borderBottomWidth: 1, borderBottomColor: palette.border }}
          >
            <AppText variant="bodySmallBold" tone="muted" style={{ textTransform: "uppercase" }}>
              Notification Preferences
            </AppText>
          </View>

          <View
            style={[styles.settingRow, { borderBottomColor: palette.border, padding: spacing[4] }]}
          >
            <View style={{ flex: 1, paddingRight: spacing[3] }}>
              <AppText variant="bodyBold">New Reviews</AppText>
              <AppText variant="bodySmall" tone="muted">
                Alert when a customer leaves a review
              </AppText>
            </View>
            <Switch
              value={notifications.newReviews}
              onValueChange={() => handleToggleNotification("newReviews")}
              trackColor={{ true: palette.orange, false: palette.border }}
            />
          </View>

          <View
            style={[styles.settingRow, { borderBottomColor: palette.border, padding: spacing[4] }]}
          >
            <View style={{ flex: 1, paddingRight: spacing[3] }}>
              <AppText variant="bodyBold">Low Rating Alerts</AppText>
              <AppText variant="bodySmall" tone="muted">
                Immediate alert for reviews 2 stars or below
              </AppText>
            </View>
            <Switch
              value={notifications.lowRatingAlerts}
              onValueChange={() => handleToggleNotification("lowRatingAlerts")}
              trackColor={{ true: palette.orange, false: palette.border }}
            />
          </View>

          <View
            style={[styles.settingRow, { borderBottomColor: palette.border, padding: spacing[4] }]}
          >
            <View style={{ flex: 1, paddingRight: spacing[3] }}>
              <AppText variant="bodyBold">Weekly Digest</AppText>
              <AppText variant="bodySmall" tone="muted">
                Weekly email summary of your analytics
              </AppText>
            </View>
            <Switch
              value={notifications.weeklyDigest}
              onValueChange={() => handleToggleNotification("weeklyDigest")}
              trackColor={{ true: palette.orange, false: palette.border }}
            />
          </View>

          <View style={[styles.settingRow, { borderBottomWidth: 0, padding: spacing[4] }]}>
            <View style={{ flex: 1, paddingRight: spacing[3] }}>
              <AppText variant="bodyBold">AI Insights</AppText>
              <AppText variant="bodySmall" tone="muted">
                Notifications when AI finds a menu improvement
              </AppText>
            </View>
            <Switch
              value={notifications.aiInsights}
              onValueChange={() => handleToggleNotification("aiInsights")}
              trackColor={{ true: palette.orange, false: palette.border }}
            />
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
            },
          ]}
        >
          <View
            style={{ padding: spacing[3], borderBottomWidth: 1, borderBottomColor: palette.border }}
          >
            <AppText variant="bodySmallBold" tone="muted" style={{ textTransform: "uppercase" }}>
              Weekly Summary & Alerts
            </AppText>
          </View>
          <View style={{ gap: spacing[3], padding: spacing[4] }}>
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
                Weekly summary will appear after your stall has analytics data.
              </AppText>
            )}
            <Button
              label={isSendingWeekly ? "Sending..." : "Send weekly summary"}
              variant="secondary"
              size="sm"
              disabled={isSendingWeekly || !activeOutlet}
              onPress={handleSendWeeklySummary}
            />
            {merchantNotifications.slice(0, 3).map((notification) => (
              <View key={notification.id} style={{ gap: spacing[0.5] }}>
                <AppText variant="bodySmallBold">{notification.title}</AppText>
                <AppText variant="micro" tone="muted" numberOfLines={2}>
                  {notification.body}
                </AppText>
              </View>
            ))}
          </View>
        </View>

        {/* Links & Legal */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
            },
          ]}
        >
          <Pressable
            style={[styles.linkRow, { borderBottomColor: palette.border, padding: spacing[4] }]}
            onPress={() => navigation.navigate("VerificationCentre" as never)}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
              <Shield size={20} color={palette.textSecondary} />
              <AppText variant="bodyBold">Verification Status</AppText>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <AppText variant="bodySmall" tone="muted">
                {activeOutlet?.verification?.status === "verified" ? "Verified" : "Pending"}
              </AppText>
              <ChevronRight size={18} color={palette.textMuted} />
            </View>
          </Pressable>

          <Pressable
            style={[styles.linkRow, { padding: spacing[4] }]}
            accessibilityRole="button"
            accessibilityLabel="Open merchant help and support"
            onPress={() => void openTrustedExternalUrl("https://hungry.sg/help")}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
              <HelpCircle size={20} color={palette.textSecondary} />
              <AppText variant="bodyBold">Help & Support</AppText>
            </View>
            <ChevronRight size={18} color={palette.textMuted} />
          </Pressable>
        </View>

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

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  section: {
    borderWidth: 1,
    overflow: "hidden",
  },
  teamMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
});
