import type { ReviewDraft } from "../../types/domain";

export function createInitialReviewDraft(): ReviewDraft {
  return {
    selectedVenueId: undefined,
    selectedDishId: undefined,
    rating: 0,
    selectedTags: [],
    recommend: false,
    text: "",
    photos: [],
  };
}

/**
 * RFC 4122 v4 id generated on the client so a retried review submission reuses the same row id
 * (the server resumes instead of inserting a duplicate review).
 */
export function createClientReviewId(): string {
  const cryptoRef = (globalThis as { crypto?: Partial<Crypto> }).crypto;
  if (typeof cryptoRef?.randomUUID === "function") {
    return cryptoRef.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof cryptoRef?.getRandomValues === "function") {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
