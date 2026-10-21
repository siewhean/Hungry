import assert from "node:assert/strict";
import test from "node:test";

import { VideoMetadataError, stripVideoLocationMetadata } from "./videoMetadata";

function u32(value: number): number[] {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

function box(type: string | number[], payload: number[] = []): number[] {
  const typeBytes = typeof type === "string" ? Array.from(type, (c) => c.charCodeAt(0)) : type;
  return [...u32(8 + payload.length), ...typeBytes, ...payload];
}

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));
const GPS = ascii("+01.2966+103.7764/");

function video(moovChildren: number[]): Uint8Array {
  return new Uint8Array([
    ...box("ftyp", [...ascii("isom"), ...u32(0), ...ascii("isom")]),
    ...box("moov", moovChildren),
    ...box("mdat", ascii("frame-data")),
  ]);
}

function containsAscii(bytes: Uint8Array, text: string): boolean {
  return Buffer.from(bytes).includes(Buffer.from(text, "latin1"));
}

test("an iTunes-style location atom in udta is removed and the file keeps its size", () => {
  const input = video(box("udta", box([0xa9, 0x78, 0x79, 0x7a], GPS)));
  assert.ok(containsAscii(input, "+01.2966+103.7764/"));

  const { bytes, neutralised } = stripVideoLocationMetadata(input);
  assert.equal(neutralised, 1);
  assert.equal(bytes.length, input.length);
  assert.ok(!containsAscii(bytes, "+01.2966+103.7764/"));
  // The atom is now a free box, and the media data after it is untouched.
  assert.ok(containsAscii(bytes, "free"));
  assert.ok(containsAscii(bytes, "frame-data"));
  // The input buffer is not modified.
  assert.ok(containsAscii(input, "+01.2966+103.7764/"));
});

test("3GPP loci atoms are removed", () => {
  const { neutralised, bytes } = stripVideoLocationMetadata(video(box("udta", box("loci", GPS))));
  assert.equal(neutralised, 1);
  assert.ok(!containsAscii(bytes, "+01.2966"));
});

test("QuickTime location keys and their ilst values are removed, other metadata is kept", () => {
  const keyEntry = (name: string) => box("mdta", ascii(name));
  const keys = box("keys", [
    ...u32(0),
    ...u32(2),
    ...keyEntry("com.apple.quicktime.make"),
    ...keyEntry("com.apple.quicktime.location.ISO6709"),
  ]);
  const ilst = box("ilst", [
    ...box(u32(1), box("data", [...u32(1), ...u32(0), ...ascii("Apple")])),
    ...box(u32(2), box("data", [...u32(1), ...u32(0), ...GPS])),
  ]);
  // ISO-style meta: version and flags come first.
  const input = video(box("meta", [...u32(0), ...keys, ...ilst]));

  const { bytes, neutralised } = stripVideoLocationMetadata(input);
  assert.equal(neutralised, 1);
  assert.ok(!containsAscii(bytes, "+01.2966+103.7764/"));
  assert.ok(containsAscii(bytes, "Apple"));
});

test("a video without location atoms passes through unchanged", () => {
  const input = video(box("udta", box("name", ascii("clip"))));
  const { bytes, neutralised } = stripVideoLocationMetadata(input);
  assert.equal(neutralised, 0);
  assert.deepEqual(Array.from(bytes), Array.from(input));
});

test("a file that is not an MP4 container is refused instead of passed through", () => {
  assert.throws(() => stripVideoLocationMetadata(new Uint8Array(40).fill(7)), VideoMetadataError);
  const truncated = video(box("udta", box("loci", GPS))).slice(0, 30);
  assert.throws(() => stripVideoLocationMetadata(truncated), VideoMetadataError);
});
