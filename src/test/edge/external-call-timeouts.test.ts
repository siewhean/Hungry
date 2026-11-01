// Every call an Edge Function makes to another company's API has a time limit, so a provider that
// stops answering cannot hold the function open. New calls must carry one too.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const FUNCTIONS_DIR = path.join(process.cwd(), "supabase", "functions");

function sourceFiles(): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(FUNCTIONS_DIR, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const inner of readdirSync(path.join(FUNCTIONS_DIR, entry.name))) {
        if (inner.endsWith(".ts") && !inner.endsWith(".test.ts")) {
          files.push(path.join(FUNCTIONS_DIR, entry.name, inner));
        }
      }
    }
  }
  return files;
}

test("every fetch in an Edge Function sets a timeout signal", () => {
  const missing: string[] = [];
  let calls = 0;
  for (const file of sourceFiles()) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (!/\bfetch\(/.test(line) || line.trim().startsWith("//") || line.includes("function ")) {
        return;
      }
      calls += 1;
      // The options object follows within a few lines of the call.
      const nearby = lines.slice(index, index + 14).join("\n");
      if (!nearby.includes("AbortSignal.timeout(")) {
        missing.push(`${path.relative(process.cwd(), file)}:${index + 1}`);
      }
    });
  }
  assert.ok(calls >= 8, `expected to find the Edge Functions' fetch calls, found ${calls}`);
  assert.deepEqual(missing, [], "these fetch calls have no AbortSignal.timeout");
});

test("the time limits are short enough to matter and long enough to work", () => {
  const source = readFileSync(path.join(FUNCTIONS_DIR, "_shared", "timeouts.ts"), "utf8");
  const limits = [...source.matchAll(/^\s+(\w+): ([\d_]+),/gm)].map((m) => [
    m[1],
    Number(m[2].replace(/_/g, "")),
  ]);
  assert.ok(limits.length >= 5);
  for (const [name, ms] of limits) {
    assert.ok(Number(ms) >= 5_000 && Number(ms) <= 60_000, `${name} is ${ms} ms`);
  }
});
