// The app's own choice sheet (ChoiceSheetHost over DismissibleSheet): it shows what askChoice asked,
// hands back the option that is tapped, and answers "dismissed" for Cancel. Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createElement } from "react";

import { ChoiceSheetHost, DismissibleSheet, AppText } from "@/components/ui";
import { askChoice } from "@/store/useChoiceSheetStore";
import { cleanup, render, settle } from "@/test/render";

afterEach(cleanup);

test("it shows the question and returns the option that is tapped", async () => {
  const view = await render(createElement(ChoiceSheetHost));
  const answer = askChoice({
    title: "Add a photo",
    message: "Where is it from?",
    options: [
      { id: "camera", label: "Take photo" },
      { id: "library", label: "Choose from library" },
    ],
  });
  await settle();
  assert.match(document.body.textContent ?? "", /Add a photo/);
  assert.match(document.body.textContent ?? "", /Where is it from\?/);
  await view.press(
    document.body.querySelector('[aria-label="Choose from library"]') as HTMLElement | null,
  );
  assert.equal(await answer, "library");
});

test("Cancel answers dismissed", async () => {
  const view = await render(createElement(ChoiceSheetHost));
  const answer = askChoice({ title: "Pick one", options: [{ id: "a", label: "A" }] });
  await settle();
  await view.press(document.body.querySelector('[aria-label="Cancel"]') as HTMLElement | null);
  assert.equal(await answer, null);
});

test("a sheet that is not visible renders nothing, and the close control closes a visible one", async () => {
  let closed = 0;
  const head = <AppText>Head</AppText>;
  const hidden = await render(
    <DismissibleSheet visible={false} onClose={() => undefined} header={head}>
      <AppText>Body</AppText>
    </DismissibleSheet>,
  );
  assert.doesNotMatch(document.body.textContent ?? "", /Body/);
  await hidden.rerender(
    <DismissibleSheet visible onClose={() => (closed += 1)} closeLabel="Close sheet" header={head}>
      <AppText>Body</AppText>
    </DismissibleSheet>,
  );
  await settle();
  assert.match(document.body.textContent ?? "", /Body/);
  await hidden.press(
    document.body.querySelector('[aria-label="Close sheet"]') as HTMLElement | null,
  );
  assert.equal(closed, 1);
});

test("only the newest host shows the sheet, and the older one takes over when it leaves", async () => {
  const root = await render(createElement(ChoiceSheetHost));
  const card = await render(createElement(ChoiceSheetHost));
  const answer = askChoice({ title: "From the card", options: [{ id: "a", label: "A" }] });
  await settle();
  // One sheet, not two: the card's host shows it, the root's stays empty.
  assert.equal(document.body.querySelectorAll('[aria-label="Cancel"]').length, 1);
  await card.unmount();
  await settle();
  assert.equal(document.body.querySelectorAll('[aria-label="Cancel"]').length, 1);
  await root.press(document.body.querySelector('[aria-label="Cancel"]') as HTMLElement | null);
  assert.equal(await answer, null);
});
