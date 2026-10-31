import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, useWindowDimensions, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppSymbol, Avatar, Button, EmptyState, ListRow } from "@/components/ui";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { confirmHaptic } from "@/lib/haptics";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = NativeStackScreenProps<RootStackParamList, "FollowRequests">;

type FollowRequestItem = {
  userId: string;
  name: string;
  avatarUrl: string;
};

/** Rows per request; matches list_incoming_follow_requests' default page size. */
const FOLLOW_REQUESTS_PAGE_SIZE = 50;

function toRequestItems(rows: { userId: string; displayName: string; avatarUrl?: string }[]) {
  return rows
    .filter((row) => Boolean(row.userId))
    .map((row) => ({
      userId: row.userId,
      name: row.displayName.trim() || "Hungry User",
      avatarUrl: row.avatarUrl ?? "",
    }));
}

function mergeRequests(current: FollowRequestItem[], next: FollowRequestItem[]) {
  const seen = new Set(current.map((request) => request.userId));
  return [...current, ...next.filter((request) => !seen.has(request.userId))];
}

export function FollowRequestsScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  // On a 320pt phone two labelled buttons leave no room for the name, so Delete becomes an X.
  const compact = useWindowDimensions().width < 360;
  const [requests, setRequests] = useState<FollowRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  // Server rows fetched so far (offset for the next page) and whether another page may exist.
  const [loadedRowCount, setLoadedRowCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    Record<string, "approve" | "decline" | undefined>
  >({});

  const loadFirstPage = useCallback(() => {
    let isActive = true;
    setIsLoading(true);
    setLoadFailed(false);
    void getHungryService()
      .social.listFollowRequests({ limit: FOLLOW_REQUESTS_PAGE_SIZE, offset: 0 })
      .then((rows) => {
        if (!isActive) return;
        setRequests(toRequestItems(rows));
        setLoadedRowCount(rows.length);
        setHasMore(rows.length === FOLLOW_REQUESTS_PAGE_SIZE);
      })
      .catch((error) => {
        reportError(error, { screen: "FollowRequests", action: "load_requests" });
        if (!isActive) return;
        setLoadFailed(true);
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => loadFirstPage(), [loadFirstPage]);

  const loadMore = () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    void getHungryService()
      .social.listFollowRequests({ limit: FOLLOW_REQUESTS_PAGE_SIZE, offset: loadedRowCount })
      .then((rows) => {
        setRequests((current) => mergeRequests(current, toRequestItems(rows)));
        setLoadedRowCount((current) => current + rows.length);
        setHasMore(rows.length === FOLLOW_REQUESTS_PAGE_SIZE);
      })
      .catch((error) => {
        reportError(error, { screen: "FollowRequests", action: "load_more_requests" });
        showToast({ message: "Couldn't load more requests. Try again.", tone: "error" });
      })
      .finally(() => setIsLoadingMore(false));
  };

  const respond = (request: FollowRequestItem, action: "approve" | "decline") => {
    if (pendingAction[request.userId]) return;
    setPendingAction((current) => ({ ...current, [request.userId]: action }));
    const service = getHungryService().social;
    void (
      action === "approve"
        ? service.approveFollowRequest(request.userId)
        : service.declineFollowRequest(request.userId)
    )
      .then(() => {
        trackAnalyticsEvent(
          action === "approve" ? "follow_request_approved" : "follow_request_declined",
          {
            target_user_id: request.userId,
          },
        );
        if (action === "approve") confirmHaptic();
        setRequests((current) => current.filter((item) => item.userId !== request.userId));
        // The answered row left the server list, so the next page starts one earlier.
        setLoadedRowCount((current) => Math.max(0, current - 1));
        showToast({
          message:
            action === "approve"
              ? `${request.name} now follows you.`
              : `Declined ${request.name}'s request.`,
          tone: action === "approve" ? "success" : "info",
        });
      })
      .catch((error) => {
        reportError(error, { screen: "FollowRequests", action: `${action}_request` });
        showToast({
          message:
            action === "approve"
              ? "Couldn't approve the request. Please try again."
              : "Couldn't decline the request. Please try again.",
          tone: "error",
        });
      })
      .finally(() => {
        setPendingAction((current) => ({ ...current, [request.userId]: undefined }));
      });
  };

  return (
    <ProfileScreenShell title="Follow requests" testID="follow-requests-screen">
      {isLoading ? (
        <View style={{ alignItems: "center", paddingTop: spacing[3], gap: spacing[2] }}>
          <ActivityIndicator color={palette.orange} accessibilityLabel="Loading follow requests" />
          <EmptyState
            title="Loading follow requests"
            body="Fetching people who asked to follow you."
          />
        </View>
      ) : loadFailed ? (
        <EmptyState
          title="Couldn't load follow requests"
          body="Check your connection and try again."
          ctaLabel="Try again"
          onPress={loadFirstPage}
        />
      ) : requests.length ? (
        <View style={{ paddingBottom: spacing[5] }}>
          {requests.map((request, index) => {
            const action = pendingAction[request.userId];
            return (
              <ListRow
                key={request.userId}
                first={index === 0}
                title={request.name}
                subtitle="Wants to follow you"
                subtitleLines={2}
                accessibilityLabel={`Open ${request.name}'s profile`}
                leading={<Avatar name={request.name} uri={request.avatarUrl} size={44} />}
                onPress={() =>
                  navigation.navigate("UserProfile", {
                    authorName: request.name,
                    authorAvatarUrl: request.avatarUrl,
                    authorId: request.userId,
                  })
                }
                trailing={
                  <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
                    <Button
                      label="Confirm"
                      size="sm"
                      fullWidth={false}
                      loading={action === "approve"}
                      disabled={Boolean(action)}
                      accessibilityLabel={`Approve follow request from ${request.name}`}
                      onPress={() => respond(request, "approve")}
                    />
                    {compact ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Decline follow request from ${request.name}`}
                        accessibilityState={{
                          disabled: Boolean(action),
                          busy: action === "decline",
                        }}
                        disabled={Boolean(action)}
                        hitSlop={4}
                        onPress={() => respond(request, "decline")}
                        style={{
                          alignItems: "center",
                          height: 44,
                          justifyContent: "center",
                          width: 40,
                        }}
                      >
                        <AppSymbol name="close" size={18} color={palette.textSecondary} />
                      </Pressable>
                    ) : (
                      <Button
                        label="Delete"
                        variant="ghost"
                        size="sm"
                        fullWidth={false}
                        loading={action === "decline"}
                        disabled={Boolean(action)}
                        accessibilityLabel={`Decline follow request from ${request.name}`}
                        onPress={() => respond(request, "decline")}
                      />
                    )}
                  </View>
                }
              />
            );
          })}
          {hasMore ? (
            <Button
              label="Load more"
              variant="ghost"
              size="sm"
              loading={isLoadingMore}
              onPress={loadMore}
            />
          ) : null}
        </View>
      ) : (
        <EmptyState
          title="No follow requests"
          body="When someone asks to follow your private account, they'll show up here."
          icon={
            <AppSymbol
              name="followRequests"
              size={36}
              weight="regular"
              color={palette.textSecondary}
            />
          }
        />
      )}
    </ProfileScreenShell>
  );
}
