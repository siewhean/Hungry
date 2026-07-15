import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const avatar = readFileSync(resolve(process.cwd(), "src/components/ui/Avatar.tsx"), "utf8");
const stallDetail = readFileSync(
  resolve(process.cwd(), "src/app/screens/detail/StallDetailScreen.tsx"),
  "utf8",
);

test("Avatar falls back to the bundled mark after a remote image failure", () => {
  assert.match(avatar, /onError=\{\(\) => setRemoteImageFailed\(true\)\}/);
  assert.match(avatar, /showRemoteImage \? \(/);
  assert.match(avatar, /source=\{DEFAULT_USER_AVATAR\}/);
});

test("stall reviews use the resilient shared Avatar", () => {
  assert.match(
    stallDetail,
    /<Avatar uri=\{review\.avatarUrl\} name=\{review\.authorName\} size=\{40\} \/>/,
  );
});
