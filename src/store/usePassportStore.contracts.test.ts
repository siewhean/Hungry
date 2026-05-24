import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("passport store exposes stamp selector and celebration marker contract", () => {
  const source = read("src/store/usePassportStore.ts");

  assert.match(source, /getEarnedStamps: \(\) => EarnedPassportStamp\[\]/);
  assert.match(source, /getNextStamp: \(\) => PassportNextStamp \| null/);
  assert.match(source, /getNewlyEarnedUncelebratedStamp: \(\) => EarnedPassportStamp \| null/);
  assert.match(source, /getCelebrateMarker: \(\) => PassportCelebrateMarker \| null/);
  assert.match(source, /markStampCelebrated: \(stampId: string\) => void/);
  assert.match(source, /celebratedStampIds: Record<string, boolean>/);
});
