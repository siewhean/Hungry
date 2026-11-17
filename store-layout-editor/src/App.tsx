import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { v4 as uuidv4 } from "uuid";

import { CanvasView } from "./components/CanvasView";
import { Toolbar } from "./components/Toolbar";
import { Sidebar } from "./components/Sidebar";
import { calibrationReady } from "./features/calibration/calibration";
import { rectifyPerspective } from "./features/calibration/perspective";
import { applySnapping } from "./features/drawing/snapping";
import { rectangleIsValid, rectangleToPolygon } from "./features/drawing/rectangleTool";
import { exportLayoutJson } from "./features/export/exportJson";
import { exportLayoutSvg } from "./features/export/exportSvg";
import { clampPointToBounds } from "./features/geometry/bounds";
import { validateShapes } from "./features/geometry/validation";
import type {
  CalibrationState,
  EditorSettings,
  LayoutImage,
  Point,
  StoreShape,
  ToolMode,
  ViewTransform,
} from "./types/layout";

interface ShapesHistory {
  past: StoreShape[][];
  present: StoreShape[];
  future: StoreShape[][];
}

interface VertexDragState {
  shapeId: string;
  vertexIndex: number;
}

const defaultSettings: EditorSettings = {
  gridSize: 20,
  snapToGrid: true,
  snapAxis: true,
  snapSharedEdges: true,
  showGrid: true,
};

function createShape(points: Point[]): StoreShape {
  return {
    id: uuidv4(),
    unitId: "",
    tenantName: "",
    category: "",
    fillColor: "#16a34a",
    labelPosition: "centroid",
    points,
  };
}

function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function useShapeHistory(initialShapes: StoreShape[]) {
  const [history, setHistory] = useState<ShapesHistory>({
    past: [],
    present: initialShapes,
    future: [],
  });

  const setShapes = (nextShapes: StoreShape[]) => {
    setHistory((previous) => ({
      past: [...previous.past, previous.present],
      present: nextShapes,
      future: [],
    }));
  };

  const replaceShapes = (nextShapes: StoreShape[]) => {
    setHistory({
      past: [],
      present: nextShapes,
      future: [],
    });
  };

  const undo = () => {
    setHistory((previous) => {
      if (previous.past.length === 0) {
        return previous;
      }

      const nextPast = previous.past.slice(0, -1);
      const previousPresent = previous.past[previous.past.length - 1];
      return {
        past: nextPast,
        present: previousPresent,
        future: [previous.present, ...previous.future],
      };
    });
  };

  const redo = () => {
    setHistory((previous) => {
      if (previous.future.length === 0) {
        return previous;
      }

      const [nextPresent, ...nextFuture] = previous.future;
      return {
        past: [...previous.past, previous.present],
        present: nextPresent,
        future: nextFuture,
      };
    });
  };

  return {
    shapes: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    setShapes,
    replaceShapes,
    undo,
    redo,
  };
}

export default function App() {
  const [sourceImage, setSourceImage] = useState<LayoutImage | null>(null);
  const [workingImage, setWorkingImage] = useState<LayoutImage | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [settings, setSettings] = useState<EditorSettings>(defaultSettings);
  const [selectedShapeId, setSelectedShapeId] = useState<string | undefined>(undefined);
  const [draftPolygon, setDraftPolygon] = useState<Point[]>([]);
  const [draftRectangle, setDraftRectangle] = useState<Point[]>([]);
  const [rectangleStart, setRectangleStart] = useState<Point | null>(null);
  const [vertexDrag, setVertexDrag] = useState<VertexDragState | null>(null);
  const [calibration, setCalibration] = useState<CalibrationState>({
    points: [],
    isRectified: false,
  });
  const [viewTransform, setViewTransform] = useState<ViewTransform>({
    zoom: 1,
    pan: { x: 20, y: 20 },
  });

  const {
    shapes,
    canUndo,
    canRedo,
    setShapes,
    replaceShapes,
    undo,
    redo,
  } = useShapeHistory([]);

  const warnings = useMemo(() => validateShapes(shapes), [shapes]);

  const imageBounds = useMemo(
    () => ({
      width: workingImage?.width ?? 1200,
      height: workingImage?.height ?? 800,
    }),
    [workingImage],
  );

  useEffect(() => {
    if (selectedShapeId && !shapes.some((shape) => shape.id === selectedShapeId)) {
      setSelectedShapeId(undefined);
    }
  }, [selectedShapeId, shapes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((meta && event.key.toLowerCase() === "y") || (meta && event.shiftKey && event.key.toLowerCase() === "z")) {
        event.preventDefault();
        redo();
      } else if (event.key === "Enter" && toolMode === "polygon" && draftPolygon.length >= 3) {
        event.preventDefault();
        setShapes([...shapes, createShape(draftPolygon)]);
        setDraftPolygon([]);
      } else if (event.key === "Escape") {
        setDraftPolygon([]);
        setDraftRectangle([]);
        setRectangleStart(null);
        setVertexDrag(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draftPolygon, redo, setShapes, shapes, toolMode, undo]);

  const snapPoint = (
    point: Point,
    options?: { previousPoint?: Point; activeShapeId?: string },
  ): Point => {
    const bounded = clampPointToBounds(point, imageBounds.width, imageBounds.height);
    return applySnapping(bounded, {
      settings,
      previousPoint: options?.previousPoint,
      allShapes: shapes,
      activeShapeId: options?.activeShapeId,
    });
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        return;
      }

      const image = new Image();
      image.onload = () => {
        const nextImage: LayoutImage = {
          name: file.name,
          src: result,
          width: image.naturalWidth,
          height: image.naturalHeight,
        };

        setSourceImage(nextImage);
        setWorkingImage(nextImage);
        setCalibration({ points: [], isRectified: false });
        setDraftPolygon([]);
        setDraftRectangle([]);
        setRectangleStart(null);
        setSelectedShapeId(undefined);
        replaceShapes([]);
        setViewTransform({ zoom: 1, pan: { x: 20, y: 20 } });
      };
      image.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasPointerDown = (point: Point) => {
    if (!workingImage) {
      return;
    }

    if (toolMode === "calibration") {
      if (calibration.points.length < 4) {
        setCalibration((current) => ({
          ...current,
          points: [...current.points, point],
        }));
      }
      return;
    }

    if (toolMode === "polygon") {
      const previousPoint = draftPolygon[draftPolygon.length - 1];
      const snapped = snapPoint(point, { previousPoint });
      setDraftPolygon((current) => [...current, snapped]);
      return;
    }

    if (toolMode === "rectangle") {
      const snapped = snapPoint(point);
      setRectangleStart(snapped);
      setDraftRectangle(rectangleToPolygon(snapped, snapped));
      return;
    }

    if (toolMode === "select") {
      setSelectedShapeId(undefined);
    }
  };

  const handleCanvasPointerMove = (point: Point) => {
    if (!workingImage) {
      return;
    }

    if (vertexDrag) {
      setShapes(
        shapes.map((shape) => {
          if (shape.id !== vertexDrag.shapeId) {
            return shape;
          }

          const previousPoint =
            shape.points[
              (vertexDrag.vertexIndex - 1 + shape.points.length) %
                shape.points.length
            ];
          const snapped = snapPoint(point, {
            previousPoint,
            activeShapeId: shape.id,
          });
          const points = [...shape.points];
          points[vertexDrag.vertexIndex] = snapped;
          return { ...shape, points };
        }),
      );
      return;
    }

    if (toolMode === "rectangle" && rectangleStart) {
      const snapped = snapPoint(point, { previousPoint: rectangleStart });
      setDraftRectangle(rectangleToPolygon(rectangleStart, snapped));
    }
  };

  const handleCanvasPointerUp = (point: Point) => {
    if (!workingImage) {
      return;
    }

    if (toolMode === "rectangle" && rectangleStart) {
      const snapped = snapPoint(point, { previousPoint: rectangleStart });
      if (rectangleIsValid(rectangleStart, snapped)) {
        setShapes([
          ...shapes,
          createShape(rectangleToPolygon(rectangleStart, snapped)),
        ]);
      }
      setRectangleStart(null);
      setDraftRectangle([]);
    }

    if (vertexDrag) {
      setVertexDrag(null);
    }
  };

  const handleCanvasDoubleClick = () => {
    if (toolMode !== "polygon") {
      return;
    }

    if (draftPolygon.length >= 3) {
      setShapes([...shapes, createShape(draftPolygon)]);
      setDraftPolygon([]);
    }
  };

  const handleVertexPointerDown = (
    shapeId: string,
    vertexIndex: number,
    _point: Point,
    event: ReactPointerEvent<SVGCircleElement>,
  ) => {
    event.stopPropagation();
    setSelectedShapeId(shapeId);
    setVertexDrag({ shapeId, vertexIndex });
  };

  const handleShapeMetadataChange = (
    shapeId: string,
    patch: Partial<
      Pick<
        StoreShape,
        "unitId" | "tenantName" | "category" | "fillColor" | "labelPosition"
      >
    >,
  ) => {
    setShapes(
      shapes.map((shape) =>
        shape.id === shapeId ? { ...shape, ...patch } : shape,
      ),
    );
  };

  const handleDeleteShape = (shapeId: string) => {
    setShapes(shapes.filter((shape) => shape.id !== shapeId));
    if (selectedShapeId === shapeId) {
      setSelectedShapeId(undefined);
    }
  };

  const applyCalibration = async () => {
    if (!workingImage || !calibrationReady(calibration.points)) {
      return;
    }

    const rectified = await rectifyPerspective(
      workingImage.src,
      calibration.points,
    );
    const nextImage: LayoutImage = {
      name: `${workingImage.name.replace(/\.[^/.]+$/, "")}-rectified.png`,
      src: rectified.src,
      width: rectified.width,
      height: rectified.height,
    };
    setWorkingImage(nextImage);
    setCalibration({ points: [], isRectified: true });
    replaceShapes([]);
    setSelectedShapeId(undefined);
    setDraftPolygon([]);
    setDraftRectangle([]);
  };

  const resetCalibration = () => {
    if (sourceImage) {
      setWorkingImage(sourceImage);
    }
    setCalibration({ points: [], isRectified: false });
    setDraftPolygon([]);
    setDraftRectangle([]);
  };

  const exportJson = () => {
    if (!workingImage) {
      return;
    }
    const json = exportLayoutJson(workingImage, shapes);
    const filename = `${workingImage.name.replace(/\.[^/.]+$/, "")}-layout.json`;
    downloadFile(filename, json, "application/json");
  };

  const exportSvg = () => {
    if (!workingImage) {
      return;
    }
    const svg = exportLayoutSvg(workingImage, shapes);
    const filename = `${workingImage.name.replace(/\.[^/.]+$/, "")}-layout.svg`;
    downloadFile(filename, svg, "image/svg+xml");
  };

  return (
    <div className="app-shell">
      <Toolbar
        activeTool={toolMode}
        settings={settings}
        canUndo={canUndo}
        canRedo={canRedo}
        canCalibrate={Boolean(workingImage)}
        calibrationReady={calibrationReady(calibration.points)}
        onToolChange={setToolMode}
        onFileUpload={handleFileUpload}
        onApplyCalibration={applyCalibration}
        onResetCalibration={resetCalibration}
        onUndo={undo}
        onRedo={redo}
        onExportJson={exportJson}
        onExportSvg={exportSvg}
        onSettingsChange={setSettings}
      />
      <div className="content-shell">
        <div className="canvas-shell">
          <CanvasView
            image={workingImage}
            shapes={shapes}
            selectedShapeId={selectedShapeId}
            draftPolygon={draftPolygon}
            draftRectangle={draftRectangle}
            calibrationPoints={calibration.points}
            toolMode={toolMode}
            settings={settings}
            viewTransform={viewTransform}
            onViewTransformChange={setViewTransform}
            onCanvasPointerDown={handleCanvasPointerDown}
            onCanvasPointerMove={handleCanvasPointerMove}
            onCanvasPointerUp={handleCanvasPointerUp}
            onCanvasDoubleClick={handleCanvasDoubleClick}
            onShapeSelect={setSelectedShapeId}
            onVertexPointerDown={handleVertexPointerDown}
          />
        </div>
        <aside className="panel-shell">
          <Sidebar
            shapes={shapes}
            selectedShapeId={selectedShapeId}
            warnings={warnings}
            onSelectShape={setSelectedShapeId}
            onDeleteShape={handleDeleteShape}
            onShapeMetadataChange={handleShapeMetadataChange}
          />
        </aside>
      </div>
    </div>
  );
}
