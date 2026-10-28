import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { AppText, Avatar, Button, Card, EmptyState } from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { reportError } from "@/lib/monitoring/reportError";
import { unblockUserForSession, unhidePostForSession } from "@/lib/security/communitySafety";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { BlockedUserEntry, HiddenPostEntry } from "@/lib/services/types";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";

// Hidden posts belong to the archived social feed; while it is off only blocks are listed.
const showHiddenPosts = FEATURE_FLAGS.socialFeedEnabled;

/** The Settings row and screen title. */
export const BLOCKED_AND_HIDDEN_TITLE = showHiddenPosts ? "Blocked and hidden" : "Blocked people";

/** Settings > Blocked people: undo a block (and a hidden post while the social feed is on). */
export function BlockedAndHiddenScreen() {
  const { palette, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const [blocked, setBlocked] = useState<BlockedUserEntry[]>([]);
  const [hidden, setHidden] = useState<HiddenPostEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    let isActive = true;
    setIsLoading(true);
    setLoadError(null);
    const safety = getHungryService().communitySafety;
    void Promise.all([
      safety.listBlockedUsers(),
      showHiddenPosts ? safety.listHiddenPosts() : Promise.resolve<HiddenPostEntry[]>([]),
    ])
      .then(([blockedRows, hiddenRows]) => {
        if (!isActive) return;
        setBlocked(blockedRows);
        setHidden(hiddenRows);
      })
      .catch((error: unknown) => {
        reportError(error, { area: "blocked_and_hidden_load" });
        if (!isActive) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => load(), [load]);

  const unblock = (entry: BlockedUserEntry) => {
    if (busyId) return;
    const name = entry.displayName?.trim() || "this user";
    setBusyId(entry.blockedUserId);
    void unblockUserForSession(entry.blockedUserId)
      .then(() => {
        setBlocked((current) => current.filter((row) => row.blockedUserId !== entry.blockedUserId));
        showToast({ message: `Unblocked ${name}.`, tone: "success" });
      })
      .catch((error: unknown) => {
        reportError(error, { area: "blocked_and_hidden_unblock" });
        showToast({ message: "Could not unblock. Please try again.", tone: "error" });
      })
      .finally(() => setBusyId(null));
  };

  const unhide = (entry: HiddenPostEntry) => {
    if (busyId) return;
    setBusyId(entry.postId);
    void unhidePostForSession(entry.postId)
      .then(() => {
        setHidden((current) => current.filter((row) => row.postId !== entry.postId));
        showToast({ message: "Post will show in your feed again.", tone: "success" });
      })
      .catch((error: unknown) => {
        reportError(error, { area: "blocked_and_hidden_unhide" });
        showToast({ message: "Could not unhide. Please try again.", tone: "error" });
      })
      .finally(() => setBusyId(null));
  };

  return (
    <ProfileScreenShell title={BLOCKED_AND_HIDDEN_TITLE} testID="blocked-and-hidden-screen">
      {isLoading ? (
        <View style={{ alignItems: "center", paddingTop: spacing[3] }}>
          <ActivityIndicator color={palette.orange} accessibilityLabel="Loading" />
        </View>
      ) : loadError ? (
        <EmptyState
          title="Couldn't load this list"
          body="Check your connection and try again."
          errorMessage={loadError}
          sendErrorContext="Blocked and hidden"
          ctaLabel="Try again"
          onPress={load}
        />
      ) : (
        <View style={{ gap: spacing[5], paddingBottom: spacing[5] }}>
          <View style={{ gap: spacing[3] }}>
            <AppText variant="h3" accessibilityRole="header">
              Blocked people
            </AppText>
            {blocked.length ? (
              blocked.map((entry) => {
                const name = entry.displayName?.trim() || "Hungry User";
                return (
                  <Card key={entry.blockedUserId} style={{ padding: spacing[3] }}>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
                      <Avatar name={name} uri={entry.avatarUrl} size={44} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <AppText variant="bodyBold" numberOfLines={1}>
                          {name}
                        </AppText>
                      </View>
                      <Button
                        label="Unblock"
                        variant="secondary"
                        size="sm"
                        fullWidth={false}
                        loading={busyId === entry.blockedUserId}
                        disabled={Boolean(busyId)}
                        accessibilityLabel={`Unblock ${name}`}
                        onPress={() => unblock(entry)}
                      />
                    </View>
                  </Card>
                );
              })
            ) : (
              <AppText tone="secondary">You haven&apos;t blocked anyone.</AppText>
            )}
          </View>

          {showHiddenPosts ? (
            <View style={{ gap: spacing[3] }}>
              <AppText variant="h3" accessibilityRole="header">
                Hidden posts
              </AppText>
              {hidden.length ? (
                hidden.map((entry) => {
                  const title = entry.dishName?.trim() || entry.caption?.trim() || "Post";
                  const subtitle = [entry.authorName?.trim(), entry.venueName?.trim()]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <Card key={entry.postId} style={{ padding: spacing[3] }}>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <AppText variant="bodyBold" numberOfLines={1}>
                            {title}
                          </AppText>
                          {subtitle ? (
                            <AppText variant="micro" tone="secondary" numberOfLines={1}>
                              {subtitle}
                            </AppText>
                          ) : null}
                        </View>
                        <Button
                          label="Unhide"
                          variant="secondary"
                          size="sm"
                          fullWidth={false}
                          loading={busyId === entry.postId}
                          disabled={Boolean(busyId)}
                          accessibilityLabel={`Unhide ${title}`}
                          onPress={() => unhide(entry)}
                        />
                      </View>
                    </Card>
                  );
                })
              ) : (
                <AppText tone="secondary">You haven&apos;t hidden any posts.</AppText>
              )}
            </View>
          ) : null}
        </View>
      )}
    </ProfileScreenShell>
  );
}
