/** The data export is written here before it is shared (iOS), then removed. */
export const EXPORT_FILE_NAME = "hungry-data-export.json";

/**
 * Android shares the export as text, and an intent over about 1 MB fails (and many apps cut
 * long text), so a larger export is not sent that way. Lift this with expo-sharing, which
 * needs a native build.
 */
export const ANDROID_TEXT_SHARE_LIMIT_CHARS = 200_000;

export function canShareExportAsText(json: string): boolean {
  return json.length <= ANDROID_TEXT_SHARE_LIMIT_CHARS;
}

type FileSystemModule = typeof import("expo-file-system");

function loadFileSystem(): FileSystemModule | null {
  try {
    // Lazy so non-native runtimes (tests) and stores can import this file safely.
    return require("expo-file-system") as FileSystemModule;
  } catch {
    return null;
  }
}

/** Writes the export to the cache directory and returns its file URI. */
export function writeExportFile(json: string): string {
  const fileSystem = loadFileSystem();
  if (!fileSystem) throw new Error("File storage is unavailable.");
  const exportFile = new fileSystem.File(fileSystem.Paths.cache, EXPORT_FILE_NAME);
  exportFile.create({ overwrite: true });
  exportFile.write(json);
  return exportFile.uri;
}

/**
 * Removes the exported copy of the user's data from the cache. It is a full copy of their
 * personal data, so it goes after sharing, on sign-out, on deletion and when the cache is
 * cleared. Never throws: a missing file or storage is fine.
 */
export function deleteExportFile(): void {
  try {
    const fileSystem = loadFileSystem();
    if (!fileSystem) return;
    const exportFile = new fileSystem.File(fileSystem.Paths.cache, EXPORT_FILE_NAME);
    if (exportFile.exists) exportFile.delete();
  } catch {
    // Nothing to remove, or the OS already cleaned the cache.
  }
}
