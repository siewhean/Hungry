import assert from "node:assert/strict";
import test from "node:test";

import { resolveStallOpenInfo } from "./stallOpenState";

// 2026-10-19 is a Monday; noon in Singapore.
const mondayNoon = new Date(Date.UTC(2026, 9, 19, 4, 0));

test("STALL-14: a temporary closure is shown once, as the hours status, not again under the header", () => {
  const info = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "10am - 8pm" },
    temporaryClosure: "Closed for renovation until 3 Nov",
    now: mondayNoon,
  });
  assert.equal(info.statusLabel, "Closed for renovation until 3 Nov");
  assert.equal(info.extraNotice, undefined);
});

test("STALL-14: a stored notice the status does not say still shows under the header", () => {
  const info = resolveStallOpenInfo({
    venue: {
      isOpen: true,
      operatingHours: "Mon-Sun 10am - 8pm",
      closureNotice: "Closed on 3 Nov for Deepavali.",
    },
    now: mondayNoon,
  });
  assert.notEqual(info.statusLabel, info.closureNotice);
  assert.equal(info.extraNotice, "Closed on 3 Nov for Deepavali.");
});
