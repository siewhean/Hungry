import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { AppText, Avatar, Button, Card, EmptyState } from "@/components/ui";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { unblockAccount } from "@/lib/security/communitySafety";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { BlockedAccount } from "@/lib/services/types";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";

function formatBlockedDate(iso: string): string | undefined {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

/** Settings > Privacy > Blocked accounts: who the signed-in user blocked, with an Unblock action. */
export function BlockedAccountsScreen() {
  const { spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const [accounts, setAccounts] = useState<BlockedAccount[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const load = useCallback((isCancelled: () => boolean = () => false) => {
    setLoadState("loading");
    getHungryService()
      .communitySafety.getBlockedAccounts()
      .then((next) => {
        if (isCancelled()) return;
        setAccounts(next);
        setLoadState("loaded");
      })
      .catch(() => {
        if (!isCancelled()) setLoadState("error");
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const handleUnblock = (account: BlockedAccount) => {
    if (unblockingId) return;
    setUnblockingId(account.blockedUserId);
    const name = account.displayName || "this account";
    void unblockAccount(account.blockedUserId)
      .then(() => {
        setAccounts((current) =>
          current.filter((entry) => entry.blockedUserId !== account.blockedUserId),
        );
        showToast({ message: `Unblocked ${name}.`, tone: "success" });
      })
      .catch(() => {
        trackAnalyticsEvent("user_unblock_failed", {});
        showToast({
          message: "Couldn't unblock. Check your connection and try again.",
          tone: "error",
        });
      })
      .finally(() => setUnblockingId(null));
  };

  return (
    <ProfileScreenShell
      title="Blocked accounts"
      subtitle="Blocked people can't see your posts and you won't see theirs."
      testID="blocked-accounts-screen"
    >
      {loadState === "loading" ? (
        <AppText tone="secondary" accessibilityLiveRegion="polite">
          Loading…
        </AppText>
      ) : null}
      {loadState === "error" ? (
        <EmptyState
          title="Couldn't load blocked accounts"
          body="Check your connection and try again."
          ctaLabel="Try again"
          onPress={() => load()}
        />
      ) : null}
      {loadState === "loaded" && accounts.length === 0 ? (
        <EmptyState
          title="No blocked accounts"
          body="When you block someone from a post or review, they appear here so you can unblock them."
        />
      ) : null}
      {loadState === "loaded" && accounts.length > 0 ? (
        <Card>
          <View style={{ gap: spacing[4] }}>
            {accounts.map((account) => {
              const name = account.displayName || "Hungry member";
              const blockedOn = formatBlockedDate(account.blockedAt);
              return (
                <View
                  key={account.blockedUserId}
                  style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}
                >
                  <Avatar uri={account.avatarUrl} name={name} size={44} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="bodyBold" numberOfLines={1}>
                      {name}
                    </AppText>
                    {blockedOn ? (
                      <AppText variant="micro" tone="muted">
                        Blocked on {blockedOn}
                      </AppText>
                    ) : null}
                  </View>
                  <Button
                    label="Unblock"
                    variant="secondary"
                    size="sm"
                    accessibilityLabel={`Unblock ${name}`}
                    loading={unblockingId === account.blockedUserId}
                    disabled={unblockingId !== null}
                    onPress={() => handleUnblock(account)}
                  />
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}
    </ProfileScreenShell>
  );
}
