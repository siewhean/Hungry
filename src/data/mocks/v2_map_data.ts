import { floorPlanSourceRegistry } from "@/lib/geo/floorPlanSources";
import { getFloorPlan } from "@/lib/geo/floorPlans";
import type { FloorPlan, StallPolygon } from "@/lib/services/types";

export interface MockStallPolygon {
  id: string;
  stallId: string;
  buildingId: string;
  floor: string;
  path: string;
  type: "stall" | "non-food" | "unmapped" | "background" | "corridor";
}

export const MOCK_MAP_VIEWBOX: Record<string, { width: number; height: number }> = {
  "hc-maxwell:L1": { width: 980, height: 640 },
  "building-maxwell:L1": { width: 980, height: 640 },
};

const BUILDING_ALIASES: Record<string, string[]> = {
  "building-maxwell": ["hc-maxwell"],
  "hc-maxwell": ["building-maxwell"],
};

function toPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first[0]} ${first[1]} ${rest.map(([x, y]) => `L ${x} ${y}`).join(" ")} Z`;
}

function toMockType(stall: StallPolygon): MockStallPolygon["type"] {
  const kind = stall.kind ?? "tenant";
  if (kind === "corridor") return "corridor";
  if (kind === "facility") return "non-food";
  if (kind === "tenant" && stall.venueId) return "stall";
  if (kind === "tenant") return "unmapped";
  return "unmapped";
}

function resolveSource(buildingId: string, floor: string) {
  const direct = floorPlanSourceRegistry[`${buildingId}:${floor}`];
  if (direct) return direct;
  for (const alias of BUILDING_ALIASES[buildingId] ?? []) {
    const byAlias = floorPlanSourceRegistry[`${alias}:${floor}`];
    if (byAlias) return byAlias;
  }
  return undefined;
}

function buildMockPolygonsForFloor(
  buildingId: string,
  floor: string,
  floorPlan: FloorPlan,
): MockStallPolygon[] {
  const source = resolveSource(buildingId, floor);
  const base: MockStallPolygon[] = floorPlan.stalls.map(
    (stall): MockStallPolygon => ({
      id: `poly-${stall.stallId}`,
      stallId: stall.venueId ?? "none",
      buildingId,
      floor,
      path: toPath(stall.polygon),
      type: toMockType(stall),
    }),
  );

  if (!source) {
    return base;
  }

  return [
    {
      id: `bg-${buildingId}-${floor}`,
      stallId: "none",
      buildingId,
      floor,
      path: toPath(source.buildingOutline.polygon),
      type: "background",
    },
    ...base,
  ];
}

const MAXWELL_L1_FLOOR = getFloorPlan("hc-maxwell", "L1");
export const MOCK_POLYGONS: MockStallPolygon[] = [
  ...buildMockPolygonsForFloor("hc-maxwell", "L1", MAXWELL_L1_FLOOR),
  ...buildMockPolygonsForFloor("building-maxwell", "L1", MAXWELL_L1_FLOOR),
];
