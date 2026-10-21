import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(
  resolve(process.cwd(), "src/lib/services/supabase/mediaUpload.ts"),
  "utf8",
);

function functionBody(name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} should exist`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("image uploads are re-encoded to strip EXIF/GPS after validating the original", () => {
  assert.match(source, /require\("expo-image-manipulator"\)/);
  assert.match(source, /ImageManipulator\.manipulate\(uri\)\.renderAsync\(\)/);

  const imageUpload = functionBody("uploadImageFromUri");
  const validateAt = imageUpload.indexOf("assertValidImageBlob(originalBlob");
  const reencodeAt = imageUpload.search(/reencodeImageWithoutMetadata\(\s*uri/);
  const uploadAt = imageUpload.indexOf("uploadViaSignedUrl(");
  assert.ok(validateAt >= 0 && validateAt < reencodeAt && reencodeAt < uploadAt);
});

test("post media re-encodes photos and strips location atoms from videos", () => {
  const postUpload = functionBody("uploadPostMediaFromUri");
  assert.match(postUpload, /originalContentType\.startsWith\("image\/"\)/);
  assert.match(postUpload, /await reencodeImageWithoutMetadata\(uri, originalContentType\)/);
  assert.match(postUpload, /await stripVideoMetadata\(originalBlob, originalContentType\)/);
  assert.ok(
    postUpload.indexOf("assertValidPostMediaBlob(originalBlob") <
      postUpload.indexOf("reencodeImageWithoutMetadata("),
  );
});

test("a failed metadata strip refuses the upload instead of sending the original", () => {
  const reencode = source.slice(
    source.indexOf("async function reencodeImageWithoutMetadata("),
    source.indexOf("async function readBlobBytes("),
  );
  assert.doesNotMatch(reencode, /return null/);
  assert.match(reencode, /throw new MediaUploadError\("metadata_strip_failed"/);
  // One retry before giving up.
  assert.match(reencode, /tries < 2/);

  for (const name of ["uploadImageFromUri", "uploadPostMediaFromUri"]) {
    assert.doesNotMatch(functionBody(name), /\?\?\s*originalBlob|stripped\?\./, name);
  }
  const video = source.slice(source.indexOf("async function stripVideoMetadata("));
  assert.match(video, /catch \{\s*throw new MediaUploadError\("metadata_strip_failed"/);
});

test("HEIC photos re-encoded to JPEG are stored under a .jpg path", async () => {
  const { pathForReencodedImage } = await import("@/lib/services/supabase/mediaUpload");
  assert.equal(
    pathForReencodedImage("u1/r1/photo-0-1.heic", "image/heic", "image/jpeg"),
    "u1/r1/photo-0-1.jpg",
  );
  assert.equal(
    pathForReencodedImage("u1/a.b/photo", "image/heic", "image/jpeg"),
    "u1/a.b/photo.jpg",
  );
  // Unchanged formats keep the caller's path.
  assert.equal(pathForReencodedImage("u1/x.jpeg", "image/jpeg", "image/jpeg"), "u1/x.jpeg");
  assert.equal(pathForReencodedImage("u1/x.png", "image/png", "image/png"), "u1/x.png");

  for (const name of ["uploadImageFromUri", "uploadPostMediaFromUri"]) {
    assert.match(
      functionBody(name),
      /const path = pathForReencodedImage\(requestedPath, originalContentType, contentType\);/,
    );
  }
});
