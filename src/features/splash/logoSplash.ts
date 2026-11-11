/**
 * The launch logo: where the official icon and wordmark sit, and how they move.
 *
 * Both are pure functions of time, so the animation is the same on every run and every device,
 * and it can be tested without a screen. The component drives `logoSplashFrame` from the UI
 * thread (every helper is a worklet) with a single linear clock.
 *
 * Lengths are in "logo units": pixels of the official full logo (assets/images/Logo/
 * hungry_current_logo_transparent_cropped.png, lockup box 820 x 746). The component multiplies
 * them by dp-per-unit, so the final frame matches the official logo at any screen size.
 */

/** Whole animation, including the final hold. */
export const LOGO_SPLASH_DURATION_MS = 2200;

/** Size of the official lockup (icon above wordmark), in logo units. */
export const LOGO_LOCKUP_UNITS = { width: 820, height: 746 } as const;

const ICON_ASSET_PX = 626;
const WORDMARK_ASSET_PX = { width: 2000, height: 627 } as const;
/** The wordmark is drawn at this fraction of its file size in the official lockup (fitted to the official logo pixel by pixel). */
const WORDMARK_SCALE = 0.4705;

/**
 * Image boxes (the transparent padding of each PNG included) placed so that the visible artwork
 * lands exactly where it sits in the official logo. Origin is the lockup's top-left corner.
 */
export const LOGO_IMAGE_UNITS = {
  icon: { left: 81, top: -80, size: ICON_ASSET_PX },
  wordmark: {
    left: -60,
    top: 475,
    width: WORDMARK_ASSET_PX.width * WORDMARK_SCALE,
    height: WORDMARK_ASSET_PX.height * WORDMARK_SCALE,
  },
} as const;

/** The icon starts at the middle of the screen, this far below its place in the lockup. */
const ICON_START_DROP_UNITS = 140;
/** The wordmark rises this far into place. */
const WORDMARK_RISE_UNITS = 85;
/** Height of the finishing hop of the whole lockup. */
const HOP_UNITS = 20;

/** Seconds at which each phase begins. */
const PHASE = { icon: 0, bounce: 0.5, wordmark: 0.9, finish: 1.5 } as const;

/** A spring is treated as finished (and snapped to its target) once its envelope falls below this. */
const SETTLE = 0.0015;

export type LogoSplashFrame = {
  iconOpacity: number;
  iconScaleX: number;
  iconScaleY: number;
  /** Positive moves down. Logo units. */
  iconTranslateY: number;
  wordmarkOpacity: number;
  wordmarkScale: number;
  wordmarkTranslateY: number;
  groupScale: number;
  groupTranslateY: number;
};

/** The resting arrangement: the official logo. */
export const LOGO_SPLASH_FINAL_FRAME: LogoSplashFrame = {
  iconOpacity: 1,
  iconScaleX: 1,
  iconScaleY: 1,
  iconTranslateY: 0,
  wordmarkOpacity: 1,
  wordmarkScale: 1,
  wordmarkTranslateY: 0,
  groupScale: 1,
  groupTranslateY: 0,
};

/** Spring settings for a peak (first overshoot) at `peakSeconds` with the given damping ratio. */
function springFor(zeta: number, peakSeconds: number) {
  const dampedOmega = Math.PI / peakSeconds;
  return { zeta, omega: dampedOmega / Math.sqrt(1 - zeta * zeta) };
}

const ICON_SCALE_SPRING = springFor(0.5517, 0.3); // overshoots 20% -> 100% by 12.5% of the way = 110%
const ICON_DROP_SPRING = springFor(0.45, 0.17);
const WORDMARK_SCALE_SPRING = springFor(0.45, 0.2);
const WORDMARK_RISE_SPRING = springFor(0.5, 0.2);
const HOP_SPRING = springFor(0.7, 0.3);

/** 0 at the start, 1 at the target, overshooting on the way: a spring released from rest. */
function springProgress(seconds: number, spring: { zeta: number; omega: number }): number {
  "worklet";
  if (seconds <= 0) return 0;
  const { zeta, omega } = spring;
  const decay = Math.exp(-zeta * omega * seconds);
  if (decay < SETTLE) return 1;
  const dampedOmega = omega * Math.sqrt(1 - zeta * zeta);
  return (
    1 -
    decay *
      (Math.cos(dampedOmega * seconds) +
        ((zeta * omega) / dampedOmega) * Math.sin(dampedOmega * seconds))
  );
}

/** A single bump that rises, falls back and rings out: 1 at its highest, 0 before and after. */
function hop(seconds: number): number {
  "worklet";
  if (seconds <= 0) return 0;
  const { zeta, omega } = HOP_SPRING;
  const decayRate = zeta * omega;
  const dampedOmega = omega * Math.sqrt(1 - zeta * zeta);
  const envelope = Math.exp(-decayRate * seconds);
  if (envelope < SETTLE) return 0;
  const peakAt = Math.atan(dampedOmega / decayRate) / dampedOmega;
  const peak = Math.exp(-decayRate * peakAt) * Math.sin(dampedOmega * peakAt);
  return (envelope * Math.sin(dampedOmega * seconds)) / peak;
}

function easeOutCubic(x: number): number {
  "worklet";
  const clamped = Math.min(Math.max(x, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

function iconScaleAt(seconds: number): number {
  "worklet";
  return 0.2 + 0.8 * springProgress(seconds - PHASE.icon, ICON_SCALE_SPRING);
}

function iconDropAt(seconds: number): number {
  "worklet";
  return ICON_START_DROP_UNITS * (1 - springProgress(seconds - PHASE.bounce, ICON_DROP_SPRING));
}

const VELOCITY_STEP = 0.001;

/** Squash and stretch: stretch along the way of travel while moving fast, squash as it reverses. */
function iconStretchAt(seconds: number): number {
  "worklet";
  const scaleVelocity =
    (iconScaleAt(seconds + VELOCITY_STEP) - iconScaleAt(seconds - VELOCITY_STEP)) /
    (2 * VELOCITY_STEP);
  const riseVelocity =
    -(iconDropAt(seconds + VELOCITY_STEP) - iconDropAt(seconds - VELOCITY_STEP)) /
    (2 * VELOCITY_STEP);
  const stretch = 0.07 * Math.tanh(scaleVelocity / 3) + 0.06 * Math.tanh(riseVelocity / 600);
  return Math.min(Math.max(stretch, -0.09), 0.09);
}

/** Everything on screen `timeMs` after the animation starts. */
export function logoSplashFrame(timeMs: number): LogoSplashFrame {
  "worklet";
  const seconds = Math.min(Math.max(timeMs, 0), LOGO_SPLASH_DURATION_MS) / 1000;
  const stretch = iconStretchAt(seconds);
  const wordmarkSeconds = seconds - PHASE.wordmark;
  const hopHeight = hop(seconds - PHASE.finish);

  return {
    iconOpacity: Math.min(seconds / 0.08, 1),
    iconScaleX: iconScaleAt(seconds) * (1 - stretch * 0.5),
    iconScaleY: iconScaleAt(seconds) * (1 + stretch),
    iconTranslateY: iconDropAt(seconds),
    wordmarkOpacity: easeOutCubic(wordmarkSeconds / 0.35),
    wordmarkScale: 0.85 + 0.15 * springProgress(wordmarkSeconds, WORDMARK_SCALE_SPRING),
    wordmarkTranslateY:
      WORDMARK_RISE_UNITS * (1 - springProgress(wordmarkSeconds, WORDMARK_RISE_SPRING)),
    groupScale: 1 + 0.025 * hopHeight,
    groupTranslateY: 0 - HOP_UNITS * hopHeight,
  };
}

export type LogoSplashLayout = {
  /** dp per logo unit. */
  unit: number;
  lockup: { width: number; height: number };
  icon: { left: number; top: number; size: number };
  wordmark: { left: number; top: number; width: number; height: number };
};

/** The official lockup at a width of `lockupWidth` dp, as image boxes inside a lockup-sized view. */
export function logoSplashLayout(lockupWidth: number): LogoSplashLayout {
  const unit = lockupWidth / LOGO_LOCKUP_UNITS.width;
  const { icon, wordmark } = LOGO_IMAGE_UNITS;
  return {
    unit,
    lockup: { width: lockupWidth, height: LOGO_LOCKUP_UNITS.height * unit },
    icon: { left: icon.left * unit, top: icon.top * unit, size: icon.size * unit },
    wordmark: {
      left: wordmark.left * unit,
      top: wordmark.top * unit,
      width: wordmark.width * unit,
      height: wordmark.height * unit,
    },
  };
}

/** Lockup width for a screen: about half the width, never taller than a third of the height. */
export function logoSplashLockupWidth(screenWidth: number, screenHeight: number): number {
  const byWidth = screenWidth * 0.56;
  const byHeight = (screenHeight / 3) * (LOGO_LOCKUP_UNITS.width / LOGO_LOCKUP_UNITS.height);
  return Math.round(Math.min(byWidth, byHeight, 320));
}
