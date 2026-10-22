import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { checkMigrationSafety, CUTOFF_VERSION, PROD_REF } from "../check-migration-safety.mjs";

const sha = (t) => createHash("sha256").update(t).digest("hex");
const version = String(Number(CUTOFF_VERSION) + 1);
const name = `${version}_add_thing.sql`;
const up = "-- smoke: supabase/smoke/thing.sql\nalter table public.t add column c int;\n";
const down = "alter table public.t drop column c; -- rollback_archive not needed\n";
const evidence = (over = {}) => ({
  name: `${version}.json`,
  json: {
    version,
    result: "pass",
    staging_ref: "stagingref",
    prod_schema_matched: true,
    up_sha256: sha(up),
    down_sha256: sha(down),
    steps: {
      backup: true,
      up: true,
      down: true,
      schema_roundtrip: true,
      data_roundtrip: true,
      reapply: true,
    },
    rows_lost: [],
    ...over,
  },
});
const state = (over = {}) => ({
  migrations: [{ name, sql: up }],
  rollbacks: [{ name: `${version}_add_thing.down.sql`, sql: down }],
  rehearsals: [evidence()],
  smokes: ["supabase/smoke/thing.sql"],
  ...over,
});

test("a migration with down file, smoke and matching evidence passes", () => {
  assert.deepEqual(checkMigrationSafety(state()), []);
});

test("migrations at or below the cutoff are not checked", () => {
  const old = { name: `${CUTOFF_VERSION}_old.sql`, sql: "select 1;" };
  assert.deepEqual(
    checkMigrationSafety(state({ migrations: [old], rollbacks: [], rehearsals: [] })),
    [],
  );
});

test("missing down file fails unless waived with a reason", () => {
  assert.match(checkMigrationSafety(state({ rollbacks: [] }))[0], /missing supabase\/rollbacks/);
  const waived = `-- no-down: additive column, forward fix is the plan\n${up}`;
  const problems = checkMigrationSafety(
    state({
      migrations: [{ name, sql: waived }],
      rollbacks: [],
      rehearsals: [
        evidence({ up_sha256: sha(waived), down_sha256: "", steps: { backup: true, up: true } }),
      ],
    }),
  );
  assert.deepEqual(problems, []);
});

test("a one-word waiver reason is rejected", () => {
  const bad = `-- no-down: skip\n${up}`;
  assert.match(
    checkMigrationSafety(state({ migrations: [{ name, sql: bad }], rollbacks: [] })).join("\n"),
    /reason of at least 10/,
  );
});

test("missing or stale rehearsal evidence fails", () => {
  assert.match(checkMigrationSafety(state({ rehearsals: [] }))[0], /no staging rehearsal evidence/);
  assert.match(
    checkMigrationSafety(state({ rehearsals: [evidence({ up_sha256: "x" })] })).join("\n"),
    /migration changed since it was rehearsed/,
  );
  assert.match(
    checkMigrationSafety(state({ rehearsals: [evidence({ down_sha256: "x" })] })).join("\n"),
    /down migration changed/,
  );
});

test("evidence from the production project is rejected", () => {
  assert.match(
    checkMigrationSafety(state({ rehearsals: [evidence({ staging_ref: PROD_REF })] })).join("\n"),
    /other than production/,
  );
});

test("evidence that skipped the staging-vs-prod schema comparison is rejected", () => {
  assert.match(
    checkMigrationSafety(state({ rehearsals: [evidence({ prod_schema_matched: false })] })).join(
      "\n",
    ),
    /not verified against production/,
  );
});

test("failed round trip steps and lost rows are rejected", () => {
  const e = evidence();
  e.json.steps.schema_roundtrip = false;
  e.json.rows_lost = ["public.dishes"];
  const text = checkMigrationSafety(state({ rehearsals: [e] })).join("\n");
  assert.match(text, /schema_roundtrip/);
  assert.match(text, /rows were lost in public\.dishes/);
});

test("begin/commit in a new migration is rejected", () => {
  const withTx = `${up}begin;\ncommit;\n`;
  assert.match(
    checkMigrationSafety(
      state({
        migrations: [{ name, sql: withTx }],
        rehearsals: [evidence({ up_sha256: sha(withTx) })],
      }),
    ).join("\n"),
    /remove begin\/commit/,
  );
});

test("a destructive down must archive data first", () => {
  const lossy = "drop table public.thing;\n";
  const text = checkMigrationSafety(
    state({
      rollbacks: [{ name: `${version}_add_thing.down.sql`, sql: lossy }],
      rehearsals: [evidence({ down_sha256: sha(lossy) })],
    }),
  ).join("\n");
  assert.match(text, /rollback_archive/);
  const archived =
    "create schema if not exists rollback_archive;\ncreate table rollback_archive.thing as select * from public.thing;\ndrop table public.thing;\n";
  assert.deepEqual(
    checkMigrationSafety(
      state({
        rollbacks: [{ name: `${version}_add_thing.down.sql`, sql: archived }],
        rehearsals: [evidence({ down_sha256: sha(archived) })],
      }),
    ),
    [],
  );
});

test("a down file without a migration, a missing smoke header and a missing smoke file fail", () => {
  assert.match(
    checkMigrationSafety(
      state({
        rollbacks: [
          { name: "20270101000000_ghost.down.sql", sql: "select 1;" },
          ...state().rollbacks,
        ],
      }),
    ).join("\n"),
    /no matching migration/,
  );
  const noSmoke = "alter table public.t add column c int;\n";
  assert.match(
    checkMigrationSafety(
      state({
        migrations: [{ name, sql: noSmoke }],
        rehearsals: [evidence({ up_sha256: sha(noSmoke) })],
      }),
    ).join("\n"),
    /add a "-- smoke:/,
  );
  assert.match(
    checkMigrationSafety(state({ smokes: [] })).join("\n"),
    /smoke file .* does not exist/,
  );
});

test("duplicate versions are rejected", () => {
  const dup = [
    { name: "20260101000000_a.sql", sql: "" },
    { name: "20260101000000_b.sql", sql: "" },
  ];
  assert.match(
    checkMigrationSafety(state({ migrations: dup, rollbacks: [], rehearsals: [] }))[0],
    /also used by/,
  );
});
