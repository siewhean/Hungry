import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { typography } from "@/theme/tokens";

const root = path.resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

test("SR5-7: the price token is Nunito semibold with tabular digits, the size of the meta line", () => {
  assert.equal(typography.price.fontFamily, "Nunito_600SemiBold");
  assert.deepEqual(typography.price.fontVariant, ["tabular-nums"]);
  assert.equal(typography.price.fontSize, typography.bodySmall.fontSize);
  assert.equal(typography.price.lineHeight, typography.bodySmall.lineHeight);
});

test("SR5-7: no screen or component sets DM Mono on a price", () => {
  // DM Mono stays for the `code` token and the developer launcher only.
  const allowed = new Set([
    path.join(root, "src/theme/tokens.ts"),
    path.join(root, "src/theme/index.tsx"),
    path.join(root, "src/app/screens/dev/DeveloperLauncherScreen.tsx"),
  ]);
  const offenders = sourceFiles(path.join(root, "src")).filter(
    (file) => !allowed.has(file) && /DMMono|DM Mono/.test(readFileSync(file, "utf8")),
  );
  assert.deepEqual(offenders, []);
});
