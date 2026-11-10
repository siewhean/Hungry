import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createElement } from "react";

import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { cleanup, render } from "@/test/render";

import { PostTabPage } from "./PostTabPage";

const flags = FEATURE_FLAGS as unknown as Record<string, boolean>;
const savedFlags = { ...flags };

afterEach(async () => {
  await cleanup();
  Object.assign(flags, savedFlags);
});

test("the Post page invites Add a dish (the one composer) and its button opens the editor", async () => {
  flags.foodPortfolioEnabled = true;
  let started = 0;
  const view = await render(createElement(PostTabPage, { onStart: () => (started += 1) }));
  assert.match(view.text(), /What did you eat\?/);
  await view.press(view.findByText("Add a dish"));
  assert.equal(started, 1);
});

test("with the Food Portfolio off the button still says Write a review", async () => {
  flags.foodPortfolioEnabled = false;
  const view = await render(createElement(PostTabPage, { onStart: () => undefined }));
  assert.ok(view.findByText("Write a review"));
});
