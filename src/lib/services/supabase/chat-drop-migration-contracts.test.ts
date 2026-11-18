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
  assert.match(code(down), /read_receipts replica identity full/);
  assert.match(code(down), /alter publication supabase_realtime add table/);
  assert.match(code(down), /post_shares_target_conversation_id_fkey/);
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
  const runbook = readRepoFile("supabase/manual/chat-db-drop-runbook.md");
  for (const step of [
    "backup-chat-tables.sh",
    "rehearse.sh 20261119090000",
    "ship.sh 20261119090000",
    "Ship the app without direct messages",
    "explicit approval",
    "pg_restore --data-only",
  ]) {
    assert.ok(runbook.includes(step), `runbook is missing: ${step}`);
  }
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
