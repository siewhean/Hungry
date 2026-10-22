// CI guard: every endpoint someone could call in a loop has a rate limit or an explicit exemption.
//
//   * REST: each RPC that the anon role can execute needs a row with an anon cap in
//     app_private.request_rate_rules (seeded in a migration), or an entry with a reason in
//     supabase/rate-limit-allowlist.json (covered by the default cap, or not callable in a loop).
//   * Edge Functions: each function needs a limiter call, or a secret-token guard, or an
//     allowlist entry with a reason.
//   * The pre-request hook that enforces the REST limits must still be switched on.
//
// Why migrations and not the database: CI has no database. The anon grants are replayed from
// the migrations in filename order, the way Postgres would have applied them (a new public
// function is executable by anon until a migration revokes it, because Supabase's default
// privileges grant it).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RULES_TABLE = "app_private.request_rate_rules";
const HOOK_FUNCTION = "app_private.check_request_rate";

const LIMITER_MARKERS = [
  /app_can_make_ip_request/,
  /app_can_make_user_request/,
  /app_can_make_ops_request/,
  /rate_limited/,
  /_PER_(?:MINUTE|HOUR|DAY)\b/,
];
const TOKEN_MARKERS = [
  /ACCOUNT_DELETION_WORKER_TOKEN/,
  /TASTE_TAGGING_WORKER_TOKEN/,
  /NOTIFICATION_WORKER_TOKEN/,
  /ORPHAN_MEDIA_WORKER_TOKEN/,
  /GUEST_SESSION_API_KEY/,
];

function stripSqlComments(sql) {
  // Line comments first: they can contain "/*" (for example "GET /rpc/*") that is not a block comment.
  return sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

function rolesInclude(roleList, role) {
  return roleList
    .split(",")
    .map((r) => r.trim().replace(/"/g, "").toLowerCase())
    .includes(role);
}

/** Replays the migrations and returns what anon can execute and which rate-limit rows exist. */
export function analyzeMigrations(migrationsDir) {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const functions = new Map(); // name -> { anon: boolean, trigger: boolean }
  const rules = new Map(); // route -> { anon: number | null, user: number | null }
  let hookOn = false;

  for (const file of files) {
    const sql = stripSqlComments(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
    const events = [];

    for (const m of sql.matchAll(
      /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi,
    )) {
      const after = sql.slice(m.index + m[0].length, m.index + m[0].length + 3000);
      const bodyStart = after.search(/\bas\s+(?:\$|')/i);
      const head = bodyStart === -1 ? after : after.slice(0, bodyStart);
      events.push({
        at: m.index,
        type: "create",
        name: m[1].toLowerCase(),
        trigger: /\breturns\s+trigger\b/i.test(head),
      });
    }
    for (const m of sql.matchAll(
      /drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*(?:\([^)]*\))?\s*(?:cascade|restrict)?\s*;/gi,
    )) {
      events.push({ at: m.index, type: "drop", name: m[1].toLowerCase() });
    }
    for (const m of sql.matchAll(
      /\b(grant|revoke)\s+(?:all|execute)(?:\s+privileges)?\s+on\s+function\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*(?:\([^;]*?\))?\s+(to|from)\s+([^;]+);/gi,
    )) {
      if (rolesInclude(m[4], "anon")) {
        events.push({
          at: m.index,
          type: m[1].toLowerCase() === "grant" ? "grant-anon" : "revoke-anon",
          name: m[2].toLowerCase(),
        });
      }
    }
    for (const m of sql.matchAll(
      /revoke\s+(?:all|execute)(?:\s+privileges)?\s+on\s+all\s+functions\s+in\s+schema\s+public\s+from\s+([^;]+);/gi,
    )) {
      if (rolesInclude(m[1], "anon")) events.push({ at: m.index, type: "revoke-all-anon" });
    }
    for (const m of sql.matchAll(/insert\s+into\s+app_private\.request_rate_rules\b[\s\S]*?;/gi)) {
      for (const t of m[0].matchAll(/\(\s*'([^']+)'\s*,\s*(\d+|null)\s*,\s*(\d+|null)\s*,/gi)) {
        events.push({
          at: m.index + t.index,
          type: "rule",
          route: t[1],
          anon: /^\d+$/.test(t[2]) ? Number(t[2]) : null,
          user: /^\d+$/.test(t[3]) ? Number(t[3]) : null,
        });
      }
    }
    for (const m of sql.matchAll(
      /delete\s+from\s+app_private\.request_rate_rules\s+where\s+route\s*=\s*'([^']+)'/gi,
    )) {
      events.push({ at: m.index, type: "rule-delete", route: m[1] });
    }
    for (const m of sql.matchAll(/pgrst\.db_pre_request\b[^;]*;/gi)) {
      const before = sql.slice(Math.max(0, m.index - 40), m.index).toLowerCase();
      const setting = m[0].toLowerCase();
      events.push({
        at: m.index,
        type: "hook",
        on: /\bset\b/.test(before) && setting.includes(HOOK_FUNCTION),
      });
    }

    events.sort((a, b) => a.at - b.at);
    for (const e of events) {
      if (e.type === "create") {
        const known = functions.get(e.name);
        // A function created for the first time is executable by anon through default privileges;
        // replacing an existing one keeps whatever grants it had.
        functions.set(e.name, { anon: known ? known.anon : true, trigger: e.trigger });
      } else if (e.type === "drop") {
        functions.delete(e.name);
      } else if (e.type === "grant-anon" || e.type === "revoke-anon") {
        const known = functions.get(e.name);
        if (known) known.anon = e.type === "grant-anon";
      } else if (e.type === "revoke-all-anon") {
        for (const fn of functions.values()) fn.anon = false;
      } else if (e.type === "rule") {
        rules.set(e.route, { anon: e.anon, user: e.user });
      } else if (e.type === "rule-delete") {
        rules.delete(e.route);
      } else if (e.type === "hook") {
        hookOn = e.on;
      }
    }
  }

  const anonRpcs = [...functions.entries()]
    .filter(([, fn]) => fn.anon && !fn.trigger)
    .map(([name]) => name)
    .sort();
  return { anonRpcs, allFunctions: new Set(functions.keys()), rules, hookOn };
}

export function listEdgeFunctions(functionsDir) {
  const result = [];
  for (const entry of fs.readdirSync(functionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const indexPath = path.join(functionsDir, entry.name, "index.ts");
    if (!fs.existsSync(indexPath)) continue;
    const source = fs.readFileSync(indexPath, "utf8");
    result.push({
      name: entry.name,
      limited: LIMITER_MARKERS.some((marker) => marker.test(source)),
      tokenGated: TOKEN_MARKERS.some((marker) => marker.test(source)),
    });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export function findProblems({ migrations, edgeFunctions, allowlist }) {
  const problems = [];
  const allowedRpcs = allowlist.anonRpcs ?? {};
  const allowedEdge = allowlist.edgeFunctions ?? {};

  if (!migrations.hookOn) {
    problems.push(
      `The REST limiter is not switched on: no migration leaves pgrst.db_pre_request = '${HOOK_FUNCTION}' (see 20261022120000_api_request_rate_limits.sql).`,
    );
  }
  if (!migrations.rules.has("*")) {
    problems.push(`${RULES_TABLE} has no '*' default row.`);
  }

  for (const name of migrations.anonRpcs) {
    const rule = migrations.rules.get(`rpc/${name}`);
    const hasAnonCap = rule && rule.anon !== null;
    const allowed = Object.hasOwn(allowedRpcs, name);
    if (!hasAnonCap && !allowed) {
      problems.push(
        `RPC ${name} is callable by anon but has no rate limit. Add ('rpc/${name}', <anon per minute>, <user per minute>, '<note>') to ${RULES_TABLE} in a migration, ` +
          `or revoke execute from anon, or list it in supabase/rate-limit-allowlist.json with a reason.`,
      );
    }
    if (hasAnonCap && allowed) {
      problems.push(`RPC ${name} has a rule and an allowlist entry; remove the allowlist entry.`);
    }
  }
  for (const [name, reason] of Object.entries(allowedRpcs)) {
    if (!String(reason).trim()) problems.push(`Allowlist entry for RPC ${name} needs a reason.`);
    if (!migrations.anonRpcs.includes(name)) {
      problems.push(
        `Allowlist entry for RPC ${name} is stale: no migration leaves it executable by anon.`,
      );
    }
  }
  for (const route of migrations.rules.keys()) {
    if (route.startsWith("rpc/") && !migrations.allFunctions.has(route.slice(4))) {
      problems.push(`Rate rule '${route}' names a function no migration creates (typo?).`);
    }
  }

  for (const fn of edgeFunctions) {
    const allowed = Object.hasOwn(allowedEdge, fn.name);
    if (!fn.limited && !fn.tokenGated && !allowed) {
      problems.push(
        `Edge Function ${fn.name} has no rate limit. Call app_can_make_ip_request (before auth) and app_can_make_user_request (after), ` +
          `or guard it with a worker token, or list it in supabase/rate-limit-allowlist.json with a reason.`,
      );
    }
    if ((fn.limited || fn.tokenGated) && allowed) {
      problems.push(`Edge Function ${fn.name} is limited already; remove its allowlist entry.`);
    }
  }
  for (const [name, reason] of Object.entries(allowedEdge)) {
    if (!String(reason).trim())
      problems.push(`Allowlist entry for Edge Function ${name} needs a reason.`);
    if (!edgeFunctions.some((fn) => fn.name === name)) {
      problems.push(`Allowlist entry for Edge Function ${name} is stale: no such function.`);
    }
  }
  return problems;
}

function main() {
  const root = process.cwd();
  const allowlistPath = path.join(root, "supabase", "rate-limit-allowlist.json");
  const allowlist = fs.existsSync(allowlistPath)
    ? JSON.parse(fs.readFileSync(allowlistPath, "utf8"))
    : {};
  const problems = findProblems({
    migrations: analyzeMigrations(path.join(root, "supabase", "migrations")),
    edgeFunctions: listEdgeFunctions(path.join(root, "supabase", "functions")),
    allowlist,
  });
  if (problems.length > 0) {
    console.error(problems.map((p) => `- ${p}`).join("\n"));
    process.exit(1);
  }
  console.log("Rate-limit contract passed.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
