import { useCallback, useMemo } from "react";
import { AppState, Pressable, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppSymbol, AppText } from "@/components/ui";
import { getActivityUnreadCount, selectActivitySourceUpdates } from "@/features/home/activity";
import { preloadRoute } from "@/features/navigation/prefetch";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { getServiceProvider } from "@/lib/services/serviceProvider";
import { useActivityStore } from "@/store/useActivityStore";
import { useHungryTheme } from "@/theme";

/**
 * The Activity bell for your own Profile header: who followed, liked or commented. With Home
 * on Discover the social feed's bell is hidden, so the Food Portfolio puts it here. The count
 * is read from the server when Profile is shown and when the app comes back to the front.
 */
export function ActivityBellButton({ viewerId, size }: { viewerId: string; size: number }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colorScheme, palette, radii } = useHungryTheme();
  const mode = getServiceProvider().mode;
  const readActivityIds = useActivityStore((state) => state.readActivityIds);
  const activityUpdates = useActivityStore((state) => state.activityUpdates);
  const dbActivityEvents = useActivityStore((state) => state.dbActivityEvents);
  const fetchActivityEvents = useActivityStore((state) => state.fetchActivityEvents);
  const unread = useMemo(
    () =>
      getActivityUnreadCount(
        readActivityIds,
        selectActivitySourceUpdates(mode, dbActivityEvents, activityUpdates),
        viewerId,
      ),
    [readActivityIds, activityUpdates, dbActivityEvents, viewerId, mode],
  );
  // A/B test activity_bell_badge_v1: a count (control) or a plain dot. Only diners with something
  // unread see a badge, so only they are exposed.
  const showDot = useExperimentVariant("activity_bell_badge_v1", { enabled: unread > 0 }) === "dot";

  useFocusEffect(
    useCallback(() => {
      if (mode === "mock") return undefined;
      void fetchActivityEvents();
      const subscription = AppState.addEventListener("change", (nextState) => {
        if (nextState === "active") void fetchActivityEvents();
      });
      return () => subscription.remove();
    }, [fetchActivityEvents, mode]),
  );

  return (
    <Pressable
      testID="profile-activity-bell"
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Activity, ${unread} unread` : "Activity"}
      accessibilityHint="Opens who followed, liked or commented on your posts"
      onPressIn={() => preloadRoute(navigation, "ActivityInbox", { initialTab: "updates" })}
      onPress={() => {
        trackAnalyticsEvent("profile_item_opened", {
          kind: "activity_bell",
          source: "profile_header",
          unread_count: unread,
        });
        navigation.navigate("ActivityInbox", { initialTab: "updates" });
      }}
      hitSlop={2}
      style={{ alignItems: "center", height: size, justifyContent: "center", width: size }}
    >
      <AppSymbol name="notifications" size={22} weight="regular" color={palette.text} />
      {unread > 0 && showDot ? (
        <View
          testID="profile-activity-dot"
          style={{
            backgroundColor: colorScheme === "dark" ? palette.orange : palette.accentText,
            borderRadius: radii.pill,
            height: 10,
            position: "absolute",
            right: 4,
            top: 4,
            width: 10,
          }}
        />
      ) : unread > 0 ? (
        <View
          testID="profile-activity-badge"
          style={{
            alignItems: "center",
            backgroundColor: colorScheme === "dark" ? palette.orange : palette.accentText,
            borderRadius: radii.pill,
            height: 18,
            justifyContent: "center",
            minWidth: 18,
            paddingHorizontal: 4,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        >
          <AppText
            variant="micro"
            style={{ color: palette.textOnOrange, fontSize: 11, fontWeight: "700", lineHeight: 14 }}
          >
            {unread > 9 ? "9+" : unread}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}
