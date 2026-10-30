import assert from "node:assert/strict";
import test from "node:test";

import { MERCHANT_REPLY_MAX_LENGTH } from "@/features/merchant/merchantReadiness";
import {
  REPLY_SUGGESTION_KINDS,
  REPLY_SUGGESTION_LABELS,
  buildReplySuggestion,
  canFillReplySuggestion,
  orderReplySuggestionKinds,
} from "@/features/merchant/replySuggestions";

test("each suggestion greets the reviewer by first name and fits the reply limit", () => {
  for (const kind of REPLY_SUGGESTION_KINDS) {
    const text = buildReplySuggestion(kind, "Mei Ling Tan");
    assert.match(text, /^Hi Mei, /, kind);
    assert.ok(text.length > 0 && text.length <= MERCHANT_REPLY_MAX_LENGTH, kind);
  }
});

test("a missing or generic reviewer name is left out of the greeting", () => {
  for (const name of [undefined, "", "  ", "Anonymous", "guest"]) {
    const text = buildReplySuggestion("thank", name);
    assert.doesNotMatch(text, /^Hi /);
    assert.match(text, /^thank you/);
  }
});

test("the three chips are Thank, Apologise and Invite back", () => {
  assert.deepEqual(
    REPLY_SUGGESTION_KINDS.map((kind) => REPLY_SUGGESTION_LABELS[kind]),
    ["Thank", "Apologise", "Invite back"],
  );
});

test("suggestions never promise refunds or offers", () => {
  for (const kind of REPLY_SUGGESTION_KINDS) {
    assert.doesNotMatch(
      buildReplySuggestion(kind, "Sam"),
      /refund|free|discount|voucher|compensat/i,
    );
  }
});

test("Apologise leads on a 3-star or lower review; Thank leads on 4 stars, 5 stars or no rating", () => {
  assert.deepEqual(orderReplySuggestionKinds(1), ["apologise", "thank", "invite_back"]);
  assert.deepEqual(orderReplySuggestionKinds(3), ["apologise", "thank", "invite_back"]);
  for (const rating of [4, 5, undefined, 0]) {
    assert.deepEqual(orderReplySuggestionKinds(rating), ["thank", "apologise", "invite_back"]);
  }
});

test("a chip fills an empty box or the last suggestion, never the merchant's own words", () => {
  assert.equal(canFillReplySuggestion("", null), true);
  assert.equal(canFillReplySuggestion("   ", null), true);
  assert.equal(canFillReplySuggestion("Hi Mei, thank you", "Hi Mei, thank you"), true);
  assert.equal(canFillReplySuggestion("Hi Mei, thank you!", "Hi Mei, thank you"), false);
  assert.equal(canFillReplySuggestion("Sorry about that", null), false);
});
