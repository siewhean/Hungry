import assert from "node:assert/strict";
import test from "node:test";

import { toMerchantEmailUrl, toMerchantPhoneUrl, toMerchantWebUrl } from "./merchantLinks";

test("merchant web links are forced to https and reject non-web schemes", () => {
  assert.equal(toMerchantWebUrl("laksa.sg"), "https://laksa.sg/");
  assert.equal(toMerchantWebUrl("http://laksa.sg/menu"), "https://laksa.sg/menu");
  assert.equal(toMerchantWebUrl("javascript:alert(1)"), null);
  assert.equal(toMerchantWebUrl("https://user:pw@evil.com"), null);
  assert.equal(toMerchantWebUrl("localhost"), null);
});

test("merchant phone and email links are rebuilt from validated parts", () => {
  assert.equal(toMerchantPhoneUrl("+65 6123 4567"), "tel:+6561234567");
  assert.equal(toMerchantPhoneUrl("call me"), null);
  assert.equal(toMerchantEmailUrl("hello@laksa.sg"), "mailto:hello@laksa.sg");
  assert.equal(toMerchantEmailUrl("a@b.sg?bcc=x@y.com"), null);
});
