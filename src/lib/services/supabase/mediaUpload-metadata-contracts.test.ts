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
  const reencodeAt = imageUpload.indexOf("reencodeImageWithoutMetadata(uri");
  const uploadAt = imageUpload.indexOf("uploadViaSignedUrl(");
  assert.ok(validateAt >= 0 && validateAt < reencodeAt && reencodeAt < uploadAt);
});

test("post media re-encodes photos but leaves videos untouched", () => {
  const postUpload = functionBody("uploadPostMediaFromUri");
  assert.match(
    postUpload,
    /originalContentType\.startsWith\("image\/"\)\s*\?\s*await reencodeImageWithoutMetadata/,
  );
  assert.ok(
    postUpload.indexOf("assertValidPostMediaBlob(originalBlob") <
      postUpload.indexOf("reencodeImageWithoutMetadata("),
  );
});
