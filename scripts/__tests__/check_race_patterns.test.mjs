import assert from "node:assert/strict";
import test from "node:test";
import { checkMigration, checkTypeScript } from "../check-race-patterns.mjs";

const wrap = (body) => `create or replace function public.f() returns void language plpgsql as $$\n${body}\n$$;`;

test("flags count-then-insert without a lock", () => {
  const sql = wrap(`begin
    if (select count(*) from t where u = auth.uid()) >= 10 then
      raise exception 'too many';
    end if;
    insert into t (u) values (auth.uid());
  end;`);
  assert.equal(checkMigration({ name: "m.sql", sql }).length, 1);
});

test("accepts the same function with an advisory lock, a row lock or race-ok", () => {
  const body = `begin
    perform pg_advisory_xact_lock(hashtextextended('k', 0));
    if (select count(*) from t) >= 10 then raise exception 'x'; end if;
    insert into t (u) values (1);
  end;`;
  assert.deepEqual(checkMigration({ name: "m.sql", sql: wrap(body) }), []);
  const rowLock = body.replace(/perform pg_advisory[^;]*;/, "perform 1 from parent for no key update;");
  assert.deepEqual(checkMigration({ name: "m.sql", sql: wrap(rowLock) }), []);
  const waived = body.replace(/perform pg_advisory[^;]*;/, "-- race-ok: single caller, runs from cron");
  assert.deepEqual(checkMigration({ name: "m.sql", sql: wrap(waived) }), []);
});

test("flags max(position) + 1 inserts and counters recomputed from a snapshot", () => {
  const next = wrap(`begin insert into i (p) values ((select max(position) + 1 from i)); end;`);
  assert.equal(checkMigration({ name: "m.sql", sql: next }).length, 1);
  const counter = wrap(`begin update posts set like_count = (select count(*) from likes) where id = 1; end;`);
  assert.equal(checkMigration({ name: "m.sql", sql: counter }).length, 1);
});

test("INSERT .. ON CONFLICT counts as atomic", () => {
  const sql = wrap(`begin
    if exists (select 1 from t) then raise exception 'x'; end if;
    insert into t (u) values (1) on conflict do nothing;
  end;`);
  assert.deepEqual(checkMigration({ name: "m.sql", sql }), []);
});

test("flags a counter written back from a value read first", () => {
  const bad = `await client.from("t").update({ bumps: Number(row.bumps ?? 0) + 1 }).eq("id", id);`;
  assert.equal(checkTypeScript({ name: "a.ts", text: bad }).length, 1);
  const ok = `await client.rpc("bump", { p_id: id });`;
  assert.deepEqual(checkTypeScript({ name: "a.ts", text: ok }), []);
  assert.deepEqual(
    checkTypeScript({ name: "a.ts", text: `// race-ok: compare-and-set on attempts\n${bad}` }),
    [],
  );
});
