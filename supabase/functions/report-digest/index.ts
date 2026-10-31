// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { reportFunctionError, serveWithSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { timingSafeEqual } from "../_shared/timingSafeEqual.ts";

// Emails the support inbox when people have reported content (App Store 1.2: reports need a
// timely response). Run every 15 minutes by the report-digest pg_cron job (20261031090000),
// authenticated with REPORT_DIGEST_TOKEN. Each report is mentioned once: the RPC marks the
// reports it returns, and a failed send puts them back for the next run.
//
// The email carries what to look at (kind, id, reason, time), never the reporter's identity or
// any content text.

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_RECIPIENT = "usehungrysingapore@gmail.com";

function toJson(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function describeReports(reports: Record<string, unknown>[]): string {
  const lines = reports.map(
    (report) =>
      `- ${String(report.target_type)} ${String(report.target_id)}: ${String(report.reason)} (${String(report.created_at)})`,
  );
  return [
    `${reports.length} new report${reports.length === 1 ? "" : "s"} on Hungry.`,
    "",
    ...lines,
    "",
    "Open the moderation queue (list_content_moderation_queue) to review and act. Our public promise is a response within 24 hours.",
  ].join("\n");
}

serveWithSentry("report-digest", async (request) => {
  if (request.method !== "POST") {
    return toJson(405, { error: "method_not_allowed" });
  }

  const workerToken = Deno.env.get("REPORT_DIGEST_TOKEN") ?? "";
  if (!workerToken || !timingSafeEqual(getBearerToken(request), workerToken)) {
    return toJson(401, { error: "unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const sender = Deno.env.get("RESEND_FROM") ?? "";
  const recipient = Deno.env.get("REPORT_DIGEST_TO")?.trim() || DEFAULT_RECIPIENT;
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !sender) {
    return toJson(500, { error: "missing_env" });
  }

  const payload = await request.json().catch(() => ({}));
  const parsedLimit = Number(payload?.limit);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(parsedLimit) ? Math.floor(parsedLimit) : DEFAULT_LIMIT),
  );

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.rpc("claim_content_reports_for_alert", { p_limit: limit });
  if (error) {
    await reportFunctionError("report-digest", error, { stage: "claim" }, request);
    return toJson(500, { error: "claim_failed" });
  }
  const reports = Array.isArray(data) ? data : [];
  if (reports.length === 0) {
    return toJson(200, { sent: 0 });
  }

  const release = async () => {
    const { error: releaseError } = await client.rpc("release_content_report_alerts", {
      p_ids: reports.map((report) => report.id),
    });
    if (releaseError) {
      await reportFunctionError("report-digest", releaseError, { stage: "release" }, request);
    }
  };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        subject: `Hungry: ${reports.length} new report${reports.length === 1 ? "" : "s"} to review`,
        text: describeReports(reports),
      }),
    });
    if (!response.ok) throw new Error(`resend_failed:${response.status}`);
  } catch (sendError) {
    await release();
    await reportFunctionError("report-digest", sendError, { stage: "send" }, request);
    return toJson(502, { error: "send_failed" });
  }

  return toJson(200, { sent: reports.length });
});
