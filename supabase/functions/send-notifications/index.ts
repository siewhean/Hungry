// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { timingSafeEqual } from "../_shared/timingSafeEqual.ts";

// Drains public.notification_jobs (filled by the dishes trigger, the weekly
// picks, meal-time and like-digest crons, the follow-request trigger and the merchant
// low-rating reviews trigger) and sends Expo
// pushes. Each job is rechecked before sending: the user (or, for low-rating
// alerts, the merchant account) still opted in, the dish (if any) still exists
// and is not sold out, the review (if any) is not hidden by moderation, outside
// the user's quiet hours (Singapore time; consumer pushes only), under their
// weekly cap (consumer pushes only), and not older than 48 hours (two hours
// for meal-time suggestions, which are also skipped once the user has opened
// the app that Singapore day). Low-rating
// alerts open Merchant Centre, so they are only sent when the
// MERCHANT_ALERTS_ENABLED secret is "true" (set it when Merchant Centre ships).

type JsonObject = Record<string, unknown>;

// Matches the column defaults in notification_preferences; used when a user
// has a push token but never saved preferences (weekly picks is on by default).
const DEFAULT_PREFERENCES = {
  stall_updates: false,
  weekly_picks: true,
  mealtime_suggestions: false,
  // Likes, follows and follow requests: on by default, one switch.
  social_activity: true,
  quiet_start_hour: 22,
  quiet_end_hour: 8,
  weekly_cap: 3,
};

const MAX_BATCH_SIZE = 500;
const MAX_ATTEMPTS = 3;
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;
// A lunch nudge at 3pm is noise: meal-time jobs expire after two hours.
const MEALTIME_STALE_AFTER_MS = 2 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const ANDROID_CHANNEL_ID = "stall-updates";
const MERCHANT_LOW_RATING = "merchant_low_rating";
const MEALTIME = "mealtime";
// A follow request is something a person is waiting on, so it never counts toward the
// weekly cap and is never held back by it. Like digests (one a day) do count.
const SOCIAL_FOLLOW_REQUEST = "social_follow_request";

function toJson(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function parseLimit(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(parsed)));
}

function singaporeHour(now: Date): number {
  return (now.getUTCHours() + 8) % 24;
}

function singaporeDate(now: Date): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isQuietHour(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

function isSoldOut(flags: unknown): boolean {
  return (Array.isArray(flags) ? flags : []).some(
    (flag) =>
      String(flag)
        .toLowerCase()
        .replace(/[\s-]+/g, "_") === "sold_out",
  );
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return toJson(405, { error: "method_not_allowed" });
  }

  const workerToken = Deno.env.get("NOTIFICATION_WORKER_TOKEN") ?? "";
  if (!workerToken || !timingSafeEqual(getBearerToken(request), workerToken)) {
    return toJson(401, { error: "unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return toJson(500, { error: "missing_supabase_env" });
  }
  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN") ?? "";
  const merchantAlertsEnabled = Deno.env.get("MERCHANT_ALERTS_ENABLED") === "true";

  const payload = (await request.json().catch(() => ({}))) as JsonObject;
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: jobs, error: claimError } = await client.rpc("claim_notification_jobs", {
    p_limit: parseLimit(payload.limit),
  });
  if (claimError) {
    return toJson(500, { error: "claim_failed", detail: claimError.message });
  }
  if (!jobs?.length) {
    return toJson(200, { claimed: 0 });
  }

  const now = new Date();
  const userIds = [...new Set(jobs.map((job) => job.user_id))];
  const merchantJobs = jobs.filter((job) => job.category === MERCHANT_LOW_RATING);
  const dishIds = [
    ...new Set(
      jobs
        .filter((job) => job.category !== MERCHANT_LOW_RATING)
        .map((job) => job.dish_id)
        .filter(Boolean),
    ),
  ];
  const reviewIds = [...new Set(merchantJobs.map((job) => job.review_id).filter(Boolean))];
  const merchantAccountIds = [
    ...new Set(merchantJobs.map((job) => job.merchant_account_id).filter(Boolean)),
  ];

  const [
    { data: prefs },
    { data: tokens },
    { data: dishes },
    { data: recentSent },
    { data: reviews },
    { data: hiddenReviews },
    { data: merchantPrefs },
    { data: activeToday },
  ] = await Promise.all([
    client.from("notification_preferences").select("*").in("user_id", userIds),
    client.from("user_push_tokens").select("token, user_id").in("user_id", userIds),
    client.from("dishes").select("id, availability_flags").in("id", dishIds),
    client
      .from("notification_jobs")
      .select("user_id")
      .eq("status", "sent")
      .not("category", "in", `(${MERCHANT_LOW_RATING},${SOCIAL_FOLLOW_REQUEST})`)
      .gte("sent_at", new Date(now.getTime() - WEEK_MS).toISOString())
      .in("user_id", userIds),
    client.from("reviews").select("id").in("id", reviewIds),
    client
      .from("review_moderation_states")
      .select("review_id")
      .in("state", ["hidden", "removed"])
      .in("review_id", reviewIds),
    client
      .from("merchant_notification_preferences")
      .select("merchant_account_id, low_rating_alerts")
      .in("merchant_account_id", merchantAccountIds),
    client
      .from("user_activity_days")
      .select("user_id")
      .eq("activity_date", singaporeDate(now))
      .in("user_id", userIds),
  ]);

  const activeTodayUserIds = new Set((activeToday ?? []).map((row) => row.user_id));
  const prefsByUser = new Map((prefs ?? []).map((row) => [row.user_id, row]));
  const dishesById = new Map((dishes ?? []).map((row) => [row.id, row]));
  const liveReviewIds = new Set((reviews ?? []).map((row) => row.id));
  for (const row of hiddenReviews ?? []) liveReviewIds.delete(row.review_id);
  const lowRatingOffAccounts = new Set(
    (merchantPrefs ?? [])
      .filter((row) => row.low_rating_alerts === false)
      .map((row) => row.merchant_account_id),
  );
  const tokensByUser = new Map<string, string[]>();
  for (const row of tokens ?? []) {
    tokensByUser.set(row.user_id, [...(tokensByUser.get(row.user_id) ?? []), row.token]);
  }
  const sentThisWeek = new Map<string, number>();
  for (const row of recentSent ?? []) {
    sentThisWeek.set(row.user_id, (sentThisWeek.get(row.user_id) ?? 0) + 1);
  }

  const results = { sent: 0, skipped: 0, deferred: 0, failed: 0 };
  const hour = singaporeHour(now);

  const finish = async (jobId: string, fields: JsonObject) => {
    await client
      .from("notification_jobs")
      .update({ locked_at: null, ...fields })
      .eq("id", jobId);
  };

  // Jobs that are skipped or deferred send nothing, so their status updates are grouped by
  // identical fields and written once each after the loop instead of one UPDATE per job.
  const queuedFinishes = new Map<string, { fields: JsonObject; jobIds: string[] }>();
  // Tokens Expo reports as unregistered are removed together after the loop.
  const deadTokensToRemove = new Set<string>();
  const queueFinish = (jobId: string, fields: JsonObject) => {
    const key = JSON.stringify(fields);
    const group = queuedFinishes.get(key) ?? { fields, jobIds: [] };
    group.jobIds.push(jobId);
    queuedFinishes.set(key, group);
  };

  for (const job of jobs) {
    const pref = { ...DEFAULT_PREFERENCES, ...(prefsByUser.get(job.user_id) ?? {}) };
    const isWeeklyPicks = job.category === "weekly_picks";
    const isLowRating = job.category === MERCHANT_LOW_RATING;
    const isMealtime = job.category === MEALTIME;
    const isSocial = job.category.startsWith("social_");
    const isFollowRequest = job.category === SOCIAL_FOLLOW_REQUEST;
    const dish = job.dish_id ? dishesById.get(job.dish_id) : null;
    let skipReason: string | null = null;

    if (isLowRating && !merchantAlertsEnabled) skipReason = "merchant_alerts_disabled";
    else if (
      isLowRating
        ? lowRatingOffAccounts.has(job.merchant_account_id)
        : isSocial
          ? !pref.social_activity
          : isMealtime
            ? !pref.mealtime_suggestions
            : isWeeklyPicks
              ? !pref.weekly_picks
              : !pref.stall_updates
    )
      skipReason = "opted_out";
    else if (
      now.getTime() - new Date(job.created_at).getTime() >
      (isMealtime ? MEALTIME_STALE_AFTER_MS : STALE_AFTER_MS)
    )
      skipReason = "stale";
    else if (isMealtime && activeTodayUserIds.has(job.user_id)) skipReason = "already_active";
    else if (
      isLowRating
        ? !liveReviewIds.has(job.review_id)
        : !isMealtime &&
          !isWeeklyPicks &&
          !isSocial &&
          (!dish || isSoldOut(dish.availability_flags))
    )
      skipReason = "no_longer_relevant";
    else if (
      !isLowRating &&
      !isFollowRequest &&
      (sentThisWeek.get(job.user_id) ?? 0) >= pref.weekly_cap
    )
      skipReason = "weekly_cap";
    else if (!(tokensByUser.get(job.user_id) ?? []).length) skipReason = "no_device";

    if (skipReason) {
      results.skipped += 1;
      queueFinish(job.id, { status: "skipped", skip_reason: skipReason });
      continue;
    }

    // Merchant Centre has no quiet-hours setting, so low-rating alerts are sent right away.
    if (!isLowRating && isQuietHour(hour, pref.quiet_start_hour, pref.quiet_end_hour)) {
      results.deferred += 1;
      queueFinish(job.id, { status: "pending", attempts: Math.max(0, job.attempts - 1) });
      continue;
    }

    const userTokens = tokensByUser.get(job.user_id) ?? [];
    const messages = userTokens.map((token) => ({
      to: token,
      title: job.title,
      body: job.body,
      channelId: ANDROID_CHANNEL_ID,
      data: { url: job.deep_link, notificationId: job.id, category: job.category },
    }));

    let delivered = false;
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
        },
        body: JSON.stringify(messages),
      });
      const body = await response.json().catch(() => ({}));
      const tickets = Array.isArray(body?.data) ? body.data : [];
      const deadTokens: string[] = [];
      tickets.forEach((ticket, index) => {
        if (ticket?.status === "ok") delivered = true;
        if (ticket?.details?.error === "DeviceNotRegistered") deadTokens.push(userTokens[index]);
      });
      deadTokens.forEach((token) => deadTokensToRemove.add(token));
    } catch {
      delivered = false;
    }

    if (delivered) {
      results.sent += 1;
      if (!isLowRating && !isFollowRequest)
        sentThisWeek.set(job.user_id, (sentThisWeek.get(job.user_id) ?? 0) + 1);
      await finish(job.id, { status: "sent", sent_at: new Date().toISOString() });
    } else {
      results.failed += 1;
      await finish(job.id, {
        status: job.attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        skip_reason: job.attempts >= MAX_ATTEMPTS ? "send_failed" : null,
      });
    }
  }

  if (deadTokensToRemove.size > 0) {
    await client
      .from("user_push_tokens")
      .delete()
      .in("token", [...deadTokensToRemove]);
  }
  await Promise.all(
    // n-plus-one-ok: one UPDATE per distinct set of fields, not per job.
    [...queuedFinishes.values()].map(({ fields, jobIds }) =>
      client
        .from("notification_jobs")
        .update({ locked_at: null, ...fields })
        .in("id", jobIds),
    ),
  );

  return toJson(200, { claimed: jobs.length, ...results });
});
