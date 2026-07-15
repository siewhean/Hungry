import type { LayoutImage, StoreShape } from "../../types/layout";
import { validateShapes } from "../geometry/validation";

function polygonArea(shape: StoreShape): number {
  return Math.abs(
    shape.points.reduce((sum, point, index) => {
      const next = shape.points[(index + 1) % shape.points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
}

export function assertLayoutExportable(image: LayoutImage, shapes: StoreShape[]): void {
  if (
    !Number.isFinite(image.width) ||
    image.width <= 0 ||
    !Number.isFinite(image.height) ||
    image.height <= 0
  ) {
    throw new Error("The floor-plan image dimensions are invalid.");
  }

  const shapeIds = new Set<string>();
  const unitIds = new Set<string>();
  for (const shape of shapes) {
    if (!shape.id.trim() || shapeIds.has(shape.id)) {
      throw new Error("Every store polygon must have a unique ID.");
    }
    shapeIds.add(shape.id);

    const unitId = shape.unitId.trim().toLowerCase();
    if (!unitId || unitIds.has(unitId)) {
      throw new Error("Every store polygon must have a unique unit ID before export.");
    }
    unitIds.add(unitId);

    if (shape.points.length < 3) {
      throw new Error(`${shape.unitId} must contain at least three polygon points.`);
    }
    for (const point of shape.points) {
      if (
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < 0 ||
        point.y < 0 ||
        point.x > image.width ||
        point.y > image.height
      ) {
        throw new Error(`${shape.unitId} contains a point outside the floor-plan bounds.`);
      }
    }
    if (polygonArea(shape) <= 0.5) {
      throw new Error(`${shape.unitId} has no usable polygon area.`);
    }
  }

  const warnings = validateShapes(shapes);
  if (warnings.length > 0) {
    throw new Error(`Resolve geometry warnings before export: ${warnings[0].message}`);
  }
}
