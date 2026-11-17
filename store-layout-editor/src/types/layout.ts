export type ToolMode =
  | "select"
  | "pan"
  | "polygon"
  | "rectangle"
  | "calibration";

export type LabelPosition =
  | "centroid"
  | "top"
  | "right"
  | "bottom"
  | "left";

export interface Point {
  x: number;
  y: number;
}

export interface LayoutImage {
  name: string;
  src: string;
  width: number;
  height: number;
}

export interface StoreShape {
  id: string;
  unitId: string;
  tenantName: string;
  category: string;
  fillColor: string;
  labelPosition: LabelPosition;
  points: Point[];
}

export interface LayoutDocument {
  image: Pick<LayoutImage, "name" | "width" | "height">;
  stores: Array<{
    id: string;
    unitId: string;
    tenantName: string;
    category: string;
    fillColor: string;
    labelPosition: LabelPosition;
    polygon: Point[];
  }>;
}

export interface CalibrationState {
  points: Point[];
  isRectified: boolean;
}

export interface EditorSettings {
  gridSize: number;
  snapToGrid: boolean;
  snapAxis: boolean;
  snapSharedEdges: boolean;
  showGrid: boolean;
}

export interface GeometryWarning {
  id: string;
  shapeId: string;
  type: "overlap" | "self_intersection";
  message: string;
}

export interface ViewTransform {
  zoom: number;
  pan: Point;
}
