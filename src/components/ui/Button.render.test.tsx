// The shared Button's disabled look. Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createElement } from "react";

import { Button } from "@/components/ui";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

const buttonEl = (view: Awaited<ReturnType<typeof render>>) =>
  view.container.querySelector('[role="button"]') as HTMLElement;

test("a disabled primary button is neutral, not faded orange", async () => {
  const enabled = await render(
    createElement(Button, { label: "Sign in", onPress: () => undefined }),
  );
  const enabledBg = getComputedStyle(buttonEl(enabled)).backgroundColor;
  await cleanup();

  const disabled = await render(
    createElement(Button, { label: "Sign in", disabled: true, onPress: () => undefined }),
  );
  const el = buttonEl(disabled);
  assert.notEqual(getComputedStyle(el).backgroundColor, enabledBg);
  assert.equal(getComputedStyle(el).opacity, "1");
  assert.equal(el.getAttribute("aria-disabled"), "true");
});

test("a loading primary button keeps the brand colour", async () => {
  const enabled = await render(
    createElement(Button, { label: "Sign in", onPress: () => undefined }),
  );
  const enabledBg = getComputedStyle(buttonEl(enabled)).backgroundColor;
  await cleanup();

  const loading = await render(
    createElement(Button, { label: "Sign in", loading: true, onPress: () => undefined }),
  );
  assert.equal(getComputedStyle(buttonEl(loading)).backgroundColor, enabledBg);
});
