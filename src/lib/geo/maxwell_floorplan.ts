import type { FloorPlan, StallPolygon } from "@/lib/services/types";

export interface MaxwellSkiaPolygon {
  id: string;
  stallId: string;
  buildingId: string;
  floor: string;
  path: string;
  type: "stall" | "non-food" | "unmapped" | "background" | "corridor";
}

export const MAXWELL_L1_CANVAS = {
  width: 980,
  height: 640,
} as const;

export const MAXWELL_L1_BUILDING_OUTLINE: [number, number][] = [
  [44, 44],
  [328, 44],
  [364, 108],
  [612, 108],
  [648, 44],
  [934, 44],
  [934, 264],
  [866, 300],
  [866, 352],
  [934, 388],
  [934, 596],
  [648, 596],
  [612, 532],
  [364, 532],
  [328, 596],
  [44, 596],
  [44, 388],
  [114, 352],
  [114, 300],
  [44, 264],
];

const MAXWELL_UNIT_TO_VENUE_ID: Record<string, string> = {
  "#01-10": "venue-tian-tian",
  "#01-12": "venue-pasta-express",
  "#02-21": "venue-maxwell-porridge",
};

function polyToPath(points: [number, number][]): string {
  if (points.length === 0) {
    return "";
  }
  const [first, ...rest] = points;
  const lines = rest.map(([x, y]) => `L ${x} ${y}`).join(" ");
  return `M ${first[0]} ${first[1]} ${lines} Z`;
}

function tenant(
  unitNumber: string,
  polygon: [number, number][],
  label: string,
  status: StallPolygon["status"] = "open",
): StallPolygon {
  return {
    stallId: `maxwell-${unitNumber.replace("#", "").toLowerCase()}`,
    unitNumber,
    polygon,
    status,
    venueId: MAXWELL_UNIT_TO_VENUE_ID[unitNumber],
    label,
    kind: "tenant",
  };
}

function corridor(id: string, polygon: [number, number][], label?: string): StallPolygon {
  return {
    stallId: id,
    unitNumber: "",
    polygon,
    status: "non_food",
    kind: "corridor",
    label,
  };
}

function facility(
  id: string,
  label: string,
  polygon: [number, number][],
  facilityType: StallPolygon["facilityType"],
): StallPolygon {
  return {
    stallId: id,
    unitNumber: "",
    polygon,
    status: "non_food",
    kind: "facility",
    facilityType,
    label,
  };
}

export const MAXWELL_L1_STALLS: StallPolygon[] = [
  corridor(
    "maxwell-corridor-main",
    [
      [132, 294],
      [844, 294],
      [858, 318],
      [844, 346],
      [132, 346],
      [118, 320],
    ],
    "Main Spine",
  ),
  corridor(
    "maxwell-corridor-top-link",
    [
      [312, 156],
      [668, 156],
      [688, 184],
      [668, 214],
      [312, 214],
      [292, 184],
    ],
    "North Link",
  ),
  corridor(
    "maxwell-corridor-bottom-link",
    [
      [312, 424],
      [668, 424],
      [688, 452],
      [668, 484],
      [312, 484],
      [292, 452],
    ],
    "South Link",
  ),

  tenant(
    "#01-04",
    [
      [74, 78],
      [164, 68],
      [168, 146],
      [82, 154],
    ],
    "Carrot Cake",
  ),
  tenant(
    "#01-06",
    [
      [172, 66],
      [254, 62],
      [260, 140],
      [176, 146],
    ],
    "Fish Ball Noodles",
  ),
  tenant(
    "#01-08",
    [
      [264, 64],
      [338, 76],
      [332, 150],
      [270, 142],
    ],
    "Nasi Lemak",
  ),
  tenant(
    "#01-10",
    [
      [346, 118],
      [428, 112],
      [432, 180],
      [350, 192],
    ],
    "Tian Tian Chicken Rice",
  ),
  tenant(
    "#01-12",
    [
      [440, 110],
      [526, 106],
      [530, 184],
      [448, 192],
    ],
    "Pasta Express",
  ),
  tenant(
    "#01-14",
    [
      [540, 108],
      [626, 114],
      [620, 194],
      [540, 188],
    ],
    "Braised Duck Rice",
  ),
  tenant(
    "#01-16",
    [
      [638, 118],
      [720, 108],
      [724, 184],
      [642, 196],
    ],
    "Ban Mian",
  ),
  tenant(
    "#01-18",
    [
      [730, 108],
      [822, 120],
      [816, 198],
      [736, 188],
    ],
    "Satay",
  ),
  tenant(
    "#01-20",
    [
      [828, 126],
      [900, 152],
      [898, 228],
      [828, 214],
    ],
    "Oyster Omelette",
  ),

  tenant(
    "#01-38",
    [
      [82, 210],
      [174, 206],
      [176, 276],
      [86, 282],
    ],
    "Laksa",
  ),
  tenant(
    "#01-40",
    [
      [184, 206],
      [272, 204],
      [272, 278],
      [186, 284],
    ],
    "Hokkien Mee",
  ),
  tenant(
    "#01-42",
    [
      [274, 210],
      [356, 218],
      [352, 290],
      [276, 286],
    ],
    "Rojak",
  ),
  tenant(
    "#01-44",
    [
      [642, 214],
      [724, 206],
      [726, 288],
      [648, 296],
    ],
    "Chicken Wings",
  ),
  tenant(
    "#01-46",
    [
      [730, 204],
      [820, 214],
      [818, 292],
      [734, 286],
    ],
    "Kway Chap",
  ),
  tenant(
    "#01-48",
    [
      [824, 214],
      [894, 246],
      [892, 320],
      [824, 304],
    ],
    "Mutton Soup",
  ),

  tenant(
    "#01-70",
    [
      [84, 358],
      [168, 354],
      [170, 438],
      [90, 444],
    ],
    "Prawn Mee",
  ),
  tenant(
    "#01-72",
    [
      [176, 352],
      [262, 350],
      [266, 434],
      [180, 438],
    ],
    "Kueh Pie Tee",
  ),
  tenant(
    "#01-74",
    [
      [270, 352],
      [348, 360],
      [344, 442],
      [274, 434],
    ],
    "Desserts",
  ),
  tenant(
    "#02-21",
    [
      [354, 448],
      [438, 436],
      [444, 510],
      [360, 524],
    ],
    "Night Owl Teochew Porridge",
  ),
  tenant(
    "#01-76",
    [
      [448, 434],
      [532, 428],
      [536, 506],
      [452, 514],
    ],
    "Economic Rice",
    "closed",
  ),
  tenant(
    "#01-78",
    [
      [540, 430],
      [622, 436],
      [618, 514],
      [542, 510],
    ],
    "Fish Soup",
  ),
  tenant(
    "#01-80",
    [
      [632, 436],
      [716, 426],
      [722, 506],
      [640, 520],
    ],
    "Claypot Rice",
  ),
  tenant(
    "#01-82",
    [
      [726, 424],
      [812, 434],
      [810, 516],
      [730, 510],
    ],
    "Satay Bee Hoon",
  ),
  tenant(
    "#01-84",
    [
      [818, 438],
      [900, 464],
      [898, 540],
      [824, 528],
    ],
    "Soup Kambing",
  ),

  facility(
    "maxwell-facility-washroom",
    "Washroom",
    [
      [74, 470],
      [166, 466],
      [164, 560],
      [78, 562],
    ],
    "washroom",
  ),
  facility(
    "maxwell-facility-lift",
    "Lift Lobby",
    [
      [258, 470],
      [322, 474],
      [320, 548],
      [256, 544],
    ],
    "lift",
  ),
  facility(
    "maxwell-facility-tray-return",
    "Tray Return",
    [
      [662, 470],
      [744, 464],
      [748, 552],
      [666, 560],
    ],
    "service",
  ),
  facility(
    "maxwell-facility-escalator",
    "Escalator",
    [
      [826, 468],
      [900, 488],
      [896, 568],
      [830, 556],
    ],
    "escalator",
  ),
];

export const MAXWELL_L1_FLOOR_PLAN: FloorPlan = {
  buildingId: "hc-maxwell",
  floor: "L1",
  canvasWidth: MAXWELL_L1_CANVAS.width,
  canvasHeight: MAXWELL_L1_CANVAS.height,
  stalls: MAXWELL_L1_STALLS,
};

function isTenantWithVenueId(stall: StallPolygon): boolean {
  return (stall.kind ?? "tenant") === "tenant" && Boolean(stall.venueId);
}

function skiaTypeForStall(stall: StallPolygon): MaxwellSkiaPolygon["type"] {
  const kind = stall.kind ?? "tenant";
  if (kind === "corridor") return "corridor";
  if (kind === "facility") return "non-food";
  return isTenantWithVenueId(stall) ? "stall" : "unmapped";
}

export function buildMaxwellSkiaPolygons(
  buildingId = "hc-maxwell",
  floor = "L1",
): MaxwellSkiaPolygon[] {
  const converted = MAXWELL_L1_STALLS.map((stall) => ({
    id: `poly-${stall.stallId}`,
    stallId: stall.venueId ?? "none",
    buildingId,
    floor,
    path: polyToPath(stall.polygon),
    type: skiaTypeForStall(stall),
  }));

  return [
    {
      id: "bg-maxwell-realistic",
      stallId: "none",
      buildingId,
      floor,
      path: polyToPath(MAXWELL_L1_BUILDING_OUTLINE),
      type: "background",
    },
    ...converted,
  ];
}
