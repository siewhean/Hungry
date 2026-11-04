import assert from "node:assert/strict";
import test from "node:test";

import {
  canShareCardImage,
  captureSizeFor,
  loadShareCardNative,
  setShareCardNativeForTests,
  shareCardImage,
  type ShareCardNative,
} from "./shareCardImage";

function fakeNative(overrides: Partial<ShareCardNative> = {}) {
  const calls: { capture: unknown[]; share: unknown[] } = { capture: [], share: [] };
  const native: ShareCardNative = {
    captureRef: async (target, options) => {
      calls.capture.push({ target, options });
      return "/tmp/card.jpg";
    },
    isAvailableAsync: async () => true,
    shareAsync: async (url, options) => {
      calls.share.push({ url, options });
    },
    ...overrides,
  };
  return { native, calls };
}

const story = {
  width: 1080,
  height: 1920,
  format: "jpg" as const,
  dialogTitle: "Share your review",
};

test("captureSizeFor asks iOS for points and Android for pixels", () => {
  assert.deepEqual(captureSizeFor(1080, 1920, "ios", 3), { width: 360, height: 640 });
  assert.deepEqual(captureSizeFor(1080, 1920, "android", 2.75), { width: 1080, height: 1920 });
  assert.deepEqual(captureSizeFor(1080, 1350, "ios", 0), { width: 1080, height: 1350 });
});

test("a build without the picture modules shares nothing and says unavailable", async () => {
  setShareCardNativeForTests(undefined);
  assert.equal(loadShareCardNative(), null);
  assert.equal(canShareCardImage(), false);
  assert.equal(await shareCardImage({}, story, null), "unavailable");
});

test("no card view, or a phone that cannot share files, is unavailable", async () => {
  const { native, calls } = fakeNative({ isAvailableAsync: async () => false });
  assert.equal(await shareCardImage(null, story, native), "unavailable");
  assert.equal(await shareCardImage({}, story, native), "unavailable");
  assert.equal(calls.capture.length, 0);
});

test("the card is captured at full size and shared as a file URL", async () => {
  const { native, calls } = fakeNative();
  const target = { id: "card" };
  assert.equal(await shareCardImage(target, story, native), "shared");
  assert.deepEqual(calls.capture, [
    {
      target,
      options: { width: 1080, height: 1920, format: "jpg", quality: 0.92, result: "tmpfile" },
    },
  ]);
  assert.deepEqual(calls.share, [
    {
      url: "file:///tmp/card.jpg",
      options: { mimeType: "image/jpeg", UTI: "public.jpeg", dialogTitle: "Share your review" },
    },
  ]);
  assert.equal(canShareCardImage(native), true);
  setShareCardNativeForTests(native);
  assert.equal(loadShareCardNative(), native);
  assert.equal(canShareCardImage(), true);
  setShareCardNativeForTests(undefined);
});

test("the sticker shares as a PNG and a file URL is passed through", async () => {
  const { native, calls } = fakeNative({ captureRef: async () => "file:///data/card.png" });
  await shareCardImage({}, { ...story, format: "png" }, native);
  assert.deepEqual(calls.share[0], {
    url: "file:///data/card.png",
    options: { mimeType: "image/png", UTI: "public.png", dialogTitle: "Share your review" },
  });
});

test("a failed capture throws so the screen can report it", async () => {
  const { native, calls } = fakeNative({
    captureRef: async () => {
      throw new Error("capture failed");
    },
  });
  await assert.rejects(() => shareCardImage({}, story, native), /capture failed/);
  assert.equal(calls.share.length, 0);
});
