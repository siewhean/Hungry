import { Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { AppSymbol, AppText, Avatar, Card, Screen } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { confirmAction } from "@/lib/runtime/confirmAction";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";

function ReleaseProfileRow({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  onPress: () => void;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? palette.bgSoft : palette.surface,
        borderRadius: radii.lg,
        flexDirection: "row",
        gap: spacing[3],
        minHeight: 58,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
      })}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.bgSoft,
          borderRadius: radii.md,
          height: 38,
          justifyContent: "center",
          width: 38,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, gap: spacing[0.5] }}>
        <AppText variant="bodyBold">{label}</AppText>
        <AppText tone="secondary" variant="micro">
          {detail}
        </AppText>
      </View>
      <AppSymbol name="chevronRight" color={palette.textMuted} size={18} />
    </Pressable>
  );
}

/** Release 0.1 profile: account essentials only, with social/creator surfaces omitted. */
export function ReleaseProfileScreen() {
  const navigation = useNavigation();
  const rootNavigation = getRootNavigation(navigation as never);
  const profile = useProfileStore((state) => state.profile);
  const signOut = useSessionStore((state) => state.signOut);
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <Screen title="Profile" showBack={false} contentContainerStyle={{ gap: spacing[4] }}>
      <Card
        style={{
          alignItems: "center",
          borderRadius: radii.xl,
          gap: spacing[3],
          padding: spacing[5],
        }}
      >
        <Avatar name={profile.displayName} size={76} uri={profile.avatarUrl} />
        <View style={{ alignItems: "center", gap: spacing[1] }}>
          <AppText variant="h3">{profile.displayName || "Hungry member"}</AppText>
          <AppText tone="secondary" style={{ textAlign: "center" }} variant="bodySmall">
            {FEATURE_FLAGS.favouritesEnabled
              ? "Your account, saved dishes, and essential settings."
              : "Your account and essential settings."}
          </AppText>
        </View>
      </Card>

      <View style={{ gap: spacing[2] }}>
        {FEATURE_FLAGS.favouritesEnabled ? (
          <ReleaseProfileRow
            icon={<AppSymbol name="save" color={palette.orange} size={20} />}
            label="Saved"
            detail="Your dishes, stalls and lists"
            onPress={() => rootNavigation.navigate("Favourites")}
          />
        ) : null}
        <ReleaseProfileRow
          icon={<AppSymbol name="compose" color={palette.text} size={20} />}
          label="Edit profile"
          detail="Update your name, photo, and food preferences"
          onPress={() => rootNavigation.navigate("EditProfile")}
        />
        <ReleaseProfileRow
          icon={<AppSymbol name="settings" color={palette.text} size={20} />}
          label="Settings and privacy"
          detail="Manage privacy, support, account deletion, and app settings"
          onPress={() => rootNavigation.navigate("Settings")}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        accessibilityHint="Signs out and returns to the authentication screen"
        onPress={() =>
          confirmAction({
            title: "Sign out",
            message: "You will be signed out from Hungry on this device.",
            confirmLabel: "Sign out",
            destructive: true,
            onConfirm: signOut,
          })
        }
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: pressed ? palette.bgSoft : palette.surface,
          borderColor: palette.border,
          borderRadius: radii.lg,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing[2],
          justifyContent: "center",
          minHeight: 52,
          paddingHorizontal: spacing[4],
        })}
      >
        <AppSymbol name="signOut" color={palette.error} size={18} />
        <AppText style={{ color: palette.error }} variant="bodyBold">
          Sign out
        </AppText>
      </Pressable>
    </Screen>
  );
}
