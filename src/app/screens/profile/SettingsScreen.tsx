import { assertAccountGeneration, getAccountGeneration } from "@/lib/security/accountScope";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Alert, Linking } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { SettingsSection, SettingsRow } from "@/components/settings";
import { StallAlertsSettings } from "@/components/settings/StallAlertsSettings";
import { AppText, Button } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { SUPPORT_EMAIL, WEB_LINKS } from "@/constants/links";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import { getHungryService } from "@/lib/services/serviceProvider";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/services/types";
import { buildMyDataExport } from "@/features/profile/exportMyData";
import { shareMyDataExport } from "@/features/profile/shareMyDataExport";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { ProfileScreenShell } from "./ProfileScreenShell";

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const root = getRootNavigation(navigation);
  const profile = useProfileStore((s) => s.profile);
  const setVisibility = useProfileStore((s) => s.setProfileVisibility);
  const userId = useSessionStore((s) => s.authenticatedUserId);
  const ui = useUIStore();
  const location = useLocationStore((s) => s.manualLocation);
  const [busy, setBusy] = useState<string | null>(null);
  const [deletion, setDeletion] =
    useState<
      Awaited<ReturnType<ReturnType<typeof getHungryService>["auth"]["getPendingAccountDeletion"]>>
    >(null);
  const [lookupError, setLookupError] = useState(false);
  const [lookupVersion, setLookupVersion] = useState(0);
  const [lookingUp, setLookingUp] = useState(true);
  useEffect(() => {
    let active = true;
    setLookingUp(true);
    setLookupError(false);
    void getHungryService()
      .auth.getPendingAccountDeletion()
      .then((value) => {
        if (active) setDeletion(value);
      })
      .catch(() => {
        if (active) setLookupError(true);
      })
      .finally(() => {
        if (active) setLookingUp(false);
      });
    return () => {
      active = false;
    };
  }, [userId, lookupVersion]);
  const run = async (key: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await action();
    } catch {
      Alert.alert(
        "Could not complete action",
        "Your changes were not confirmed. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };
  const exportData = async () => {
    const generation = getAccountGeneration();
    const accountId = userId;
    if (!accountId) throw new Error("Sign in to export data");
    const data = await buildMyDataExport(getHungryService());
    assertAccountGeneration(generation);
    const failed = Object.entries(data)
      .filter(([, value]) => value && typeof value === "object" && "ok" in value && !value.ok)
      .map(([key]) => key);
    if (failed.length) {
      const proceed = await new Promise<boolean>((resolve) =>
        Alert.alert(
          "Incomplete export",
          `These sections could not be loaded: ${failed.join(", ")}. Retry or share a file that clearly records the missing sections.`,
          [
            { text: "Retry later", style: "cancel", onPress: () => resolve(false) },
            { text: "Share incomplete file", onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        ),
      );
      if (!proceed) return;
    }
    assertAccountGeneration(generation);
    await shareMyDataExport(
      data,
      accountId,
      () => useSessionStore.getState().authenticatedUserId ?? null,
    );
  };
  const requestDeletion = () =>
    Alert.alert(
      "Delete account",
      `Your account is scheduled for deletion after ${ACCOUNT_DELETION_GRACE_DAYS} days. Signing in does not cancel deletion. Use Keep my account and wait for confirmation before the deadline. Menu photos may remain without your name and required security or legal records may be retained.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request deletion",
          style: "destructive",
          onPress: () =>
            void run("delete", async () => {
              await getHungryService().auth.requestAccountDeletion({
                reason: "user_initiated_settings_flow",
              });
              setLookupVersion((v) => v + 1);
              Alert.alert(
                "Deletion scheduled",
                "Your request was accepted. You can keep your account by explicitly cancelling deletion before the deadline.",
              );
              try {
                await useSessionStore.getState().signOut();
                root.reset({
                  index: 0,
                  routes: [{ name: "AuthStack", params: { screen: "Login" } }],
                });
              } catch {
                Alert.alert(
                  "Deletion is still scheduled",
                  "Local sign-out could not be confirmed. Retry sign out. This does not undo your deletion request.",
                );
              }
            }),
        },
      ],
    );
  return (
    <ProfileScreenShell title="Settings">
      <SettingsSection title="Account and privacy">
        <SettingsRow
          label="Authentication email"
          value={profile.email || "Unavailable"}
          type="value"
        />
        <SettingsRow
          label="Profile visibility"
          value={profile.profileVisibility === "private" ? "Private" : "Public"}
          busy={busy === "privacy"}
          disabled={!!busy}
          onPress={() =>
            Alert.alert(
              "Profile visibility",
              "Choose who can follow your profile. Private profiles require approval.",
              [
                { text: "Cancel", style: "cancel" },
                ...(["public", "private"] as const).map((value) => ({
                  text: value === "public" ? "Public" : "Private",
                  onPress: () =>
                    void run("privacy", async () => {
                      await setVisibility(value);
                    }),
                })),
              ],
            )
          }
        />
        <SettingsRow
          label="Hide reviewed dishes"
          description="Exclude dishes you reviewed from your recommendations. Your public reviews stay visible."
          type="toggle"
          isEnabled={ui.hideReviewedDishesFromFeed}
          onToggle={ui.setHideReviewedDishesFromFeed}
        />
        {lookingUp ? (
          <AppText>Checking account deletion status…</AppText>
        ) : lookupError ? (
          <Button
            label="Retry deletion status"
            variant="secondary"
            onPress={() => setLookupVersion((v) => v + 1)}
          />
        ) : deletion ? (
          <>
            <AppText>
              Deletion scheduled for {new Date(deletion.scheduledFor).toLocaleString()}.
            </AppText>
            <SettingsRow
              label="Keep my account"
              busy={busy === "keep"}
              disabled={!!busy}
              onPress={() =>
                void run("keep", async () => {
                  const confirmed = await getHungryService().auth.cancelAccountDeletion();
                  if (!confirmed) throw new Error("Cancellation was not confirmed");
                  setDeletion(null);
                  Alert.alert("Account kept", "Your deletion request was successfully cancelled.");
                })
              }
            />
          </>
        ) : (
          <SettingsRow
            label="Delete account"
            disabled={!!busy}
            busy={busy === "delete"}
            onPress={requestDeletion}
          />
        )}
      </SettingsSection>
      <SettingsSection title="Appearance and interaction">
        <SettingsRow
          label="Theme"
          value={ui.themePreference}
          onPress={() =>
            Alert.alert("Choose theme", undefined, [
              { text: "Cancel", style: "cancel" },
              ...(["system", "light", "dark"] as const).map((value) => ({
                text: value === "system" ? "Follow device" : value === "light" ? "Light" : "Dark",
                onPress: () => ui.setThemePreference(value),
              })),
            ])
          }
        />
        <SettingsRow
          label="Reduce motion"
          type="toggle"
          isEnabled={ui.reducedMotionEnabled}
          onToggle={ui.setReducedMotionEnabled}
        />
        <SettingsRow
          label="Haptic feedback"
          type="toggle"
          isEnabled={ui.hapticFeedbackEnabled}
          onToggle={ui.setHapticFeedbackEnabled}
        />
      </SettingsSection>
      <SettingsSection title="Location and data">
        <SettingsRow
          label="Selected area"
          type="value"
          value={location || "Device location when available"}
        />
        <SettingsRow
          label="Use current device location"
          description="Clear the selected area and request a fresh device location. If access is denied, choose an area from discovery."
          disabled={!!busy}
          busy={busy === "location"}
          onPress={() =>
            void run("location", async () => {
              useLocationStore.getState().resetLocationState();
              const granted = await useLocationStore.getState().grantLocation();
              if (!granted)
                Alert.alert(
                  "Device location unavailable",
                  "Choose an area in discovery, or allow location access in phone settings.",
                );
            })
          }
        />
        <SettingsRow
          label="Location permissions"
          onPress={() =>
            void Linking.openSettings().catch(() =>
              Alert.alert(
                "Open phone settings",
                "Find Hungry in your phone settings to change location access.",
              ),
            )
          }
        />
        <SettingsRow
          label="Save search history"
          type="toggle"
          isEnabled={ui.allowSearchHistory}
          onToggle={ui.setAllowSearchHistory}
        />
        <SettingsRow
          label="Clear search history"
          description="Removes recent searches only. Your account, profile, location and drafts are preserved."
          onPress={() =>
            Alert.alert("Clear recent searches?", undefined, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Clear",
                style: "destructive",
                onPress: () => useSearchStore.getState().clearHistory(),
              },
            ])
          }
        />
        <SettingsRow
          label="Export my data"
          description="Share a JSON file. Missing sections are disclosed before sharing."
          disabled={!!busy}
          busy={busy === "export"}
          onPress={() => void run("export", exportData)}
        />
      </SettingsSection>
      {FEATURE_FLAGS.stallAlertsEnabled ? (
        <StallAlertsSettings
          onOpenFollowedStalls={() =>
            root.navigate("MainTabs", { screen: "Profile", params: { screen: "FollowedStalls" } })
          }
        />
      ) : null}
      <SettingsSection title="Support and legal">
        <SettingsRow
          label="Contact support"
          value={SUPPORT_EMAIL}
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.help)}
        />
        <SettingsRow
          label="Privacy policy"
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.privacy)}
        />
        <SettingsRow
          label="Terms of service"
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.terms)}
        />
        <SettingsRow
          label="Account deletion information"
          onPress={() => void openTrustedExternalUrl(WEB_LINKS.accountDeletion)}
        />
      </SettingsSection>
      <SettingsSection title="About">
        <SettingsRow
          label="Hungry version"
          type="value"
          value={Constants.expoConfig?.version ?? "Unknown"}
        />
        <SettingsRow
          label="Sign out"
          disabled={!!busy}
          busy={busy === "signout"}
          onPress={() =>
            void run("signout", async () => {
              await useSessionStore.getState().signOut();
              root.reset({
                index: 0,
                routes: [{ name: "AuthStack", params: { screen: "Login" } }],
              });
            })
          }
        />
      </SettingsSection>
    </ProfileScreenShell>
  );
}
