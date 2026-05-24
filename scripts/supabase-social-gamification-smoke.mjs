#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SMOKE_URL_ENV = "HUNGRY_SUPABASE_SMOKE_URL";
const SMOKE_ANON_ENV = "HUNGRY_SUPABASE_SMOKE_ANON_KEY";
const SMOKE_SERVICE_ENV = "HUNGRY_SUPABASE_SMOKE_SERVICE_ROLE_KEY";
const SMOKE_PROJECT_REF_ENV = "HUNGRY_SUPABASE_SMOKE_PROJECT_REF";
const SERVICE_ROLE_OPT_IN_ENV = "HUNGRY_ALLOW_SERVICE_ROLE_SMOKE";

function getAnonKey() {
  return process.env[SMOKE_ANON_ENV]?.trim() ?? "";
}

function isLocalSmokeUrl(urlText) {
  try {
    const { hostname } = new URL(urlText);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function getMissingEnv() {
  const missing = [SMOKE_URL_ENV, SMOKE_SERVICE_ENV].filter((name) => !process.env[name]?.trim());
  const smokeUrl = process.env[SMOKE_URL_ENV]?.trim();

  if (!getAnonKey()) missing.push(SMOKE_ANON_ENV);
  if (smokeUrl && !isLocalSmokeUrl(smokeUrl) && !process.env[SMOKE_PROJECT_REF_ENV]?.trim()) {
    missing.push(SMOKE_PROJECT_REF_ENV);
  }
  if (process.env[SERVICE_ROLE_OPT_IN_ENV] !== "1") {
    missing.push(`${SERVICE_ROLE_OPT_IN_ENV}=1`);
  }
  return missing;
}

function fail(message) {
  throw new Error(`[supabase-social-gamification-smoke] ${message}`);
}

function createSupabaseClient(key) {
  return createClient(process.env[SMOKE_URL_ENV].trim(), key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function assertSmokeTargetIsAllowed() {
  const smokeUrl = process.env[SMOKE_URL_ENV].trim();
  if (isLocalSmokeUrl(smokeUrl)) return;

  const { hostname } = new URL(smokeUrl);
  const actualProjectRef = hostname.split(".")[0] ?? "";
  const expectedProjectRef = process.env[SMOKE_PROJECT_REF_ENV]?.trim() ?? "";

  if (!expectedProjectRef) {
    fail(
      `cloud smoke target requires ${SMOKE_PROJECT_REF_ENV} to confirm the intended dev project`,
    );
  }
  if (actualProjectRef !== expectedProjectRef) {
    fail(
      `${SMOKE_PROJECT_REF_ENV}=${expectedProjectRef} does not match the Supabase URL project ref ${actualProjectRef}`,
    );
  }
}

async function expectNoError(result, label) {
  if (result.error) fail(`${label}: ${result.error.message}`);
  return result.data;
}

function expectError(result, label) {
  if (!result.error) {
    fail(`${label}: expected access to be denied, but the operation succeeded`);
  }
}

async function createTestUser(admin, runId, label) {
  const email = `hungry-social-${label}-${runId}@example.test`;
  const password = `HungrySmoke-${runId}-123!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: `Hungry Social ${label.toUpperCase()} ${runId}`,
    },
  });
  if (error || !data.user?.id) {
    fail(`create ${label} auth user: ${error?.message ?? "missing user id"}`);
  }
  return { id: data.user.id, email, password, label };
}

async function signInUser(anonKey, user) {
  const client = createSupabaseClient(anonKey);
  await expectNoError(
    await client.auth.signInWithPassword({ email: user.email, password: user.password }),
    `sign in ${user.label}`,
  );
  return client;
}

async function upsertProfile(client, user, displayName) {
  await expectNoError(
    await client.from("user_profiles").upsert(
      {
        id: user.id,
        email: user.email,
        display_name: displayName,
      },
      { onConflict: "id" },
    ),
    `upsert ${user.label} profile`,
  );
}

async function cleanup(admin, userIds, runId) {
  const errors = [];
  const capture = async (operation, label) => {
    try {
      const result = await operation;
      if (result?.error) errors.push(`${label}: ${result.error.message}`);
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (userIds.length > 0) {
    await capture(
      admin.from("app_ops_rate_limits").delete().in("actor_user_id", userIds),
      "delete ops rate limits",
    );
    await capture(
      admin.from("app_user_rate_limits").delete().in("actor_user_id", userIds),
      "delete user rate limits",
    );
    await capture(
      admin.from("app_ops_admins").delete().in("user_id", userIds),
      "delete ops admins",
    );
    await capture(
      admin.from("content_reports").delete().in("reporter_id", userIds),
      "delete content reports",
    );
    await capture(
      admin.from("user_blocks").delete().in("blocker_id", userIds),
      "delete user blocks",
    );
    await capture(
      admin.from("food_cred_events").delete().in("user_id", userIds),
      "delete food cred events",
    );
    await capture(
      admin.from("user_food_cred").delete().in("user_id", userIds),
      "delete food cred totals",
    );
    await capture(
      admin.from("user_mission_progress").delete().in("user_id", userIds),
      "delete mission progress",
    );
    await capture(
      admin.from("user_stall_interactions").delete().in("user_id", userIds),
      "delete stall interactions",
    );
    await capture(admin.from("user_profiles").delete().in("id", userIds), "delete user profiles");
  }

  await capture(
    admin.from("content_reports").delete().like("target_id", `%${runId}%`),
    "delete smoke content reports by target",
  );

  const deleteResults = await Promise.allSettled(
    userIds.map((userId) => admin.auth.admin.deleteUser(userId)),
  );
  deleteResults.forEach((result, index) => {
    const userId = userIds[index];
    if (result.status === "rejected") {
      errors.push(
        `delete auth user ${userId}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
      );
      return;
    }
    if (result.value.error) {
      errors.push(`delete auth user ${userId}: ${result.value.error.message}`);
    }
  });

  if (errors.length > 0) fail(`cleanup failed: ${errors.join("; ")}`);
}

async function main() {
  const missing = getMissingEnv();
  const requireEnv =
    process.argv.includes("--require-env") || process.env.HUNGRY_SUPABASE_SMOKE_REQUIRED === "1";

  if (missing.length > 0) {
    const message = `skipped; missing ${missing.join(", ")}`;
    if (requireEnv) fail(message);
    console.log(`[supabase-social-gamification-smoke] ${message}`);
    return;
  }
  assertSmokeTargetIsAllowed();

  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const admin = createSupabaseClient(process.env[SMOKE_SERVICE_ENV].trim());
  const anonKey = getAnonKey();
  const users = [];
  let successPayload;
  let primaryError;

  try {
    const userA = await createTestUser(admin, runId, "a");
    users.push(userA);
    const userB = await createTestUser(admin, runId, "b");
    users.push(userB);
    const opsUser = await createTestUser(admin, runId, "ops");
    users.push(opsUser);

    const clientA = await signInUser(anonKey, userA);
    const clientB = await signInUser(anonKey, userB);
    const opsClient = await signInUser(anonKey, opsUser);

    await upsertProfile(clientA, userA, `Smoke Reporter ${runId}`);
    await upsertProfile(clientB, userB, `Smoke Target ${runId}`);
    await upsertProfile(opsClient, opsUser, `Smoke Ops ${runId}`);

    const venues = await expectNoError(
      await admin.from("venues").select("id").limit(1),
      "load one venue for stall interactions",
    );
    const venueId = Array.isArray(venues) ? venues[0]?.id : undefined;
    if (!venueId) fail("no venue row is available for stall interaction smoke");

    const reportId = await expectNoError(
      await clientA.rpc("report_content", {
        p_target_type: "profile",
        p_target_id: userB.id,
        p_reason: "spam",
        p_target_author_key: userB.id,
      }),
      "report profile content",
    );
    if (!reportId) fail("report_content did not return a report id");

    const ownReports = await expectNoError(
      await clientA.from("content_reports").select("id,target_type,target_id").eq("id", reportId),
      "reporter reads own report",
    );
    if (!Array.isArray(ownReports) || ownReports.length !== 1) {
      fail("reporter could not read the report it created");
    }

    const otherReports = await expectNoError(
      await clientB.from("content_reports").select("id").eq("id", reportId),
      "non-reporter reads content report through RLS",
    );
    if (Array.isArray(otherReports) && otherReports.length > 0) {
      fail("non-reporter could read another user's content report");
    }

    expectError(
      await clientA.from("content_reports").insert({
        reporter_id: userA.id,
        target_type: "profile",
        target_id: `${userB.id}-direct-${runId}`,
        reason: "spam",
        status: "open",
      }),
      "direct content report insert",
    );

    expectError(
      await clientA.rpc("list_content_moderation_queue", { p_limit: 10 }),
      "non-ops moderation queue access",
    );

    await expectNoError(
      await admin.from("app_ops_admins").upsert({
        user_id: opsUser.id,
        role: "operator",
        enabled: true,
      }),
      "seed ops admin user",
    );
    const queueRows = await expectNoError(
      await opsClient.rpc("list_content_moderation_queue", { p_limit: 10 }),
      "ops moderation queue access",
    );
    if (
      !Array.isArray(queueRows) ||
      !queueRows.some((row) => row.target_type === "profile" && row.target_id === userB.id)
    ) {
      fail("ops moderation queue did not include the smoke profile report");
    }

    await expectNoError(
      await clientA.from("user_blocks").upsert({
        blocker_id: userA.id,
        blocked_user_key: userB.id,
        reason: "smoke-block",
      }),
      "block target user",
    );
    expectError(
      await clientA
        .rpc("open_chat_conversation", {
          p_target_user_id: userB.id,
          p_target_merchant_account_id: null,
          p_conversation_type: "user",
        })
        .maybeSingle(),
      "blocked user conversation open",
    );

    const foodCred = await expectNoError(
      await clientA.rpc("award_food_cred", {
        p_source_action: "post_created",
        p_related_entity_id: `smoke-post-${runId}`,
        p_related_entity_type: "post",
        p_points: null,
      }),
      "award food cred",
    );
    const foodCredRow = Array.isArray(foodCred) ? foodCred[0] : foodCred;
    if (!foodCredRow || foodCredRow.points_awarded <= 0 || foodCredRow.total_points <= 0) {
      fail("award_food_cred did not award positive points");
    }

    expectError(
      await clientA.from("user_food_cred").insert({
        user_id: userA.id,
        total_points: 999,
        level_index: 9,
      }),
      "direct food cred insert",
    );

    const interaction = await expectNoError(
      await clientA.rpc("upsert_stall_interaction", {
        p_stall_id: venueId,
        p_is_saved: true,
        p_is_tried: true,
        p_is_reviewed: null,
      }),
      "upsert stall interaction",
    );
    const interactionRow = Array.isArray(interaction) ? interaction[0] : interaction;
    if (!interactionRow?.is_saved || !interactionRow?.is_tried) {
      fail("upsert_stall_interaction did not persist saved/tried flags");
    }

    const hiddenInteractions = await expectNoError(
      await clientB.from("user_stall_interactions").select("user_id").eq("user_id", userA.id),
      "other user reads stall interactions through RLS",
    );
    if (Array.isArray(hiddenInteractions) && hiddenInteractions.length > 0) {
      fail("another user could read private stall interactions");
    }

    const activeMissions = await expectNoError(
      await clientA
        .from("weekly_missions")
        .select("id,mission_type")
        .eq("mission_type", "write_review")
        .eq("is_active", true),
      "load active write_review mission",
    );
    if (!Array.isArray(activeMissions) || activeMissions.length === 0) {
      fail("no active write_review mission is available for mission progress smoke");
    }

    await expectNoError(
      await clientA.rpc("increment_mission_progress", { p_mission_type: "write_review" }),
      "increment mission progress",
    );
    const missionProgress = await expectNoError(
      await clientA
        .from("user_mission_progress")
        .select("mission_id,current_count,completed_at")
        .eq("user_id", userA.id),
      "read own mission progress",
    );
    if (
      !Array.isArray(missionProgress) ||
      !missionProgress.some((row) => row.current_count >= 1 && row.completed_at)
    ) {
      fail("mission progress was not completed for the write_review smoke");
    }

    successPayload = {
      ok: true,
      runId,
      venueId,
      verified: [
        "auth users created",
        "profiles upserted",
        "report_content writes checked report",
        "content_reports direct insert is revoked for app clients",
        "content report RLS hides reports from non-reporters",
        "moderation queue is ops-admin gated",
        "user block prevents conversation open",
        "award_food_cred writes checked Food Cred event",
        "direct Food Cred insert is revoked for app clients",
        "upsert_stall_interaction writes private stall interaction",
        "stall interaction RLS hides rows from other users",
        "increment_mission_progress completes an active mission",
      ],
    };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await cleanup(
        admin,
        users.map((user) => user.id),
        runId,
      );
    } catch (cleanupError) {
      if (!primaryError) throw cleanupError;
      console.error(
        cleanupError instanceof Error
          ? cleanupError.message
          : `[supabase-social-gamification-smoke] cleanup failed: ${cleanupError}`,
      );
    }
  }

  if (successPayload) {
    console.log(JSON.stringify(successPayload, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
