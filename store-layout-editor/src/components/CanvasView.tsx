import {
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react";
import { ShapeLayer } from "./ShapeLayer";
import type {
  EditorSettings,
  LayoutImage,
  Point,
  StoreShape,
  ToolMode,
  ViewTransform,
} from "../types/layout";

interface CanvasViewProps {
  image: LayoutImage | null;
  shapes: StoreShape[];
  selectedShapeId?: string;
  draftPolygon: Point[];
  draftRectangle: Point[];
  calibrationPoints: Point[];
  toolMode: ToolMode;
  settings: EditorSettings;
  viewTransform: ViewTransform;
  onViewTransformChange: (next: ViewTransform) => void;
  onCanvasPointerDown: (point: Point, event: ReactPointerEvent<SVGSVGElement>) => void;
  onCanvasPointerMove: (point: Point, event: ReactPointerEvent<SVGSVGElement>) => void;
  onCanvasPointerUp: (point: Point, event: ReactPointerEvent<SVGSVGElement>) => void;
  onCanvasDoubleClick: (point: Point, event: ReactMouseEvent<SVGSVGElement>) => void;
  onShapeSelect: (shapeId: string) => void;
  onVertexPointerDown: (
    shapeId: string,
    vertexIndex: number,
    point: Point,
    event: ReactPointerEvent<SVGCircleElement>,
  ) => void;
}

interface PanState {
  pointerId: number;
  originX: number;
  originY: number;
  startPanX: number;
  startPanY: number;
}

function clampZoom(zoom: number): number {
  return Math.max(0.1, Math.min(15, zoom));
}

export function CanvasView({
  image,
  shapes,
  selectedShapeId,
  draftPolygon,
  draftRectangle,
  calibrationPoints,
  toolMode,
  settings,
  viewTransform,
  onViewTransformChange,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  onCanvasDoubleClick,
  onShapeSelect,
  onVertexPointerDown,
}: CanvasViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);

  const { zoom, pan } = viewTransform;
  const gridPatternId = useMemo(
    () => `grid-${Math.round(settings.gridSize * 100)}`,
    [settings.gridSize],
  );

  const getWorldPoint = (clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    if (!svg) {
      return { x: 0, y: 0 };
    }

    const rect = svg.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    return {
      x: (localX - pan.x) / zoom,
      y: (localY - pan.y) / zoom,
    };
  };

  const beginPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    setPanState({
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const rect = svg.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    const worldX = (pointerX - pan.x) / zoom;
    const worldY = (pointerY - pan.y) / zoom;

    const nextZoom = clampZoom(zoom * (event.deltaY > 0 ? 0.92 : 1.08));
    const nextPan = {
      x: pointerX - worldX * nextZoom,
      y: pointerY - worldY * nextZoom,
    };

    onViewTransformChange({ zoom: nextZoom, pan: nextPan });
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const world = getWorldPoint(event.clientX, event.clientY);
    const panMode = toolMode === "pan" || event.button === 1;

    if (panMode) {
      beginPan(event);
      return;
    }

    onCanvasPointerDown(world, event);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (panState && panState.pointerId === event.pointerId) {
      const nextPan = {
        x: panState.startPanX + (event.clientX - panState.originX),
        y: panState.startPanY + (event.clientY - panState.originY),
      };
      onViewTransformChange({ zoom, pan: nextPan });
      return;
    }

    const world = getWorldPoint(event.clientX, event.clientY);
    onCanvasPointerMove(world, event);
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (panState && panState.pointerId === event.pointerId) {
      setPanState(null);
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }

    const world = getWorldPoint(event.clientX, event.clientY);
    onCanvasPointerUp(world, event);
  };

  const imageWidth = image?.width ?? 1200;
  const imageHeight = image?.height ?? 800;

  return (
    <div
      onWheel={handleWheel}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: "#f8fafc",
      }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={(event) => {
          const world = getWorldPoint(event.clientX, event.clientY);
          onCanvasDoubleClick(world, event);
        }}
        style={{ touchAction: "none", display: "block" }}
      >
        <defs>
          <pattern
            id={gridPatternId}
            width={settings.gridSize}
            height={settings.gridSize}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${settings.gridSize} 0 L 0 0 0 ${settings.gridSize}`}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={0.6}
            />
          </pattern>
        </defs>

        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          <rect
            x={0}
            y={0}
            width={imageWidth}
            height={imageHeight}
            fill="#ffffff"
            stroke="#e5e7eb"
          />
          {image && (
            <image
              href={image.src}
              x={0}
              y={0}
              width={image.width}
              height={image.height}
              preserveAspectRatio="none"
            />
          )}
          {settings.showGrid && (
            <rect
              x={0}
              y={0}
              width={imageWidth}
              height={imageHeight}
              fill={`url(#${gridPatternId})`}
              opacity={0.9}
              pointerEvents="none"
            />
          )}

          <ShapeLayer
            shapes={shapes}
            selectedShapeId={selectedShapeId}
            draftPolygon={draftPolygon}
            draftRectangle={draftRectangle}
            calibrationPoints={calibrationPoints}
            toolMode={toolMode}
            onShapeSelect={onShapeSelect}
            onVertexPointerDown={onVertexPointerDown}
          />
        </g>
      </svg>
    </div>
  );
}
