/**
 * Supabase-compatible async storage adapter backed by `expo-secure-store`
 * (Keychain on iOS, EncryptedSharedPreferences on Android).
 *
 * Why this exists:
 *   `@supabase/supabase-js` on React Native defaults its auth token persistence
 *   to AsyncStorage — which stores the access token, refresh token, and full
 *   session JSON in plaintext on disk. That is an OWASP MASVS-STORAGE finding.
 *   This adapter moves that material into Keychain / Keystore so it can only
 *   be read after device unlock and is never backed up.
 *
 * Design notes:
 *   - SecureStore has a ~2KB practical per-value limit on iOS. Supabase session
 *     JSON can exceed 2KB (access + refresh + user object + provider tokens),
 *     so values are chunked into ~1800-byte slices with a small metadata
 *     record describing the chunk count.
 *   - Each chunk and the metadata record are written/read through SecureStore
 *     using `AFTER_FIRST_UNLOCK` accessibility so token refresh can succeed in
 *     the background after the user's first unlock following a reboot.
 *   - On first read of a legacy key that still lives in AsyncStorage (from a
 *     pre-upgrade install), the value is migrated into SecureStore and the
 *     AsyncStorage copy is deleted. This is a one-shot op per key.
 *   - If SecureStore itself throws in production, tokens stay memory-only and
 *     the user must re-authenticate on restart. Plain AsyncStorage fallback is
 *     only allowed in dev/test via `__DEV__` or HUNGRY_ALLOW_INSECURE_AUTH_STORAGE.
 */

const CHUNK_SIZE = 1800;
const CHUNK_SUFFIX = ".c";
const META_SUFFIX = ".cmeta";

type SecureStoreLike = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string, options?: { keychainAccessible?: unknown }) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
  AFTER_FIRST_UNLOCK?: unknown;
};

type AsyncStorageLike = {
  getItem: (name: string) => Promise<string | null>;
  setItem: (name: string, value: string) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
};

let cachedSecureStore: SecureStoreLike | null | undefined;
let cachedAsyncStorage: AsyncStorageLike | null | undefined;

function getSecureStore(): SecureStoreLike | null {
  if (process.env.HUNGRY_DISABLE_SECURE_STORE === "1") {
    cachedSecureStore = null;
    return cachedSecureStore;
  }

  if (cachedSecureStore !== undefined) {
    return cachedSecureStore;
  }

  try {
    const moduleRef = require("expo-secure-store") as SecureStoreLike;
    if (
      moduleRef &&
      typeof moduleRef.getItemAsync === "function" &&
      typeof moduleRef.setItemAsync === "function" &&
      typeof moduleRef.deleteItemAsync === "function"
    ) {
      cachedSecureStore = moduleRef;
      return cachedSecureStore;
    }
  } catch {
    // Native module is not available in this runtime.
  }

  cachedSecureStore = null;
  return cachedSecureStore;
}

function getAsyncStorage(): AsyncStorageLike | null {
  if (process.env.HUNGRY_DISABLE_ASYNC_STORAGE === "1") {
    cachedAsyncStorage = null;
    return cachedAsyncStorage;
  }

  if (cachedAsyncStorage !== undefined) {
    return cachedAsyncStorage;
  }

  try {
    const moduleRef = require("@react-native-async-storage/async-storage") as {
      default?: AsyncStorageLike;
    };
    const candidate = moduleRef.default;
    if (
      candidate &&
      typeof candidate.getItem === "function" &&
      typeof candidate.setItem === "function" &&
      typeof candidate.removeItem === "function"
    ) {
      cachedAsyncStorage = candidate;
      return cachedAsyncStorage;
    }
  } catch {
    // Native module is not available in this runtime.
  }

  cachedAsyncStorage = null;
  return cachedAsyncStorage;
}

const memoryStore = new Map<string, string>();

function canUsePlaintextTokenFallback(): boolean {
  return (
    process.env.HUNGRY_ALLOW_INSECURE_AUTH_STORAGE === "1" ||
    (typeof __DEV__ !== "undefined" && __DEV__)
  );
}

function chunkKey(name: string, index: number): string {
  return `${name}${CHUNK_SUFFIX}${index}`;
}

function metaKey(name: string): string {
  return `${name}${META_SUFFIX}`;
}

type ChunkMeta = { chunks: number; length: number; version: 1 };

function parseMeta(raw: string | null): ChunkMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ChunkMeta>;
    if (
      parsed &&
      parsed.version === 1 &&
      typeof parsed.chunks === "number" &&
      typeof parsed.length === "number" &&
      parsed.chunks >= 0
    ) {
      return parsed as ChunkMeta;
    }
  } catch {
    // fall through
  }
  return null;
}

async function secureGet(name: string): Promise<string | null> {
  const secureStore = getSecureStore();
  if (!secureStore) return null;

  try {
    return await secureStore.getItemAsync(name);
  } catch {
    return null;
  }
}

async function secureSet(name: string, value: string): Promise<boolean> {
  const secureStore = getSecureStore();
  if (!secureStore) return false;

  try {
    await secureStore.setItemAsync(name, value, {
      keychainAccessible: secureStore.AFTER_FIRST_UNLOCK,
    });
    return true;
  } catch {
    return false;
  }
}

async function secureDelete(name: string): Promise<void> {
  const secureStore = getSecureStore();
  if (!secureStore) return;

  try {
    await secureStore.deleteItemAsync(name);
  } catch {
    // Ignore — callers still fall through to other stores.
  }
}

async function readFromSecureStore(name: string): Promise<string | null> {
  const metaRaw = await secureGet(metaKey(name));
  const meta = parseMeta(metaRaw);

  if (!meta) {
    // No chunk metadata — either a pre-chunking single-value write, or no
    // entry at all. Probe the single-key form before giving up.
    return secureGet(name);
  }

  if (meta.chunks === 0) {
    return "";
  }

  const chunks = await Promise.all(
    Array.from({ length: meta.chunks }, (_, i) => secureGet(chunkKey(name, i))),
  );

  if (chunks.some((chunk) => chunk === null)) {
    // Partial corruption — treat as absent and clean up so the next write
    // starts from a known-good state.
    await clearSecureStoreEntry(name, meta.chunks);
    return null;
  }

  const joined = chunks.join("");
  if (joined.length !== meta.length) {
    // Length mismatch indicates truncation; discard and clean up.
    await clearSecureStoreEntry(name, meta.chunks);
    return null;
  }
  return joined;
}

async function clearSecureStoreEntry(name: string, knownChunkCount: number): Promise<void> {
  const tasks: Promise<void>[] = [secureDelete(metaKey(name)), secureDelete(name)];
  for (let i = 0; i < knownChunkCount; i++) {
    tasks.push(secureDelete(chunkKey(name, i)));
  }
  await Promise.all(tasks);
}

async function removeFromSecureStore(name: string): Promise<void> {
  const metaRaw = await secureGet(metaKey(name));
  const meta = parseMeta(metaRaw);
  const chunks = meta?.chunks ?? 0;
  // Delete any chunks we know about plus a defensive additional sweep of a
  // small trailing range in case a previous write left orphans.
  const sweep = Math.max(chunks, 8);
  const tasks: Promise<void>[] = [secureDelete(metaKey(name)), secureDelete(name)];
  for (let i = 0; i < sweep; i++) {
    tasks.push(secureDelete(chunkKey(name, i)));
  }
  await Promise.all(tasks);
}

async function writeToSecureStore(name: string, value: string): Promise<boolean> {
  // Clear any prior entry first so we never leave stale chunks behind.
  await removeFromSecureStore(name);

  const parts: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    parts.push(value.slice(i, i + CHUNK_SIZE));
  }
  if (parts.length === 0) {
    parts.push("");
  }

  for (let i = 0; i < parts.length; i++) {
    const ok = await secureSet(chunkKey(name, i), parts[i]);
    if (!ok) {
      // Roll back partial writes so read doesn't return a truncated value.
      await removeFromSecureStore(name);
      return false;
    }
  }

  const meta: ChunkMeta = { chunks: parts.length, length: value.length, version: 1 };
  const metaOk = await secureSet(metaKey(name), JSON.stringify(meta));
  if (!metaOk) {
    await removeFromSecureStore(name);
    return false;
  }
  return true;
}

async function migrateLegacyValue(name: string): Promise<string | null> {
  const asyncStorage = getAsyncStorage();
  if (!asyncStorage) return null;

  let legacy: string | null = null;
  try {
    legacy = await asyncStorage.getItem(name);
  } catch {
    return null;
  }
  if (legacy === null) return null;

  const wrote = await writeToSecureStore(name, legacy);
  if (wrote) {
    try {
      await asyncStorage.removeItem(name);
    } catch {
      // Keep legacy value readable even if cleanup fails — next launch will retry.
    }
  } else if (!canUsePlaintextTokenFallback()) {
    return null;
  }
  return legacy;
}

export const supabaseAuthStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const fromSecureStore = await readFromSecureStore(name);
    if (fromSecureStore !== null) {
      return fromSecureStore;
    }

    const migrated = await migrateLegacyValue(name);
    if (migrated !== null) {
      return migrated;
    }

    const asyncStorage = canUsePlaintextTokenFallback() ? getAsyncStorage() : null;
    if (asyncStorage) {
      try {
        const fromAsync = await asyncStorage.getItem(name);
        if (fromAsync !== null) return fromAsync;
      } catch {
        // Fall through to in-memory.
      }
    }

    return memoryStore.get(name) ?? null;
  },

  setItem: async (name: string, value: string): Promise<void> => {
    const wrote = await writeToSecureStore(name, value);
    if (wrote) {
      // Belt-and-braces: if a legacy copy lingered in AsyncStorage, remove it
      // now that the canonical copy lives in SecureStore.
      const asyncStorage = getAsyncStorage();
      if (asyncStorage) {
        try {
          await asyncStorage.removeItem(name);
        } catch {
          // Ignore — not critical to the write path.
        }
      }
      memoryStore.delete(name);
      return;
    }

    // SecureStore failed. In production, keep tokens memory-only rather than
    // persisting auth material to plaintext AsyncStorage.
    const asyncStorage = canUsePlaintextTokenFallback() ? getAsyncStorage() : null;
    if (asyncStorage) {
      try {
        await asyncStorage.setItem(name, value);
        return;
      } catch {
        // Fall through.
      }
    }
    memoryStore.set(name, value);
  },

  removeItem: async (name: string): Promise<void> => {
    await removeFromSecureStore(name);

    const asyncStorage = getAsyncStorage();
    if (asyncStorage) {
      try {
        await asyncStorage.removeItem(name);
      } catch {
        // Ignore.
      }
    }

    memoryStore.delete(name);
  },
};

// Exported for tests.
export const __internal = {
  CHUNK_SIZE,
  CHUNK_SUFFIX,
  META_SUFFIX,
  chunkKey,
  metaKey,
  canUsePlaintextTokenFallback,
};
