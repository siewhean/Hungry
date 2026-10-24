import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { ArrowDown, ArrowUp, Pin, PinOff, RefreshCw, Users } from "lucide-react-native";

import {
  AppText,
  Avatar,
  Button,
  Card,
  EmptyState,
  InlineBanner,
  Screen,
  Skeleton,
} from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import { reportError } from "@/lib/monitoring/reportError";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { useHungryTheme } from "@/theme";
import type { PopularVisitorCandidate, PopularVisitorPin } from "@/types/domain";

/** Review candidates per page; "Load older reviews" fetches the next page. */
const CANDIDATE_PAGE_SIZE = 30;

export function FeaturedVisitorsScreen() {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const [pins, setPins] = useState<PopularVisitorPin[]>([]);
  const [candidates, setCandidates] = useState<PopularVisitorCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // A failed load replaces the screen; a failed pin, unpin or reorder only shows a banner.
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hasMoreCandidates, setHasMoreCandidates] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const pinnedReviewIds = useMemo(() => new Set(pins.map((pin) => pin.reviewId)), [pins]);

  const loadVisitors = useCallback(async () => {
    if (!activeOutlet) {
      setPins([]);
      setCandidates([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    setActionError(null);
    try {
      const merchant = getHungryService().merchant;
      const [activePins, reviewCandidates] = await Promise.all([
        merchant.listPopularVisitorPins(activeOutlet.id),
        merchant.listPopularVisitorCandidates(activeOutlet.id, { limit: CANDIDATE_PAGE_SIZE }),
      ]);
      setPins(activePins);
      setCandidates(reviewCandidates);
      setHasMoreCandidates(reviewCandidates.length >= CANDIDATE_PAGE_SIZE);
    } catch (caughtError) {
      reportError(caughtError, { screen: "FeaturedVisitors", action: "load" });
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to load featured visitors.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet]);

  useEffect(() => {
    void loadVisitors();
  }, [loadVisitors]);

  const loadMoreCandidates = useCallback(async () => {
    const oldest = candidates[candidates.length - 1];
    if (!activeOutlet || !oldest || isLoadingMore) return;
    setIsLoadingMore(true);
    setActionError(null);
    try {
      const older = await getHungryService().merchant.listPopularVisitorCandidates(
        activeOutlet.id,
        { limit: CANDIDATE_PAGE_SIZE, before: oldest.visitedAt, beforeId: oldest.reviewId },
      );
      setCandidates((current) => {
        const known = new Set(current.map((item) => item.reviewId));
        return [...current, ...older.filter((item) => !known.has(item.reviewId))];
      });
      setHasMoreCandidates(older.length >= CANDIDATE_PAGE_SIZE);
    } catch (caughtError) {
      reportError(caughtError, { screen: "FeaturedVisitors", action: "load_more" });
      setActionError(
        caughtError instanceof Error ? caughtError.message : "Unable to load older reviews.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeOutlet, candidates, isLoadingMore]);

  const handlePin = useCallback(
    async (candidate: PopularVisitorCandidate) => {
      if (!activeOutlet || pins.length >= 6) return;
      setBusyId(candidate.reviewId);
      setActionError(null);
      try {
        const pin = await getHungryService().merchant.pinPopularVisitor(
          activeOutlet.id,
          candidate.reviewId,
        );
        // Update from the mutation result instead of refetching both lists.
        setPins((current) => [...current.filter((item) => item.id !== pin.id), pin]);
      } catch (caughtError) {
        reportError(caughtError, { screen: "FeaturedVisitors", action: "pin" });
        setActionError(
          caughtError instanceof Error ? caughtError.message : "Unable to pin visitor.",
        );
      } finally {
        setBusyId(null);
      }
    },
    [activeOutlet, pins.length],
  );

  const handleUnpin = useCallback(async (pinId: string) => {
    setBusyId(pinId);
    setActionError(null);
    try {
      await getHungryService().merchant.unpinPopularVisitor(pinId);
      setPins((current) => current.filter((pin) => pin.id !== pinId));
    } catch (caughtError) {
      reportError(caughtError, { screen: "FeaturedVisitors", action: "unpin" });
      setActionError(
        caughtError instanceof Error ? caughtError.message : "Unable to unpin visitor.",
      );
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleMove = useCallback(
    async (pinId: string, direction: -1 | 1) => {
      if (!activeOutlet) return;
      const index = pins.findIndex((pin) => pin.id === pinId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= pins.length) return;
      const previousPins = pins;
      const reordered = [...pins];
      const [current] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, current);
      setPins(reordered.map((pin, sortOrder) => ({ ...pin, sortOrder })));
      setBusyId(pinId);
      setActionError(null);
      try {
        const updated = await getHungryService().merchant.reorderPopularVisitorPins(
          activeOutlet.id,
          reordered.map((pin) => pin.id),
        );
        setPins(updated);
      } catch (caughtError) {
        reportError(caughtError, { screen: "FeaturedVisitors", action: "reorder" });
        setPins(previousPins);
        setActionError(
          caughtError instanceof Error ? caughtError.message : "Unable to reorder visitors.",
        );
      } finally {
        setBusyId(null);
      }
    },
    [activeOutlet, pins],
  );

  if (!activeOutlet) {
    return (
      <Screen title="Featured visitors">
        <EmptyState
          title="No outlet selected"
          body="Select or create an outlet before featuring visitor reviews."
          icon={<Users size={48} color={palette.textMuted} />}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Featured visitors"
      subtitle={activeOutlet.name}
      headerRight={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reload featured visitors"
          onPress={loadVisitors}
          style={{
            minHeight: 40,
            minWidth: 40,
            borderRadius: componentRadii.iconButton,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: palette.surface,
            borderWidth: 1,
            borderColor: palette.border,
          }}
        >
          <RefreshCw size={18} color={palette.textSecondary} />
        </Pressable>
      }
    >
      <View style={{ gap: spacing[5], width: "100%" }}>
        {isLoading ? (
          <View style={{ gap: spacing[3] }}>
            <Skeleton height={120} borderRadius={componentRadii.card} />
            <Skeleton height={120} borderRadius={componentRadii.card} />
            <Skeleton height={120} borderRadius={componentRadii.card} />
          </View>
        ) : error ? (
          <EmptyState
            title="Unable to load visitors"
            body="Try reloading the visitor list."
            errorMessage={error}
            sendErrorContext="Featured visitors"
            ctaLabel="Reload"
            onPress={loadVisitors}
          />
        ) : (
          <>
            {actionError ? <InlineBanner tone="error" message={actionError} /> : null}
            <View style={{ gap: spacing[3] }}>
              <View>
                <AppText variant="h3">Pinned visitors</AppText>
                <AppText variant="bodySmall" tone="muted">
                  {pins.length}/6 active visitor reviews shown on the stall page
                </AppText>
              </View>
              {pins.length === 0 ? (
                <Card style={{ padding: spacing[4] }}>
                  <AppText variant="bodySmall" tone="muted">
                    No visitor reviews are pinned yet.
                  </AppText>
                </Card>
              ) : (
                pins.map((pin, index) => (
                  <Card key={pin.id} style={{ padding: spacing[4], gap: spacing[3] }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                      {/* Names only: a diner's profile photo is not copied onto the stall page. */}
                      <Avatar name={pin.authorName} size={44} />
                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyBold">{pin.authorName}</AppText>
                        <AppText variant="bodySmall" tone="muted">
                          {pin.dishName ?? "Review"} - {pin.visitedAt.slice(0, 10)}
                        </AppText>
                      </View>
                      <Button
                        label="Unpin"
                        variant="ghost"
                        size="sm"
                        fullWidth={false}
                        loading={busyId === pin.id}
                        leftIcon={<PinOff size={15} color={palette.textSecondary} />}
                        onPress={() => handleUnpin(pin.id)}
                      />
                    </View>
                    <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>
                      {pin.reviewText}
                    </AppText>
                    <View style={{ flexDirection: "row", gap: spacing[2] }}>
                      <Button
                        label="Move up"
                        variant="secondary"
                        size="sm"
                        fullWidth={false}
                        disabled={index === 0 || busyId === pin.id}
                        leftIcon={<ArrowUp size={15} color={palette.textSecondary} />}
                        onPress={() => handleMove(pin.id, -1)}
                      />
                      <Button
                        label="Move down"
                        variant="secondary"
                        size="sm"
                        fullWidth={false}
                        disabled={index === pins.length - 1 || busyId === pin.id}
                        leftIcon={<ArrowDown size={15} color={palette.textSecondary} />}
                        onPress={() => handleMove(pin.id, 1)}
                      />
                    </View>
                  </Card>
                ))
              )}
            </View>

            <View style={{ gap: spacing[3], paddingBottom: spacing[12] }}>
              <View>
                <AppText variant="h3">Review candidates</AppText>
                <AppText variant="bodySmall" tone="muted">
                  Only review-backed visitors can be featured.
                </AppText>
              </View>
              {candidates.map((candidate) => {
                const isPinned = pinnedReviewIds.has(candidate.reviewId);
                return (
                  <Card key={candidate.reviewId} style={{ padding: spacing[4], gap: spacing[3] }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                      <Avatar name={candidate.authorName} size={44} />
                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyBold">{candidate.authorName}</AppText>
                        <AppText variant="bodySmall" tone="muted">
                          {candidate.dishName ?? "Review"} - {candidate.visitedAt.slice(0, 10)}
                        </AppText>
                      </View>
                      <Button
                        label={isPinned ? "Pinned" : "Pin"}
                        variant={isPinned ? "secondary" : "primary"}
                        size="sm"
                        fullWidth={false}
                        disabled={isPinned || pins.length >= 6}
                        loading={busyId === candidate.reviewId}
                        leftIcon={
                          <Pin
                            size={15}
                            color={isPinned ? palette.textSecondary : palette.textOnDark}
                          />
                        }
                        onPress={() => handlePin(candidate)}
                      />
                    </View>
                    <AppText variant="bodySmall" tone="secondary" numberOfLines={3}>
                      {candidate.reviewText}
                    </AppText>
                  </Card>
                );
              })}
              {hasMoreCandidates ? (
                <Button
                  label={isLoadingMore ? "Loading..." : "Load older reviews"}
                  variant="secondary"
                  loading={isLoadingMore}
                  disabled={isLoadingMore}
                  onPress={() => void loadMoreCandidates()}
                />
              ) : null}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
