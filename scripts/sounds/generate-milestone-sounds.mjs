// Writes the three milestone sounds in assets/sounds/ from plain sine tones, so they are ours and
// licence-free. Run with `node scripts/sounds/generate-milestone-sounds.mjs` after changing a note.
// Kept short and soft: a sound marks a moment, it never asks for attention.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const RATE = 22_050;
const OUT = join(process.cwd(), "assets", "sounds");

/** A bell-like note: a sine and a quiet octave, with a fast attack and an exponential fade. */
function note(freq, start, length, gain) {
  return { freq, start, length, gain };
}

function render(notes, total) {
  const samples = new Float32Array(Math.round(total * RATE));
  for (const { freq, start, length, gain } of notes) {
    const from = Math.round(start * RATE);
    const count = Math.round(length * RATE);
    for (let i = 0; i < count && from + i < samples.length; i += 1) {
      const t = i / RATE;
      const attack = Math.min(1, t / 0.008);
      const fade = Math.exp(-t * (5 / length));
      const tone = Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t);
      samples[from + i] += tone * attack * fade * gain;
    }
  }
  return samples;
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(value * 32_767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const SOUNDS = {
  // Marked a dish tried: a soft two-note pluck (E5, A5).
  tried: render([note(659.25, 0, 0.22, 0.28), note(880, 0.07, 0.3, 0.24)], 0.4),
  // An achievement tier or stamp: three rising notes (C5, E5, G5).
  milestone: render(
    [note(523.25, 0, 0.35, 0.24), note(659.25, 0.1, 0.35, 0.22), note(783.99, 0.2, 0.5, 0.22)],
    0.75,
  ),
  // A streak milestone: a warm chord that settles (A4, C#5, E5, A5).
  streak: render(
    [
      note(440, 0, 0.7, 0.16),
      note(554.37, 0.04, 0.7, 0.14),
      note(659.25, 0.08, 0.7, 0.14),
      note(880, 0.16, 0.6, 0.12),
    ],
    0.85,
  ),
};

for (const [name, samples] of Object.entries(SOUNDS)) {
  writeFileSync(join(OUT, `${name}.wav`), wav(samples));
}
