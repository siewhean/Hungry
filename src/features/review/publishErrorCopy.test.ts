import assert from "node:assert/strict";
import test from "node:test";

import {
  describePublishError,
  describeReviewEditError,
  isExpectedPublishError,
} from "./publishErrorCopy";

test("an upload failure never shows the raw error text and says the draft is kept", () => {
  const message = describePublishError(new Error("Signed upload URL creation failed."), "review");
  assert.doesNotMatch(message, /Signed upload URL/);
  assert.match(message, /couldn't upload/i);
  assert.match(message, /draft is saved/i);
});

test("offline, own-stall, size, type and location failures each get their own plain copy", () => {
  assert.match(describePublishError(new TypeError("Network request failed"), "review"), /offline/i);
  assert.match(
    describePublishError(
      { code: "42501", message: "You cannot review a stall you manage." },
      "review",
    ),
    /can't review a stall you manage/,
  );
  assert.match(
    describePublishError(new Error("Image upload exceeds 10MB limit."), "post"),
    /too large/,
  );
  assert.match(
    describePublishError(
      new Error("Image upload must be image/jpeg, image/png, image/heic, or image/webp."),
      "post",
    ),
    /file type isn't supported/,
  );
  const stripError = Object.assign(new Error("We could not remove location data."), {
    code: "metadata_strip_failed",
  });
  assert.match(describePublishError(stripError, "post"), /location details/);
});

test("the post composer says the post is still on screen; reviews say the draft is saved", () => {
  assert.match(describePublishError(new Error("boom"), "post"), /post is still here/);
  assert.match(describePublishError(new Error("boom"), "review"), /draft is saved/);
});

test("server text the user can act on (text filter) is passed through", () => {
  const filtered = {
    code: "23514",
    message: "Reviews can include at most one link or phone number.",
  };
  assert.equal(
    describePublishError(filtered, "review"),
    "Reviews can include at most one link or phone number.",
  );
});

test("a rate-limited publish says to slow down, not 'something went wrong' (REV-18)", () => {
  const limited = { code: "rate_limited", message: "Too many requests" };
  assert.match(describePublishError(limited, "review"), /posting quickly/);
  assert.match(describePublishError({ status: 429, message: "" }, "review"), /posting quickly/);
  assert.match(describePublishError(limited, "review"), /draft is saved/i);
});

test("expected publish refusals are not faults; unknown ones are (REV-X1)", () => {
  assert.equal(isExpectedPublishError({ code: "rate_limited", message: "Too many requests" }), true);
  assert.equal(isExpectedPublishError({ code: "23514", message: "Please keep it kind." }), true);
  assert.equal(
    isExpectedPublishError({ code: "42501", message: "You cannot review a stall you manage." }),
    true,
  );
  assert.equal(isExpectedPublishError(new Error("new row violates row-level security")), false);
  assert.equal(isExpectedPublishError(new TypeError("Network request failed")), false);
});

test("edit and delete failures never show raw error text (REV-12)", () => {
  const raw = new Error('duplicate key value violates unique constraint "reviews_pkey"');
  assert.equal(describeReviewEditError(raw, "save"), "Couldn't save your review. Try again.");
  assert.equal(describeReviewEditError(raw, "delete"), "Couldn't delete your review. Try again.");
  assert.equal(
    describeReviewEditError({ code: "23514", message: "Please keep it kind" }, "save"),
    "Please keep it kind.",
  );
  assert.match(describeReviewEditError(new TypeError("Network request failed"), "save"), /offline/);
  assert.match(describeReviewEditError({ code: "rate_limited", message: "" }, "save"), /quickly/);
});
