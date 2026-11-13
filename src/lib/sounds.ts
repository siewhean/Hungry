// The only module that may import expo-audio (enforced by eslint): the three milestone sounds,
// each tied to one moment that already has a haptic, so a sound is never the only feedback.
// - Off with Settings > Sounds, and quiet when the phone is on silent.
// - Mixed under the diner's music or podcast, never pausing it.
// - Dropped when another sound played a moment ago, so a burst of unlocks stays one sound.
// - A no-op where the audio module is not in the build (release builds strip it until it ships).
import { useUIStore } from "@/store/useUIStore";

export type MilestoneSound = "tried" | "milestone" | "streak";

type AudioApi = {
  createAudioPlayer: (source: number) => { play: () => void; seekTo: (seconds: number) => unknown };
  setAudioModeAsync: (mode: {
    playsInSilentMode: boolean;
    interruptionMode: string;
  }) => Promise<void>;
};

let sourceOverride: ((sound: MilestoneSound) => number) | null = null;

/** Read only once audio is known to be there, so nothing loads the files otherwise. */
function sourceOf(sound: MilestoneSound): number {
  if (sourceOverride) return sourceOverride(sound);
  switch (sound) {
    case "tried":
      return require("../../assets/sounds/tried.wav");
    case "milestone":
      return require("../../assets/sounds/milestone.wav");
    case "streak":
      return require("../../assets/sounds/streak.wav");
  }
}

const MIN_GAP_MS = 1_500;
let lastSoundAt = 0;
let audio: AudioApi | null | undefined;
let modeSet = false;
const players = new Map<MilestoneSound, ReturnType<AudioApi["createAudioPlayer"]>>();

function loadAudio(): AudioApi | null {
  if (audio !== undefined) return audio;
  try {
    const { requireOptionalNativeModule } = require("expo-modules-core") as {
      requireOptionalNativeModule: (name: string) => unknown;
    };
    audio = requireOptionalNativeModule("ExpoAudio")
      ? // Loaded only when the native module is there, so a build without it never throws.
        (require("expo-audio") as AudioApi)
      : null;
  } catch {
    audio = null;
  }
  return audio;
}

/** True when this build can play sounds: Settings shows the Sounds switch only then. */
export function soundsAvailable(): boolean {
  return loadAudio() !== null;
}

export function resetSoundThrottle(): void {
  lastSoundAt = 0;
}

/** Plays one milestone sound, or nothing (switch off, no audio in the build, or too soon). */
export function playMilestoneSound(sound: MilestoneSound, now = Date.now()): boolean {
  if (!useUIStore.getState().soundsEnabled) return false;
  if (now - lastSoundAt < MIN_GAP_MS) return false;
  const api = loadAudio();
  if (!api) return false;
  lastSoundAt = now;
  try {
    if (!modeSet) {
      modeSet = true;
      void api
        .setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" })
        .catch(() => undefined);
    }
    let player = players.get(sound);
    if (!player) {
      player = api.createAudioPlayer(sourceOf(sound));
      players.set(sound, player);
    } else {
      void player.seekTo(0);
    }
    player.play();
    return true;
  } catch {
    // A sound is a nicety: a failure to play is never reported to the diner.
    return false;
  }
}

/** For tests: swap the audio module (and the sound files, which node cannot load). */
export function setAudioForTests(
  api: AudioApi | null,
  sources: ((sound: MilestoneSound) => number) | null = null,
): void {
  audio = api;
  sourceOverride = sources;
  modeSet = false;
  players.clear();
}
