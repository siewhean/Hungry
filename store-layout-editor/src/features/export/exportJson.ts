import type { LayoutDocument, LayoutImage, StoreShape } from "../../types/layout";

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
  return JSON.stringify(toLayoutDocument(image, shapes), null, 2);
}
