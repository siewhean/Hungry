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
const MAX_MENU_PHOTO_BYTES = 10 * 1024 * 1024;

function guessContentType(uri: string): string {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".heic")) return "image/heic";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
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
        upsert: true,
      });
    return !uploadError;
  } catch {
    return false;
  }
}

async function uploadViaSdk(
  client: SupabaseClient,
  bucket: string,
  path: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  const { error } = await client.storage.from(bucket).upload(path, blob, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw error;
  }
}

export async function uploadImageFromUri(params: {
  client: SupabaseClient;
  bucket: string;
  path: string;
  uri: string;
}): Promise<UploadedAsset> {
  const { client, bucket, path, uri } = params;
  const blob = await fetchBlobFromUri(uri);
  const contentType = guessContentType(uri);

  const signedSucceeded = await uploadViaSignedUrl(client, bucket, path, blob, contentType);
  if (!signedSucceeded) {
    await uploadViaSdk(client, bucket, path, blob, contentType);
  }

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return {
    path,
    publicUrl: data.publicUrl,
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
