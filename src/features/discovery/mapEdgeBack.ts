/** A pan move as React Native's PanResponder reports it (only the fields used here). */
export interface EdgeBackGesture {
  x0: number;
  y0: number;
  dx: number;
  dy: number;
}

/**
 * True when a move on the map screen is a left-edge swipe back: it started inside the edge zone,
 * above the bottom sheet (so a swipe on the card carousel scrolls it instead), and is mostly
 * horizontal and to the right.
 */
export function isMapEdgeBackSwipe(
  gesture: EdgeBackGesture,
  layout: { edgeZoneWidth: number; screenHeight: number; sheetHeight: number },
): boolean {
  return (
    gesture.x0 <= layout.edgeZoneWidth &&
    gesture.y0 < layout.screenHeight - layout.sheetHeight &&
    gesture.dx > 12 &&
    Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5
  );
}
