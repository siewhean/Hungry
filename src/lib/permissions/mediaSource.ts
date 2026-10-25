import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { isGalleryPermissionGranted } from "./gallery";

export type MediaSource = "camera" | "library";

/**
 * Asks where a photo comes from: the camera or the library. Resolves null when dismissed.
 * On web, and in builds without camera support, there is no camera sheet, so it goes straight
 * to the library.
 *
 * The library needs no permission request: the system photo picker (iOS 14+, Android 13+)
 * only hands over what the person picks.
 */
export function askMediaSource(title = "Add a photo"): Promise<MediaSource | null> {
  if (Platform.OS === "web" || !FEATURE_FLAGS.cameraCaptureEnabled) {
    return Promise.resolve("library");
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      undefined,
      [
        { text: "Take photo", onPress: () => resolve("camera") },
        { text: "Choose from library", onPress: () => resolve("library") },
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

export type CameraCaptureResult =
  | { status: "ok"; assets: ImagePicker.ImagePickerAsset[] }
  | { status: "denied" }
  | { status: "canceled" };

/**
 * Opens the camera, asking for camera permission only when it is actually used. Builds without
 * camera support answer "denied" without touching the native module (iOS aborts the app when
 * the camera is requested without NSCameraUsageDescription).
 */
export async function captureWithCamera(
  options: ImagePicker.ImagePickerOptions,
): Promise<CameraCaptureResult> {
  if (!FEATURE_FLAGS.cameraCaptureEnabled) return { status: "denied" };
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!isGalleryPermissionGranted(permission)) return { status: "denied" };
  const result = await ImagePicker.launchCameraAsync(options);
  if (result.canceled || !result.assets?.length) return { status: "canceled" };
  return { status: "ok", assets: result.assets };
}
