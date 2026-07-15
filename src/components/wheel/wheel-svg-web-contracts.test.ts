import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(resolve(process.cwd(), "src/components/wheel/WheelSvg.tsx"), "utf8");

test("Wheel SVG rotates labels without emitting an invalid transform-origin DOM property", () => {
  assert.doesNotMatch(source, /\borigin=/);
  assert.doesNotMatch(source, /\brotation=/);
  assert.match(
    source,
    /transform=\{`rotate\(\$\{labelAngle\} \$\{labelPt\.x\} \$\{labelPt\.y\}\)`\}/,
  );
});
