import { Platform } from "react-native";

import { confirmGalleryAccess, isGalleryPermissionGranted } from "@/lib/permissions/gallery";

export type MerchantMediaKind = "image" | "video";
export type MerchantMediaSource = "library" | "camera";

/** Longest verification video accepted, in seconds (a walkaround, not a full tour). */
export const MAX_EVIDENCE_VIDEO_SECONDS = 120;

type PickedAsset = { uri?: string; duration?: number | null };
type PickerResult = { canceled: boolean; assets?: PickedAsset[] | null };
type PermissionResult = { granted?: boolean; status?: string };
type ImagePickerModule = {
  requestMediaLibraryPermissionsAsync: () => Promise<PermissionResult>;
  requestCameraPermissionsAsync: () => Promise<PermissionResult>;
  launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<PickerResult>;
  launchCameraAsync: (options: Record<string, unknown>) => Promise<PickerResult>;
};

function loadImagePickerModule(): ImagePickerModule | null {
  try {
    return require("expo-image-picker") as ImagePickerModule;
  } catch {
    return null;
  }
}

/**
 * Picks one merchant photo or video from the library, or takes a photo with the camera.
 * `rationale` is the context-specific reason shown before the gallery permission prompt.
 * Returns null when the merchant cancels; throws an Error with a user-facing message otherwise.
 * Camera capture is photo-only: the app ships without microphone access, which video needs.
 */
export async function pickMerchantMedia({
  kind,
  source = "library",
  rationale,
  allowsEditing = kind === "image",
  maxVideoSeconds = MAX_EVIDENCE_VIDEO_SECONDS,
}: {
  kind: MerchantMediaKind;
  source?: MerchantMediaSource;
  rationale: string;
  allowsEditing?: boolean;
  maxVideoSeconds?: number;
}): Promise<string | null> {
  const imagePicker = loadImagePickerModule();
  if (!imagePicker) {
    throw new Error("The photo picker is unavailable in this app build.");
  }
  const options = {
    allowsEditing,
    mediaTypes: kind === "video" ? ["videos"] : ["images"],
    quality: 0.82,
    selectionLimit: 1,
    ...(kind === "video" ? { videoMaxDuration: maxVideoSeconds } : {}),
  };

  let result: PickerResult;
  if (source === "camera" && kind === "image" && Platform.OS !== "web") {
    const permission = await imagePicker.requestCameraPermissionsAsync();
    if (!isGalleryPermissionGranted(permission)) {
      throw new Error("Camera permission is required to take this photo.");
    }
    result = await imagePicker.launchCameraAsync(options);
  } else {
    const shouldRequestPermission = await confirmGalleryAccess({
      title: "Allow gallery access",
      message: rationale,
      confirmLabel: "Allow",
      cancelLabel: "Not now",
    });
    if (!shouldRequestPermission) return null;
    const permission = await imagePicker.requestMediaLibraryPermissionsAsync();
    if (!isGalleryPermissionGranted(permission)) {
      throw new Error("Photos permission is required to attach this file.");
    }
    result = await imagePicker.launchImageLibraryAsync(options);
  }

  const asset = result.canceled ? undefined : result.assets?.[0];
  if (!asset?.uri) return null;
  // expo-image-picker reports video duration in milliseconds.
  if (
    kind === "video" &&
    typeof asset.duration === "number" &&
    asset.duration > maxVideoSeconds * 1000
  ) {
    throw new Error(
      `Please choose a video of ${Math.round(maxVideoSeconds / 60)} minutes or less.`,
    );
  }
  return asset.uri;
}
