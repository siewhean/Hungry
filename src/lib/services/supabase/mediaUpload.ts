import type { SupabaseClient } from "@supabase/supabase-js";

export interface UploadedAsset {
  path: string;
  publicUrl: string;
}

export interface MenuPhotoValidationInput {
  mimeType?: string;
  fileSizeBytes?: number;
}

const ALLOWED_MENU_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/heic"]);
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

async function uploadViaSignedUrl(
  client: SupabaseClient,
  bucket: string,
  path: string,
  blob: Blob,
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
  const { client, bucket, path, uri } = params;
  const blob = await fetchBlobFromUri(uri);
  const contentType = blob.type || guessContentType(uri);
  await assertValidImageBlob(blob, contentType);

  const signedSucceeded = await uploadViaSignedUrl(client, bucket, path, blob, contentType);
  if (!signedSucceeded) {
    throw new Error("Signed upload URL creation failed.");
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
  const { client, bucket, path, uri } = params;
  const blob = await fetchBlobFromUri(uri);
  const contentType = blob.type || guessContentType(uri);
  await assertValidPostMediaBlob(blob, contentType);

  const signedSucceeded = await uploadViaSignedUrl(client, bucket, path, blob, contentType);
  if (!signedSucceeded) {
    throw new Error("Signed upload URL creation failed.");
  }

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return {
    path,
    publicUrl: data.publicUrl,
    contentType,
    sizeBytes: typeof blob.size === "number" ? blob.size : undefined,
  };
}

export function assertValidMenuPhotoUpload(input: MenuPhotoValidationInput): void {
  if (typeof input.fileSizeBytes === "number" && input.fileSizeBytes > MAX_MENU_PHOTO_BYTES) {
    throw new Error("Menu photo exceeds 10MB limit.");
  }
  if (input.mimeType && !ALLOWED_MENU_PHOTO_MIME_TYPES.has(input.mimeType)) {
    throw new Error("Menu photo must be image/jpeg, image/png, or image/heic.");
  }
}
