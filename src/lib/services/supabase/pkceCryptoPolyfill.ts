const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

type CryptoLike = {
  subtle?: {
    digest: (
      algorithm: string | { name: string },
      data: ArrayBuffer | ArrayBufferView,
    ) => Promise<ArrayBuffer>;
  };
  getRandomValues: (array: Uint8Array | Uint16Array | Uint32Array) => typeof array;
};

function toUint8Array(data: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | ((value << (32 - amount)) >>> 0);
}

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, "0");
}

function hashMessage(message: Uint8Array): string {
  const bitLength = message.length * 8;
  const paddedLength = (message.length + 9 + 63) & ~63;
  const padded = new Uint8Array(paddedLength);

  padded.set(message, 0);
  padded[message.length] = 0x80;

  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;
  padded[paddedLength - 8] = (highBits >>> 24) & 0xff;
  padded[paddedLength - 7] = (highBits >>> 16) & 0xff;
  padded[paddedLength - 6] = (highBits >>> 8) & 0xff;
  padded[paddedLength - 5] = highBits & 0xff;
  padded[paddedLength - 4] = (lowBits >>> 24) & 0xff;
  padded[paddedLength - 3] = (lowBits >>> 16) & 0xff;
  padded[paddedLength - 2] = (lowBits >>> 8) & 0xff;
  padded[paddedLength - 1] = lowBits & 0xff;

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const w = new Uint32Array(64);

  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t += 1) {
      const j = i + t * 4;
      w[t] = (padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3];
    }

    for (let t = 16; t < 64; t += 1) {
      const s0 = rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (let t = 0; t < 64; t += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[t] + w[t]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return hash
    .map(
      (value) =>
        `${toHex((value >>> 24) & 0xff)}${toHex((value >>> 16) & 0xff)}${toHex((value >>> 8) & 0xff)}${toHex(value & 0xff)}`,
    )
    .join("");
}

function toArrayBufferFromHex(hashHex: string): ArrayBuffer {
  const out = new Uint8Array(hashHex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hashHex.slice(i * 2, i * 2 + 2), 16);
  }
  return out.buffer;
}

function ensureTextEncoderPolyfill(): void {
  if (typeof (globalThis as { TextEncoder?: unknown }).TextEncoder !== "undefined") {
    return;
  }

  class TextEncoderPolyfill {
    encode(input = ""): Uint8Array {
      const escaped = encodeURIComponent(input);
      const raw = unescape(escaped);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i += 1) {
        bytes[i] = raw.charCodeAt(i);
      }
      return bytes;
    }
  }

  (globalThis as { TextEncoder: typeof TextEncoderPolyfill }).TextEncoder = TextEncoderPolyfill;
}

function ensureCryptoPolyfill(): void {
  if (typeof globalThis.crypto === "undefined") {
    (globalThis as { crypto: CryptoLike }).crypto = {} as CryptoLike;
  }

  const cryptoRef = globalThis.crypto as CryptoLike;

  ensureTextEncoderPolyfill();

  if (typeof cryptoRef.getRandomValues !== "function") {
    cryptoRef.getRandomValues = (array) => {
      for (let i = 0; i < array.length; i += 1) {
        array[i] = Math.floor(Math.random() * 0x100000000);
      }
      return array;
    };
  }

  if (!cryptoRef.subtle || typeof cryptoRef.subtle.digest !== "function") {
    cryptoRef.subtle = {
      digest: async (algorithm, data) => {
        const algorithmName = typeof algorithm === "string" ? algorithm : (algorithm?.name ?? "");
        if (algorithmName.toUpperCase() !== "SHA-256") {
          throw new Error(`Unsupported digest algorithm: ${algorithmName}`);
        }

        const bytes = toUint8Array(data);
        return toArrayBufferFromHex(hashMessage(bytes));
      },
    };
  }
}

export function installPkceCryptoPolyfill(): void {
  const isWebCryptoReady =
    typeof globalThis.crypto !== "undefined" &&
    typeof (globalThis.crypto as CryptoLike).subtle !== "undefined" &&
    typeof (globalThis.crypto as CryptoLike).getRandomValues === "function" &&
    typeof (globalThis as { TextEncoder?: unknown }).TextEncoder !== "undefined";

  if (isWebCryptoReady) {
    return;
  }

  ensureCryptoPolyfill();
}

export { hashMessage as __testHashMessage };
