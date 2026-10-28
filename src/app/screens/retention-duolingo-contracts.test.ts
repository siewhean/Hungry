import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createRootLinking } from "@/app/navigation/linking";

const read = (path: string) => readFileSync(path, "utf8");

test("meal-time suggestions: opt-in, skip users already active today, open Decide for me", () => {
  const migration = read("supabase/migrations/20261019201000_mealtime_suggestions_push.sql");
  assert.match(
    migration,
    /add column if not exists mealtime_suggestions boolean not null default false/,
  );
  assert.match(migration, /where np\.mealtime_suggestions/);
  assert.match(migration, /not exists \([\s\S]*user_activity_days[\s\S]*activity_date = v_today/);
  assert.match(migration, /'merchant_low_rating', 'mealtime'/);
  assert.match(migration, /'30 3 \* \* \*'/);
  assert.match(migration, /'30 9 \* \* \*'/);
  assert.match(
    migration,
    /revoke all on function public\.enqueue_mealtime_notifications\(text\) from public, anon, authenticated/,
  );

  const worker = read("supabase/functions/send-notifications/index.ts");
  assert.match(worker, /mealtime_suggestions: false/);
  assert.match(worker, /isMealtime\s*\? !pref\.mealtime_suggestions/);
  assert.match(worker, /isMealtime \? MEALTIME_STALE_AFTER_MS : STALE_AFTER_MS/);
  assert.match(
    worker,
    /isMealtime && activeTodayUserIds\.has\(job\.user_id\)\) skipReason = "already_active"/,
  );

  const linking = createRootLinking("hungry://", () => ({
    isAuthReady: true,
    isAuthenticated: true,
  }));
  assert.deepEqual(linking.getStateFromPath("decide")?.routes?.[1], {
    name: "DecideForMeResult",
    params: { surface: "push" },
  });

  const settings = read("src/components/settings/StallAlertsSettings.tsx");
  assert.match(settings, /handleToggle\("mealtimeSuggestions", value\)/);
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /mealtime_suggestions: next\.mealtimeSuggestions/);
});

test("welcome back: only after more than a week away, behind welcome_back_v2", () => {
  const card = read("src/components/home/WelcomeBackCard.tsx");
  assert.match(card, /!isReturningAfterBreak\(snapshot\.state\)\) return null/);
  assert.match(card, /useExperimentVariant\("welcome_back_v2", \{ enabled: visible \}\)/);
  assert.match(card, /getWelcomeBackDishes\(snapshot\.previousActiveDate\)/);
  assert.match(card, /trackAnalyticsEvent\("welcome_back_shown"/);
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.match(home, /<WelcomeBackCard[\s\S]*?<WeeklyPicksRail/);
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(
    service,
    /\.from\("stall_follows"\)[\s\S]*?\.gte\("created_at", `\$\{sinceDate\}T00:00:00\+08:00`\)/,
  );
});

test("passport weekly goal: counted from tried items, celebrated once per week", () => {
  const screen = read("src/app/screens/profile/PassportScreen.tsx");
  assert.match(screen, /computeWeeklyGoal\(\[\.\.\.triedAtByItem\.values\(\)\]\)/);
  assert.match(screen, /celebratedGoalWeeks\[weeklyGoal\.weekKey\]/);
  assert.match(screen, /markGoalWeekCelebrated\(weeklyGoal\.weekKey\)/);
  assert.match(screen, /trackAnalyticsEvent\("weekly_goal_completed"/);
  assert.match(screen, /<WeeklyGoalCard/);
  const store = read("src/store/usePassportStore.ts");
  assert.match(store, /celebratedGoalWeeks: state\.celebratedGoalWeeks/);
  const card = read("src/components/gamification/WeeklyGoalCard.tsx");
  assert.match(card, /if \(!celebrating \|\| reduceMotion\) return;/);
  assert.match(card, /cancelAnimation\(pop\)/);
});
