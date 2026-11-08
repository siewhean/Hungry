// Headers carry a title only (sh, 2026-11-08: "Do not have description for the headers").
// ProfileScreenShell no longer takes a subtitle, so this guards the screens that used one.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const DIR = "src/app/screens/profile";

test("ProfileScreenShell has no subtitle prop", () => {
  const shell = readFileSync(`${DIR}/ProfileScreenShell.tsx`, "utf8");
  assert.doesNotMatch(shell, /subtitle/);
});

test("no profile screen passes a header subtitle", () => {
  const screens = readdirSync(DIR).filter(
    (name) => name.endsWith(".tsx") && !name.includes(".test."),
  );
  for (const name of screens) {
    const source = readFileSync(`${DIR}/${name}`, "utf8");
    assert.doesNotMatch(source, /<ProfileScreenShell[^>]*\bsubtitle=/s, name);
  }
});

test("the post composer header has no description", () => {
  const composer = readFileSync("src/app/screens/post/PostComposerScreen.tsx", "utf8");
  assert.match(composer, /<Screen keyboardAvoiding title="Create post">/);
});
