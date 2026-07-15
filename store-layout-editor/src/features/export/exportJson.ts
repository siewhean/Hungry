import type {
  LabelPosition,
  LayoutDocument,
  LayoutImage,
  Point,
  StoreShape,
} from "../../types/layout";
import { assertLayoutExportable } from "./exportValidation";

const labelPositions: ReadonlySet<LabelPosition> = new Set([
  "centroid",
  "top",
  "right",
  "bottom",
  "left",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parsePoint(value: unknown, path: string): Point {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
    throw new Error(`${path} must contain finite numeric x and y coordinates.`);
  }
  return { x: value.x, y: value.y };
}

function readString(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`${path}.${key} must be a string.`);
  }
  return value;
}

export function toLayoutDocument(
  image: LayoutImage,
  shapes: StoreShape[],
): LayoutDocument {
  return {
    image: {
      name: image.name,
      width: image.width,
      height: image.height,
    },
    stores: shapes.map((shape) => ({
      id: shape.id,
      unitId: shape.unitId,
      tenantName: shape.tenantName,
      category: shape.category,
      fillColor: shape.fillColor,
      labelPosition: shape.labelPosition,
      polygon: shape.points,
    })),
  };
}

export function exportLayoutJson(image: LayoutImage, shapes: StoreShape[]): string {
  assertLayoutExportable(image, shapes);
  return JSON.stringify(toLayoutDocument(image, shapes), null, 2);
}

/** Parses a persisted layout into a canonical, detached document. */
export function parseLayoutJson(source: string): LayoutDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new Error("Layout JSON is not valid JSON.");
  }

  if (!isRecord(parsed) || !isRecord(parsed.image) || !Array.isArray(parsed.stores)) {
    throw new Error("Layout JSON must contain image metadata and a stores array.");
  }

  const imageName = readString(parsed.image, "name", "image");
  const { width, height } = parsed.image;
  if (!isFiniteNumber(width) || width <= 0 || !isFiniteNumber(height) || height <= 0) {
    throw new Error("image.width and image.height must be positive finite numbers.");
  }

  const stores = parsed.stores.map((value, index) => {
    const path = `stores[${index}]`;
    if (!isRecord(value) || !Array.isArray(value.polygon) || value.polygon.length < 3) {
      throw new Error(`${path}.polygon must contain at least three points.`);
    }

    const labelPosition = value.labelPosition;
    if (typeof labelPosition !== "string" || !labelPositions.has(labelPosition as LabelPosition)) {
      throw new Error(`${path}.labelPosition is not supported.`);
    }

    return {
      id: readString(value, "id", path),
      unitId: readString(value, "unitId", path),
      tenantName: readString(value, "tenantName", path),
      category: readString(value, "category", path),
      fillColor: readString(value, "fillColor", path),
      labelPosition: labelPosition as LabelPosition,
      polygon: value.polygon.map((point, pointIndex) =>
        parsePoint(point, `${path}.polygon[${pointIndex}]`),
      ),
    };
  });

  return {
    image: { name: imageName, width, height },
    stores,
  };
}
