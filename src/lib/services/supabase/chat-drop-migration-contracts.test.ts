// The direct-message drop migration (20261119090000) must drop only the objects it lists, leave the
// shared ones alone, patch the export and account deletion from text that really is in the latest
// definitions, and come with a down migration that recreates everything it dropped.
// Run order and backup: supabase/manual/chat-db-drop-runbook.md.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const VERSION = "20261119090000";
const NAME = `${VERSION}_drop_direct_message_chat`;
const up = readRepoFile(`supabase/migrations/${NAME}.sql`);
const down = readRepoFile(`supabase/rollbacks/${NAME}.down.sql`);

const DROPPED_TABLES = ["read_receipts", "messages", "conversation_participants", "conversations"];
const DROPPED_FUNCTIONS = [
  "public.mark_conversation_read(uuid)",
  "public.open_chat_conversation(uuid, uuid, text)",
  "app_private.open_chat_conversation(uuid, uuid, text)",
  "public.send_chat_message(uuid, text, text, uuid)",
  "app_private.send_chat_message(uuid, text, text, uuid)",
  "public.can_access_conversation(uuid)",
  "app_private.can_access_conversation(uuid)",
  "public.enforce_conversation_participant_update_guard()",
  "public.enforce_message_update_guard()",
  "public.enforce_read_receipt_update_guard()",
];
const KEPT_FUNCTIONS = [
  "app_user_block_exists",
  "app_can_make_user_request_window",
  "is_merchant_member",
];

function code(sql: string): string {
  return sql.replace(/--.*$/gm, "");
}

function listed(sql: string, pattern: RegExp): string[] {
  return [...code(sql).matchAll(pattern)].map((match) => match[1].replace(/\s+/g, " ").trim());
}

test("the migration, its down file and its smoke exist and are named alike", () => {
  const root = process.cwd();
  assert.ok(fs.existsSync(path.join(root, `supabase/migrations/${NAME}.sql`)));
  assert.ok(fs.existsSync(path.join(root, `supabase/rollbacks/${NAME}.down.sql`)));
  assert.match(up, /^-- smoke: supabase\/smoke\/drop_direct_message_chat\.sql$/m);
  assert.ok(fs.existsSync(path.join(root, "supabase/smoke/drop_direct_message_chat.sql")));
  assert.match(
    up,
    /^-- Down: supabase\/rollbacks\/20261119090000_drop_direct_message_chat\.down\.sql/m,
  );
  // The runner wraps each file in one transaction.
  assert.doesNotMatch(code(up), /^\s*(begin|commit)\s*;/im);
  assert.doesNotMatch(code(down), /^\s*(begin|commit)\s*;/im);
});

test("the migration declares the row loss and drops exactly the listed tables, children first", () => {
  const header = up.match(/^-- expect-row-loss:\s*(.+)$/m)?.[1] ?? "";
  const declared = header.split(",").map((table) => table.trim());
  assert.deepEqual(
    declared.sort(),
    [...DROPPED_TABLES.map((table) => `public.${table}`), "app_private.request_rate_rules"].sort(),
  );

  const dropped = listed(up, /drop table if exists public\.([a-z_]+)\s*;/gi);
  assert.deepEqual(dropped, DROPPED_TABLES);
  // No CASCADE anywhere: Postgres must refuse if something else still depends on a chat table.
  assert.doesNotMatch(code(up), /\bcascade\b/i);
  assert.doesNotMatch(code(up), /drop (schema|column|policy|trigger)\b/i);
  assert.doesNotMatch(code(up), /\btruncate\b/i);
});

test("the migration drops exactly the listed functions and keeps the shared helpers", () => {
  const dropped = listed(up, /drop function if exists ([a-z_.]+\([^)]*\))\s*;/gi);
  assert.deepEqual(dropped, DROPPED_FUNCTIONS);
  for (const name of KEPT_FUNCTIONS) {
    assert.doesNotMatch(code(up), new RegExp(`drop function[^;]*\\b${name}\\b`, "i"));
  }
  // post_shares keeps its column; only the foreign key goes. The legacy scaffold stays.
  assert.doesNotMatch(code(up), /drop column/i);
  assert.match(
    code(up),
    /alter table if exists public\.post_shares drop constraint if exists post_shares_target_conversation_id_fkey/,
  );
  assert.doesNotMatch(code(up), /chat_messages/);
  // A leftover reference in any function body rolls the migration back.
  assert.match(up, /functions still reference the dropped chat tables/);
});

test("the export and account-deletion patches match the latest definitions verbatim", () => {
  const exportSource = readRepoFile("supabase/migrations/20261113090000_stall_history.sql");
  const deletionSource = readRepoFile(
    "supabase/migrations/20261021100000_account_deletion_removes_profile.sql",
  );
  const finds = [...up.matchAll(/\$find\$([\s\S]*?)\$find\$/g)].map((match) => match[1]);
  assert.equal(finds.length, 2);
  const [exportFind, deletionFind] = finds;
  assert.ok(
    exportSource.includes(exportFind),
    "export text is not in the latest export definition",
  );
  assert.ok(
    deletionSource.includes(deletionFind),
    "deletion text is not in the account deletion definition",
  );
  assert.match(exportFind, /'messagesSent'/);
  assert.match(deletionFind, /delete from read_receipts/);
  // Later migrations must not have changed those definitions again.
  for (const file of fs.readdirSync(path.join(process.cwd(), "supabase/migrations")).sort()) {
    if (file <= "20261113090000_stall_history.sql" || file >= `${NAME}.sql`) continue;
    const later = readRepoFile(`supabase/migrations/${file}`);
    assert.doesNotMatch(
      later,
      /create or replace function app_private\.export_my_data\(\)/i,
      `${file} redefines export_my_data after the text this migration patches`,
    );
  }
  for (const file of fs.readdirSync(path.join(process.cwd(), "supabase/migrations")).sort()) {
    if (file <= "20261021100000_account_deletion_removes_profile.sql" || file >= `${NAME}.sql`)
      continue;
    const later = readRepoFile(`supabase/migrations/${file}`);
    assert.doesNotMatch(
      later,
      /create or replace function public\.anonymize_account_deletion_request\(/i,
      `${file} redefines anonymize_account_deletion_request after the text this migration patches`,
    );
  }
  // A patch that cannot find its text aborts instead of doing nothing.
  assert.match(up, /raise exception 'patch_function: % has % copies of the expected text'/);
  assert.match(up, /still mentions % but the expected text was not found/);
});

test("the down file recreates every table, function, trigger and policy that was dropped", () => {
  for (const table of DROPPED_TABLES) {
    assert.match(code(down), new RegExp(`create table if not exists public\\.${table}\\s*\\(`));
    assert.match(code(down), new RegExp(`alter table public\\.${table} enable row level security`));
  }
  for (const signature of DROPPED_FUNCTIONS) {
    const [schema, rest] = signature.split(".");
    const name = rest.slice(0, rest.indexOf("("));
    assert.match(
      code(down),
      new RegExp(`create or replace function ${schema}\\.${name}\\(`),
      `${signature} is not recreated`,
    );
  }
  for (const trigger of [
    "trg_enforce_conversation_participant_update_guard",
    "trg_enforce_message_update_guard",
    "trg_enforce_read_receipt_update_guard",
  ]) {
    assert.match(code(down), new RegExp(`create trigger ${trigger}`));
  }
  // The 0023 policies; read_receipts_upsert_reader is split per command, as 20260527145534 left it.
  const policies = listed(down, /create policy "?([a-z_]+)"?\s/gi);
  assert.deepEqual([...policies].sort(), [
    "conversation_participants_insert_creator_or_self",
    "conversation_participants_select_participant",
    "conversation_participants_update_self",
    "conversations_insert_creator",
    "conversations_select_participant",
    "conversations_update_participant",
    "messages_insert_sender_participant",
    "messages_select_participant",
    "messages_update_sender",
    "read_receipts_select_participant",
    "read_receipts_upsert_reader_delete",
    "read_receipts_upsert_reader_insert",
    "read_receipts_upsert_reader_update",
  ]);
  // The live policies call app_private.can_access_conversation / app_private.is_merchant_member:
  // 20260522142004 moved those functions with ALTER FUNCTION ... SET SCHEMA, and a policy follows
  // its function by OID. A public.* call inside a policy makes the schema after the down file differ
  // from the schema before the up migration (it failed the staging rehearsal on 12 policies).
  const downCode = code(down);
  const policyStart = downCode.indexOf("drop policy if exists");
  const policyEnd = downCode.indexOf("grant all on table public.conversations");
  assert.ok(
    policyStart >= 0 && policyEnd > policyStart,
    "policy section not found in the down file",
  );
  const policySql = downCode.slice(policyStart, policyEnd);
  assert.match(policySql, /app_private\.can_access_conversation\(/);
  assert.match(policySql, /app_private\.is_merchant_member\(/);
  assert.doesNotMatch(policySql, /public\.can_access_conversation\(/);
  assert.doesNotMatch(policySql, /public\.is_merchant_member\(/);
  assert.match(code(down), /read_receipts replica identity full/);
  assert.match(code(down), /alter publication supabase_realtime add table/);
  assert.match(code(down), /post_shares_target_conversation_id_fkey/);
  // A constraint name is only unique per table: every "does it exist" guard must be scoped to the
  // table, or a same-named foreign key on another table makes the guard skip the real one.
  const guards = [...code(down).matchAll(/from pg_constraint\s+where([^)]*)\)/g)].map((m) => m[1]);
  assert.equal(guards.length, 2, "expected one pg_constraint guard per recreated foreign key");
  assert.match(guards[0], /conname = 'read_receipts_message_conversation_fkey'/);
  assert.match(guards[0], /conrelid = 'public\.read_receipts'::regclass/);
  assert.match(guards[1], /conname = 'post_shares_target_conversation_id_fkey'/);
  assert.match(guards[1], /conrelid = 'public\.post_shares'::regclass/);
  // The up migration keeps post_shares.target_conversation_id values, so a surviving value points at
  // a conversation that is gone: that case adds the key NOT VALID (the restore script validates it);
  // otherwise it is added validated so the rehearsal fingerprint equals the pre-migration schema.
  const shareBlock = code(down).slice(code(down).indexOf("v_has_dangling_targets boolean"));
  assert.match(
    shareBlock,
    /target_conversation_id is not null\s+and not exists \(select 1 from public\.conversations c where c\.id = ps\.target_conversation_id\)/,
  );
  assert.match(shareBlock, /on delete set null\s+not valid;/);
  assert.match(
    shareBlock,
    /else\s+alter table public\.post_shares\s+add constraint post_shares_target_conversation_id_fkey\s+foreign key \(target_conversation_id\) references public\.conversations\(id\) on delete set null;/,
  );
  // The header must not promise a plain data-only restore: the restore script is the supported path.
  assert.match(down, /scripts\/db\/restore-chat-tables\.sh/);
  // Same privileges as production ended with: the phone cannot write messages directly.
  assert.match(
    code(down),
    /revoke insert, update, delete, truncate on table public\.messages from anon, authenticated/,
  );
  assert.match(
    code(down),
    /revoke insert, update on table public\.conversations from authenticated/,
  );
  assert.match(
    code(down),
    /revoke insert on table public\.conversation_participants from authenticated/,
  );
  // The rate rules come back with the values from 20261022120000.
  const rules = readRepoFile("supabase/migrations/20261022120000_api_request_rate_limits.sql");
  for (const rule of [
    "('rpc/send_chat_message', null, 60, 'chat')",
    "('rpc/open_chat_conversation', null, 30, 'chat')",
    "('read_receipts', null, 120, 'chat read receipts')",
  ]) {
    assert.ok(rules.includes(rule), `${rule} is not in the original rate rules`);
    assert.ok(down.includes(rule), `${rule} is not restored by the down file`);
  }
  // The down file restores the schema only; rows come from the backup.
  assert.match(down, /SCHEMA ONLY/);
  assert.doesNotMatch(code(down), /^\s*truncate\s/im);
});

test("the down file puts the chat text back where the up migration took it out", () => {
  const exportSource = readRepoFile("supabase/migrations/20261113090000_stall_history.sql");
  const deletionSource = readRepoFile(
    "supabase/migrations/20261021100000_account_deletion_removes_profile.sql",
  );
  const finds = [...down.matchAll(/\$find\$([\s\S]*?)\$find\$/g)].map((match) => match[1]);
  const repls = [...down.matchAll(/\$repl\$([\s\S]*?)\$repl\$/g)].map((match) => match[1]);
  assert.equal(finds.length, 2);
  assert.equal(repls.length, 2);
  // Each find is text that exists once in the pre-drop definition; each replacement is that text
  // plus exactly the chat block the up migration removed.
  const [exportBlock, deletionBlock] = [...up.matchAll(/\$find\$([\s\S]*?)\$find\$/g)].map(
    (m) => m[1],
  );
  assert.ok(exportSource.includes(finds[0]));
  assert.ok(deletionSource.includes(finds[1]));
  assert.ok(repls[0].includes(exportBlock), "export replacement does not restore the removed keys");
  assert.ok(
    repls[1].includes(deletionBlock),
    "deletion replacement does not restore the removed statements",
  );
  // Re-running the down file does not duplicate the text.
  assert.match(down, /where position\('conversation_participants' in/);
});

test("the backup script only reads, and the runbook names the order", () => {
  const script = readRepoFile("scripts/db/backup-chat-tables.sh");
  assert.match(script, /--data-only/);
  for (const table of DROPPED_TABLES) assert.match(script, new RegExp(`public\\.${table}\\b`));
  assert.doesNotMatch(script, /-c "\s*(drop|delete|update|insert|truncate|alter)\b/i);
  assert.doesNotMatch(script, /pg_restore(?! --list)/);
  // Counts and dump share one exported snapshot, held open while pg_dump runs, and it is read-only.
  assert.match(script, /begin isolation level repeatable read read only/);
  assert.match(script, /pg_export_snapshot\(\)/);
  assert.match(script, /pg_dump "\$DB_URL" .*--snapshot="\$SNAPSHOT"/);
  assert.ok(
    script.indexOf("--snapshot=") < script.indexOf('echo "rollback;" >&3'),
    "the snapshot session must stay open until pg_dump has finished",
  );
  const runbook = readRepoFile("supabase/manual/chat-db-drop-runbook.md");
  for (const step of [
    "backup-chat-tables.sh",
    "rehearse.sh 20261119090000",
    "ship.sh 20261119090000",
    "Ship the app without direct messages",
    "explicit approval",
    "restore-chat-tables.sh",
    "pg_export_snapshot",
  ]) {
    assert.ok(runbook.includes(step), `runbook is missing: ${step}`);
  }
});

test("the restore script reconciles deleted accounts before importing, in one transaction", () => {
  const script = readRepoFile("scripts/db/restore-chat-tables.sh");
  // One transaction, so an error leaves the database as it was.
  assert.match(script, /psql "\$DB_URL" -X -q -1 -v ON_ERROR_STOP=1 -f/);
  // Archive goes to a scratch schema first, not straight into the constrained tables.
  assert.match(script, /create schema chat_restore_scratch/);
  assert.match(script, /sed -E 's\/\^COPY public\\\./);
  for (const table of DROPPED_TABLES) {
    assert.match(
      script,
      new RegExp(`create table chat_restore_scratch\\.${table} \\(like public\\.${table}\\)`),
    );
    assert.match(
      script,
      new RegExp(`insert into public\\.${table} select \\* from chat_restore_scratch\\.${table}`),
    );
  }
  // Rows of deleted users and merchants are dropped with the live foreign keys' rules.
  assert.match(script, /public\.user_profiles/);
  assert.match(script, /public\.merchant_accounts/);
  assert.match(script, /set created_by_user_id = null/);
  assert.match(script, /set subject_merchant_account_id = null/);
  // SQL generation must fail loudly: pg_restore writes to a file with an explicit status check (no
  // `{ ...; } || die` group, where errexit is off and a failed `pg_restore | sed` would be masked),
  // every table must have a COPY section, and all of it happens before psql starts.
  const executable = script.replace(/^\s*#.*$/gm, "");
  assert.match(
    executable,
    /pg_restore --data-only --no-owner -f "\$WORK\/data\.raw\.sql" "\$BACKUP\/chat-data\.dump"[^\n]*\n\s*\|\| die/,
  );
  assert.doesNotMatch(executable, /pg_restore[^\n]*\|\s*sed/);
  assert.doesNotMatch(executable, /^\}\s*>"\$WORK\/restore\.sql"/m);
  assert.match(executable, /has no data section for \$t; refusing to import an incomplete archive/);
  assert.ok(
    executable.indexOf("has no data section") < executable.indexOf('psql "$DB_URL" -X -q -1'),
    "the dump must be validated before psql starts",
  );
  // post_shares targets that point nowhere become NULL, then the NOT VALID key is validated.
  assert.match(script, /set target_conversation_id = null/);
  assert.match(script, /validate constraint post_shares_target_conversation_id_fkey/);
  // It only restores into empty tables, never prints row data, and prod needs a typed confirmation.
  assert.match(script, /is not empty; this script only restores into empty tables/);
  assert.match(script, /Failing row/);
  assert.match(script, /CONFIRM_RESTORE/);
  assert.doesNotMatch(script.replace(/^\s*#.*$/gm, ""), /--single-transaction/);
});

// The chat RPCs are the only way a signed-in user can create a conversation. After the down file the
// tables exist but are empty, and scripts/db/restore-chat-tables.sh refuses non-empty tables, so the
// down file must leave the RPCs closed to `authenticated` until the restore transaction reopens them.
const CHAT_RPCS = [
  "public.open_chat_conversation(uuid, uuid, text)",
  "app_private.open_chat_conversation(uuid, uuid, text)",
  "public.send_chat_message(uuid, text, text, uuid)",
  "app_private.send_chat_message(uuid, text, text, uuid)",
  "public.mark_conversation_read(uuid)",
];

function normalizeSignature(signature: string): string {
  return signature
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim()
    .toLowerCase();
}

function privilegeStatements(
  sql: string,
  verb: "grant execute" | "revoke all",
): { signature: string; roles: string[] }[] {
  const pattern =
    verb === "grant execute"
      ? /grant execute on function ([a-z_.]+\([^)]*\)) to ([^;]+);/gi
      : /revoke all on function ([a-z_.]+\([^)]*\)) from ([^;]+);/gi;
  return [...code(sql).matchAll(pattern)].map((match) => ({
    signature: normalizeSignature(match[1]),
    roles: match[2].split(",").map((role) => role.trim().toLowerCase()),
  }));
}

function restoreSqlParts(script: string): { head: string; tail: string } {
  const heredoc = (name: string) => {
    const start = script.indexOf(`cat >"$WORK/${name}.sql" <<'SQL'\n`);
    assert.ok(start >= 0, `${name}.sql heredoc not found`);
    const bodyStart = script.indexOf("\n", start) + 1;
    return script.slice(bodyStart, script.indexOf("\nSQL\n", bodyStart));
  };
  return { head: heredoc("head"), tail: heredoc("tail") };
}

test("the down file leaves the chat RPCs executable by service_role only, until the restore reopens them", () => {
  const grants = privilegeStatements(down, "grant execute");
  const revokes = privilegeStatements(down, "revoke all");
  for (const signature of CHAT_RPCS) {
    const key = normalizeSignature(signature);
    const granted = grants.filter((grant) => grant.signature === key);
    assert.ok(granted.length > 0, `${signature} is not granted to anyone by the down file`);
    for (const grant of granted) {
      assert.deepEqual(
        grant.roles,
        ["service_role"],
        `${signature} must be granted to service_role only`,
      );
    }
    const revoked = revokes.filter((revoke) => revoke.signature === key);
    assert.ok(revoked.length > 0, `${signature} is not revoked from authenticated`);
    for (const revoke of revoked) {
      assert.ok(
        revoke.roles.includes("authenticated"),
        `${signature} revoke must include authenticated`,
      );
      assert.ok(revoke.roles.includes("anon") && revoke.roles.includes("public"));
    }
  }
  // No other statement in the file may hand a chat RPC to authenticated or anon.
  assert.doesNotMatch(
    code(down),
    /grant\s+(execute|all)[^;]*\b(open_chat_conversation|send_chat_message|mark_conversation_read)\b[^;]*\bto\b[^;]*\b(authenticated|anon|public)\b/i,
  );
  assert.doesNotMatch(
    code(down),
    /grant\s+execute\s+on\s+all\s+functions/i,
    "a blanket grant would reopen the chat RPCs",
  );
  // can_access_conversation only reads and is called by the row-level security policies, so it keeps
  // its original grant; it cannot create a row.
  const canAccess = grants.filter((grant) => grant.signature.includes("can_access_conversation"));
  assert.equal(canAccess.length, 2);
  for (const grant of canAccess) assert.deepEqual(grant.roles, ["authenticated", "service_role"]);
  // The reason and the manual way out are written where someone reading the file will see them.
  const runbook = readRepoFile("supabase/manual/chat-db-drop-runbook.md");
  for (const signature of CHAT_RPCS) {
    assert.ok(
      runbook.includes(`grant execute on function ${signature} to authenticated;`),
      `runbook does not list the manual grant for ${signature}`,
    );
  }
  assert.match(down, /RPC GRANTS:/);
  assert.match(down, /scripts\/db\/restore-chat-tables\.sh inside its restore transaction/);
});

test("the restore script reopens the chat RPCs to authenticated inside its transaction, before it drops the scratch schema", () => {
  const script = readRepoFile("scripts/db/restore-chat-tables.sh");
  const { tail } = restoreSqlParts(script);
  const tailCode = code(tail);
  const regranted = privilegeStatements(tail, "grant execute");
  for (const grant of regranted) assert.deepEqual(grant.roles, ["authenticated"]);
  // Exactly the functions the down file closed, no more and no fewer.
  assert.deepEqual(
    regranted.map((grant) => grant.signature).sort(),
    CHAT_RPCS.map(normalizeSignature).sort(),
  );
  const closedByDown = privilegeStatements(down, "grant execute")
    .filter((grant) => grant.roles.join() === "service_role")
    .map((grant) => grant.signature)
    .sort();
  assert.deepEqual(closedByDown, regranted.map((grant) => grant.signature).sort());
  // The original grants (authenticated + service_role) are what the pre-drop migrations ended with.
  const originalMarkRead = readRepoFile(
    "supabase/migrations/20261022150000_race_condition_fixes.sql",
  );
  assert.ok(
    originalMarkRead.includes(
      "grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;",
    ),
  );
  // Inside the transaction (the tail is part of the one psql -1 run), and last before the scratch drop.
  const dropAt = tailCode.indexOf("drop schema chat_restore_scratch cascade");
  assert.ok(dropAt > 0);
  const grantAt = tailCode.search(/grant execute on function/i);
  assert.ok(
    grantAt > 0 && grantAt < dropAt,
    "grants must come before the scratch schema is dropped",
  );
  assert.ok(
    tailCode.lastIndexOf("insert into public.read_receipts") < grantAt,
    "RPCs must only reopen after every row is imported",
  );
  assert.ok(
    tailCode.indexOf("validate constraint post_shares_target_conversation_id_fkey") < grantAt,
    "RPCs must only reopen after the post_shares key is validated",
  );
  // Nothing outside the single transaction changes privileges.
  const executable = script.replace(/^\s*#.*$/gm, "");
  const outside = executable.replace(/cat >"\$WORK\/(head|tail)\.sql" <<'SQL'[\s\S]*?\nSQL\n/g, "");
  assert.doesNotMatch(outside, /\bgrant\b|\brevoke\b/i);
  // Every function it regrants must exist before it starts.
  assert.match(script, /to_regprocedure\('\$fn'\) is not null/);
});

test("the restore script locks the four tables and checks they are empty inside the transaction", () => {
  const script = readRepoFile("scripts/db/restore-chat-tables.sh");
  const { head, tail } = restoreSqlParts(script);
  const headCode = code(head);
  const lockAt = headCode.search(
    /lock table public\.conversations, public\.conversation_participants, public\.messages, public\.read_receipts\s+in access exclusive mode;/,
  );
  const checkAt = headCode.indexOf("is not empty; this script only restores into empty tables");
  const scratchAt = headCode.indexOf("create schema chat_restore_scratch");
  assert.ok(lockAt >= 0, "head.sql does not lock the four tables");
  assert.ok(lockAt < checkAt, "the emptiness check must run after the lock");
  assert.ok(checkAt < scratchAt, "the emptiness check must run before anything is imported");
  for (const table of DROPPED_TABLES) {
    assert.match(headCode, new RegExp(`'${table}'`), `${table} is not part of the emptiness check`);
  }
  assert.match(headCode, /set lock_timeout = '\d+s';/);
  assert.ok(
    headCode.indexOf("set lock_timeout") < lockAt,
    "lock_timeout must be set before the lock is requested",
  );
  // The lock is held until COMMIT: the same single psql -1 run executes head, data and tail.
  assert.match(
    script,
    /cat "\$WORK\/head\.sql" "\$WORK\/data\.sql" "\$WORK\/tail\.sql" >"\$WORK\/restore\.sql"/,
  );
  assert.match(script, /psql "\$DB_URL" -X -q -1 -v ON_ERROR_STOP=1 -f "\$WORK\/restore\.sql"/);
  assert.doesNotMatch(tail, /\b(commit|begin)\b\s*;/i);
  assert.doesNotMatch(head, /\b(commit|begin)\b\s*;/i);
  // The old check ran in a separate session before the transaction began: it must not come back.
  const executable = script.replace(/^\s*#.*$/gm, "");
  assert.doesNotMatch(executable, /select count\(\*\) from public\.\$t"\)" = 0/);
  assert.ok(
    executable.indexOf('psql "$DB_URL" -X -q -1') > executable.indexOf("in access exclusive mode"),
    "the lock must be part of the SQL that psql runs",
  );
  // The "exactly one COPY section per table" validation is still there, before psql starts.
  assert.match(executable, /grep -c "\^COPY chat_restore_scratch\\\.\$t " "\$WORK\/data\.sql"/);
  assert.match(executable, /has no data section for \$t; refusing to import an incomplete archive/);
});

test("the smoke's leftover scan names messages after every statement that can take a table, including multi-table lists, while ignoring string literals", () => {
  const smoke = readRepoFile("supabase/smoke/drop_direct_message_chat.sql");
  assert.match(
    smoke,
    /regexp_replace\(p\.prosrc, '''\(\[\^''\]\|''''\)\*''', '''''', 'g'\)\s+as\s+body/,
  );
  const scan = [...smoke.matchAll(/stripped\.body ~\* '((?:[^']|'')+)'/g)].map((match) =>
    match[1].replace(/''/g, "'"),
  );
  assert.equal(scan.length, 2, "expected the two scan patterns");
  const upScan = [...up.matchAll(/p\.prosrc ~\* '([^']+)'/g)].map((match) => match[1]);
  // Same table-name pattern as the migration's own scan.
  assert.equal(scan[0], upScan[0]);
  // PostgreSQL's \m and \M (word start/end) are \b in JavaScript; \s and the rest are the same.
  const messages = new RegExp(scan[1].replace(/\\[mM]/g, "\\b"), "i");
  const stripSqlStrings = (sql: string) => sql.replace(/'([^']|'')*'/g, "''");
  for (const body of [
    "select 1 from messages",
    "insert into public.messages (id) values (1)",
    "update messages set body = ''",
    "select 1 from x join public.messages m on true",
    "delete from messages where true",
    "delete from x using messages m where true",
    "truncate messages",
    "truncate table public.messages",
    "truncate table public.other, public.messages",
    "truncate only messages",
    "TRUNCATE TABLE ONLY public.messages",
    "lock table messages in access exclusive mode",
    "lock table public.other, only public.messages in access exclusive mode",
    "lock public.messages",
    "alter table messages enable row level security",
    "alter table only public.messages add column x int",
    "drop table public.messages",
    "comment on table messages is 'x'",
    "create table t (m uuid references messages(id))",
    "create table t (m uuid references public.messages (id))",
    "copy public.messages from stdin",
    "select 1\n  from\n    public.messages",
  ]) {
    assert.match(stripSqlStrings(body), messages, `scan misses: ${body}`);
  }
  for (const body of [
    "select 'messagesSent'",
    "select 1 from chat_messages",
    "update chat_messages set body = '[deleted]'",
    "select 1 from public.messages_archive",
    "select 1 from app.messages",
    "insert into realtime.messages (topic) values ('x')",
    "raise exception 'too many messages'",
    "raise exception 'cannot copy messages'",
    "raise exception 'truncate table public.messages failed'",
    "select count_messages(1)",
  ]) {
    assert.doesNotMatch(stripSqlStrings(body), messages, `scan wrongly flags: ${body}`);
  }
  // The patterns are valid under standard_conforming_strings = on (their default): `\m`, `\M` and `\s`
  // are regex escapes inside the plain quotes, not string escapes. Do not double the backslashes.
  assert.doesNotMatch(smoke, /E'[^']*\\m/);
  assert.match(scan[1], /\\m\(/);
});

test("rehearse.sh runs the chat backup before up, verifies deferred grants after down, and runs restore before comparing the schema", () => {
  assert.match(down, /^-- pre-up-backup: scripts\/db\/backup-chat-tables\.sh$/m);
  assert.match(down, /^-- post-down-restore: scripts\/db\/restore-chat-tables\.sh$/m);
  const rehearse = readRepoFile("scripts/db/rehearse.sh");
  const backupAt = rehearse.indexOf('"$REPO_ROOT/$PRE_UP_BACKUP" staging');
  const upAt = rehearse.indexOf('apply_guarded "$UP" insert');
  const downAt = rehearse.indexOf('apply_guarded "$DOWN" delete', upAt);
  const closedCheckAt = rehearse.indexOf(
    'diff -q "$WORK/schema.before" "$WORK/schema.after_down"',
    downAt,
  );
  const restoreAt = rehearse.indexOf(
    '"$REPO_ROOT/$POST_DOWN_RESTORE" staging "$RESTORE_ARCHIVE_DIR"',
    downAt,
  );
  const schemaAfterAt = rehearse.indexOf(
    'dump_schema "$DB_URL" "${PGPASSWORD:-}" "$WORK/schema.after"',
    downAt,
  );
  assert.ok(backupAt > 0 && backupAt < upAt, "pre-up backup must run before up");
  assert.ok(upAt < downAt, "up must run before down");
  assert.ok(
    downAt < closedCheckAt && closedCheckAt < restoreAt,
    "closed-RPC check must run between down and restore",
  );
  assert.ok(restoreAt < schemaAfterAt, "restore must run before schema.after comparison");
});

test("nothing outside the migration history still reads or writes the dropped tables", () => {
  const roots = ["src", "scripts", "supabase/functions"];
  const offenders: string[] = [];
  const pattern =
    /\.from\(\s*["'](conversations|conversation_participants|messages|read_receipts)["']\s*\)|rpc\(\s*["'](open_chat_conversation|send_chat_message|mark_conversation_read)["']/;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") walk(full);
      } else if (/\.(ts|tsx|mjs|js)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
        if (pattern.test(fs.readFileSync(full, "utf8")))
          offenders.push(path.relative(process.cwd(), full));
      }
    }
  };
  for (const root of roots) walk(path.join(process.cwd(), root));
  assert.deepEqual(offenders, [], "these files still call the chat tables or RPCs");
});
