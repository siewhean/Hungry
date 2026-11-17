#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SMOKE_URL_ENV = "HUNGRY_SUPABASE_SMOKE_URL";
const SMOKE_ANON_ENV = "HUNGRY_SUPABASE_SMOKE_ANON_KEY";
const SMOKE_SERVICE_ENV = "HUNGRY_SUPABASE_SMOKE_SERVICE_ROLE_KEY";
const SMOKE_PROJECT_REF_ENV = "HUNGRY_SUPABASE_SMOKE_PROJECT_REF";
const SERVICE_ROLE_OPT_IN_ENV = "HUNGRY_ALLOW_SERVICE_ROLE_SMOKE";
const REALTIME_TIMEOUT_MS = 30_000;
const REALTIME_READY_SETTLE_MS = 1_000;

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

  if (!getAnonKey()) {
    missing.push(SMOKE_ANON_ENV);
  }
  if (smokeUrl && !isLocalSmokeUrl(smokeUrl) && !process.env[SMOKE_PROJECT_REF_ENV]?.trim()) {
    missing.push(SMOKE_PROJECT_REF_ENV);
  }
  if (process.env[SERVICE_ROLE_OPT_IN_ENV] !== "1") {
    missing.push(`${SERVICE_ROLE_OPT_IN_ENV}=1`);
  }
  return missing;
}

function fail(message) {
  throw new Error(`[supabase-chat-smoke] ${message}`);
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
  if (result.error) {
    fail(`${label}: ${result.error.message}`);
  }
  return result.data;
}

function expectError(result, label) {
  if (!result.error) {
    fail(`${label}: expected access to be denied, but the operation succeeded`);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRealtimeProbe(client, conversationId, clientNonce, runId) {
  let channel;
  let readySettled = false;
  let receivedSettled = false;
  let readyTimeout;
  let receivedTimeout;
  let rejectReceived;

  const received = new Promise((resolve, reject) => {
    rejectReceived = reject;
    channel = client.channel(`hungry-chat-smoke:${runId}`).on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (receivedSettled || payload.new?.client_nonce !== clientNonce) return;
        receivedSettled = true;
        clearTimeout(receivedTimeout);
        resolve(payload.new);
      },
    );
  });

  const ready = new Promise((resolve, reject) => {
    readyTimeout = setTimeout(() => {
      if (readySettled) return;
      readySettled = true;
      reject(new Error("Realtime subscription did not become ready in time."));
    }, REALTIME_TIMEOUT_MS);

    channel.subscribe((status, error) => {
      if (readySettled) return;
      if (error) {
        readySettled = true;
        clearTimeout(readyTimeout);
        reject(error);
        return;
      }
      if (status === "SUBSCRIBED") {
        readySettled = true;
        clearTimeout(readyTimeout);
        resolve();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        readySettled = true;
        clearTimeout(readyTimeout);
        reject(new Error(`Realtime channel failed with status ${status}.`));
      }
    });
  });

  return {
    ready,
    received,
    startReceiving() {
      if (receivedTimeout || receivedSettled) return;
      receivedTimeout = setTimeout(() => {
        if (receivedSettled) return;
        receivedSettled = true;
        rejectReceived(new Error("Realtime message was not received in time."));
      }, REALTIME_TIMEOUT_MS);
    },
    async cleanup() {
      clearTimeout(readyTimeout);
      clearTimeout(receivedTimeout);
      if (channel) await client.removeChannel(channel);
    },
  };
}

async function createTestUser(admin, runId, label) {
  const email = `hungry-chat-${label}-${runId}@example.test`;
  const password = `HungrySmoke-${runId}-123!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: `Hungry Chat ${label.toUpperCase()} ${runId}`,
    },
  });
  if (error || !data.user?.id) {
    fail(`create ${label} auth user: ${error?.message ?? "missing user id"}`);
  }
  return { id: data.user.id, email, password, label };
}

async function signInUser(anonKey, user) {
  const client = createSupabaseClient(anonKey);
  const sessionData = await expectNoError(
    await client.auth.signInWithPassword({ email: user.email, password: user.password }),
    `sign in ${user.label}`,
  );
  if (sessionData?.session?.access_token) {
    client.realtime.setAuth(sessionData.session.access_token);
  }
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

async function cleanup(admin, userIds, conversationId) {
  const errors = [];
  const capture = async (operation, label) => {
    try {
      const result = await operation;
      if (result?.error) {
        errors.push(`${label}: ${result.error.message}`);
      }
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (conversationId) {
    await capture(
      admin.from("read_receipts").delete().eq("conversation_id", conversationId),
      "delete read receipts",
    );
    await capture(
      admin.from("messages").delete().eq("conversation_id", conversationId),
      "delete messages",
    );
    await capture(
      admin.from("conversation_participants").delete().eq("conversation_id", conversationId),
      "delete conversation participants",
    );
    await capture(
      admin.from("conversations").delete().eq("id", conversationId),
      "delete conversation",
    );
  }
  if (userIds.length > 0) {
    await capture(admin.from("user_profiles").delete().in("id", userIds), "delete user profiles");
  }

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

  if (errors.length > 0) {
    fail(`cleanup failed: ${errors.join("; ")}`);
  }
}

async function main() {
  const missing = getMissingEnv();
  const requireEnv =
    process.argv.includes("--require-env") || process.env.HUNGRY_SUPABASE_SMOKE_REQUIRED === "1";

  if (missing.length > 0) {
    const message = `skipped; missing ${missing.join(", ")}`;
    if (requireEnv) fail(message);
    console.log(`[supabase-chat-smoke] ${message}`);
    return;
  }
  assertSmokeTargetIsAllowed();

  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const admin = createSupabaseClient(process.env[SMOKE_SERVICE_ENV].trim());
  const anonKey = getAnonKey();
  const users = [];
  let conversationId = "";
  let realtimeProbe;
  let primaryError;
  let successPayload;

  try {
    const userA = await createTestUser(admin, runId, "a");
    users.push(userA);
    const userB = await createTestUser(admin, runId, "b");
    users.push(userB);
    const userC = await createTestUser(admin, runId, "c");
    users.push(userC);

    const clientA = await signInUser(anonKey, userA);
    const clientB = await signInUser(anonKey, userB);
    const clientC = await signInUser(anonKey, userC);

    await upsertProfile(clientA, userA, `Smoke User A ${runId}`);
    await upsertProfile(clientB, userB, `Smoke User B ${runId}`);
    await upsertProfile(clientC, userC, `Smoke User C ${runId}`);

    const conversation = await expectNoError(
      await clientA
        .rpc("open_chat_conversation", {
          p_target_user_id: userB.id,
          p_target_merchant_account_id: null,
          p_conversation_type: "user",
        })
        .maybeSingle(),
      "open conversation as user A",
    );
    conversationId = conversation?.id;
    if (!conversationId) fail("opened conversation did not return an id");

    const participantRows = await expectNoError(
      await clientA
        .from("conversation_participants")
        .select("participant_user_id")
        .eq("conversation_id", conversationId),
      "list opened conversation participants",
    );
    if (!Array.isArray(participantRows) || participantRows.length !== 2) {
      fail("conversation opener did not create both user participants");
    }

    const aToBNonce = `a-to-b-${runId}`;
    realtimeProbe = createRealtimeProbe(clientB, conversationId, aToBNonce, runId);
    await realtimeProbe.ready;
    await delay(REALTIME_READY_SETTLE_MS);
    realtimeProbe.startReceiving();

    const messageA = await expectNoError(
      await clientA.rpc("send_chat_message", {
        p_conversation_id: conversationId,
        p_body: `Smoke message A to B ${runId}`,
        p_client_nonce: aToBNonce,
        p_sender_merchant_account_id: null,
      }),
      "send user A message through RPC",
    );
    const messageARow = Array.isArray(messageA) ? messageA[0] : messageA;
    if (!messageARow?.id) fail("user A message did not return an id");
    await realtimeProbe.received;

    expectError(
      await clientA.from("messages").insert({
        conversation_id: conversationId,
        sender_user_id: userA.id,
        body: `Direct insert should fail ${runId}`,
        client_nonce: `a-direct-blocked-${runId}`,
        delivered_at: new Date().toISOString(),
      }),
      "participant direct message insert",
    );

    const bMessages = await expectNoError(
      await clientB
        .from("messages")
        .select("id,body,client_nonce")
        .eq("conversation_id", conversationId)
        .eq("client_nonce", aToBNonce),
      "user B reads user A message",
    );
    if (!Array.isArray(bMessages) || bMessages.length !== 1) {
      fail("user B could not read user A message through participant RLS");
    }

    const cMessages = await expectNoError(
      await clientC.from("messages").select("id").eq("conversation_id", conversationId),
      "user C non-participant message query",
    );
    if (Array.isArray(cMessages) && cMessages.length > 0) {
      fail("user C could read a conversation they do not participate in");
    }

    expectError(
      await clientC.rpc("send_chat_message", {
        p_conversation_id: conversationId,
        p_body: `Unauthorized smoke message ${runId}`,
        p_client_nonce: `c-blocked-message-${runId}`,
        p_sender_merchant_account_id: null,
      }),
      "user C non-participant message RPC",
    );

    expectError(
      await clientC.from("conversation_participants").insert({
        conversation_id: conversationId,
        participant_kind: "user",
        participant_user_id: userC.id,
      }),
      "user C non-participant self-add",
    );

    await expectNoError(
      await clientB.from("read_receipts").insert({
        message_id: messageARow.id,
        conversation_id: conversationId,
        reader_user_id: userB.id,
        read_at: new Date().toISOString(),
      }),
      "user B marks user A message read",
    );

    const visibleReceipts = await expectNoError(
      await clientA
        .from("read_receipts")
        .select("message_id,reader_user_id")
        .eq("conversation_id", conversationId)
        .eq("message_id", messageARow.id),
      "user A reads user B receipt",
    );
    if (!Array.isArray(visibleReceipts) || visibleReceipts.length !== 1) {
      fail("user A could not read user B read receipt");
    }

    expectError(
      await clientC.from("read_receipts").insert({
        message_id: messageARow.id,
        conversation_id: conversationId,
        reader_user_id: userC.id,
        read_at: new Date().toISOString(),
      }),
      "user C non-participant read receipt insert",
    );

    const bToANonce = `b-to-a-${runId}`;
    await expectNoError(
      await clientB.rpc("send_chat_message", {
        p_conversation_id: conversationId,
        p_body: `Smoke reply B to A ${runId}`,
        p_client_nonce: bToANonce,
        p_sender_merchant_account_id: null,
      }),
      "send user B reply through RPC",
    );

    const aReplies = await expectNoError(
      await clientA
        .from("messages")
        .select("id,body,client_nonce")
        .eq("conversation_id", conversationId)
        .eq("client_nonce", bToANonce),
      "user A reads user B reply",
    );
    if (!Array.isArray(aReplies) || aReplies.length !== 1) {
      fail("user A could not read user B reply");
    }

    successPayload = {
      ok: true,
      runId,
      conversationId,
      verified: [
        "auth users created",
        "profiles upserted",
        "conversation opened through checked RPC",
        "participants created by checked RPC",
        "message delivered through checked RPC and realtime",
        "direct message insert is revoked for app clients",
        "recipient reads participant message",
        "non-participant cannot read messages",
        "non-participant cannot write messages, participants, or read receipts",
        "read receipt visible to participant",
        "reply visible to original sender",
      ],
    };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await realtimeProbe?.cleanup();
      await cleanup(
        admin,
        users.map((user) => user.id),
        conversationId,
      );
    } catch (cleanupError) {
      if (!primaryError) throw cleanupError;
      console.error(
        cleanupError instanceof Error
          ? cleanupError.message
          : `[supabase-chat-smoke] cleanup failed: ${cleanupError}`,
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
