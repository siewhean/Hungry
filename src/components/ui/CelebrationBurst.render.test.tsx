// The success burst: a check badge with confetti around it. Run with
// `node scripts/test-render.mjs src/components/ui/CelebrationBurst.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { cleanup, render, settle } from "@/test/render";

import { CelebrationBurst } from "./CelebrationBurst";

afterEach(cleanup);

test("CelebrationBurst draws the check badge and its confetti", async () => {
  await render(<CelebrationBurst testID="burst" />);
  await settle();
  const burst = document.body.querySelector('[data-testid="burst"]') as HTMLElement;
  assert.ok(burst, "the burst is on screen");
  // 16 confetti pieces and the badge are its children.
  assert.equal(burst.children.length, 17);
});
