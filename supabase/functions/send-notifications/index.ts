// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { timingSafeEqual } from "../_shared/timingSafeEqual.ts";

// Drains public.notification_jobs (filled by the dishes trigger and the weekly
// picks cron) and sends Expo pushes. Each job is rechecked before sending: the
// user still opted in, the dish (if any) still exists and is not sold out,
// outside the user's quiet hours (Singapore time), under their weekly cap, and
// not older than 48 hours.

type JsonObject = Record<string, unknown>;

// Matches the column defaults in notification_preferences; used when a user
// has a push token but never saved preferences (weekly picks is on by default).
const DEFAULT_PREFERENCES = {
  stall_updates: false,
  weekly_picks: true,
  quiet_start_hour: 22,
  quiet_end_hour: 8,
  weekly_cap: 3,
};

const MAX_BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const ANDROID_CHANNEL_ID = "stall-updates";

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
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(parsed)));
}

function singaporeHour(now: Date): number {
  return (now.getUTCHours() + 8) % 24;
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

// A deadline spans both the response headers and body, including stalled streams.
export async function expoRequest(url, payload, accessToken, fetcher = fetch, timeoutMs = 10000) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error("expo_timeout")); }, timeoutMs);
  });
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetcher(url, {
        method: "POST", signal: controller.signal,
        headers: { Accept: "application/json", "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      return { response, body };
    })()]);
  } finally { clearTimeout(timer); }
}

function requireResult(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.message ?? "database_error"}`);
  return result.data;
}

export async function pollReceipts(client, accessToken, deps = {}) {
  const receipts = requireResult(await client.rpc("claim_notification_receipts", { p_limit: 1000 }), "claim_receipts") ?? [];
  if (!receipts.length) return { polled: 0 };
  let body;
  try {
    const result = await expoRequest("https://exp.host/--/api/v2/push/getReceipts",
      { ids: receipts.map(row => row.ticket_id) }, accessToken, deps.fetcher, deps.timeoutMs);
    if (!result.response.ok) throw new Error("receipt_provider_rejected");
    body = result.body;
  } catch (error) {
    // The SQL claim has a bounded lease, so a failed poll remains retryable.
    throw new Error(`receipt_poll_failed: ${error.message}`);
  }
  const results = receipts.map(row => {
    const receipt = body?.data?.[row.ticket_id];
    return { ticket_id: row.ticket_id, status: receipt?.status === "ok" ? "ok" :
      receipt?.status === "error" ? "error" : "pending", error_code: receipt?.details?.error ?? null };
  });
  requireResult(await client.rpc("settle_notification_receipts", { p_results: results }), "settle_receipts");
  return { polled: results.length };
}

export async function handleNotificationWorker(request, deps = {}) {
  if (request.method !== "POST") return toJson(405, { error: "method_not_allowed" });
  const workerToken = Deno.env.get("NOTIFICATION_WORKER_TOKEN") ?? "";
  if (!workerToken || !timingSafeEqual(getBearerToken(request), workerToken))
    return toJson(401, { error: "unauthorized" });
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return toJson(500, { error: "missing_supabase_env" });
  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN") ?? "";
  const payload = await request.json().catch(() => ({}));
  const client = deps.client ?? createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const clock = deps.now ?? (() => new Date());
  try {
    const receiptResult = await pollReceipts(client, accessToken, deps);
    const jobs = requireResult(await client.rpc("claim_notification_jobs", {
      p_limit: parseLimit(payload.limit),
    }), "claim_jobs") ?? [];
    if (!jobs.length) return toJson(200, { claimed: 0, ...receiptResult });
    const userIds = [...new Set(jobs.map(job => job.user_id))];
    const dishIds = [...new Set(jobs.map(job => job.dish_id).filter(Boolean))];
    const lookups = await Promise.all([
      client.from("notification_preferences").select("*").in("user_id", userIds),
      client.from("user_push_tokens").select("token, user_id").in("user_id", userIds),
      client.from("dishes").select("id, availability_flags").in("id", dishIds),
      client.from("notification_jobs").select("user_id").in("status", ["sent", "accepted", "delivery_unknown"])
        .gte("sent_at", new Date(clock().getTime() - WEEK_MS).toISOString()).in("user_id", userIds),
    ]);
    const finish = async (jobId, fields) => requireResult(await client.from("notification_jobs")
      .update({ locked_at: null, ...fields }).eq("id", jobId).select("id").single(), "finalize_job");
    const lookupError = lookups.find(result => result.error);
    if (lookupError) {
      // Do not turn unavailable preferences/tokens/history into defaults or skips.
      for (const job of jobs) await finish(job.id, { status: "pending", attempts: Math.max(0, job.attempts - 1) });
      throw new Error("notification_lookup_failed");
    }
    const [prefs, tokens, dishes, recentSent] = lookups.map(result => result.data ?? []);
    const prefsByUser = new Map(prefs.map(row => [row.user_id, row]));
    const dishesById = new Map(dishes.map(row => [row.id, row]));
    const tokensByUser = new Map();
    for (const row of tokens) tokensByUser.set(row.user_id, [...(tokensByUser.get(row.user_id) ?? []), row.token]);
    const sentThisWeek = new Map();
    for (const row of recentSent) sentThisWeek.set(row.user_id, (sentThisWeek.get(row.user_id) ?? 0) + 1);
    const results = { accepted: 0, skipped: 0, deferred: 0, failed: 0, unknown: 0 };
    for (const job of jobs) {
      const now = clock();
      const hour = singaporeHour(now);
      const pref = { ...DEFAULT_PREFERENCES, ...(prefsByUser.get(job.user_id) ?? {}) };
      const isWeeklyPicks = job.category === "weekly_picks";
      const dish = job.dish_id ? dishesById.get(job.dish_id) : null;
      let skipReason = null;
      if (isWeeklyPicks ? !pref.weekly_picks : !pref.stall_updates) skipReason = "opted_out";
      else if (now.getTime() - new Date(job.created_at).getTime() > STALE_AFTER_MS) skipReason = "stale";
      else if (!isWeeklyPicks && (!dish || isSoldOut(dish.availability_flags))) skipReason = "no_longer_relevant";
      else if ((sentThisWeek.get(job.user_id) ?? 0) >= pref.weekly_cap) skipReason = "weekly_cap";
      else if (!(tokensByUser.get(job.user_id) ?? []).length) skipReason = "no_device";
      if (skipReason) {
        await finish(job.id, { status: "skipped", skip_reason: skipReason }); results.skipped++; continue;
      }
      if (isQuietHour(hour, pref.quiet_start_hour, pref.quiet_end_hour)) {
        await finish(job.id, { status: "pending", attempts: Math.max(0, job.attempts - 1) }); results.deferred++; continue;
      }
      // Persist uncertainty BEFORE transport. A crash/timeout cannot put an accepted
      // push back into the automatic resend queue. Operators can reconcile unknowns.
      await finish(job.id, { status: "delivery_unknown", skip_reason: "transport_unconfirmed", sent_at: now.toISOString() });
      const userTokens = tokensByUser.get(job.user_id) ?? [];
      let accepted = false;
      let unknown = false;
      for (let offset = 0; offset < userTokens.length; offset += 100) {
        const chunk = userTokens.slice(offset, offset + 100);
        let result;
        try {
          result = await expoRequest(EXPO_PUSH_URL, chunk.map(token => ({
            to: token, title: job.title, body: job.body, channelId: ANDROID_CHANNEL_ID,
            data: { url: job.deep_link, notificationId: job.id, category: job.category },
          })), accessToken, deps.fetcher, deps.timeoutMs);
        } catch { unknown = true; break; }
        if (!result.response.ok) {
          // Explicit rejection is safe to retry; transport ambiguity is not.
          if (offset > 0) unknown = true;
          break;
        }
        const tickets = Array.isArray(result.body?.data) ? result.body.data : [];
        if (tickets.length !== chunk.length) unknown = true;
        const saved = [];
        const dead = [];
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (ticket?.status === "ok" && typeof ticket.id === "string" && ticket.id.length > 0) {
            accepted = true;
            saved.push({ ticket_id: ticket.id, token: chunk[i] });
          } else if (ticket?.details?.error === "DeviceNotRegistered") dead.push(chunk[i]);
          else if (ticket?.status !== "error") unknown = true;
        }
        if (saved.length) requireResult(await client.rpc("record_notification_tickets", {
          p_job_id: job.id, p_tickets: saved,
        }), "record_tickets");
        if (dead.length) requireResult(await client.from("user_push_tokens").delete().eq("user_id", job.user_id).in("token", dead), "remove_tokens");
      }
      if (unknown) {
        await finish(job.id, { status: "delivery_unknown", skip_reason: "transport_unconfirmed" }); results.unknown++;
      } else if (accepted) {
        await finish(job.id, { status: "accepted", skip_reason: null }); results.accepted++;
      } else {
        await finish(job.id, { status: job.attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          sent_at: null, skip_reason: job.attempts >= MAX_ATTEMPTS ? "send_failed" : null }); results.failed++;
      }
      if (accepted || unknown) sentThisWeek.set(job.user_id, (sentThisWeek.get(job.user_id) ?? 0) + 1);
    }
    return toJson(200, { claimed: jobs.length, ...receiptResult, ...results });
  } catch (error) {
    console.error("notification_worker_failed", error.message);
    return new Response(JSON.stringify({ error: "notification_worker_failed" }), {
      status: 503, headers: { "Content-Type": "application/json", "Retry-After": "60" },
    });
  }
}

if (import.meta.main) Deno.serve(handleNotificationWorker);
