import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  clearTrackedAnalyticsEvents,
  setAnalyticsSink,
  trackAnalyticsEvent,
  type AnalyticsEventRecord,
} from "@/lib/analytics";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("events tracked before the PostHog sink attaches are replayed to it", () => {
  setAnalyticsSink(null);
  clearTrackedAnalyticsEvents();
  trackAnalyticsEvent("app_launched", { is_authenticated: false });
  trackAnalyticsEvent("shared_link_opened", { route: "DishDetail" });

  const seen: AnalyticsEventRecord[] = [];
  setAnalyticsSink((event) => seen.push(event), { replayBufferedEvents: true });
  trackAnalyticsEvent("dish_viewed", { dish_id: "d1" });
  setAnalyticsSink(null);
  clearTrackedAnalyticsEvents();

  assert.deepEqual(
    seen.map((event) => event.event),
    ["app_launched", "shared_link_opened", "dish_viewed"],
  );
  assert.match(
    read("src/hooks/useAppBootstrap.ts"),
    /setAnalyticsSink\(posthogSink, \{ replayBufferedEvents: true \}\)/,
  );
  assert.match(read("src/lib/analytics/posthogSink.ts"), /captureAppLifecycleEvents: true/);
});

test("sign-out unbinds this device's push token before ending the Supabase session", () => {
  const session = read("src/store/useSessionStore.ts");
  assert.match(
    session,
    /service\.push\.unregisterPushToken\(\)[\s\S]*?\.then\(\(\) => service\.auth\.signOut\(\)\)/,
  );
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /client\.rpc\("unregister_push_token", \{ p_token: token \}\)/);
  assert.match(service, /await rememberRegisteredPushToken\(token\);/);

  const migration = read(
    "supabase/migrations/20261018091000_push_token_unbind_mood_search_slot.sql",
  );
  assert.match(migration, /where token = p_token\s+and user_id = v_user_id;/);
  assert.match(
    migration,
    /grant execute on function public\.unregister_push_token\(text\) to authenticated;/,
  );
});

test("sign_in_completed is logged once per sign-in and identity flags are accurate", () => {
  const session = read("src/store/useSessionStore.ts");
  assert.equal(session.match(/trackAnalyticsEvent\("sign_in_completed"/g)?.length, 1);
  assert.equal(session.match(/trackSignInCompletedOnce\(profileId, \{/g)?.length, 2);
  assert.match(session, /has_precise_location: location\.permission === "granted"/);
});

test("account deletion reports success once queued, and the grace prompt can't be dismissed", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /await this\.signOut\(\)\.catch\(\(\) => undefined\);/);
  assert.match(
    read("src/features/auth/useAccountDeletionGracePrompt.ts"),
    /\{ cancelable: false \}/,
  );
});

test("share attribution survives a relaunch for seven days", () => {
  const source = read("src/features/share/shareAttribution.ts");
  assert.match(source, /ATTRIBUTION_TTL_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(source, /export async function hydrateShareAttribution/);
  assert.match(read("src/hooks/useAppBootstrap.ts"), /void hydrateShareAttribution\(\);/);
});

test("share attribution is cleared once a signup is credited to it", async () => {
  const { clearShareAttribution, getShareAttribution, rememberShareAttribution } =
    await import("@/features/share/shareAttribution");
  rememberShareAttribution({ source: "whatsapp", route: "DishDetail" });
  assert.deepEqual(getShareAttribution(), { source: "whatsapp", route: "DishDetail" });
  clearShareAttribution();
  assert.equal(getShareAttribution(), null);

  // sign_up_completed is logged in one place, the session store, which credits the share tag.
  assert.match(
    read("src/store/useSessionStore.ts"),
    /"sign_up_completed",[\s\S]*if \(shareAttribution\) clearShareAttribution\(\);/,
  );
  assert.doesNotMatch(
    read("src/app/screens/auth/EmailVerificationScreen.tsx"),
    /sign_up_completed/,
  );
});

test("GPS refreshes on foreground and first follow asks for push inline", () => {
  const bootstrap = read("src/hooks/useAppBootstrap.ts");
  assert.match(bootstrap, /AppState\.addEventListener\("change"/);
  assert.match(bootstrap, /useLocationStore\.getState\(\)\.refreshLocation\(\)/);
  // A cold launch always re-reads GPS so a user who moved isn't stuck on the old area.
  assert.match(bootstrap, /onFinishHydration\(refreshLocationOnLaunch\)/);
  assert.match(bootstrap, /refreshLocation\(\{ force: true \}\)/);

  const follow = read("src/components/stall/FollowStallButton.tsx");
  assert.match(follow, /registerForStallAlerts\(\)/);
  assert.match(follow, /FEATURE_FLAGS\.stallAlertsEnabled && isFirstFollow/);

  assert.match(
    read("src/app/screens/profile/SettingsScreen.tsx"),
    /rootNavigation\.navigate\("MainTabs", \{\s*screen: "Profile",\s*params: \{ screen: "FollowedStalls" \},/,
  );
  assert.match(read("src/store/useProfileStore.ts"), /trackAnalyticsEvent\("activated"/);
});
