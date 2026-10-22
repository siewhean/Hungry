import assert from "node:assert/strict";
import test from "node:test";
import { isTrustedCatalogSourceUrl } from "./catalogSourcePolicy";

test("catalog sources require an exact approved HTTPS publisher", () => {
  assert.equal(isTrustedCatalogSourceUrl("https://www.capitaland.com/sg/malls/"), true);
  for (const value of [
    "http://www.capitaland.com/",
    "https://www.capitaland.com.evil.example/",
    "https://www.capitaland.com@evil.example/",
    "https://user:password@www.capitaland.com/",
    "javascript:alert(1)",
    "https://www.capitaland.com:8080/",
  ])
    assert.equal(isTrustedCatalogSourceUrl(value), false);
});
