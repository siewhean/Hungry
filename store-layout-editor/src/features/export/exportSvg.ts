import type { LabelPosition, LayoutImage, Point, StoreShape } from "../../types/layout";

function polygonPointString(points: Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function centroid(points: Point[]): Point {
  const sums = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );
  return {
    x: sums.x / points.length,
    y: sums.y / points.length,
  };
}

function labelAnchor(points: Point[], labelPosition: LabelPosition): Point {
  const center = centroid(points);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  switch (labelPosition) {
    case "top":
      return { x: center.x, y: minY + 14 };
    case "right":
      return { x: maxX - 12, y: center.y };
    case "bottom":
      return { x: center.x, y: maxY - 8 };
    case "left":
      return { x: minX + 12, y: center.y };
    case "centroid":
    default:
      return center;
  }
}

export function exportLayoutSvg(image: LayoutImage, shapes: StoreShape[]): string {
  const polygons = shapes
    .map((shape) => {
      const anchor = labelAnchor(shape.points, shape.labelPosition);
      const label = (shape.unitId || shape.id).replace(/&/g, "&amp;");

      return `
  <polygon points="${polygonPointString(shape.points)}" fill="${shape.fillColor}" fill-opacity="0.2" stroke="${shape.fillColor}" stroke-width="1.5" />
  <text x="${anchor.x}" y="${anchor.y}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#111827">${label}</text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${image.width}" height="${image.height}" viewBox="0 0 ${image.width} ${image.height}">
  <image href="${image.src}" x="0" y="0" width="${image.width}" height="${image.height}" preserveAspectRatio="none" />
${polygons}
</svg>`;
}
