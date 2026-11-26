import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppSymbol, AppText, Button, PressableScale, type AppSymbolName } from "@/components/ui";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { reportError } from "@/lib/monitoring/reportError";

export const HOME_OFFLINE_COPY = {
  offline: {
    title: "You're offline",
    body: "Connect to Wi-Fi or mobile data and Home will load again by itself.",
  },
  unreachable: {
    title: "Can't reach Hungry",
    body: "Home is taking longer than usual to load. Try again in a moment.",
  },
} as const;

type Props = {
  /** Tries the live Home again (Try again, pull to refresh, or the connection coming back). */
  onRetry: () => unknown;
  /** True while a Try again is loading the live Home; the button shows it is working. */
  retrying?: boolean;
};

function ListRow({
  icon,
  title,
  subtitle,
  accessibilityLabel,
  onPress,
}: {
  icon: AppSymbolName;
  title: string;
  subtitle?: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: spacing[3],
        minHeight: 56,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
      }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.bgSoft,
          borderRadius: radii.md,
          height: 36,
          justifyContent: "center",
          width: 36,
        }}
      >
        <AppSymbol color={palette.orange} name={icon} size={18} weight="medium" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText numberOfLines={1} variant="bodyBold">
          {title}
        </AppText>
        {subtitle ? (
          <AppText numberOfLines={1} tone="secondary" variant="bodySmall">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <AppSymbol color={palette.textMuted} name="chevronRight" size={14} weight="semibold" />
    </PressableScale>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { palette, radii, spacing } = useHungryTheme();
  return (
    <View style={{ gap: spacing[2] }}>
      <AppText accessibilityRole="header" tone="secondary" variant="bodySmall">
        {title}
      </AppText>
      <View
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: radii.lg,
          borderWidth: 1,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * The Home a diner sees when the live Home can't load: no connection, or the server is too slow.
 * It says which, offers Try again and pull to refresh, retries by itself when the phone comes
 * back online, and keeps saved dishes in reach.
 */
export function HomeOfflineScreen({ onRetry, retrying = false }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { palette, semanticSpacing, spacing } = useHungryTheme();
  const isOffline = useUIStore((state) => state.isOffline);
  const savedDishCount = useProfileStore((state) => state.profile.favouriteDishIds.length);
  const [refreshing, setRefreshing] = useState(false);

  // The phone coming back online tries the live Home again without a tap.
  const wasOffline = useRef(isOffline);
  useEffect(() => {
    if (wasOffline.current && !isOffline) onRetry();
    wasOffline.current = isOffline;
  }, [isOffline, onRetry]);

  const copy = isOffline ? HOME_OFFLINE_COPY.offline : HOME_OFFLINE_COPY.unreachable;

  return (
    <View
      style={{ backgroundColor: palette.bg, flex: 1, paddingTop: insets.top }}
      testID="home-offline-root"
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          gap: spacing[6],
          paddingBottom: Math.max(insets.bottom, spacing[6]),
          paddingHorizontal: semanticSpacing.screenEdge,
          paddingTop: spacing[6],
        }}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              setRefreshing(true);
              // The spinner stops once the retry settles, whether or not the feed came back.
              void Promise.resolve()
                .then(onRetry)
                .catch((error: unknown) =>
                  reportError(error, { screen: "HomeOffline", action: "retry" }),
                )
                .finally(() => setRefreshing(false));
            }}
            refreshing={refreshing}
            tintColor={palette.orange}
          />
        }
        showsVerticalScrollIndicator={false}
        testID="home-offline-screen"
      >
        <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
          <View accessibilityRole="alert" style={{ alignItems: "center", gap: spacing[3] }}>
            <View
              style={{
                alignItems: "center",
                backgroundColor: palette.bgSoft,
                borderRadius: 36,
                height: 72,
                justifyContent: "center",
                width: 72,
              }}
            >
              <AppSymbol
                color={palette.orange}
                name={isOffline ? "offline" : "problem"}
                size={32}
                weight="medium"
              />
            </View>
            <AppText accessibilityRole="header" style={{ textAlign: "center" }} variant="h2">
              {copy.title}
            </AppText>
            <AppText style={{ maxWidth: 320, textAlign: "center" }} tone="secondary" variant="body">
              {copy.body}
            </AppText>
          </View>
        </View>
        <View style={{ gap: spacing[4] }}>
          {savedDishCount > 0 ? (
            <Section title="Saved on this phone">
              <ListRow
                accessibilityLabel={`Your saved dishes, ${savedDishCount} saved`}
                icon="saved"
                onPress={() => navigation.navigate("Favourites", { section: "dishes" })}
                subtitle={`${savedDishCount} ${savedDishCount === 1 ? "dish" : "dishes"}`}
                title="Your saved dishes"
              />
            </Section>
          ) : null}
          <Button
            label={retrying ? "Trying again" : "Try again"}
            loading={retrying}
            leftIcon={
              <AppSymbol color={palette.textOnOrange} name="retry" size={16} weight="semibold" />
            }
            onPress={onRetry}
            style={{ alignSelf: "stretch" }}
            testID="home-offline-retry"
          />
        </View>
      </ScrollView>
    </View>
  );
}
