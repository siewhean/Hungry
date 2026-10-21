import type { SupabaseClient } from "@supabase/supabase-js";

import { stripVideoLocationMetadata } from "./videoMetadata";

export interface UploadedAsset {
  path: string;
  publicUrl: string;
}

export interface MenuPhotoValidationInput {
  mimeType?: string;
  fileSizeBytes?: number;
}

const ALLOWED_MENU_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
]);
const ALLOWED_IMAGE_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
]);
const ALLOWED_POST_MEDIA_MIME_TYPES = new Set([
  ...ALLOWED_IMAGE_UPLOAD_MIME_TYPES,
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);
const MAX_MENU_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_POST_MEDIA_BYTES = 50 * 1024 * 1024;
const MAGIC_BYTE_SAMPLE_BYTES = 16;
/** Longest edge an uploaded photo keeps after re-encoding. */
const MAX_UPLOAD_IMAGE_EDGE_PX = 2048;

/** Machine-readable reason an upload was refused, so screens can show plain copy. */
export type MediaUploadErrorCode = "metadata_strip_failed" | "upload_failed";

export class MediaUploadError extends Error {
  readonly code: MediaUploadErrorCode;

  constructor(code: MediaUploadErrorCode, message: string) {
    super(message);
    this.name = "MediaUploadError";
    this.code = code;
  }
}

const METADATA_STRIP_FAILED_MESSAGE =
  "We could not remove location data from this file, so it was not uploaded.";

function guessContentType(uri: string): string {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".heic")) return "image/heic";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".mp4")) return "video/mp4";
  if (normalized.endsWith(".mov") || normalized.endsWith(".qt")) return "video/quicktime";
  if (normalized.endsWith(".webm")) return "video/webm";
  return "application/octet-stream";
}

async function fetchBlobFromUri(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to read local media: ${response.status}`);
  }
  return response.blob();
}

type ImageManipulatorModule = typeof import("expo-image-manipulator");

function loadImageManipulator(): ImageManipulatorModule | null {
  try {
    // Lazy so a binary built before expo-image-manipulator was added (or a non-RN test
    // runtime) falls back to the original file instead of crashing at import time.
    return require("expo-image-manipulator") as ImageManipulatorModule;
  } catch {
    return null;
  }
}

/**
 * Re-encode an already-validated image so EXIF metadata (GPS location, device details)
 * is not uploaded. PNG and WebP keep their format; JPEG and HEIC become JPEG.
 * Throws when re-encoding is unavailable or fails twice: the original file carries the
 * location tags, so it is never uploaded in its place.
 */
async function reencodeImageWithoutMetadata(
  uri: string,
  contentType: string,
): Promise<{ blob: Blob; contentType: string }> {
  const manipulator = loadImageManipulator();
  if (!manipulator) {
    throw new MediaUploadError("metadata_strip_failed", METADATA_STRIP_FAILED_MESSAGE);
  }

  const { ImageManipulator, SaveFormat } = manipulator;
  const format =
    contentType === "image/png"
      ? SaveFormat.PNG
      : contentType === "image/webp"
        ? SaveFormat.WEBP
        : SaveFormat.JPEG;

  const attempt = async () => {
    let rendered = await ImageManipulator.manipulate(uri).renderAsync();
    // Full-resolution phone photos are 3-5x larger than any screen shows: cap the long edge.
    if (Math.max(rendered.width, rendered.height) > MAX_UPLOAD_IMAGE_EDGE_PX) {
      rendered = await ImageManipulator.manipulate(uri)
        .resize(
          rendered.width >= rendered.height
            ? { width: MAX_UPLOAD_IMAGE_EDGE_PX }
            : { height: MAX_UPLOAD_IMAGE_EDGE_PX },
        )
        .renderAsync();
    }
    const saved = await rendered.saveAsync({ format, compress: 0.9 });
    const blob = await fetchBlobFromUri(saved.uri);
    return { blob, contentType: `image/${format}` };
  };

  // One retry covers a transient decoder or file-system hiccup.
  let lastError: unknown;
  for (let tries = 0; tries < 2; tries += 1) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn("Image metadata stripping failed; refusing the upload.", lastError);
  }
  throw new MediaUploadError("metadata_strip_failed", METADATA_STRIP_FAILED_MESSAGE);
}

async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  const withBuffer = blob as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof withBuffer.arrayBuffer === "function") {
    return new Uint8Array(await withBuffer.arrayBuffer());
  }
  if (typeof FileReader === "function") {
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        reader.result instanceof ArrayBuffer
          ? resolve(reader.result)
          : reject(new Error("Unable to read media bytes in this environment."));
      reader.onerror = () => reject(reader.error ?? new Error("Unable to read media bytes."));
      reader.readAsArrayBuffer(blob);
    });
    return new Uint8Array(buffer);
  }
  throw new Error("Unable to read media bytes in this environment.");
}

/**
 * MP4 and QuickTime videos carry the shooting location as atoms in the file. They are
 * neutralised in place; a file whose structure cannot be read is refused, never uploaded as is.
 * WebM does not carry phone location tags and passes through.
 */
async function stripVideoMetadata(
  blob: Blob,
  contentType: string,
): Promise<{ body: Blob | ArrayBuffer; contentType: string }> {
  if (contentType !== "video/mp4" && contentType !== "video/quicktime") {
    return { body: blob, contentType };
  }
  try {
    const { bytes, neutralised } = stripVideoLocationMetadata(await readBlobBytes(blob));
    if (neutralised === 0) return { body: blob, contentType };
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return { body: buffer as ArrayBuffer, contentType };
  } catch {
    throw new MediaUploadError("metadata_strip_failed", METADATA_STRIP_FAILED_MESSAGE);
  }
}

const EXTENSION_BY_IMAGE_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Callers build storage paths from the picked file's extension. When re-encoding changed
 * the format (HEIC -> JPEG), swap the extension so the path matches the stored bytes.
 */
export function pathForReencodedImage(
  path: string,
  originalContentType: string,
  contentType: string,
): string {
  const extension = EXTENSION_BY_IMAGE_CONTENT_TYPE[contentType];
  if (contentType === originalContentType || !extension) return path;
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  return dot > slash ? `${path.slice(0, dot)}.${extension}` : `${path}.${extension}`;
}

async function uploadViaSignedUrl(
  client: SupabaseClient,
  bucket: string,
  path: string,
  blob: Blob | ArrayBuffer,
  contentType: string,
): Promise<boolean> {
  try {
    const { data: signed, error: signedError } = await client.storage
      .from(bucket)
      .createSignedUploadUrl(path);
    if (signedError || !signed?.token) {
      return false;
    }

    const { error: uploadError } = await client.storage
      .from(bucket)
      .uploadToSignedUrl(path, signed.token, blob, {
        contentType,
        upsert: false,
      });
    return !uploadError;
  } catch {
    return false;
  }
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function bytesToAscii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function matchesContentTypeMagic(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return startsWith(bytes, [0xff, 0xd8, 0xff]);
  }
  if (contentType === "image/png") {
    return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (contentType === "image/webp") {
    return bytesToAscii(bytes, 0, 4) === "RIFF" && bytesToAscii(bytes, 8, 12) === "WEBP";
  }
  if (contentType === "image/heic") {
    const brand = bytesToAscii(bytes, 8, 12);
    return (
      bytesToAscii(bytes, 4, 8) === "ftyp" &&
      ["heic", "heif", "heix", "hevc", "mif1"].includes(brand)
    );
  }
  if (contentType === "video/mp4" || contentType === "video/quicktime") {
    return bytesToAscii(bytes, 4, 8) === "ftyp";
  }
  if (contentType === "video/webm") {
    return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  }
  return false;
}

async function assertValidMagicBytes(blob: Blob, contentType: string): Promise<void> {
  const sliceEnd = Math.min(MAGIC_BYTE_SAMPLE_BYTES, blob.size ?? MAGIC_BYTE_SAMPLE_BYTES);
  const maybeSlice = typeof blob.slice === "function" ? blob.slice(0, sliceEnd) : blob;
  let sampleBuffer: ArrayBuffer | undefined;

  if (
    typeof (blob as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === "function"
  ) {
    sampleBuffer = await (blob as Blob & { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
  } else if (
    typeof (maybeSlice as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer ===
    "function"
  ) {
    sampleBuffer = await (
      maybeSlice as Blob & { arrayBuffer: () => Promise<ArrayBuffer> }
    ).arrayBuffer();
  } else if (typeof FileReader === "function") {
    sampleBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (result instanceof ArrayBuffer) {
          resolve(result);
          return;
        }
        reject(new Error("Unable to read media magic bytes in this environment."));
      };
      reader.onerror = () => reject(reader.error ?? new Error("Unable to read media magic bytes."));
      reader.readAsArrayBuffer(maybeSlice);
    });
  }

  if (!sampleBuffer) {
    return;
  }

  const sample = new Uint8Array(sampleBuffer);
  if (!matchesContentTypeMagic(sample, contentType)) {
    throw new Error("Media upload content does not match its declared type.");
  }
}

async function assertValidImageBlob(blob: Blob, contentType: string): Promise<void> {
  if (typeof blob.size === "number" && blob.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error("Image upload exceeds 10MB limit.");
  }
  if (!ALLOWED_IMAGE_UPLOAD_MIME_TYPES.has(contentType)) {
    throw new Error("Image upload must be image/jpeg, image/png, image/heic, or image/webp.");
  }
  await assertValidMagicBytes(blob, contentType);
}

async function assertValidPostMediaBlob(blob: Blob, contentType: string): Promise<void> {
  if (typeof blob.size === "number" && blob.size > MAX_POST_MEDIA_BYTES) {
    throw new Error("Post media upload exceeds 50MB limit.");
  }
  if (!ALLOWED_POST_MEDIA_MIME_TYPES.has(contentType)) {
    throw new Error("Post media must be an image or supported video file.");
  }
  await assertValidMagicBytes(blob, contentType);
}

export async function uploadImageFromUri(params: {
  client: SupabaseClient;
  bucket: string;
  path: string;
  uri: string;
}): Promise<UploadedAsset> {
  const { client, bucket, path: requestedPath, uri } = params;
  const originalBlob = await fetchBlobFromUri(uri);
  const originalContentType = originalBlob.type || guessContentType(uri);
  await assertValidImageBlob(originalBlob, originalContentType);

  const { blob, contentType } = await reencodeImageWithoutMetadata(uri, originalContentType);
  const path = pathForReencodedImage(requestedPath, originalContentType, contentType);

  const signedSucceeded = await uploadViaSignedUrl(client, bucket, path, blob, contentType);
  if (!signedSucceeded) {
    throw new MediaUploadError("upload_failed", "Signed upload URL creation failed.");
  }

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return {
    path,
    publicUrl: data.publicUrl,
  };
}

export async function uploadPostMediaFromUri(params: {
  client: SupabaseClient;
  bucket: string;
  path: string;
  uri: string;
}): Promise<UploadedAsset & { contentType: string; sizeBytes?: number }> {
  const { client, bucket, path: requestedPath, uri } = params;
  const originalBlob = await fetchBlobFromUri(uri);
  const originalContentType = originalBlob.type || guessContentType(uri);
  await assertValidPostMediaBlob(originalBlob, originalContentType);

  let body: Blob | ArrayBuffer;
  let contentType: string;
  if (originalContentType.startsWith("image/")) {
    const stripped = await reencodeImageWithoutMetadata(uri, originalContentType);
    body = stripped.blob;
    contentType = stripped.contentType;
  } else {
    ({ body, contentType } = await stripVideoMetadata(originalBlob, originalContentType));
  }
  const path = pathForReencodedImage(requestedPath, originalContentType, contentType);

  const signedSucceeded = await uploadViaSignedUrl(client, bucket, path, body, contentType);
  if (!signedSucceeded) {
    throw new MediaUploadError("upload_failed", "Signed upload URL creation failed.");
  }

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  const sizeBytes =
    body instanceof ArrayBuffer
      ? body.byteLength
      : typeof body.size === "number"
        ? body.size
        : undefined;
  return {
    path,
    publicUrl: data.publicUrl,
    contentType,
    sizeBytes,
  };
}

export function assertValidMenuPhotoUpload(input: MenuPhotoValidationInput): void {
  if (typeof input.fileSizeBytes === "number" && input.fileSizeBytes > MAX_MENU_PHOTO_BYTES) {
    throw new Error("Menu photo exceeds 10MB limit.");
  }
  if (input.mimeType && !ALLOWED_MENU_PHOTO_MIME_TYPES.has(input.mimeType)) {
    throw new Error("Menu photo must be image/jpeg, image/png, image/heic, or image/webp.");
  }
}
