import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { askChoice } from "@/store/useChoiceSheetStore";

import { isGalleryPermissionGranted } from "./gallery";

export type MediaSource = "camera" | "library";

/**
 * Asks where a photo comes from: the camera or the library, in the app's own sheet. Resolves null when dismissed.
 * On web there is no camera sheet, so it goes straight to the library.
 *
 * The library needs no permission request: the system photo picker (iOS 14+, Android 13+)
 * only hands over what the person picks.
 */
export async function askMediaSource(title = "Add a photo"): Promise<MediaSource | null> {
  if (Platform.OS === "web") return "library";
  const choice = await askChoice({
    title,
    options: [
      { id: "camera", label: "Take photo" },
      { id: "library", label: "Choose from library" },
    ],
  });
  return choice === "camera" || choice === "library" ? choice : null;
}

export type CameraCaptureResult =
  | { status: "ok"; assets: ImagePicker.ImagePickerAsset[] }
  | { status: "denied" }
  | { status: "canceled" };

/** Opens the camera, asking for camera permission only when it is actually used. */
export async function captureWithCamera(
  options: ImagePicker.ImagePickerOptions,
): Promise<CameraCaptureResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!isGalleryPermissionGranted(permission)) return { status: "denied" };
  const result = await ImagePicker.launchCameraAsync(options);
  if (result.canceled || !result.assets?.length) return { status: "canceled" };
  return { status: "ok", assets: result.assets };
}
