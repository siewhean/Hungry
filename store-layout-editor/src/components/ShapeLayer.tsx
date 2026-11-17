import type { PointerEvent as ReactPointerEvent } from "react";
import type { LabelPosition, Point, StoreShape } from "../types/layout";

function pointsToSvg(points: Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function centroid(points: Point[]): Point {
  const total = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );
  return {
    x: total.x / points.length,
    y: total.y / points.length,
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

interface ShapeLayerProps {
  shapes: StoreShape[];
  selectedShapeId?: string;
  draftPolygon: Point[];
  draftRectangle: Point[];
  calibrationPoints: Point[];
  toolMode: string;
  onShapeSelect: (shapeId: string) => void;
  onVertexPointerDown: (
    shapeId: string,
    vertexIndex: number,
    point: Point,
    event: ReactPointerEvent<SVGCircleElement>,
  ) => void;
}

export function ShapeLayer({
  shapes,
  selectedShapeId,
  draftPolygon,
  draftRectangle,
  calibrationPoints,
  toolMode,
  onShapeSelect,
  onVertexPointerDown,
}: ShapeLayerProps) {
  return (
    <g>
      {shapes.map((shape) => {
        const isSelected = shape.id === selectedShapeId;
        const anchor = labelAnchor(shape.points, shape.labelPosition);

        return (
          <g key={shape.id}>
            <polygon
              points={pointsToSvg(shape.points)}
              fill={shape.fillColor}
              fillOpacity={isSelected ? 0.3 : 0.18}
              stroke={shape.fillColor}
              strokeWidth={isSelected ? 2 : 1.2}
              onPointerDown={(event) => {
                event.stopPropagation();
                onShapeSelect(shape.id);
              }}
              style={{ cursor: "pointer" }}
            />
            <text
              x={anchor.x}
              y={anchor.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#111827"
              fontSize={11}
              pointerEvents="none"
            >
              {shape.unitId || shape.tenantName || shape.id}
            </text>
            {isSelected &&
              shape.points.map((point, index) => (
                <circle
                  key={`${shape.id}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={5}
                  fill="#ffffff"
                  stroke="#1f2937"
                  strokeWidth={1.5}
                  style={{ cursor: "grab" }}
                  onPointerDown={(event) =>
                    onVertexPointerDown(shape.id, index, point, event)
                  }
                />
              ))}
          </g>
        );
      })}

      {draftPolygon.length > 0 && (
        <polyline
          points={pointsToSvg(draftPolygon)}
          fill="none"
          stroke="#1d4ed8"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      )}

      {draftRectangle.length > 0 && (
        <polygon
          points={pointsToSvg(draftRectangle)}
          fill="#0ea5e9"
          fillOpacity={0.15}
          stroke="#0ea5e9"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      )}

      {toolMode === "calibration" &&
        calibrationPoints.map((point, index) => (
          <g key={`cal-${index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r={7}
              fill="#ffffff"
              stroke="#ef4444"
              strokeWidth={2}
              pointerEvents="none"
            />
            <text
              x={point.x}
              y={point.y - 10}
              textAnchor="middle"
              fill="#ef4444"
              fontSize={12}
              fontWeight={700}
              pointerEvents="none"
            >
              {index + 1}
            </text>
          </g>
        ))}
    </g>
  );
}
