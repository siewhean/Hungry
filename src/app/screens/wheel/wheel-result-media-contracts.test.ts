import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(
  path.join(process.cwd(), "src/app/screens/wheel/WheelResultModal.tsx"),
  "utf8",
);

test("mock Wheel winners disclose representative media instead of claiming an exact photo", () => {
  assert.match(source, /getServiceProvider\(\)\.mode === "mock"/);
  assert.match(source, /REPRESENTATIVE · NOT EXACT PHOTO/);
  assert.match(source, /isMockDataSource \? " representative image" : " photo"/);
});
