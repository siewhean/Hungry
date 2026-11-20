import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Contract for the zone hours script (build plan package 1.3). The planner is tested in
// zone-hours-plan.test.ts; these checks keep the writer safe without needing a database.
const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const script = readFileSync(path.join(repoRoot, "scripts/db/fill-zone-hours.sh"), "utf8");

test("it is a dry run unless --apply is given", () => {
  assert.match(script, /APPLY=0/);
  assert.match(script, /if \[ "\$APPLY" -ne 1 \]; then[^\n]*exit 0/);
});

test("it only fills stalls with no schedule yet, in one statement", () => {
  assert.match(script, /v\.opening_schedule is null and \$SCOPE/);
  assert.match(script, /where v\.id::text = d\.id and v\.opening_schedule is null/);
});

test("it checks the environment through the shared helper and keeps an undo list", () => {
  assert.match(script, /load_env "\$TARGET"/);
  assert.match(script, /--undo FILE/);
  assert.match(script, /\[ ! -e "\$UNDO_FILE" \]/);
  // The undo list comes from the rows the UPDATE returned, and only unchanged schedules are cleared.
  assert.match(script, /returning v\.id, v\.opening_schedule as schedule/);
  assert.match(script, /v\.opening_schedule = d\.schedule/);
});

test("the undo list is replaced by one rename, never a partial copy", () => {
  assert.match(script, /TMP_UNDO="\$\(mktemp "\$UNDO_FILE\.XXXXXX"\)"/);
  assert.match(script, /mv "\$TMP_UNDO" "\$UNDO_FILE"/);
});

test("it never invents hours: only the planner's schedules are written", () => {
  assert.match(script, /scripts\/hours\/zone-hours-plan\.ts/);
  assert.doesNotMatch(script, /insert into public\.venues/i);
});

test("big lists go to psql by file, never as a command-line argument", () => {
  assert.doesNotMatch(script, /-v (updates|undo)="\$\(cat/);
  assert.match(script, /\\set updates `cat :'updates_file'`/);
  assert.match(script, /\\set undo `cat :'undo_file'`/);
});

test("venue ids are compared as text, so a text or uuid id column both work", () => {
  assert.match(script, /as d\(id text, schedule jsonb\)/);
  assert.match(script, /v\.id::text = d\.id and v\.opening_schedule is null/);
  assert.doesNotMatch(script, /as d\(id uuid/);
});
