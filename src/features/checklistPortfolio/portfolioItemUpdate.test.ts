import assert from "node:assert/strict";
import test from "node:test";

import { buildPortfolioItemUpdate } from "./portfolioItemUpdate";

test("a score edit on an item whose private note failed to load sends no note fields", () => {
  // privateNotes undefined: get_portfolio_private_notes failed, the sheet showed "".
  const updates = buildPortfolioItemUpdate(
    { score: 6, publicNotes: "Go early", privateNotes: undefined },
    { score: 8, publicNotes: "Go early", privateNotes: "" },
  );
  assert.deepEqual(updates, { score: 8 });
  assert.equal("privateNotes" in updates, false);
});

test("changed notes are sent trimmed, and clearing a loaded note sends an empty string", () => {
  assert.deepEqual(
    buildPortfolioItemUpdate(
      { score: undefined, publicNotes: "Old", privateNotes: "Secret" },
      { score: undefined, publicNotes: "  New  ", privateNotes: "" },
    ),
    { publicNotes: "New", privateNotes: "" },
  );
});

test("nothing changed sends nothing", () => {
  assert.deepEqual(
    buildPortfolioItemUpdate(
      { score: 7, publicNotes: undefined, privateNotes: "x" },
      { score: 7, publicNotes: " ", privateNotes: "x " },
    ),
    {},
  );
});
