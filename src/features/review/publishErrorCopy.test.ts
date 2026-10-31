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

test("a photo that fails the explicit-content check is explained and is not a fault", () => {
  const rejected = { code: "photo_rejected", message: "One of your photos can't be posted." };
  assert.match(describePublishError(rejected, "review"), /may break our community rules/);
  assert.match(describePublishError(rejected, "review"), /Choose a different photo/);
  assert.match(describePublishError(rejected, "review"), /draft is saved/i);
  assert.equal(isExpectedPublishError(rejected), true);
});

test("expected publish refusals are not faults; unknown ones are (REV-X1)", () => {
  assert.equal(
    isExpectedPublishError({ code: "rate_limited", message: "Too many requests" }),
    true,
  );
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

test("odd error shapes still get plain copy", () => {
  assert.match(describePublishError(undefined, "review"), /^Something went wrong/);
  assert.match(describePublishError("timed out", "post"), /^You appear to be offline/);
  assert.match(describePublishError({ status: 429 }, "post"), /posting quickly/);
  assert.match(describePublishError({ code: "upload_failed" }, "review"), /couldn't upload/);
  assert.match(
    describePublishError({ code: "23514", message: "x".repeat(200) }, "review"),
    /^Something went wrong/,
    "overlong server text is not shown",
  );
  assert.equal(
    describePublishError({ code: "23514", message: "Please keep it kind!" }, "review"),
    "Please keep it kind!",
  );
  assert.equal(
    describeReviewEditError({ code: "23514", message: "Please keep it kind" }, "save"),
    "Please keep it kind.",
  );
  assert.equal(describeReviewEditError({ code: "23514", message: "Done!" }, "delete"), "Done!");
  assert.match(describeReviewEditError({ message: "Too Many Requests" }, "save"), /quickly/);
  assert.match(describeReviewEditError(new Error("Failed to fetch"), "delete"), /offline/);
  assert.equal(describeReviewEditError(null, "delete"), "Couldn't delete your review. Try again.");
  assert.equal(isExpectedPublishError(null), false);
  assert.equal(isExpectedPublishError({ code: "23514", message: "" }), false);
});
