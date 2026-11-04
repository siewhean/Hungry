// PhotoPager: the count badge and the viewer callback. Run with `npm run test:render`.
import assert from "node:assert/strict";
import { act, createElement } from "react";
import test, { afterEach } from "node:test";

import { PhotoPager, clampPhotoIndex } from "@/components/dish/PhotoPager";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

const photos = (count: number) =>
  Array.from({ length: count }, (_, index) => `https://cdn.hungry.sg/${index}.jpg`);

test("the page index never runs past the last photo when the list shrinks (DISH-X8)", () => {
  assert.equal(clampPhotoIndex(3, 4), 3);
  assert.equal(clampPhotoIndex(3, 2), 1);
  assert.equal(clampPhotoIndex(5, 1), 0);
  assert.equal(clampPhotoIndex(0, 0), 0);
});

test("PhotoPager counts photos and reports when the viewer opens", async () => {
  const opened: number[] = [];
  const props = {
    width: 320,
    height: 200,
    subject: "Laksa",
    onViewerOpen: (at: number) => opened.push(at),
  };
  const view = await render(createElement(PhotoPager, { ...props, photos: photos(4) }));
  assert.ok(view.findByLabel("Photo 1 of 4"));
  await view.press(view.findByLabel("Photo 2 of 4, Laksa"));
  assert.deepEqual(opened, [1]);
  await view.rerender(createElement(PhotoPager, { ...props, photos: photos(2) }));
  assert.ok(view.findByLabel("Photo 1 of 2"));
});

type FailableImage = HTMLElement & { __triggerError?: () => void };

function pagerImages(root: ParentNode) {
  return Array.from(root.querySelectorAll('[data-stub="expo-image.Image"]')) as FailableImage[];
}

test("R4-STALL-9: a photo that fails to load is dropped; when none are left the fallback shows", async () => {
  const view = await render(
    createElement(PhotoPager, {
      photos: photos(2),
      width: 320,
      height: 200,
      subject: "Laksa",
      fallback: createElement("div", { "data-testid": "pager-fallback" }, "No photo"),
    }),
  );
  assert.ok(view.findByLabel("Photo 1 of 2"));
  await act(async () => {
    pagerImages(view.container)[0]?.__triggerError?.();
  });
  assert.equal(view.findByLabel("Photo 1 of 2"), null, "the dead photo is gone from the count");
  assert.equal(view.container.querySelector('[data-testid="pager-fallback"]'), null);
  assert.equal(pagerImages(view.container).length, 1);
  await act(async () => {
    pagerImages(view.container)[0]?.__triggerError?.();
  });
  assert.ok(view.container.querySelector('[data-testid="pager-fallback"]'), "fallback renders");
  assert.equal(pagerImages(view.container).length, 0);
});
