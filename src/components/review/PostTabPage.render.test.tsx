import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createElement } from "react";

import { cleanup, render } from "@/test/render";

import { PostTabPage } from "./PostTabPage";

afterEach(cleanup);

test("the Post page invites a review and its button opens the review card", async () => {
  let started = 0;
  const view = await render(createElement(PostTabPage, { onStart: () => (started += 1) }));
  assert.match(view.text(), /What did you eat\?/);
  await view.press(view.findByText("Write a review"));
  assert.equal(started, 1);
});
