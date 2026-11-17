import type { FloorPlan, FloorPlanSourceV1 } from "@/lib/services/types";
import {
  MAXWELL_L1_BUILDING_OUTLINE,
  MAXWELL_L1_CANVAS,
  MAXWELL_L1_STALLS,
} from "@/lib/geo/maxwell_floorplan";

const MAXWELL_L1_SOURCE: FloorPlanSourceV1 = {
  schemaVersion: "floorplan-source.v1",
  buildingId: "hc-maxwell",
  floor: "L1",
  canvas: {
    width: MAXWELL_L1_CANVAS.width,
    height: MAXWELL_L1_CANVAS.height,
  },
  buildingOutline: {
    polygon: MAXWELL_L1_BUILDING_OUTLINE,
    label: "Maxwell Food Centre Envelope",
  },
  stalls: MAXWELL_L1_STALLS.map((stall) => ({
    id: stall.stallId,
    unitNumber: stall.unitNumber,
    polygon: stall.polygon,
    kind: stall.kind ?? "tenant",
    facilityType: stall.facilityType,
    label: stall.label,
    venueId: stall.venueId,
    statusDefault: stall.status,
  })),
  meta: {
    sourceType: "cv_extracted",
    sourceConfidence: 0.91,
    verified: false,
    updatedAt: "2026-04-29T00:00:00.000Z",
  },
};

export const floorPlanSourceRegistry: Record<string, FloorPlanSourceV1> = {
  "hc-maxwell:L1": MAXWELL_L1_SOURCE,
};

export function adaptFloorPlanSourceToFloorPlan(
  source: FloorPlanSourceV1,
  requestedBuildingId = source.buildingId,
): FloorPlan {
  return {
    buildingId: requestedBuildingId,
    floor: source.floor,
    canvasWidth: source.canvas.width,
    canvasHeight: source.canvas.height,
    stalls: source.stalls.map((stall) => ({
      stallId: stall.id,
      unitNumber: stall.unitNumber,
      polygon: stall.polygon,
      status: stall.statusDefault,
      venueId: stall.venueId,
      label: stall.label,
      kind: stall.kind,
      facilityType: stall.facilityType,
    })),
  };
}
