import {
  MAX_SLIDER_VALUE,
  MIN_SLIDER_VALUE,
  nearestStopIndex,
  clampSliderValue,
} from "./tasteSliderStops";

/** Where on the track (0 to width, minus the thumb's inset on both sides) a 0 to 10 value sits. */
export function xFromValue(value: number, trackWidth: number, inset: number): number {
  const usable = Math.max(0, trackWidth - inset * 2);
  return inset + (clampSliderValue(value) / MAX_SLIDER_VALUE) * usable;
}

/** The 0 to 10 value for a finger at x. The thumb follows the finger freely: nothing snaps here. */
export function valueFromX(x: number, trackWidth: number, inset: number): number {
  const usable = trackWidth - inset * 2;
  if (usable <= 0) return MIN_SLIDER_VALUE;
  return clampSliderValue(((x - inset) / usable) * MAX_SLIDER_VALUE);
}

/** True when moving from one value to the next crosses into a different stop (a tick is due). */
export function crossedStop(previous: number, next: number): boolean {
  return nearestStopIndex(previous) !== nearestStopIndex(next);
}

/** 1 when the thumb moved up the scale, -1 when down, 0 when the stop is unchanged. */
export function stopDirection(previousIndex: number, nextIndex: number): -1 | 0 | 1 {
  if (nextIndex === previousIndex) return 0;
  return nextIndex > previousIndex ? 1 : -1;
}
