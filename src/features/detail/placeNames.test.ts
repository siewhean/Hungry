import assert from "node:assert/strict";
import test from "node:test";

import { cleanPlaceName, placeKey } from "./placeNames";

test("the same MRT station written two ways reads the same", () => {
  assert.equal(cleanPlaceName("Singapore 648310 Pioneer Mrt Stn"), "Pioneer MRT Station");
  assert.equal(cleanPlaceName("Pioneer Mrt Station"), "Pioneer MRT Station");
  assert.equal(placeKey("Singapore 648310 Pioneer Mrt Stn"), placeKey("Pioneer Mrt Station"));
});

test("a postal code after the name is dropped", () => {
  assert.equal(cleanPlaceName("Blk 651 Coffee Shop, Singapore 640651"), "Blk 651 Coffee Shop");
});

test("capitals become words, codes and acronyms stay", () => {
  assert.equal(cleanPlaceName("JURONG POINT"), "Jurong Point");
  assert.equal(cleanPlaceName("JW50"), "JW50");
  assert.equal(cleanPlaceName("NTU North Spine"), "NTU North Spine");
  assert.equal(cleanPlaceName("Bukit Panjang Ctr"), "Bukit Panjang Centre");
});

test("empty and missing names stay empty", () => {
  assert.equal(cleanPlaceName(undefined), "");
  assert.equal(cleanPlaceName("   "), "");
  assert.equal(placeKey(null), "");
});

test("different places keep different keys", () => {
  assert.notEqual(placeKey("Pioneer Mall"), placeKey("Pioneer MRT Station"));
});

test("polluted subunit clauses and bare unit numbers are cleaned or rejected", () => {
  assert.equal(cleanPlaceName("1 Maritime Square #01-84e"), "1 Maritime Square");
  assert.equal(cleanPlaceName("People's Park Centre #03-48"), "People's Park Centre");
  assert.equal(
    cleanPlaceName("136 Joo Chiat Road Singapore 427419 (1ST Storey)"),
    "136 Joo Chiat Road",
  );
  // Bare unit numbers or postal prefix + unit numbers are rejected
  assert.equal(cleanPlaceName("Singapore 099253 #01-75/76"), "");
  assert.equal(cleanPlaceName("#01-75/76"), "");
  assert.equal(cleanPlaceName("#B1-167/168"), "");
});
