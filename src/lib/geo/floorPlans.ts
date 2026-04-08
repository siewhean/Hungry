/**
 * Hungry — Mock Floor Plan Data
 *
 * Programmatically generated floor plan layouts for key buildings.
 * In production, these would be loaded from Supabase Storage (SVG/GeoJSON).
 *
 * Coordinate system: SVG canvas space (unitless, typically 400×300).
 * Each stall polygon is defined by its 4 corners [x, y].
 */

import type { FloorPlan, StallPolygon } from "@/lib/services/types";

// ─── Helper: generate a simple rectangular stall grid ──────────────────────

function stallRect(
  x: number,
  y: number,
  w: number,
  h: number
): [number, number][] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

// ─── Maxwell Food Centre — L1 (simplified 10 stalls) ─────────────────────────

const maxwellL1Stalls: StallPolygon[] = [
  { stallId: "maxwell-01", unitNumber: "#01-10", polygon: stallRect(10, 10, 80, 60), status: "open", venueId: "venue-tian-tian", label: "Tian Tian Chicken Rice" },
  { stallId: "maxwell-02", unitNumber: "#01-37", polygon: stallRect(100, 10, 80, 60), status: "open", venueId: "venue-maxwell-laksa", label: "Old School Laksa" },
  { stallId: "maxwell-03", unitNumber: "#01-61", polygon: stallRect(190, 10, 80, 60), status: "open", venueId: "venue-maxwell-cheng-tng", label: "Ah Ma Cheng Tng" },
  { stallId: "maxwell-04", unitNumber: "#01-42", polygon: stallRect(280, 10, 80, 60), status: "closed", venueId: "venue-maxwell-rojak", label: "Classic Indian Rojak" },
  { stallId: "maxwell-05", unitNumber: "#01-55", polygon: stallRect(370, 10, 80, 60), status: "open", label: "Char Siew Rice" },
  { stallId: "maxwell-06", unitNumber: "#01-20", polygon: stallRect(10, 80, 80, 60), status: "open", label: "Mee Rebus" },
  { stallId: "maxwell-07", unitNumber: "#01-22", polygon: stallRect(100, 80, 80, 60), status: "non_food", label: "Drinks Stall" },
  { stallId: "maxwell-08", unitNumber: "#01-30", polygon: stallRect(190, 80, 80, 60), status: "open", label: "Carrot Cake" },
  { stallId: "maxwell-09", unitNumber: "#01-38", polygon: stallRect(280, 80, 80, 60), status: "open", label: "Prawn Mee" },
  { stallId: "maxwell-10", unitNumber: "#01-50", polygon: stallRect(370, 80, 80, 60), status: "closed", label: "Wanton Noodles" },
  { stallId: "maxwell-11", unitNumber: "#01-70", polygon: stallRect(10, 150, 80, 60), status: "open", label: "Roasted Pig Rice" },
  { stallId: "maxwell-12", unitNumber: "#01-75", polygon: stallRect(100, 150, 80, 60), status: "non_food", label: "Toilet" },
  { stallId: "maxwell-13", unitNumber: "#01-80", polygon: stallRect(190, 150, 80, 60), status: "open", label: "Fish Ball Noodles" },
  { stallId: "maxwell-14", unitNumber: "#01-90", polygon: stallRect(280, 150, 80, 60), status: "open", label: "Nasi Padang" },
  { stallId: "maxwell-15", unitNumber: "#01-95", polygon: stallRect(370, 150, 80, 60), status: "open", label: "Popiah & Kueh Pie Tee" },
];

// ─── Old Airport Road — L1 (larger grid) ─────────────────────────────────────

const oarL1Stalls: StallPolygon[] = [
  { stallId: "oar-01", unitNumber: "#01-12", polygon: stallRect(10, 10, 70, 55), status: "open", venueId: "venue-old-airport-char-kway-teow", label: "Lao Fu Zi CKT" },
  { stallId: "oar-02", unitNumber: "#01-19", polygon: stallRect(90, 10, 70, 55), status: "open", venueId: "venue-old-airport-lor-mee", label: "Nam Sing Lor Mee" },
  { stallId: "oar-03", unitNumber: "#01-28", polygon: stallRect(170, 10, 70, 55), status: "open", label: "Waton Egg Noodles" },
  { stallId: "oar-04", unitNumber: "#01-36", polygon: stallRect(250, 10, 70, 55), status: "closed", label: "Popiah" },
  { stallId: "oar-05", unitNumber: "#01-45", polygon: stallRect(330, 10, 70, 55), status: "open", label: "Nasi Lemak" },
  { stallId: "oar-06", unitNumber: "#01-58", polygon: stallRect(410, 10, 70, 55), status: "closed", venueId: "venue-old-airport-oyster-cake", label: "To-Ricos Oyster Cake" },
  { stallId: "oar-07", unitNumber: "#01-60", polygon: stallRect(10, 75, 70, 55), status: "open", label: "Rojak & Cendol" },
  { stallId: "oar-08", unitNumber: "#01-68", polygon: stallRect(90, 75, 70, 55), status: "open", label: "Fried Rice" },
  { stallId: "oar-09", unitNumber: "#01-75", polygon: stallRect(170, 75, 70, 55), status: "non_food", label: "Drinks" },
  { stallId: "oar-10", unitNumber: "#01-80", polygon: stallRect(250, 75, 70, 55), status: "open", label: "Hokkien Mee" },
  { stallId: "oar-11", unitNumber: "#01-88", polygon: stallRect(330, 75, 70, 55), status: "open", label: "Satay" },
  { stallId: "oar-12", unitNumber: "#01-92", polygon: stallRect(410, 75, 70, 55), status: "open", label: "Durian" },
];

// ─── Tiong Bahru Market — L2 ──────────────────────────────────────────────────

const tiongBahruL2Stalls: StallPolygon[] = [
  { stallId: "tb-01", unitNumber: "#02-05", polygon: stallRect(10, 10, 80, 60), status: "open", venueId: "venue-tiong-bahru-choon-kueh", label: "Jian Bo Shui Kueh" },
  { stallId: "tb-02", unitNumber: "#02-08", polygon: stallRect(100, 10, 80, 60), status: "open", label: "Char Kway Teow" },
  { stallId: "tb-03", unitNumber: "#02-15", polygon: stallRect(190, 10, 80, 60), status: "open", label: "Wanton Mee" },
  { stallId: "tb-04", unitNumber: "#02-22", polygon: stallRect(280, 10, 80, 60), status: "closed", label: "Ban Mian" },
  { stallId: "tb-05", unitNumber: "#02-28", polygon: stallRect(10, 80, 80, 60), status: "open", label: "Fish Soup" },
  { stallId: "tb-06", unitNumber: "#02-30", polygon: stallRect(100, 80, 80, 60), status: "open", venueId: "venue-tiong-bahru-chwee-kueh", label: "Tiong Bahru Chwee Kueh" },
  { stallId: "tb-07", unitNumber: "#02-38", polygon: stallRect(190, 80, 80, 60), status: "non_food", label: "Toilet" },
  { stallId: "tb-08", unitNumber: "#02-45", polygon: stallRect(280, 80, 80, 60), status: "open", label: "Prawn Mee" },
];

// ─── Lau Pa Sat — L1 ─────────────────────────────────────────────────────────

const lauPaSatL1Stalls: StallPolygon[] = [
  { stallId: "lps-01", unitNumber: "#01-22", polygon: stallRect(10, 10, 75, 60), status: "open", venueId: "venue-satay-street", label: "Satay Street Classics" },
  { stallId: "lps-02", unitNumber: "#01-30", polygon: stallRect(95, 10, 75, 60), status: "open", label: "Chicken Rice" },
  { stallId: "lps-03", unitNumber: "#01-41", polygon: stallRect(180, 10, 75, 60), status: "open", venueId: "venue-lau-pa-sat-bbq-stingray", label: "Harbour BBQ Stingray" },
  { stallId: "lps-04", unitNumber: "#01-50", polygon: stallRect(265, 10, 75, 60), status: "open", label: "Laksa" },
  { stallId: "lps-05", unitNumber: "#01-62", polygon: stallRect(350, 10, 75, 60), status: "non_food", label: "Drinks" },
  { stallId: "lps-06", unitNumber: "#01-70", polygon: stallRect(10, 80, 75, 60), status: "open", label: "Nasi Padang" },
  { stallId: "lps-07", unitNumber: "#01-78", polygon: stallRect(95, 80, 75, 60), status: "closed", label: "Carrot Cake" },
  { stallId: "lps-08", unitNumber: "#01-85", polygon: stallRect(180, 80, 75, 60), status: "open", label: "Oyster Omelette" },
];

const lauPaSatL2Stalls: StallPolygon[] = [
  { stallId: "lps-l2-01", unitNumber: "#02-05", polygon: stallRect(10, 10, 80, 60), status: "open", label: "Thai Food" },
  { stallId: "lps-l2-02", unitNumber: "#02-09", polygon: stallRect(100, 10, 80, 60), status: "closed", venueId: "venue-kopi-club", label: "Kopi Club" },
  { stallId: "lps-l2-03", unitNumber: "#02-15", polygon: stallRect(190, 10, 80, 60), status: "open", label: "Japanese Bento" },
  { stallId: "lps-l2-04", unitNumber: "#02-22", polygon: stallRect(280, 10, 80, 60), status: "non_food", label: "Office" },
];

// ─── Generic floor plan generator (for buildings without custom layouts) ──────

export function generateGenericFloorPlan(
  buildingId: string,
  floor: string,
  totalStalls: number,
  openStalls: number
): FloorPlan {
  const cols = 5;
  const stallW = 70;
  const stallH = 55;
  const gap = 10;
  const stalls: StallPolygon[] = [];

  for (let i = 0; i < totalStalls; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gap + col * (stallW + gap);
    const y = gap + row * (stallH + gap);

    let status: import("@/lib/services/types").StallStatus;
    if (i >= openStalls && i < openStalls + Math.floor(totalStalls * 0.05)) {
      status = "non_food";
    } else if (i >= openStalls) {
      status = "closed";
    } else {
      status = "open";
    }

    stalls.push({
      stallId: `${buildingId}-${floor}-${String(i + 1).padStart(2, "0")}`,
      unitNumber: `#${floor.replace("L", "0")}-${String((i + 1) * 3).padStart(2, "0")}`,
      polygon: stallRect(x, y, stallW, stallH),
      status,
      label: `Stall ${i + 1}`,
    });
  }

  const rows = Math.ceil(totalStalls / cols);
  return {
    buildingId,
    floor,
    canvasWidth: cols * (stallW + gap) + gap,
    canvasHeight: rows * (stallH + gap) + gap,
    stalls,
  };
}

// ─── Master Floor Plan Registry ───────────────────────────────────────────────

export const floorPlans: Record<string, FloorPlan> = {
  "hc-maxwell:L1": {
    buildingId: "hc-maxwell",
    floor: "L1",
    canvasWidth: 460,
    canvasHeight: 220,
    stalls: maxwellL1Stalls,
  },
  "hc-old-airport-road:L1": {
    buildingId: "hc-old-airport-road",
    floor: "L1",
    canvasWidth: 490,
    canvasHeight: 140,
    stalls: oarL1Stalls,
  },
  "hc-tiong-bahru:L2": {
    buildingId: "hc-tiong-bahru",
    floor: "L2",
    canvasWidth: 370,
    canvasHeight: 150,
    stalls: tiongBahruL2Stalls,
  },
  "hc-lau-pa-sat:L1": {
    buildingId: "hc-lau-pa-sat",
    floor: "L1",
    canvasWidth: 435,
    canvasHeight: 150,
    stalls: lauPaSatL1Stalls,
  },
  "hc-lau-pa-sat:L2": {
    buildingId: "hc-lau-pa-sat",
    floor: "L2",
    canvasWidth: 370,
    canvasHeight: 80,
    stalls: lauPaSatL2Stalls,
  },
};

/** Get a floor plan — falls back to generic layout if no custom one exists */
export function getFloorPlan(
  buildingId: string,
  floor: string,
  openStalls = 10,
  totalStalls = 12
): FloorPlan {
  const key = `${buildingId}:${floor}`;
  return floorPlans[key] ?? generateGenericFloorPlan(buildingId, floor, totalStalls, openStalls);
}
