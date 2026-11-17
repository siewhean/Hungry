import type { GeometryWarning, LabelPosition, StoreShape } from "../types/layout";

const labelOptions: LabelPosition[] = [
  "centroid",
  "top",
  "right",
  "bottom",
  "left",
];

interface SidebarProps {
  shapes: StoreShape[];
  selectedShapeId?: string;
  warnings: GeometryWarning[];
  onSelectShape: (shapeId: string) => void;
  onDeleteShape: (shapeId: string) => void;
  onShapeMetadataChange: (
    shapeId: string,
    patch: Partial<
      Pick<
        StoreShape,
        "unitId" | "tenantName" | "category" | "fillColor" | "labelPosition"
      >
    >,
  ) => void;
}

export function Sidebar({
  shapes,
  selectedShapeId,
  warnings,
  onSelectShape,
  onDeleteShape,
  onShapeMetadataChange,
}: SidebarProps) {
  const selectedShape = shapes.find((shape) => shape.id === selectedShapeId);
  const selectedWarnings = warnings.filter(
    (warning) => warning.shapeId === selectedShapeId,
  );

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto auto 1fr", height: "100%" }}>
      <section style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>
        <h3 style={{ margin: "0 0 8px" }}>Stores ({shapes.length})</h3>
        <div style={{ display: "grid", gap: 6, maxHeight: 210, overflow: "auto" }}>
          {shapes.map((shape) => {
            const active = selectedShapeId === shape.id;
            return (
              <button
                key={shape.id}
                type="button"
                onClick={() => onSelectShape(shape.id)}
                style={{
                  textAlign: "left",
                  border: "1px solid #d1d5db",
                  background: active ? "#e5e7eb" : "#ffffff",
                  borderRadius: 8,
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600 }}>{shape.unitId || "Unassigned unit"}</div>
                <div style={{ color: "#6b7280", fontSize: 12 }}>
                  {shape.tenantName || "No tenant name"}
                </div>
              </button>
            );
          })}
          {shapes.length === 0 && (
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              Draw shapes to create store records.
            </div>
          )}
        </div>
      </section>

      <section style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>
        <h3 style={{ margin: "0 0 8px" }}>Metadata</h3>
        {!selectedShape && (
          <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>
            Select a shape to edit unit metadata.
          </p>
        )}
        {selectedShape && (
          <div style={{ display: "grid", gap: 8 }}>
            <label>
              Unit ID
              <input
                type="text"
                value={selectedShape.unitId}
                onChange={(event) =>
                  onShapeMetadataChange(selectedShape.id, {
                    unitId: event.target.value,
                  })
                }
                style={{ width: "100%" }}
              />
            </label>
            <label>
              Tenant Name
              <input
                type="text"
                value={selectedShape.tenantName}
                onChange={(event) =>
                  onShapeMetadataChange(selectedShape.id, {
                    tenantName: event.target.value,
                  })
                }
                style={{ width: "100%" }}
              />
            </label>
            <label>
              Category
              <input
                type="text"
                value={selectedShape.category}
                onChange={(event) =>
                  onShapeMetadataChange(selectedShape.id, {
                    category: event.target.value,
                  })
                }
                style={{ width: "100%" }}
              />
            </label>
            <label>
              Fill Color
              <input
                type="color"
                value={selectedShape.fillColor}
                onChange={(event) =>
                  onShapeMetadataChange(selectedShape.id, {
                    fillColor: event.target.value,
                  })
                }
                style={{ width: "100%", height: 34 }}
              />
            </label>
            <label>
              Label Position
              <select
                value={selectedShape.labelPosition}
                onChange={(event) =>
                  onShapeMetadataChange(selectedShape.id, {
                    labelPosition: event.target.value as LabelPosition,
                  })
                }
                style={{ width: "100%" }}
              >
                {labelOptions.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => onDeleteShape(selectedShape.id)}
              style={{
                marginTop: 4,
                border: "1px solid #ef4444",
                color: "#ef4444",
                background: "#fff",
                borderRadius: 8,
                padding: "8px 10px",
                cursor: "pointer",
              }}
            >
              Delete Shape
            </button>
            {selectedWarnings.length > 0 && (
              <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 12 }}>
                {selectedWarnings.map((warning) => (
                  <div key={warning.id}>- {warning.message}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section style={{ padding: 12 }}>
        <h3 style={{ margin: "0 0 8px" }}>Geometry Warnings</h3>
        {warnings.length === 0 ? (
          <p style={{ margin: 0, color: "#059669", fontSize: 13 }}>
            No overlaps or self-intersections detected.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {warnings.map((warning) => (
              <button
                key={warning.id}
                type="button"
                onClick={() => onSelectShape(warning.shapeId)}
                style={{
                  textAlign: "left",
                  border: "1px solid #fecaca",
                  background: "#fff1f2",
                  color: "#9f1239",
                  borderRadius: 8,
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
              >
                {warning.message}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
