import { assertAccountGeneration, getAccountGeneration } from "@/lib/security/accountScope";
import { File, Paths, Directory } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Crypto from "expo-crypto";

const EXPORT_TTL_MS = 5 * 60 * 1000;
const activeExports = new Map<string, { file: File; timer: ReturnType<typeof setTimeout> }>();

/** Account transitions call this before another account can export private data. */
export function cleanupMyDataExports(): void {
  for (const { file, timer } of activeExports.values()) {
    clearTimeout(timer);
    try {
      if (file.exists) file.delete();
    } catch {
      /* Next export retries cache cleanup. */
    }
  }
  activeExports.clear();
  try {
    const directory = new Directory(Paths.cache, "hungry-data-exports");
    if (directory.exists) directory.delete();
  } catch {
    /* Cache cleanup failure must not expose file contents in logs. */
  }
}

export async function shareMyDataExport(
  data: unknown,
  accountId: string,
  getCurrentAccountId: () => string | null,
): Promise<void> {
  const generation = getAccountGeneration();
  cleanupMyDataExports();
  if (getCurrentAccountId() !== accountId)
    throw new Error("Your account changed. Prepare a new export.");
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("File sharing is unavailable on this device.");
  assertAccountGeneration(generation);
  const directory = new Directory(Paths.cache, "hungry-data-exports");
  directory.create({ intermediates: true, idempotent: true });
  const key = Crypto.randomUUID();
  const file = new File(directory, `${key}.json`);
  file.create();
  file.write(JSON.stringify(data, null, 2));
  const remove = () => {
    activeExports.delete(key);
    try {
      if (file.exists) file.delete();
    } catch {
      /* Retried by cleanupMyDataExports. */
    }
  };
  const timer = setTimeout(remove, EXPORT_TTL_MS);
  activeExports.set(key, { file, timer });
  try {
    assertAccountGeneration(generation);
    if (getCurrentAccountId() !== accountId)
      throw new Error("Your account changed. Prepare a new export.");
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json",
      dialogTitle: "My Hungry data",
    });
  } finally {
    clearTimeout(timer);
    remove();
  }
}
