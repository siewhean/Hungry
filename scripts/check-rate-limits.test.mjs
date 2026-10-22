import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeMigrations, findProblems, listEdgeFunctions } from "./check-rate-limits.mjs";

const HOOK = `
insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('*', 120, 300, 'default')
on conflict (route) do nothing;
alter role authenticator set pgrst.db_pre_request = 'app_private.check_request_rate';
`;

function project(migrations, edgeFunctions = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rate-limits-"));
  fs.mkdirSync(path.join(dir, "migrations"));
  fs.mkdirSync(path.join(dir, "functions"));
  Object.entries(migrations).forEach(([name, sql]) =>
    fs.writeFileSync(path.join(dir, "migrations", name), sql),
  );
  Object.entries(edgeFunctions).forEach(([name, source]) => {
    fs.mkdirSync(path.join(dir, "functions", name));
    fs.writeFileSync(path.join(dir, "functions", name, "index.ts"), source);
  });
  return {
    migrations: analyzeMigrations(path.join(dir, "migrations")),
    edgeFunctions: listEdgeFunctions(path.join(dir, "functions")),
  };
}

const run = (p, allowlist = {}) => findProblems({ ...p, allowlist });

test("a new public function is anon-callable by default and must be limited", () => {
  const p = project({
    "001_hook.sql": HOOK,
    "002_fn.sql":
      "create or replace function public.list_things() returns setof int language sql as $$ select 1 $$;",
  });
  assert.deepEqual(p.migrations.anonRpcs, ["list_things"]);
  const problems = run(p);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /list_things/);
});

test("a rule with an anon cap, an allowlist entry, or a revoke each clear it", () => {
  const fn =
    "create function public.list_things() returns setof int language sql as $$ select 1 $$;";
  const withRule = project({
    "001_hook.sql": HOOK,
    "002_fn.sql": fn,
    "003_rule.sql":
      "insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values ('rpc/list_things', 30, 60, 'x');",
  });
  assert.deepEqual(run(withRule), []);

  const base = project({ "001_hook.sql": HOOK, "002_fn.sql": fn });
  assert.deepEqual(run(base, { anonRpcs: { list_things: "cheap helper" } }), []);

  const revoked = project({
    "001_hook.sql": HOOK,
    "002_fn.sql": fn,
    "003_revoke.sql":
      "revoke all on function public.list_things() from public, anon, authenticated;",
  });
  assert.deepEqual(revoked.migrations.anonRpcs, []);
  assert.deepEqual(run(revoked), []);
});

test("a rule with no anon cap does not count, and a later grant re-opens a revoked function", () => {
  const p = project({
    "001_hook.sql": HOOK,
    "002_fn.sql":
      "create function public.list_things() returns int language sql as $$ select 1 $$;",
    "003_rule.sql":
      "insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values ('rpc/list_things', null, 60, 'x');",
  });
  assert.equal(run(p).length, 1);

  const reopened = project({
    "001_hook.sql": HOOK,
    "002_fn.sql":
      "create function public.list_things() returns int language sql as $$ select 1 $$;",
    "003_revoke.sql": "revoke execute on function public.list_things() from anon;",
    "004_grant.sql": "grant execute on function public.list_things() to anon, authenticated;",
  });
  assert.deepEqual(reopened.migrations.anonRpcs, ["list_things"]);
});

test("trigger functions and app_private functions are not RPCs", () => {
  const p = project({
    "001_hook.sql": HOOK,
    "002_fn.sql": `
      create function public.touch() returns trigger language plpgsql as $$ begin return new; end $$;
      create function app_private.secret() returns int language sql as $$ select 1 $$;`,
  });
  assert.deepEqual(p.migrations.anonRpcs, []);
});

test("a comment mentioning /* does not hide the statements after it", () => {
  const p = project({
    "001_hook.sql": `-- covers GET /rpc/* too\n${HOOK}`,
  });
  assert.equal(p.migrations.hookOn, true);
  assert.equal(p.migrations.rules.has("*"), true);
});

test("the hook must be on, and rules must name real functions", () => {
  const off = project({
    "001_hook.sql": HOOK,
    "002_off.sql": "alter role authenticator reset pgrst.db_pre_request;",
  });
  assert.match(run(off).join("\n"), /not switched on/);

  const typo = project({
    "001_hook.sql": HOOK,
    "002_rule.sql":
      "insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values ('rpc/nope', 1, 1, 'x');",
  });
  assert.match(run(typo).join("\n"), /rpc\/nope.*no migration creates/);
});

test("stale allowlist entries are reported", () => {
  const p = project({ "001_hook.sql": HOOK });
  assert.match(run(p, { anonRpcs: { gone: "reason" } }).join("\n"), /stale/);
  assert.match(run(p, { edgeFunctions: { gone: "reason" } }).join("\n"), /stale/);
});

test("Edge Functions need a limiter, a worker token, or an allowlist entry", () => {
  const p = project(
    { "001_hook.sql": HOOK },
    {
      open: "Deno.serve(() => new Response('hi'));",
      limited:
        "await client.rpc('app_can_make_ip_request', {}); Deno.serve(() => new Response('hi'));",
      worker:
        "const t = Deno.env.get('NOTIFICATION_WORKER_TOKEN'); Deno.serve(() => new Response('hi'));",
    },
  );
  const problems = run(p);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Edge Function open/);
  assert.deepEqual(run(p, { edgeFunctions: { open: "static health check" } }), []);
});

test("a rate rule on a STABLE or IMMUTABLE RPC is refused until it is made VOLATILE", () => {
  const rule =
    "insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values ('rpc/list_things', 30, 60, 'x');";
  const stableAfterBody = project({
    "001_hook.sql": HOOK,
    "002_fn.sql":
      "create function public.list_things() returns int as $$ select 1 $$ language sql stable;",
    "003_rule.sql": rule,
  });
  assert.match(run(stableAfterBody).join("\n"), /list_things.*STABLE or IMMUTABLE/);

  const stableBeforeBody = project({
    "001_hook.sql": HOOK,
    "002_fn.sql":
      "create function public.list_things() returns int language sql immutable as $$ select 1 $$;",
    "003_rule.sql": rule,
  });
  assert.match(run(stableBeforeBody).join("\n"), /list_things.*STABLE or IMMUTABLE/);

  const fixed = project({
    "001_hook.sql": HOOK,
    "002_fn.sql":
      "create function public.list_things() returns int as $$ select 1 $$ language sql stable;",
    "003_rule.sql": rule,
    "004_vol.sql": "alter function public.list_things() volatile;",
  });
  assert.deepEqual(run(fixed), []);

  const recreatedStable = project({
    "001_hook.sql": HOOK,
    "002_fn.sql":
      "create function public.list_things() returns int language sql as $$ select 1 $$;",
    "003_rule.sql": rule,
    "004_replace.sql":
      "create or replace function public.list_things() returns int language sql stable as $$ select 2 $$;",
  });
  assert.equal(run(recreatedStable).length, 1);

  const volatileDefault = project({
    "001_hook.sql": HOOK,
    "002_fn.sql":
      "create function public.list_things() returns int language plpgsql as $$ begin return 1; end $$;",
    "003_rule.sql": rule,
  });
  assert.deepEqual(run(volatileDefault), []);
});
