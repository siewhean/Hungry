/** About 45 ms per letter, so a 46-letter question types in about two seconds. */
export const TYPE_MS_PER_LETTER = 45;
/** A long line types faster instead of taking longer than this. */
export const TYPE_MAX_TOTAL_MS = 2200;

/** Time between letters for a line of this length. */
export function typingIntervalMs(length: number): number {
  if (length <= 0) return 0;
  return Math.min(TYPE_MS_PER_LETTER, TYPE_MAX_TOTAL_MS / length);
}

/** How long the whole line takes to type in. */
export function typingDurationMs(text: string): number {
  return Math.round(typingIntervalMs(text.length) * text.length);
}

/** Spaces appear without a tick, so the haptics follow the letters. */
export function shouldTick(character: string): boolean {
  return character.trim().length > 0;
}

export type TypewriterOptions = {
  text: string;
  /** Reduce Motion, or a screen the person has seen before: show the whole line at once. */
  instant: boolean;
  /** Called with the part of the line shown so far. */
  onProgress: (visible: string, done: boolean) => void;
  /** Called once per visible letter. The haptic helper limits itself, so this may be called often. */
  onTick: () => void;
  setIntervalFn?: (callback: () => void, ms: number) => unknown;
  clearIntervalFn?: (handle: unknown) => void;
};

export type Typewriter = {
  /** Show the whole line now, with no further ticks (the person tapped the line). */
  finish: () => void;
  /** Stop without showing anything more (the screen went away). */
  cancel: () => void;
};

/** Types a line in letter by letter. Timers are injectable so the pacing can be tested. */
export function startTypewriter(options: TypewriterOptions): Typewriter {
  const { text, instant, onProgress, onTick } = options;
  const setTimer =
    options.setIntervalFn ?? ((callback: () => void, ms: number) => setInterval(callback, ms));
  const clearTimer =
    options.clearIntervalFn ??
    ((handle: unknown) => clearInterval(handle as ReturnType<typeof setInterval>));

  let handle: unknown = null;
  let shown = 0;
  let stopped = false;

  const stop = () => {
    stopped = true;
    if (handle !== null) clearTimer(handle);
    handle = null;
  };

  if (instant || text.length === 0) {
    stopped = true;
    onProgress(text, true);
    return { finish: () => undefined, cancel: () => undefined };
  }

  onProgress("", false);
  handle = setTimer(() => {
    if (stopped) return;
    shown += 1;
    const done = shown >= text.length;
    onProgress(text.slice(0, shown), done);
    if (shouldTick(text.charAt(shown - 1))) onTick();
    if (done) stop();
  }, typingIntervalMs(text.length));

  return {
    finish: () => {
      if (stopped) return;
      stop();
      onProgress(text, true);
    },
    cancel: stop,
  };
}
