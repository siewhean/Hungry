/**
 * The food swap: a dish leaves along a semi-circle, turning and fading, while the next one arrives
 * from the other side the same way. The pose is a pure function of progress (0 to 1) so the curve can
 * be tested and sampled into an Animated interpolation.
 */
export type ArcRole = "leaving" | "entering";

export type ArcPose = {
  x: number;
  y: number;
  rotateDeg: number;
  opacity: number;
  scale: number;
};

/** How far a dish turns on its way off or on. */
export const ARC_TURN_DEG = 60;
/** The dish shrinks a little while it is away from the centre. */
export const ARC_MIN_SCALE = 0.85;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * `direction` is 1 when the slider moved up the scale and -1 when down: moving up sends the old dish
 * to the right and brings the new one in from the left, like turning a wheel. The resting dish sits at
 * the top of the arc (0, 0); `radius` is the width of the sweep.
 */
export function arcPose(
  role: ArcRole,
  progress: number,
  direction: 1 | -1,
  radius: number,
): ArcPose {
  const t = clamp01(progress);
  // Angle on the arc: 90 degrees is the resting top, 0 and 180 are the two ends.
  const away = role === "leaving" ? t : 1 - t;
  // The old dish heads off one side; the new one comes in from the other.
  const sweep = role === "leaving" ? -direction : direction;
  const angle = ((90 + sweep * 90 * away) * Math.PI) / 180;
  const turn =
    role === "leaving" ? direction * ARC_TURN_DEG * t : -direction * ARC_TURN_DEG * (1 - t);
  const opacity = role === "leaving" ? 1 - t : t;
  return {
    x: round(radius * Math.cos(angle)),
    y: round(radius - radius * Math.sin(angle)),
    rotateDeg: round(turn),
    opacity: round(opacity),
    scale: round(1 - (1 - ARC_MIN_SCALE) * away),
  };
}

function round(value: number): number {
  // Cosine of 90 degrees is 6e-17, not zero; keep animation inputs clean.
  return Math.round(value * 1000) / 1000 + 0;
}

export type ArcSamples = {
  inputRange: number[];
  translateX: number[];
  translateY: number[];
  rotate: string[];
  opacity: number[];
  scale: number[];
};

/** Eight steps along the arc are enough for the eye; Animated interpolates between them. */
export function arcSamples(
  role: ArcRole,
  direction: 1 | -1,
  radius: number,
  steps = 8,
): ArcSamples {
  const samples: ArcSamples = {
    inputRange: [],
    translateX: [],
    translateY: [],
    rotate: [],
    opacity: [],
    scale: [],
  };
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const pose = arcPose(role, progress, direction, radius);
    samples.inputRange.push(progress);
    samples.translateX.push(pose.x);
    samples.translateY.push(pose.y);
    samples.rotate.push(`${pose.rotateDeg}deg`);
    samples.opacity.push(pose.opacity);
    samples.scale.push(pose.scale);
  }
  return samples;
}

/** How long one swap takes. */
export const FOOD_SWAP_MS = 320;
