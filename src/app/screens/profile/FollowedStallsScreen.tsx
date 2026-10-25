import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BellRing } from "lucide-react-native";

import { AppText, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { describeMissingStalls, loadVenuesByIds } from "@/features/profile/loadVenuesByIds";
import { useRetryableLoad } from "@/features/profile/useRetryableLoad";
import { reportError } from "@/lib/monitoring/reportError";
import type { VenueSummary } from "@/types/domain";
import { useStallFollowStore } from "@/store/useStallFollowStore";
import { useHungryTheme } from "@/theme";
import type { ProfileStackParamList } from "./ProfileStack";
import { ProfileReviewsSkeleton } from "./ProfileGridSkeleton";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = NativeStackScreenProps<ProfileStackParamList, "FollowedStalls">;

export function FollowedStallsScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const followedStallIds = useStallFollowStore((state) => state.followedStallIds);
  const loadFollowedStalls = useStallFollowStore((state) => state.loadFollowedStalls);
  const rootNavigation = getRootNavigation(navigation as any);

  const isLoaded = useStallFollowStore((state) => state.isLoaded);
  const { failed: loadFailed, retry } = useRetryableLoad(loadFollowedStalls, "followed stalls");

  // Stall names come from the server: the local catalog cache holds only part of the catalog.
  const [lookup, setLookup] = useState<{
    key: string;
    venues: VenueSummary[];
    missingCount: number;
  }>();
  const [lookupFailed, setLookupFailed] = useState(false);
  const [lookupRetry, setLookupRetry] = useState(0);
  const idsKey = followedStallIds.join(",");
  useEffect(() => {
    if (followedStallIds.length === 0) {
      setLookup({ key: idsKey, venues: [], missingCount: 0 });
      return;
    }
    let active = true;
    setLookupFailed(false);
    loadVenuesByIds(followedStallIds)
      .then((result) => {
        if (active) setLookup({ key: idsKey, ...result });
      })
      .catch((error: unknown) => {
        reportError(error, { screen: "FollowedStalls", action: "loadVenues" });
        if (active) setLookupFailed(true);
      });
    return () => {
      active = false;
    };
    // idsKey stands for followedStallIds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, lookupRetry]);
  const venues = lookup?.venues ?? [];
  const missingCount = lookup && lookup.key === idsKey ? lookup.missingCount : 0;
  const isResolving = followedStallIds.length > 0 && lookup?.key !== idsKey && !lookupFailed;
  const failed = loadFailed || (lookupFailed && venues.length === 0);
  const onRetry = () => {
    retry();
    setLookupRetry((count) => count + 1);
  };

  return (
    <ProfileScreenShell
      title="Followed stalls"
      subtitle="We'll let you know when a stall updates its menu on Hungry."
    >
      <View style={{ gap: spacing[3], paddingBottom: spacing[5] }}>
        {venues.length ? (
          <>
            {venues.map((venue) => (
              <Pressable
                key={venue.id}
                accessibilityRole="button"
                onPress={() => rootNavigation.navigate("StallDetail", { venueId: venue.id })}
                style={({ pressed }) => [
                  {
                    borderColor: palette.border,
                    borderWidth: 1,
                    borderRadius: componentRadii.card,
                    backgroundColor: pressed ? palette.bgSoft : palette.surface,
                    overflow: "hidden",
                  },
                ]}
              >
                <Card style={{ padding: spacing[4], gap: spacing[3] }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                    <BellRing color={palette.orange} size={18} />
                    <View style={{ flex: 1, gap: spacing[1] }}>
                      <AppText variant="bodyBold">{venue.name}</AppText>
                      {[venue.unitNumber, venue.buildingName].filter(Boolean).length ? (
                        <AppText tone="secondary">
                          {[venue.unitNumber, venue.buildingName].filter(Boolean).join(" · ")}
                        </AppText>
                      ) : null}
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))}
            {missingCount > 0 ? (
              <AppText tone="secondary" variant="bodySmall">
                {describeMissingStalls(missingCount)}
              </AppText>
            ) : null}
          </>
        ) : (!isLoaded || isResolving) && !failed ? (
          <ProfileReviewsSkeleton />
        ) : !failed && missingCount > 0 ? (
          // You follow stalls, but none came back: not "No followed stalls yet".
          <EmptyState
            title="Couldn't show your followed stalls"
            body={describeMissingStalls(missingCount)}
            ctaLabel="Retry"
            onPress={onRetry}
          />
        ) : failed ? (
          <EmptyState
            title="Couldn't load followed stalls"
            body="Check your connection and try again."
            ctaLabel="Retry"
            onPress={onRetry}
          />
        ) : (
          <EmptyState
            title="No followed stalls yet"
            body="Tap Follow on a stall page to hear about its menu changes."
          />
        )}
      </View>
    </ProfileScreenShell>
  );
}
