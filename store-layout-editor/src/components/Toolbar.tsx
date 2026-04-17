import type { ChangeEvent } from "react";
import type { EditorSettings, ToolMode } from "../types/layout";

interface ToolbarProps {
  activeTool: ToolMode;
  settings: EditorSettings;
  canUndo: boolean;
  canRedo: boolean;
  canCalibrate: boolean;
  calibrationReady: boolean;
  onToolChange: (tool: ToolMode) => void;
  onFileUpload: (file: File) => void;
  onApplyCalibration: () => void;
  onResetCalibration: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportJson: () => void;
  onExportSvg: () => void;
  onSettingsChange: (settings: EditorSettings) => void;
}

function ToolButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? "#1f2937" : "#ffffff",
        color: active ? "#ffffff" : "#111827",
        border: "1px solid #d1d5db",
        borderRadius: 8,
        padding: "8px 10px",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export function Toolbar({
  activeTool,
  settings,
  canUndo,
  canRedo,
  canCalibrate,
  calibrationReady,
  onToolChange,
  onFileUpload,
  onApplyCalibration,
  onResetCalibration,
  onUndo,
  onRedo,
  onExportJson,
  onExportSvg,
  onSettingsChange,
}: ToolbarProps) {
  const onUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
      event.currentTarget.value = "";
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        padding: 12,
        borderBottom: "1px solid #d1d5db",
        background: "#ffffff",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <label
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: "8px 10px",
            cursor: "pointer",
            background: "#f9fafb",
          }}
        >
          Upload directory image
          <input
            type="file"
            accept="image/*"
            onChange={onUpload}
            style={{ display: "none" }}
          />
        </label>
        <ToolButton label="Select" active={activeTool === "select"} onClick={() => onToolChange("select")} />
        <ToolButton label="Pan" active={activeTool === "pan"} onClick={() => onToolChange("pan")} />
        <ToolButton label="Polygon" active={activeTool === "polygon"} onClick={() => onToolChange("polygon")} />
        <ToolButton label="Rectangle" active={activeTool === "rectangle"} onClick={() => onToolChange("rectangle")} />
        <ToolButton label="Calibrate" active={activeTool === "calibration"} onClick={() => onToolChange("calibration")} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button type="button" disabled={!canUndo} onClick={onUndo}>
          Undo
        </button>
        <button type="button" disabled={!canRedo} onClick={onRedo}>
          Redo
        </button>
        <button type="button" disabled={!canCalibrate || !calibrationReady} onClick={onApplyCalibration}>
          Apply calibration
        </button>
        <button type="button" disabled={!canCalibrate} onClick={onResetCalibration}>
          Reset calibration
        </button>
        <button type="button" onClick={onExportJson}>
          Export JSON
        </button>
        <button type="button" onClick={onExportSvg}>
          Export SVG
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <label>
          <input
            type="checkbox"
            checked={settings.snapToGrid}
            onChange={(event) =>
              onSettingsChange({ ...settings, snapToGrid: event.target.checked })
            }
          />{" "}
          Snap to grid
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.snapAxis}
            onChange={(event) =>
              onSettingsChange({ ...settings, snapAxis: event.target.checked })
            }
          />{" "}
          Snap edges H/V
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.snapSharedEdges}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                snapSharedEdges: event.target.checked,
              })
            }
          />{" "}
          Shared-edge snapping
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.showGrid}
            onChange={(event) =>
              onSettingsChange({ ...settings, showGrid: event.target.checked })
            }
          />{" "}
          Show grid
        </label>
        <label>
          Grid size:{" "}
          <input
            type="number"
            min={4}
            max={200}
            value={settings.gridSize}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                gridSize: Math.max(4, Number(event.target.value) || 20),
              })
            }
            style={{ width: 72 }}
          />
        </label>
      </div>
    </div>
  );
}
