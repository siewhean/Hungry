import assert from "node:assert/strict";
import test from "node:test";

import { DECIDE_FOR_ME_OPTION_ID, DECIDE_QUESTIONS } from "@/features/discovery/decideQuiz";
import { readRepoFile } from "@/test/sourceContracts";

test("Decide for me shows three photo cards per row from bundled food photos", () => {
  const screen = readRepoFile("src/app/screens/discover/DecideForMeQuizScreen.tsx");
  const images = readRepoFile("src/app/screens/discover/decideOptionImages.ts");

  assert.match(screen, /DECIDE_OPTION_IMAGES\[option\.id\]/);
  // Three per row, two at large text sizes.
  assert.match(screen, /const columns = fontScale >= 1\.3 \? 2 : 3;/);
  assert.match(screen, /\(width - spacing\[4\] \* 2 - spacing\[2\] \* \(columns - 1\)\) \/ columns/);
  assert.match(screen, /flexWrap: "wrap"/);
  assert.doesNotMatch(images, /https?:\/\//);
  // Every real answer outside Western has a photo; "Decide for me" keeps its dice tile.
  for (const question of DECIDE_QUESTIONS) {
    for (const option of question.options) {
      if (option.id === DECIDE_FOR_ME_OPTION_ID || option.id === "western") continue;
      assert.match(images, new RegExp(`(^|\\s|")${option.id}"?:`), option.id);
    }
  }
});
