import React, { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet, Switch, Alert, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Users,
  Shield,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  UserPlus,
  Trash2,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Button, IconButton, Screen, Chip } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { MerchantTeamMember, MerchantNotificationPreferences } from "@/types/domain";

export function MerchantSettingsScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation();
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const account = useMerchantStore((state) => state.account);
  const clearMerchant = useMerchantStore((state) => state.clearMerchant);
  const insets = useSafeAreaInsets();

  const [teamMembers, setTeamMembers] = useState<MerchantTeamMember[]>([]);
  const [notifications, setNotifications] = useState<MerchantNotificationPreferences>({
    newReviews: true,
    lowRatingAlerts: true,
    newComments: true,
    promotionUpdates: true,
    weeklyDigest: true,
    aiInsights: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSettingsData() {
      if (account) {
        try {
          const members = await getHungryService().merchant.getTeamMembers(account.id);
          setTeamMembers(members);

          const prefs = await getHungryService().merchant.getNotificationPreferences(account.id);
          if (prefs) setNotifications(prefs);
        } catch (e) {
          console.error(e);
        }
      }
      setIsLoading(false);
    }
    loadSettingsData();
  }, [account]);

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

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of Merchant Centre? You will be returned to your consumer profile.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: () => {
            clearMerchant();
            navigation.navigate("Profile" as never);
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

  return (
    <Screen title="Settings">
      <View style={{ gap: spacing[5], width: "100%" }}>
        {/* Account Info */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: radii.lg,
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
            <View style={{ marginTop: spacing[2], alignSelf: "flex-start" }}>
              <Chip label={`Role: ${account?.role}`} selected={false} />
            </View>
          </View>
        </View>

        {/* Team Management */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: radii.lg,
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
            <IconButton
              accessibilityLabel="Add team member"
              icon={<UserPlus size={18} color={palette.orange} />}
              onPress={() => Alert.alert("Coming Soon", "Invite system not connected yet.")}
            />
          </View>

          {teamMembers.map((member, index) => (
            <View
              key={member.id}
              style={[
                styles.teamMemberRow,
                { borderBottomColor: palette.border },
                index === teamMembers.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                  <AppText variant="bodyBold">{member.displayName}</AppText>
                  {member.role === "owner" && (
                    <View style={{ backgroundColor: palette.orangeLight, borderRadius: 16 }}>
                      <Chip label="Owner" selected={true} />
                    </View>
                  )}
                  {member.role === "manager" && <Chip label="Manager" selected={false} />}
                  {member.role === "staff" && <Chip label="Staff" selected={false} />}
                </View>
                <AppText variant="bodySmall" tone="muted" style={{ marginTop: 2 }}>
                  {member.email}
                </AppText>
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
              borderRadius: radii.lg,
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

          <View style={[styles.settingRow, { borderBottomColor: palette.border }]}>
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

          <View style={[styles.settingRow, { borderBottomColor: palette.border }]}>
            <View style={{ flex: 1, paddingRight: spacing[3] }}>
              <AppText variant="bodyBold">Low Rating Alerts</AppText>
              <AppText variant="bodySmall" tone="muted">
                Immediate alert for reviews 3 stars or below
              </AppText>
            </View>
            <Switch
              value={notifications.lowRatingAlerts}
              onValueChange={() => handleToggleNotification("lowRatingAlerts")}
              trackColor={{ true: palette.orange, false: palette.border }}
            />
          </View>

          <View style={[styles.settingRow, { borderBottomColor: palette.border }]}>
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

          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
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

        {/* Links & Legal */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: radii.lg,
            },
          ]}
        >
          <Pressable
            style={[styles.linkRow, { borderBottomColor: palette.border }]}
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
            style={styles.linkRow}
            onPress={() => Alert.alert("Support", "Opening merchant support centre...")}
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
          label="Log out of Merchant Centre"
          variant="secondary"
          leftIcon={<LogOut size={18} color={palette.error} />}
          onPress={handleLogout}
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
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  section: {
    borderWidth: 1,
    overflow: "hidden",
  },
  teamMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
});
