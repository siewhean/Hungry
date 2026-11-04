// Turns a rendered share card into a picture file and opens the phone's share sheet with it
// (Instagram Stories, WhatsApp, Telegram, Save Image ...).
//
// Both native pieces (react-native-view-shot to take the picture, expo-sharing to share a file)
// arrived with the share-card build. An app build made before them has neither, so everything
// here checks first and says "unavailable"; the caller then shares a link instead.

import { NativeModules, PixelRatio, Platform, TurboModuleRegistry } from "react-native";

export interface ShareCardNative {
  captureRef: (
    target: unknown,
    options: {
      width: number;
      height: number;
      format: "png" | "jpg";
      quality: number;
      result: "tmpfile";
    },
  ) => Promise<string>;
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (
    url: string,
    options: { mimeType: string; UTI: string; dialogTitle: string },
  ) => Promise<void>;
}

export type ShareCardResult = "shared" | "unavailable";

let cachedNative: ShareCardNative | null | undefined;

/** The native picture and share modules, or null when this build (or the web) has none. */
export function loadShareCardNative(): ShareCardNative | null {
  if (cachedNative !== undefined) return cachedNative;
  cachedNative = null;
  if (Platform.OS !== "ios" && Platform.OS !== "android") return cachedNative;
  try {
    const { requireOptionalNativeModule } =
      require("expo-modules-core") as typeof import("expo-modules-core");
    const hasSharing = Boolean(requireOptionalNativeModule("ExpoSharing"));
    const hasViewShot = Boolean(
      TurboModuleRegistry.get("RNViewShot") ??
      (NativeModules as Record<string, unknown>).RNViewShot,
    );
    if (!hasSharing || !hasViewShot) return cachedNative;
    const viewShot = require("react-native-view-shot") as typeof import("react-native-view-shot");
    const sharing = require("expo-sharing") as typeof import("expo-sharing");
    cachedNative = {
      captureRef: (target, options) =>
        viewShot.captureRef(target as Parameters<typeof viewShot.captureRef>[0], options),
      isAvailableAsync: sharing.isAvailableAsync,
      shareAsync: sharing.shareAsync,
    };
  } catch {
    cachedNative = null;
  }
  return cachedNative;
}

/** Tests only: stand in for the native modules (undefined loads them again next time). */
export function setShareCardNativeForTests(native: ShareCardNative | null | undefined) {
  cachedNative = native;
}

/** True when this build can share a card as a picture. */
export function canShareCardImage(native: ShareCardNative | null = loadShareCardNative()): boolean {
  return native !== null;
}

/**
 * The size to ask react-native-view-shot for. Android takes pixels; iOS takes points and draws
 * them at the screen's scale, so the pixel size is divided by that scale there.
 */
export function captureSizeFor(
  width: number,
  height: number,
  platform: string = Platform.OS,
  pixelRatio: number = PixelRatio.get(),
): { width: number; height: number } {
  const scale = platform === "ios" && pixelRatio > 0 ? pixelRatio : 1;
  return { width: width / scale, height: height / scale };
}

/**
 * Takes a picture of `target` at `width` x `height` pixels and opens the share sheet with it.
 * Resolves "unavailable" when the build or the phone cannot share files; throws when the
 * picture or the share sheet fails, so the caller can report it.
 */
export async function shareCardImage(
  target: unknown,
  options: { width: number; height: number; format: "png" | "jpg"; dialogTitle: string },
  native: ShareCardNative | null = loadShareCardNative(),
): Promise<ShareCardResult> {
  if (!native || !target) return "unavailable";
  if (!(await native.isAvailableAsync())) return "unavailable";
  const size = captureSizeFor(options.width, options.height);
  const uri = await native.captureRef(target, {
    width: size.width,
    height: size.height,
    format: options.format,
    quality: 0.92,
    result: "tmpfile",
  });
  const png = options.format === "png";
  // iOS hands back a bare path; the share sheet wants a file URL.
  const fileUrl = uri.startsWith("/") ? `file://${uri}` : uri;
  await native.shareAsync(fileUrl, {
    mimeType: png ? "image/png" : "image/jpeg",
    UTI: png ? "public.png" : "public.jpeg",
    dialogTitle: options.dialogTitle,
  });
  return "shared";
}
