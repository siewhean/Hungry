// The loading placeholder: one shared sweep for every skeleton on screen, a still block under
// Reduce Motion, and text placeholders that are exactly as tall as the line of text they replace.
// Run with `node scripts/test-render.mjs src/components/ui/Skeleton.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { AppText, Skeleton, SkeletonText } from "@/components/ui";
import { getActiveSkeletonCount } from "@/components/ui/Skeleton";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render } from "@/test/render";

afterEach(async () => {
  await cleanup();
  useUIStore.setState({ reducedMotionEnabled: false });
});

test("every mounted skeleton shares one sweep, which stops when the last one unmounts", async () => {
  assert.equal(getActiveSkeletonCount(), 0);
  const first = await render(
    <>
      <Skeleton height={10} />
      <Skeleton height={10} />
    </>,
  );
  assert.equal(getActiveSkeletonCount(), 2);
  const second = await render(<Skeleton height={10} />);
  assert.equal(getActiveSkeletonCount(), 3);
  await first.unmount();
  assert.equal(getActiveSkeletonCount(), 1);
  await second.unmount();
  assert.equal(getActiveSkeletonCount(), 0, "nothing keeps animating");
});

test("Reduce Motion leaves a still placeholder: no sweep runs", async () => {
  useUIStore.setState({ reducedMotionEnabled: true });
  const view = await render(<Skeleton height={10} />);
  assert.equal(getActiveSkeletonCount(), 0);
  assert.ok(view.findByLabel("Loading content"), "the placeholder is still drawn");
});

test("a text placeholder is as tall as the line of text it stands in for", async () => {
  const view = await render(
    <>
      <AppText variant="bodySmallBold">Laksa</AppText>
      <SkeletonText variant="bodySmallBold" width={80} />
      <AppText variant="micro">Ah Seng</AppText>
      <SkeletonText variant="micro" width={80} />
    </>,
  );
  const lineHeights = (selector: string) =>
    Array.from(view.container.querySelectorAll<HTMLElement>(selector)).map((node) =>
      parseFloat(node.style.lineHeight),
    );
  const textLines = lineHeights("div[dir]");
  const boxes = Array.from(
    view.container.querySelectorAll<HTMLElement>("[aria-label='Loading content']"),
  ).map((node) => parseFloat((node.parentElement as HTMLElement).style.height));
  assert.equal(boxes.length, 2);
  assert.deepEqual(boxes, textLines, "same heights, line for line");
});
