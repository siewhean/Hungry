import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

// Local Release builds run from a checkout under "/Users/Siew Hean/...". Without quoting,
// basename splits the path, app.config is never bundled and the app crashes on launch.
test("expo-constants iOS app-config script quotes PROJECT_DIR", () => {
  const script = readFileSync(
    resolve(process.cwd(), "node_modules/expo-constants/scripts/get-app-config-ios.sh"),
    "utf8",
  );
  assert.match(script, /basename "\$PROJECT_DIR"/);
});
