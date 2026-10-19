import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Avatar, Button, Card, EmptyState } from "@/components/ui";
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
  const { componentRadii, palette, spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const [requests, setRequests] = useState<FollowRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    setLoadError(null);
    void getHungryService()
      .social.listFollowRequests({ limit: FOLLOW_REQUESTS_PAGE_SIZE, offset: 0 })
      .then((rows) => {
        if (!isActive) return;
        setRequests(toRequestItems(rows));
        setLoadedRowCount(rows.length);
        setHasMore(rows.length === FOLLOW_REQUESTS_PAGE_SIZE);
      })
      .catch((error) => {
        console.error("Failed to load follow requests:", error);
        if (!isActive) return;
        setLoadError(error instanceof Error ? error.message : String(error));
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
        console.error("Failed to load more follow requests:", error);
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
        console.error(`Failed to ${action} follow request:`, error);
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
      ) : loadError ? (
        <EmptyState
          title="Couldn't load follow requests"
          body="Check your connection and try again."
          errorMessage={loadError}
          sendErrorContext="Follow requests"
          ctaLabel="Try again"
          onPress={loadFirstPage}
        />
      ) : requests.length ? (
        <View style={{ gap: spacing[3], paddingBottom: spacing[5] }}>
          {requests.map((request) => {
            const action = pendingAction[request.userId];
            return (
              <Card key={request.userId} style={{ padding: spacing[3] }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${request.name}'s profile`}
                    onPress={() =>
                      navigation.navigate("UserProfile", {
                        authorName: request.name,
                        authorAvatarUrl: request.avatarUrl,
                        authorId: request.userId,
                      })
                    }
                    style={({ pressed }) => ({
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing[3],
                      minWidth: 0,
                      borderRadius: componentRadii.button,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Avatar name={request.name} uri={request.avatarUrl} size={44} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <AppText variant="bodyBold" numberOfLines={1}>
                        {request.name}
                      </AppText>
                      <AppText variant="micro" tone="secondary">
                        Wants to follow you
                      </AppText>
                    </View>
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", gap: spacing[2], marginTop: spacing[3] }}>
                  <Button
                    label="Approve"
                    size="sm"
                    fullWidth={false}
                    style={{ flex: 1 }}
                    loading={action === "approve"}
                    disabled={Boolean(action)}
                    accessibilityLabel={`Approve follow request from ${request.name}`}
                    onPress={() => respond(request, "approve")}
                  />
                  <Button
                    label="Decline"
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    style={{ flex: 1 }}
                    loading={action === "decline"}
                    disabled={Boolean(action)}
                    accessibilityLabel={`Decline follow request from ${request.name}`}
                    onPress={() => respond(request, "decline")}
                  />
                </View>
              </Card>
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
        />
      )}
    </ProfileScreenShell>
  );
}
