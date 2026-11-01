import assert from "node:assert/strict";
import test from "node:test";

import { catalogRequestKey, mapViewportZoom } from "./index";

test("catalog request keys separate cursor pages and filter states", () => {
  const first = catalogRequestKey("dishes", { p_query: "laksa", p_cursor: null, p_limit: 24 });
  const second = catalogRequestKey("dishes", { p_query: "laksa", p_cursor: "next", p_limit: 24 });
  const filtered = catalogRequestKey("dishes", {
    p_query: "laksa",
    p_cursor: null,
    p_open_only: true,
  });

  assert.notEqual(first, second);
  assert.notEqual(first, filtered);
});

test("map reads below zoom 14 ask for the venue branch, which the server can run", () => {
  assert.equal(mapViewportZoom(11.2), 14);
  assert.equal(mapViewportZoom(13.9), 14);
  assert.equal(mapViewportZoom(15.5), 15.5);
});
