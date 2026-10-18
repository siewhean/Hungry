import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { getHungryService, setMockServiceProvider } from "@/lib/services/serviceProvider";
import { DEFAULT_PUSH_PREFERENCES } from "@/types/domain";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("stall alerts only fire for verified merchant changes and respect user limits", () => {
  const migration = read("supabase/migrations/20261018003000_retention_follows_push_alerts.sql");
  assert.match(
    migration,
    /v_actor is null or not public\.merchant_can_manage_venue\(new\.venue_id\)/,
  );
  assert.match(migration, /on np\.user_id = sf\.user_id and np\.stall_updates/);
  assert.match(migration, /on conflict \(dedupe_key\) do nothing/);
  assert.match(migration, /stall_updates boolean not null default false/);
  assert.match(migration, /where p\.id = p_portfolio_id and p\.visibility = 'public'/);

  const worker = read("supabase/functions/send-notifications/index.ts");
  for (const reason of ["opted_out", "stale", "no_longer_relevant", "weekly_cap", "no_device"]) {
    assert.match(worker, new RegExp(`"${reason}"`));
  }
  assert.match(worker, /isQuietHour\(hour, pref\.quiet_start_hour, pref\.quiet_end_hour\)/);
  assert.match(worker, /DeviceNotRegistered/);
  assert.match(
    read("supabase/config.toml"),
    /\[functions\.send-notifications\]\nverify_jwt = false/,
  );
});

test("push alerts are opt-in and tapped alerts open through deep link rules", () => {
  assert.equal(DEFAULT_PUSH_PREFERENCES.stallUpdates, false);
  assert.match(read("src/app/screens/profile/SettingsScreen.tsx"), /<StallAlertsSettings/);
  const push = read("src/lib/notifications/push.ts");
  assert.match(push, /trackAnalyticsEvent\("notification_opened"/);
  assert.match(push, /push\.markOpened\(notificationId\)/);
  const root = read("src/app/navigation/RootNavigator.tsx");
  assert.match(root, /getInitialNotificationUrl\(\)/);
  assert.match(root, /subscribeToNotificationOpens\(listener\)/);
});

test("follow a stall is tracked and listed in Profile", async () => {
  assert.match(read("src/app/screens/detail/StallDetailScreen.tsx"), /<FollowStallButton/);
  assert.match(read("src/store/useStallFollowStore.ts"), /"stall_followed" : "stall_unfollowed"/);
  assert.match(read("src/app/screens/profile/ProfileStack.tsx"), /name="FollowedStalls"/);

  setMockServiceProvider();
  const service = getHungryService();
  await service.profile.setStallFollow("venue-test", true);
  assert.ok((await service.profile.getFollowedStallIds()).includes("venue-test"));
  await service.profile.setStallFollow("venue-test", false);
  assert.ok(!(await service.profile.getFollowedStallIds()).includes("venue-test"));
});

test("public lists ship in production with real share actions", () => {
  assert.match(read("src/constants/featureFlags.ts"), /portfoliosEnabled: true/);
  const detail = read("src/app/screens/portfolio/PortfolioDetailScreen.tsx");
  assert.match(detail, /kind: "portfolio"/);
  assert.match(detail, /webShareUrl\("portfolio", portfolio\.id\)/);
  assert.match(read("src/features/share/messagingShare.ts"), /"collection_shared"/);
  for (const page of ["dish", "stall", "portfolio"]) {
    assert.ok(
      read(`marketing/website/web-v2/src/app/${page}/[id]/page.tsx`).includes("SharePreview"),
    );
  }
});

test("weekly picks push is a separate opt-out that reuses the outbox, cap and quiet hours", () => {
  const migration = read("supabase/migrations/20261018092000_weekly_picks_push.sql");
  assert.match(migration, /add column if not exists weekly_picks boolean not null default true/);
  assert.match(migration, /check \(category in \('stall_update', 'weekly_picks'\)\)/);
  assert.match(migration, /from \(select distinct user_id from public\.user_push_tokens\) t/);
  assert.match(migration, /where coalesce\(np\.weekly_picks, true\)/);
  assert.match(migration, /'IYYY-"W"IW'/);
  assert.match(migration, /on conflict \(dedupe_key\) do nothing/);
  assert.match(migration, /'Your new picks are ready'/);
  assert.match(migration, /'https:\/\/usehungry\.com\/home'/);
  assert.match(migration, /security definer\s+set search_path = ''/);
  assert.match(migration, /'weekly-picks-notifications',\s*'0 3 \* \* 1'/);
  assert.match(
    migration,
    /revoke all on function public\.enqueue_weekly_picks_notifications\(\) from public, anon, authenticated/,
  );

  const worker = read("supabase/functions/send-notifications/index.ts");
  assert.match(worker, /weekly_picks: true/);
  assert.match(
    worker,
    /isWeeklyPicks \? !pref\.weekly_picks : !pref\.stall_updates\) skipReason = "opted_out"/,
  );
  assert.match(worker, /!isWeeklyPicks && \(!dish \|\| isSoldOut/);
  assert.match(worker, /sentThisWeek\.get\(job\.user_id\) \?\? 0\) >= pref\.weekly_cap/);
});
