/**
 * Removes location metadata from MP4 / QuickTime video bytes before upload.
 *
 * Phone cameras write the shooting location into the file as:
 *   - a `©xyz` atom (iTunes-style, iOS and Android) or a `loci` atom (3GPP) inside moov/udta;
 *   - `com.apple.quicktime.location.*` entries in moov/meta (a `keys` atom naming the entries and
 *     an `ilst` atom holding the values, indexed by their position in `keys`).
 *
 * Each such atom is renamed `free` and its payload zeroed in place. The atom keeps its size, so
 * no offset in the file moves and the video plays as before.
 */

const CONTAINER_TYPES = new Set(["moov", "udta", "meta"]);
const LOCATION_ATOM_TYPES = new Set(["©xyz", "loci"]);
const LOCATION_KEY_PREFIX = "com.apple.quicktime.location";

export class VideoMetadataError extends Error {
  constructor(message = "This video's file structure could not be read.") {
    super(message);
    this.name = "VideoMetadataError";
  }
}

type Box = { start: number; end: number; headerSize: number; type: string };

function readType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset]!,
    bytes[offset + 1]!,
    bytes[offset + 2]!,
    bytes[offset + 3]!,
  );
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

function readBox(bytes: Uint8Array, offset: number, limit: number): Box {
  if (offset + 8 > limit) throw new VideoMetadataError();
  const size = readUint32(bytes, offset);
  const type = readType(bytes, offset + 4);
  let headerSize = 8;
  let end: number;
  if (size === 1) {
    // 64-bit size: the high word must be zero for any file this app accepts (<= 50 MB).
    if (offset + 16 > limit || readUint32(bytes, offset + 8) !== 0) throw new VideoMetadataError();
    headerSize = 16;
    end = offset + readUint32(bytes, offset + 12);
  } else if (size === 0) {
    end = limit;
  } else {
    end = offset + size;
  }
  if (end > limit || end < offset + headerSize) throw new VideoMetadataError();
  return { start: offset, end, headerSize, type };
}

function neutralise(bytes: Uint8Array, box: Box): void {
  // 'free' atoms are skipped by every player.
  bytes.set([0x66, 0x72, 0x65, 0x65], box.start + 4);
  bytes.fill(0, box.start + box.headerSize, box.end);
}

/** Position (1-based) of each `keys` entry whose name is a location key. */
function locationKeyIndexes(bytes: Uint8Array, keys: Box): Set<number> {
  const indexes = new Set<number>();
  let cursor = keys.start + keys.headerSize + 4; // version + flags
  if (cursor + 4 > keys.end) return indexes;
  const count = readUint32(bytes, cursor);
  cursor += 4;
  for (let index = 1; index <= count && cursor + 8 <= keys.end; index += 1) {
    const size = readUint32(bytes, cursor);
    if (size < 8 || cursor + size > keys.end) break;
    const name = String.fromCharCode(...bytes.subarray(cursor + 8, cursor + size));
    if (name.startsWith(LOCATION_KEY_PREFIX)) indexes.add(index);
    cursor += size;
  }
  return indexes;
}

type WalkState = { neutralised: number; locationKeys: Set<number> };

function walk(bytes: Uint8Array, start: number, end: number, state: WalkState, inIlst = false) {
  let cursor = start;
  while (cursor + 8 <= end) {
    const box = readBox(bytes, cursor, end);
    if (inIlst) {
      // An `ilst` item: its type is the 1-based index of its `keys` entry.
      if (state.locationKeys.has(readUint32(bytes, box.start + 4))) {
        neutralise(bytes, box);
        state.neutralised += 1;
      }
    } else if (LOCATION_ATOM_TYPES.has(box.type)) {
      neutralise(bytes, box);
      state.neutralised += 1;
    } else if (box.type === "keys") {
      locationKeyIndexes(bytes, box).forEach((index) => state.locationKeys.add(index));
    } else if (box.type === "ilst") {
      walk(bytes, box.start + box.headerSize, box.end, state, true);
    } else if (CONTAINER_TYPES.has(box.type)) {
      let childStart = box.start + box.headerSize;
      // ISO `meta` is a full box (version and flags first); the QuickTime one is a plain container.
      if (box.type === "meta" && childStart + 4 <= box.end && readUint32(bytes, childStart) === 0) {
        childStart += 4;
      }
      walk(bytes, childStart, box.end, state);
    }
    cursor = box.end;
  }
}

/**
 * Returns the bytes with location atoms neutralised (a copy; the input is untouched).
 * Throws VideoMetadataError when the file is not a readable MP4 / QuickTime container, so the
 * caller refuses the upload instead of sending an unchecked file.
 */
export function stripVideoLocationMetadata(input: Uint8Array): {
  bytes: Uint8Array;
  neutralised: number;
} {
  const bytes = new Uint8Array(input);
  if (bytes.length < 16 || readType(bytes, 4) !== "ftyp") throw new VideoMetadataError();
  const state: WalkState = { neutralised: 0, locationKeys: new Set() };
  walk(bytes, 0, bytes.length, state);
  return { bytes, neutralised: state.neutralised };
}
