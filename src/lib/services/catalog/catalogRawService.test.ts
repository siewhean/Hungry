import assert from "node:assert/strict";
import test from "node:test";

import { catalogRequestKey } from "./index";

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
