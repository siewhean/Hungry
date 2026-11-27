// Home's "N stalls in this area" asks for the real count only when the feed came back full.
// Run with `node scripts/test-render.mjs src/features/discover/useAreaVenueCount.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { useAreaVenueCount } from "@/features/discover/useAreaVenueCount";
import { getHungryService } from "@/lib/services/serviceProvider";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

const area = { geoCellLatitude: 1.34, geoCellLongitude: 103.7, radiusMeters: 3000 };

async function mount(enabled: boolean) {
  let latest: number | null = -1;
  function Probe() {
    latest = useAreaVenueCount(area, enabled);
    return null;
  }
  const view = await render(<Probe />);
  await view.settle();
  return () => latest;
}

test("it reads nothing while the feed is not full", async () => {
  const discovery = getHungryService().discovery;
  const original = discovery.countVenuesInArea;
  let calls = 0;
  discovery.countVenuesInArea = async () => {
    calls += 1;
    return 321;
  };
  try {
    const count = await mount(false);
    assert.equal(count(), null);
    assert.equal(calls, 0);
  } finally {
    discovery.countVenuesInArea = original;
  }
});

test("a full feed gets the real number of stalls instead of 100+", async () => {
  const discovery = getHungryService().discovery;
  const original = discovery.countVenuesInArea;
  let asked: unknown[] = [];
  discovery.countVenuesInArea = async (...args) => {
    asked = args;
    return 321;
  };
  try {
    const count = await mount(true);
    assert.equal(count(), 321);
    assert.deepEqual(asked, [1.34, 103.7, 3000, undefined]);
  } finally {
    discovery.countVenuesInArea = original;
  }
});

test("a failed count leaves the label on 100+ and does not throw", async () => {
  const discovery = getHungryService().discovery;
  const original = discovery.countVenuesInArea;
  discovery.countVenuesInArea = async () => {
    throw new Error("count down");
  };
  try {
    const count = await mount(true);
    assert.equal(count(), null);
  } finally {
    discovery.countVenuesInArea = original;
  }
});
