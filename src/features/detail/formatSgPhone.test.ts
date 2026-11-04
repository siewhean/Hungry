// R5-STALL-7: phone numbers read as "+65 9123 4567". Run with `npm test`.
import assert from "node:assert/strict";
import test from "node:test";

import { formatSgPhone } from "@/features/detail/formatSgPhone";

test("R5-STALL-7: a Singapore number is grouped as +65 NNNN NNNN", () => {
  assert.equal(formatSgPhone("+6591234567"), "+65 9123 4567");
  assert.equal(formatSgPhone("91234567"), "+65 9123 4567");
  assert.equal(formatSgPhone("+65 6123-4567"), "+65 6123 4567");
  assert.equal(formatSgPhone(" 6591234567 "), "+65 9123 4567");
});

test("R5-STALL-7: anything that is not a Singapore number is shown as written", () => {
  assert.equal(formatSgPhone("+60123456789"), "+60123456789");
  assert.equal(formatSgPhone("1800 123 456"), "1800 123 456");
  assert.equal(formatSgPhone("12345678"), "12345678");
  assert.equal(formatSgPhone(""), "");
});
