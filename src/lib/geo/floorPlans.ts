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

function stallRect(x: number, y: number, w: number, h: number): [number, number][] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

// ─── Maxwell Food Centre — L1 ─────────────────────────────────────────────────
// Real unit positions sourced from NEA hawker directory & food guides (2024).
// Layout: rectangular single-level hall — 3 rows of stalls with a central aisle.
// Canvas: 720×260. Each stall cell: 30w × 38h, gap 4px.
// Section A: #01-01 → #01-30  (north perimeter row, left→right)
// Central corridor (8px)
// Section B: #01-31 → #01-66  (central double row, facing aisle)
// Aisle (16px)
// Section C: #01-67 → #01-100 (south perimeter row, right→left)
// Known real anchor stalls are wired to venueIds.

const maxwellL1Stalls: StallPolygon[] = [
  // ── Section A — North row (#01-01 to #01-30) ──────────────────────────────
  {
    stallId: "mx-a01",
    unitNumber: "#01-01",
    polygon: stallRect(8, 8, 30, 38),
    status: "open",
    label: "Fried Carrot Cake",
  },
  {
    stallId: "mx-a02",
    unitNumber: "#01-02",
    polygon: stallRect(42, 8, 30, 38),
    status: "open",
    label: "Yong Tau Foo",
  },
  {
    stallId: "mx-a03",
    unitNumber: "#01-03",
    polygon: stallRect(76, 8, 30, 38),
    status: "open",
    label: "Char Kway Teow",
  },
  {
    stallId: "mx-a04",
    unitNumber: "#01-04",
    polygon: stallRect(110, 8, 30, 38),
    status: "open",
    label: "Wanton Noodles",
  },
  {
    stallId: "mx-a05",
    unitNumber: "#01-05",
    polygon: stallRect(144, 8, 30, 38),
    status: "open",
    label: "Mee Siam",
  },
  {
    stallId: "mx-a06",
    unitNumber: "#01-06",
    polygon: stallRect(178, 8, 30, 38),
    status: "open",
    label: "Prawn Mee",
  },
  {
    stallId: "mx-a07",
    unitNumber: "#01-07",
    polygon: stallRect(212, 8, 30, 38),
    status: "open",
    label: "Duck Rice",
  },
  {
    stallId: "mx-a08",
    unitNumber: "#01-08",
    polygon: stallRect(246, 8, 30, 38),
    status: "open",
    label: "Mee Rebus",
  },
  {
    stallId: "mx-a09",
    unitNumber: "#01-09",
    polygon: stallRect(280, 8, 30, 38),
    status: "open",
    label: "Alimama Chicken Rice",
    venueId: "venue-alimama",
  },
  {
    stallId: "mx-a10",
    unitNumber: "#01-10",
    polygon: stallRect(314, 8, 30, 38),
    status: "open",
    label: "Tian Tian Chicken Rice",
    venueId: "venue-tian-tian",
  },
  {
    stallId: "mx-a11",
    unitNumber: "#01-11",
    polygon: stallRect(348, 8, 30, 38),
    status: "open",
    label: "Nasi Lemak",
  },
  {
    stallId: "mx-a12",
    unitNumber: "#01-12",
    polygon: stallRect(382, 8, 30, 38),
    status: "open",
    label: "Bak Chor Mee",
  },
  {
    stallId: "mx-a13",
    unitNumber: "#01-13",
    polygon: stallRect(416, 8, 30, 38),
    status: "closed",
    label: "Closed",
  },
  {
    stallId: "mx-a14",
    unitNumber: "#01-14",
    polygon: stallRect(450, 8, 30, 38),
    status: "open",
    label: "Satay",
  },
  {
    stallId: "mx-a15",
    unitNumber: "#01-15",
    polygon: stallRect(484, 8, 30, 38),
    status: "open",
    label: "Popiah",
  },
  {
    stallId: "mx-a16",
    unitNumber: "#01-16",
    polygon: stallRect(518, 8, 30, 38),
    status: "open",
    label: "Hokkien Mee",
  },
  {
    stallId: "mx-a17",
    unitNumber: "#01-17",
    polygon: stallRect(552, 8, 30, 38),
    status: "non_food",
    label: "Drinks",
  },
  {
    stallId: "mx-a18",
    unitNumber: "#01-18",
    polygon: stallRect(586, 8, 30, 38),
    status: "open",
    label: "Chicken Wings",
  },
  {
    stallId: "mx-a19",
    unitNumber: "#01-19",
    polygon: stallRect(620, 8, 30, 38),
    status: "open",
    label: "Laksa",
  },
  {
    stallId: "mx-a20",
    unitNumber: "#01-20",
    polygon: stallRect(654, 8, 30, 38),
    status: "open",
    label: "Oyster Omelette",
  },
  {
    stallId: "mx-a21",
    unitNumber: "#01-21",
    polygon: stallRect(688, 8, 30, 38),
    status: "open",
    label: "Char Siew Rice",
  },

  // ── Section B — Central row facing north (#01-31 to #01-48) ───────────────
  {
    stallId: "mx-b01",
    unitNumber: "#01-31",
    polygon: stallRect(8, 58, 30, 34),
    status: "open",
    label: "Fish Ball Noodles",
  },
  {
    stallId: "mx-b02",
    unitNumber: "#01-32",
    polygon: stallRect(42, 58, 30, 34),
    status: "open",
    label: "Roasted Pig",
  },
  {
    stallId: "mx-b03",
    unitNumber: "#01-33",
    polygon: stallRect(76, 58, 30, 34),
    status: "open",
    label: "Nasi Padang",
  },
  {
    stallId: "mx-b04",
    unitNumber: "#01-34",
    polygon: stallRect(110, 58, 30, 34),
    status: "open",
    label: "Zi Char",
  },
  {
    stallId: "mx-b05",
    unitNumber: "#01-35",
    polygon: stallRect(144, 58, 30, 34),
    status: "open",
    label: "Bak Kut Teh",
  },
  {
    stallId: "mx-b06",
    unitNumber: "#01-36",
    polygon: stallRect(178, 58, 30, 34),
    status: "closed",
    label: "Closed",
  },
  {
    stallId: "mx-b07",
    unitNumber: "#01-37",
    polygon: stallRect(212, 58, 30, 34),
    status: "open",
    label: "Old School Laksa",
    venueId: "venue-maxwell-laksa",
  },
  {
    stallId: "mx-b08",
    unitNumber: "#01-38",
    polygon: stallRect(246, 58, 30, 34),
    status: "open",
    label: "Fried Tofu",
  },
  {
    stallId: "mx-b09",
    unitNumber: "#01-39",
    polygon: stallRect(280, 58, 30, 34),
    status: "open",
    label: "Economy Rice",
  },
  {
    stallId: "mx-b10",
    unitNumber: "#01-40",
    polygon: stallRect(314, 58, 30, 34),
    status: "open",
    label: "Braised Duck",
  },
  {
    stallId: "mx-b11",
    unitNumber: "#01-41",
    polygon: stallRect(348, 58, 30, 34),
    status: "open",
    label: "Soup Kambing",
  },
  {
    stallId: "mx-b12",
    unitNumber: "#01-42",
    polygon: stallRect(382, 58, 30, 34),
    status: "open",
    label: "Indian Rojak",
    venueId: "venue-maxwell-rojak",
  },
  {
    stallId: "mx-b13",
    unitNumber: "#01-43",
    polygon: stallRect(416, 58, 30, 34),
    status: "open",
    label: "Dim Sum",
  },
  {
    stallId: "mx-b14",
    unitNumber: "#01-44",
    polygon: stallRect(450, 58, 30, 34),
    status: "open",
    label: "Carrot Cake",
  },
  {
    stallId: "mx-b15",
    unitNumber: "#01-45",
    polygon: stallRect(484, 58, 30, 34),
    status: "open",
    label: "Ban Mian",
  },
  {
    stallId: "mx-b16",
    unitNumber: "#01-46",
    polygon: stallRect(518, 58, 30, 34),
    status: "open",
    label: "Roti Prata",
  },
  {
    stallId: "mx-b17",
    unitNumber: "#01-47",
    polygon: stallRect(552, 58, 30, 34),
    status: "open",
    label: "Teochew Porridge",
  },
  {
    stallId: "mx-b18",
    unitNumber: "#01-48",
    polygon: stallRect(586, 58, 30, 34),
    status: "open",
    label: "White Bee Hoon",
  },

  // ── Section B — Central row facing south (#01-49 to #01-66) ───────────────
  {
    stallId: "mx-c01",
    unitNumber: "#01-49",
    polygon: stallRect(8, 100, 30, 34),
    status: "open",
    label: "Fishhead Curry",
  },
  {
    stallId: "mx-c02",
    unitNumber: "#01-50",
    polygon: stallRect(42, 100, 30, 34),
    status: "open",
    label: "Mutton Soup",
  },
  {
    stallId: "mx-c03",
    unitNumber: "#01-51",
    polygon: stallRect(76, 100, 30, 34),
    status: "open",
    label: "Grilled Chicken Rice",
  },
  {
    stallId: "mx-c04",
    unitNumber: "#01-52",
    polygon: stallRect(110, 100, 30, 34),
    status: "closed",
    label: "Closed",
  },
  {
    stallId: "mx-c05",
    unitNumber: "#01-53",
    polygon: stallRect(144, 100, 30, 34),
    status: "open",
    label: "Mee Goreng",
  },
  {
    stallId: "mx-c06",
    unitNumber: "#01-54",
    polygon: stallRect(178, 100, 30, 34),
    status: "open",
    label: "Kueh Tutu",
  },
  {
    stallId: "mx-c07",
    unitNumber: "#01-55",
    polygon: stallRect(212, 100, 30, 34),
    status: "open",
    label: "Cheng Tng",
    venueId: "venue-maxwell-cheng-tng",
  },
  {
    stallId: "mx-c08",
    unitNumber: "#01-56",
    polygon: stallRect(246, 100, 30, 34),
    status: "open",
    label: "Rojak & Popiah",
    venueId: "venue-maxwell-rojak-popiah",
  },
  {
    stallId: "mx-c09",
    unitNumber: "#01-57",
    polygon: stallRect(280, 100, 30, 34),
    status: "open",
    label: "Penang Assam Laksa",
  },
  {
    stallId: "mx-c10",
    unitNumber: "#01-58",
    polygon: stallRect(314, 100, 30, 34),
    status: "open",
    label: "Wonton Soup",
  },
  {
    stallId: "mx-c11",
    unitNumber: "#01-59",
    polygon: stallRect(348, 100, 30, 34),
    status: "open",
    label: "Claypot Rice",
  },
  {
    stallId: "mx-c12",
    unitNumber: "#01-60",
    polygon: stallRect(382, 100, 30, 34),
    status: "open",
    label: "Hainanese Curry Rice",
  },
  {
    stallId: "mx-c13",
    unitNumber: "#01-61",
    polygon: stallRect(416, 100, 30, 34),
    status: "open",
    label: "Fish Congee",
  },
  {
    stallId: "mx-c14",
    unitNumber: "#01-62",
    polygon: stallRect(450, 100, 30, 34),
    status: "non_food",
    label: "Drinks",
  },
  {
    stallId: "mx-c15",
    unitNumber: "#01-63",
    polygon: stallRect(484, 100, 30, 34),
    status: "open",
    label: "Braised Pork Rice",
  },
  {
    stallId: "mx-c16",
    unitNumber: "#01-64",
    polygon: stallRect(518, 100, 30, 34),
    status: "open",
    label: "Tom Yum Noodles",
  },
  {
    stallId: "mx-c17",
    unitNumber: "#01-65",
    polygon: stallRect(552, 100, 30, 34),
    status: "closed",
    label: "Closed",
  },
  {
    stallId: "mx-c18",
    unitNumber: "#01-66",
    polygon: stallRect(586, 100, 30, 34),
    status: "open",
    label: "Iced Desserts",
  },

  // ── Section C — South perimeter row (#01-67 to #01-100) ───────────────────
  {
    stallId: "mx-d01",
    unitNumber: "#01-67",
    polygon: stallRect(8, 150, 30, 38),
    status: "open",
    label: "Waffles",
  },
  {
    stallId: "mx-d02",
    unitNumber: "#01-68",
    polygon: stallRect(42, 150, 30, 38),
    status: "open",
    label: "Goreng Pisang",
  },
  {
    stallId: "mx-d03",
    unitNumber: "#01-69",
    polygon: stallRect(76, 150, 30, 38),
    status: "open",
    label: "Chicken Cutlet",
  },
  {
    stallId: "mx-d04",
    unitNumber: "#01-70",
    polygon: stallRect(110, 150, 30, 38),
    status: "open",
    label: "Roasted Pig Rice",
  },
  {
    stallId: "mx-d05",
    unitNumber: "#01-71",
    polygon: stallRect(144, 150, 30, 38),
    status: "open",
    label: "Fu Shun La Mian",
  },
  {
    stallId: "mx-d06",
    unitNumber: "#01-72",
    polygon: stallRect(178, 150, 30, 38),
    status: "open",
    label: "Kueh Pie Tee",
  },
  {
    stallId: "mx-d07",
    unitNumber: "#01-73",
    polygon: stallRect(212, 150, 30, 38),
    status: "open",
    label: "Indian Mee Goreng",
  },
  {
    stallId: "mx-d08",
    unitNumber: "#01-74",
    polygon: stallRect(246, 150, 30, 38),
    status: "non_food",
    label: "Toilet",
  },
  {
    stallId: "mx-d09",
    unitNumber: "#01-75",
    polygon: stallRect(280, 150, 30, 38),
    status: "non_food",
    label: "Drinks",
  },
  {
    stallId: "mx-d10",
    unitNumber: "#01-76",
    polygon: stallRect(314, 150, 30, 38),
    status: "open",
    label: "Noodle Soup",
  },
  {
    stallId: "mx-d11",
    unitNumber: "#01-77",
    polygon: stallRect(348, 150, 30, 38),
    status: "open",
    label: "Jin Hua Fish Bee Hoon",
  },
  {
    stallId: "mx-d12",
    unitNumber: "#01-78",
    polygon: stallRect(382, 150, 30, 38),
    status: "open",
    label: "Fried Prawns",
  },
  {
    stallId: "mx-d13",
    unitNumber: "#01-79",
    polygon: stallRect(416, 150, 30, 38),
    status: "open",
    label: "Chilli Crab",
  },
  {
    stallId: "mx-d14",
    unitNumber: "#01-80",
    polygon: stallRect(450, 150, 30, 38),
    status: "open",
    label: "Seafood Soup",
  },
  {
    stallId: "mx-d15",
    unitNumber: "#01-81",
    polygon: stallRect(484, 150, 30, 38),
    status: "open",
    label: "Pig's Organ Soup",
  },
  {
    stallId: "mx-d16",
    unitNumber: "#01-82",
    polygon: stallRect(518, 150, 30, 38),
    status: "closed",
    label: "Closed",
  },
  {
    stallId: "mx-d17",
    unitNumber: "#01-83",
    polygon: stallRect(552, 150, 30, 38),
    status: "open",
    label: "Kway Chap",
  },
  {
    stallId: "mx-d18",
    unitNumber: "#01-84",
    polygon: stallRect(586, 150, 30, 38),
    status: "open",
    label: "Pork Rib Soup",
  },
  {
    stallId: "mx-d19",
    unitNumber: "#01-85",
    polygon: stallRect(620, 150, 30, 38),
    status: "open",
    label: "Sisaket Thai Food",
  },
  {
    stallId: "mx-d20",
    unitNumber: "#01-86",
    polygon: stallRect(654, 150, 30, 38),
    status: "open",
    label: "Chicken Chop",
  },
  {
    stallId: "mx-d21",
    unitNumber: "#01-87",
    polygon: stallRect(688, 150, 30, 38),
    status: "open",
    label: "Char Siew Wonton",
  },

  // ── Far south extension (#01-88 to #01-100) ────────────────────────────────
  {
    stallId: "mx-e01",
    unitNumber: "#01-88",
    polygon: stallRect(8, 196, 30, 38),
    status: "open",
    label: "Fried Oysters",
  },
  {
    stallId: "mx-e02",
    unitNumber: "#01-89",
    polygon: stallRect(42, 196, 30, 38),
    status: "open",
    label: "Roti John",
  },
  {
    stallId: "mx-e03",
    unitNumber: "#01-90",
    polygon: stallRect(76, 196, 30, 38),
    status: "non_food",
    label: "Drinks",
  },
  {
    stallId: "mx-e04",
    unitNumber: "#01-91",
    polygon: stallRect(110, 196, 30, 38),
    status: "open",
    label: "Kueh Lapis",
  },
  {
    stallId: "mx-e05",
    unitNumber: "#01-92",
    polygon: stallRect(144, 196, 30, 38),
    status: "open",
    label: "Ngoh Hiang",
  },
  {
    stallId: "mx-e06",
    unitNumber: "#01-93",
    polygon: stallRect(178, 196, 30, 38),
    status: "open",
    label: "Pig Trotter",
  },
  {
    stallId: "mx-e07",
    unitNumber: "#01-94",
    polygon: stallRect(212, 196, 30, 38),
    status: "open",
    label: "Ye Lai Xiang BBQ",
  },
  {
    stallId: "mx-e08",
    unitNumber: "#01-95",
    polygon: stallRect(246, 196, 30, 38),
    status: "open",
    label: "Satay Bee Hoon",
  },
  {
    stallId: "mx-e09",
    unitNumber: "#01-96",
    polygon: stallRect(280, 196, 30, 38),
    status: "closed",
    label: "Closed",
  },
  {
    stallId: "mx-e10",
    unitNumber: "#01-97",
    polygon: stallRect(314, 196, 30, 38),
    status: "open",
    label: "Chee Cheong Fun",
  },
  {
    stallId: "mx-e11",
    unitNumber: "#01-98",
    polygon: stallRect(348, 196, 30, 38),
    status: "open",
    label: "Durian Puffs",
  },
  {
    stallId: "mx-e12",
    unitNumber: "#01-99",
    polygon: stallRect(382, 196, 30, 38),
    status: "open",
    label: "Pineapple Tarts",
  },
  {
    stallId: "mx-e13",
    unitNumber: "#01-100",
    polygon: stallRect(416, 196, 30, 38),
    status: "open",
    label: "Mochi Ice Cream",
  },
];

const maxwellL2Stalls: StallPolygon[] = [
  {
    stallId: "maxwell-l2-01",
    unitNumber: "#02-14",
    polygon: stallRect(20, 20, 110, 70),
    status: "open",
    venueId: "venue-maxwell-peanut-pancake",
    label: "Heritage Peanut Pancake",
  },
  {
    stallId: "maxwell-l2-02",
    unitNumber: "#02-21",
    polygon: stallRect(150, 20, 110, 70),
    status: "open",
    venueId: "venue-maxwell-porridge",
    label: "Night Owl Teochew Porridge",
  },
  {
    stallId: "maxwell-l2-03",
    unitNumber: "#02-28",
    polygon: stallRect(280, 20, 110, 70),
    status: "non_food",
    label: "Drinks Counter",
  },
  {
    stallId: "maxwell-l2-04",
    unitNumber: "#02-34",
    polygon: stallRect(20, 110, 110, 70),
    status: "closed",
    label: "Pop-up Kiosk",
  },
  {
    stallId: "maxwell-l2-05",
    unitNumber: "#02-40",
    polygon: stallRect(150, 110, 110, 70),
    status: "open",
    label: "Dessert Prep",
  },
  {
    stallId: "maxwell-l2-06",
    unitNumber: "#02-48",
    polygon: stallRect(280, 110, 110, 70),
    status: "non_food",
    label: "Seating Deck",
  },
];

// ─── Old Airport Road — L1 (larger grid) ─────────────────────────────────────

const oarL1Stalls: StallPolygon[] = [
  {
    stallId: "oar-01",
    unitNumber: "#01-12",
    polygon: stallRect(10, 10, 70, 55),
    status: "open",
    venueId: "venue-old-airport-char-kway-teow",
    label: "Lao Fu Zi CKT",
  },
  {
    stallId: "oar-02",
    unitNumber: "#01-19",
    polygon: stallRect(90, 10, 70, 55),
    status: "open",
    venueId: "venue-old-airport-lor-mee",
    label: "Nam Sing Lor Mee",
  },
  {
    stallId: "oar-03",
    unitNumber: "#01-28",
    polygon: stallRect(170, 10, 70, 55),
    status: "open",
    label: "Waton Egg Noodles",
  },
  {
    stallId: "oar-04",
    unitNumber: "#01-36",
    polygon: stallRect(250, 10, 70, 55),
    status: "closed",
    label: "Popiah",
  },
  {
    stallId: "oar-05",
    unitNumber: "#01-45",
    polygon: stallRect(330, 10, 70, 55),
    status: "open",
    label: "Nasi Lemak",
  },
  {
    stallId: "oar-06",
    unitNumber: "#01-58",
    polygon: stallRect(410, 10, 70, 55),
    status: "closed",
    venueId: "venue-old-airport-oyster-cake",
    label: "To-Ricos Oyster Cake",
  },
  {
    stallId: "oar-07",
    unitNumber: "#01-60",
    polygon: stallRect(10, 75, 70, 55),
    status: "open",
    label: "Rojak & Cendol",
  },
  {
    stallId: "oar-08",
    unitNumber: "#01-68",
    polygon: stallRect(90, 75, 70, 55),
    status: "open",
    label: "Fried Rice",
  },
  {
    stallId: "oar-09",
    unitNumber: "#01-75",
    polygon: stallRect(170, 75, 70, 55),
    status: "non_food",
    label: "Drinks",
  },
  {
    stallId: "oar-10",
    unitNumber: "#01-80",
    polygon: stallRect(250, 75, 70, 55),
    status: "open",
    label: "Hokkien Mee",
  },
  {
    stallId: "oar-11",
    unitNumber: "#01-88",
    polygon: stallRect(330, 75, 70, 55),
    status: "open",
    label: "Satay",
  },
  {
    stallId: "oar-12",
    unitNumber: "#01-92",
    polygon: stallRect(410, 75, 70, 55),
    status: "open",
    label: "Durian",
  },
];

// ─── Tiong Bahru Market — L2 ──────────────────────────────────────────────────

const tiongBahruL2Stalls: StallPolygon[] = [
  {
    stallId: "tb-01",
    unitNumber: "#02-05",
    polygon: stallRect(10, 10, 80, 60),
    status: "open",
    venueId: "venue-tiong-bahru-choon-kueh",
    label: "Jian Bo Shui Kueh",
  },
  {
    stallId: "tb-02",
    unitNumber: "#02-08",
    polygon: stallRect(100, 10, 80, 60),
    status: "open",
    label: "Char Kway Teow",
  },
  {
    stallId: "tb-03",
    unitNumber: "#02-15",
    polygon: stallRect(190, 10, 80, 60),
    status: "open",
    label: "Wanton Mee",
  },
  {
    stallId: "tb-04",
    unitNumber: "#02-22",
    polygon: stallRect(280, 10, 80, 60),
    status: "closed",
    label: "Ban Mian",
  },
  {
    stallId: "tb-05",
    unitNumber: "#02-28",
    polygon: stallRect(10, 80, 80, 60),
    status: "open",
    label: "Fish Soup",
  },
  {
    stallId: "tb-06",
    unitNumber: "#02-30",
    polygon: stallRect(100, 80, 80, 60),
    status: "open",
    venueId: "venue-tiong-bahru-chwee-kueh",
    label: "Tiong Bahru Chwee Kueh",
  },
  {
    stallId: "tb-07",
    unitNumber: "#02-38",
    polygon: stallRect(190, 80, 80, 60),
    status: "non_food",
    label: "Toilet",
  },
  {
    stallId: "tb-08",
    unitNumber: "#02-45",
    polygon: stallRect(280, 80, 80, 60),
    status: "open",
    label: "Prawn Mee",
  },
];

// ─── Lau Pa Sat — L1 ─────────────────────────────────────────────────────────

const lauPaSatL1Stalls: StallPolygon[] = [
  {
    stallId: "lps-01",
    unitNumber: "#01-22",
    polygon: stallRect(10, 10, 75, 60),
    status: "open",
    venueId: "venue-satay-street",
    label: "Satay Street Classics",
  },
  {
    stallId: "lps-02",
    unitNumber: "#01-30",
    polygon: stallRect(95, 10, 75, 60),
    status: "open",
    label: "Chicken Rice",
  },
  {
    stallId: "lps-03",
    unitNumber: "#01-41",
    polygon: stallRect(180, 10, 75, 60),
    status: "open",
    venueId: "venue-lau-pa-sat-bbq-stingray",
    label: "Harbour BBQ Stingray",
  },
  {
    stallId: "lps-04",
    unitNumber: "#01-50",
    polygon: stallRect(265, 10, 75, 60),
    status: "open",
    label: "Laksa",
  },
  {
    stallId: "lps-05",
    unitNumber: "#01-62",
    polygon: stallRect(350, 10, 75, 60),
    status: "non_food",
    label: "Drinks",
  },
  {
    stallId: "lps-06",
    unitNumber: "#01-70",
    polygon: stallRect(10, 80, 75, 60),
    status: "open",
    label: "Nasi Padang",
  },
  {
    stallId: "lps-07",
    unitNumber: "#01-78",
    polygon: stallRect(95, 80, 75, 60),
    status: "closed",
    label: "Carrot Cake",
  },
  {
    stallId: "lps-08",
    unitNumber: "#01-85",
    polygon: stallRect(180, 80, 75, 60),
    status: "open",
    label: "Oyster Omelette",
  },
];

const lauPaSatL2Stalls: StallPolygon[] = [
  {
    stallId: "lps-l2-01",
    unitNumber: "#02-05",
    polygon: stallRect(10, 10, 80, 60),
    status: "open",
    label: "Thai Food",
  },
  {
    stallId: "lps-l2-02",
    unitNumber: "#02-09",
    polygon: stallRect(100, 10, 80, 60),
    status: "closed",
    venueId: "venue-kopi-club",
    label: "Kopi Club",
  },
  {
    stallId: "lps-l2-03",
    unitNumber: "#02-15",
    polygon: stallRect(190, 10, 80, 60),
    status: "open",
    label: "Japanese Bento",
  },
  {
    stallId: "lps-l2-04",
    unitNumber: "#02-22",
    polygon: stallRect(280, 10, 80, 60),
    status: "non_food",
    label: "Office",
  },
];

// ─── Food Republic @ Wisma Atria — B1 + L4 (directory-style mall layout) ────

const wismaB1Stalls: StallPolygon[] = [
  {
    stallId: "wisma-b1-01",
    unitNumber: "#B1-01",
    polygon: [
      [30, 28],
      [154, 26],
      [148, 108],
      [30, 114],
    ],
    status: "open",
    label: "iTea",
  },
  {
    stallId: "wisma-b1-02",
    unitNumber: "#B1-03",
    polygon: [
      [170, 24],
      [290, 24],
      [296, 112],
      [174, 114],
    ],
    status: "open",
    label: "Century Bakkwa",
  },
  {
    stallId: "wisma-b1-03",
    unitNumber: "#B1-06",
    polygon: [
      [310, 34],
      [438, 30],
      [432, 114],
      [312, 122],
    ],
    status: "open",
    label: "LeTAO",
  },
  {
    stallId: "wisma-b1-04",
    unitNumber: "#B1-08",
    polygon: [
      [452, 28],
      [586, 24],
      [580, 112],
      [454, 114],
    ],
    status: "open",
    label: "Sugarfina",
  },
  {
    stallId: "wisma-b1-05",
    unitNumber: "#B1-11",
    polygon: [
      [602, 34],
      [724, 32],
      [724, 122],
      [610, 124],
    ],
    status: "open",
    label: "Tiong Bahru Bakery",
  },
  {
    stallId: "wisma-b1-06",
    unitNumber: "#B1-14",
    polygon: [
      [30, 142],
      [146, 142],
      [146, 242],
      [30, 238],
    ],
    status: "open",
    label: "Don Signature Crab",
  },
  {
    stallId: "wisma-b1-07",
    unitNumber: "#B1-18",
    polygon: [
      [32, 254],
      [144, 250],
      [148, 350],
      [30, 354],
    ],
    status: "open",
    label: "Quick Grab N Go",
  },
  {
    stallId: "wisma-b1-08",
    unitNumber: "#B1-22",
    polygon: [
      [606, 142],
      [724, 142],
      [724, 236],
      [604, 234],
    ],
    status: "open",
    label: "Snack Boulevard",
  },
  {
    stallId: "wisma-b1-09",
    unitNumber: "#B1-25",
    polygon: [
      [598, 248],
      [724, 248],
      [724, 350],
      [602, 354],
    ],
    status: "non_food",
    label: "Atrium Seating",
  },
  {
    stallId: "wisma-b1-10",
    unitNumber: "#B1-31",
    polygon: [
      [154, 374],
      [286, 366],
      [282, 486],
      [152, 494],
    ],
    status: "open",
    label: "Dessert Studio",
  },
  {
    stallId: "wisma-b1-11",
    unitNumber: "#B1-34",
    polygon: [
      [306, 368],
      [436, 366],
      [438, 494],
      [308, 498],
    ],
    status: "closed",
    label: "Weekend Pop-up",
  },
  {
    stallId: "wisma-b1-12",
    unitNumber: "#B1-38",
    polygon: [
      [454, 370],
      [588, 370],
      [590, 496],
      [456, 500],
    ],
    status: "open",
    label: "Coffee Counter",
  },
];

const wismaL4Stalls: StallPolygon[] = [
  {
    stallId: "wisma-l4-01",
    unitNumber: "#04-06",
    polygon: [
      [24, 24],
      [150, 24],
      [142, 110],
      [24, 118],
    ],
    status: "open",
    label: "Roast Delight",
  },
  {
    stallId: "wisma-l4-02",
    unitNumber: "#04-09",
    polygon: [
      [164, 24],
      [280, 24],
      [288, 116],
      [172, 112],
    ],
    status: "open",
    label: "Ramen Yard",
  },
  {
    stallId: "wisma-l4-03",
    unitNumber: "#04-12",
    polygon: [
      [300, 34],
      [420, 30],
      [420, 116],
      [306, 122],
    ],
    status: "open",
    label: "Nasi Padang",
  },
  {
    stallId: "wisma-l4-04",
    unitNumber: "#04-15",
    polygon: [
      [438, 28],
      [560, 24],
      [548, 114],
      [438, 110],
    ],
    status: "open",
    label: "Seoul Bibimbap",
  },
  {
    stallId: "wisma-l4-05",
    unitNumber: "#04-19",
    polygon: [
      [578, 24],
      [720, 24],
      [720, 120],
      [588, 112],
    ],
    status: "open",
    label: "Wok Republic",
  },
  {
    stallId: "wisma-l4-06",
    unitNumber: "#04-03",
    polygon: [
      [24, 136],
      [132, 136],
      [128, 236],
      [24, 230],
    ],
    status: "open",
    label: "Noodle Junction",
  },
  {
    stallId: "wisma-l4-07",
    unitNumber: "#04-01",
    polygon: [
      [24, 248],
      [128, 244],
      [132, 344],
      [24, 348],
    ],
    status: "non_food",
    label: "Tray Return",
  },
  {
    stallId: "wisma-l4-08",
    unitNumber: "#04-05",
    polygon: [
      [24, 364],
      [136, 360],
      [140, 468],
      [24, 480],
    ],
    status: "open",
    label: "Kopi & Toast",
  },
  {
    stallId: "wisma-l4-09",
    unitNumber: "#04-30",
    polygon: [
      [624, 134],
      [724, 140],
      [724, 236],
      [614, 228],
    ],
    status: "open",
    label: "Sweet Pantry",
  },
  {
    stallId: "wisma-l4-10",
    unitNumber: "#04-33",
    polygon: [
      [616, 250],
      [724, 246],
      [724, 340],
      [616, 348],
    ],
    status: "closed",
    label: "Seafood Grill",
  },
  {
    stallId: "wisma-l4-11",
    unitNumber: "#04-36",
    polygon: [
      [604, 360],
      [724, 360],
      [724, 480],
      [604, 470],
    ],
    status: "non_food",
    label: "Open Seating",
  },
  {
    stallId: "wisma-l4-12",
    unitNumber: "#04-40",
    polygon: [
      [160, 386],
      [284, 382],
      [278, 490],
      [158, 494],
    ],
    status: "open",
    label: "Fish Soup",
  },
  {
    stallId: "wisma-l4-13",
    unitNumber: "#04-43",
    polygon: [
      [304, 394],
      [428, 386],
      [430, 492],
      [312, 500],
    ],
    status: "open",
    label: "Bento Street",
  },
  {
    stallId: "wisma-l4-14",
    unitNumber: "#04-47",
    polygon: [
      [446, 386],
      [582, 390],
      [586, 500],
      [448, 498],
    ],
    status: "open",
    label: "Halal Kitchen",
  },
  {
    stallId: "wisma-l4-15",
    unitNumber: "#04-18",
    polygon: [
      [238, 174],
      [330, 178],
      [324, 252],
      [234, 248],
    ],
    status: "open",
    venueId: "venue-food-republic-sambal",
    label: "Sambal Seafood Wok",
  },
  {
    stallId: "wisma-l4-16",
    unitNumber: "#04-23",
    polygon: [
      [436, 168],
      [526, 170],
      [520, 248],
      [430, 246],
    ],
    status: "open",
    venueId: "venue-food-republic-claypot",
    label: "Claypot & Co",
  },
  {
    stallId: "wisma-l4-17",
    unitNumber: "#04-20",
    polygon: [
      [250, 274],
      [336, 274],
      [336, 340],
      [248, 346],
    ],
    status: "open",
    label: "Handmade Dumplings",
  },
  {
    stallId: "wisma-l4-18",
    unitNumber: "#04-25",
    polygon: [
      [430, 274],
      [520, 270],
      [522, 344],
      [432, 350],
    ],
    status: "non_food",
    label: "Shared Seating",
  },
];

// ─── Koufu @ JEM — L2 + L3 (official-layout aligned directory pilot) ────────

const JEM_L2_MAP_URL =
  "https://www.jem.sg/contentassets/0eb3b61ffa634a79bc050caadf844a10/ag-map_l2-no-floor_v2-updated-sep-2025.png";
const JEM_L3_MAP_URL =
  "https://www.jem.sg/contentassets/cab1a943dffb4a01bc4e05713444d4cd/ag-map_l3-no-floor.png";

function jemTenant({
  stallId,
  unitNumber,
  polygon,
  status,
  label,
  venueId,
}: {
  stallId: string;
  unitNumber: string;
  polygon: [number, number][];
  status: StallPolygon["status"];
  label: string;
  venueId?: string;
}): StallPolygon {
  return {
    stallId,
    unitNumber,
    polygon,
    status,
    label,
    venueId,
    kind: "tenant",
  };
}

function jemTenantRect({
  stallId,
  unitNumber,
  x,
  y,
  w,
  h,
  status,
  label,
  venueId,
}: {
  stallId: string;
  unitNumber: string;
  x: number;
  y: number;
  w: number;
  h: number;
  status?: StallPolygon["status"];
  label: string;
  venueId?: string;
}): StallPolygon {
  return jemTenant({
    stallId,
    unitNumber,
    polygon: stallRect(x, y, w, h),
    status: status ?? "open",
    label,
    venueId,
  });
}

function jemCorridor(
  stallId: string,
  polygon: [number, number][],
  label = "Corridor",
): StallPolygon {
  return {
    stallId,
    unitNumber: "",
    polygon,
    status: "non_food",
    label,
    kind: "corridor",
  };
}

function jemFacility({
  stallId,
  unitNumber,
  polygon,
  label,
  facilityType,
}: {
  stallId: string;
  unitNumber: string;
  polygon: [number, number][];
  label: string;
  facilityType: NonNullable<StallPolygon["facilityType"]>;
}): StallPolygon {
  return {
    stallId,
    unitNumber,
    polygon,
    status: "non_food",
    label,
    kind: "facility",
    facilityType,
  };
}

const jemL2Stalls: StallPolygon[] = [
  jemTenant({
    stallId: "jem-l2-2-55",
    unitNumber: "#02-55",
    polygon: [
      [396, 34],
      [504, 80],
      [516, 136],
      [422, 136],
      [394, 72],
    ],
    status: "open",
    label: "Retail unit #02-55",
  }),
  jemTenant({
    stallId: "jem-l2-hm",
    unitNumber: "#02-01/02/03",
    polygon: [
      [242, 198],
      [350, 198],
      [350, 248],
      [387, 248],
      [387, 320],
      [340, 380],
      [182, 380],
      [126, 349],
      [170, 258],
      [242, 258],
    ],
    status: "open",
    label: "H&M",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-04",
    unitNumber: "#02-04",
    x: 488,
    y: 246,
    w: 60,
    h: 62,
    label: "Retail unit #02-04",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-05",
    unitNumber: "#02-05",
    x: 550,
    y: 246,
    w: 54,
    h: 62,
    label: "Retail unit #02-05",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-06",
    unitNumber: "#02-06",
    x: 606,
    y: 246,
    w: 54,
    h: 62,
    label: "Retail unit #02-06",
  }),
  jemTenant({
    stallId: "jem-l2-2-07",
    unitNumber: "#02-07",
    polygon: [
      [680, 214],
      [906, 322],
      [876, 388],
      [680, 388],
    ],
    status: "open",
    label: "Food unit #02-07",
  }),
  jemTenant({
    stallId: "jem-l2-2-08-10",
    unitNumber: "#02-08/09/10",
    polygon: [
      [868, 390],
      [950, 426],
      [922, 575],
      [802, 575],
      [802, 450],
      [848, 450],
    ],
    status: "open",
    label: "Retail unit #02-08/09/10",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-11",
    unitNumber: "#02-11",
    x: 802,
    y: 575,
    w: 128,
    h: 86,
    label: "Retail unit #02-11",
  }),
  jemTenant({
    stallId: "jem-l2-ikea",
    unitNumber: "#02-12/13/14",
    polygon: [
      [928, 448],
      [1138, 448],
      [1138, 706],
      [1110, 720],
      [928, 720],
      [928, 661],
      [802, 661],
      [802, 450],
    ],
    status: "open",
    label: "IKEA Jurong",
  }),
  jemTenantRect({
    stallId: "jem-l2-uob",
    unitNumber: "#02-15",
    x: 760,
    y: 629,
    w: 176,
    h: 91,
    label: "UOB",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-16",
    unitNumber: "#02-16",
    x: 726,
    y: 629,
    w: 32,
    h: 91,
    label: "Retail unit #02-16",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-17",
    unitNumber: "#02-17",
    x: 687,
    y: 629,
    w: 37,
    h: 91,
    label: "Retail unit #02-17",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-18",
    unitNumber: "#02-18",
    x: 648,
    y: 629,
    w: 37,
    h: 91,
    label: "Retail unit #02-18",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-19",
    unitNumber: "#02-19",
    x: 596,
    y: 629,
    w: 50,
    h: 91,
    label: "Food unit #02-19",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-20-21",
    unitNumber: "#02-20/21",
    x: 503,
    y: 629,
    w: 91,
    h: 91,
    label: "Food unit #02-20/21",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-22",
    unitNumber: "#02-22",
    x: 434,
    y: 629,
    w: 67,
    h: 91,
    label: "Retail unit #02-22",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-23",
    unitNumber: "#02-23",
    x: 363,
    y: 629,
    w: 68,
    h: 91,
    label: "Retail unit #02-23",
  }),
  jemTenant({
    stallId: "jem-l2-uniqlo",
    unitNumber: "#02-27/28/29/30/31",
    polygon: [
      [168, 392],
      [350, 392],
      [350, 578],
      [38, 578],
    ],
    status: "open",
    label: "UNIQLO",
  }),
  jemTenant({
    stallId: "jem-l2-dondondonki",
    unitNumber: "#02-24/25/26",
    polygon: [
      [38, 578],
      [350, 578],
      [350, 691],
      [20, 720],
      [12, 708],
    ],
    status: "open",
    label: "DON DON DONKI",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-32a",
    unitNumber: "#02-32A",
    x: 363,
    y: 384,
    w: 33,
    h: 50,
    label: "Retail unit #02-32A",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-33",
    unitNumber: "#02-33",
    x: 398,
    y: 384,
    w: 35,
    h: 50,
    label: "Retail unit #02-33",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-32",
    unitNumber: "#02-32",
    x: 363,
    y: 437,
    w: 68,
    h: 35,
    label: "Retail unit #02-32",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-54",
    unitNumber: "#02-54",
    x: 363,
    y: 474,
    w: 68,
    h: 30,
    label: "Retail unit #02-54",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-52-53",
    unitNumber: "#02-52/53",
    x: 363,
    y: 506,
    w: 68,
    h: 66,
    label: "Retail unit #02-52/53",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-34-51",
    unitNumber: "#02-34/51",
    x: 433,
    y: 384,
    w: 49,
    h: 188,
    label: "Retail unit #02-34/51",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-35",
    unitNumber: "#02-35",
    x: 484,
    y: 384,
    w: 64,
    h: 130,
    label: "Retail unit #02-35",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-36",
    unitNumber: "#02-36",
    x: 550,
    y: 384,
    w: 47,
    h: 130,
    label: "Retail unit #02-36",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-37",
    unitNumber: "#02-37",
    x: 599,
    y: 384,
    w: 50,
    h: 130,
    label: "Retail unit #02-37",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-38-47",
    unitNumber: "#02-38/39/46/47",
    x: 650,
    y: 384,
    w: 110,
    h: 130,
    label: "Retail unit #02-38/39/46/47",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-40",
    unitNumber: "#02-40",
    x: 760,
    y: 384,
    w: 47,
    h: 50,
    label: "Retail unit #02-40",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-41",
    unitNumber: "#02-41",
    x: 807,
    y: 384,
    w: 43,
    h: 50,
    label: "Retail unit #02-41",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-42",
    unitNumber: "#02-42",
    x: 760,
    y: 436,
    w: 90,
    h: 34,
    label: "Retail unit #02-42",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-43",
    unitNumber: "#02-43",
    x: 760,
    y: 472,
    w: 90,
    h: 33,
    label: "Retail unit #02-43",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-44",
    unitNumber: "#02-44",
    x: 760,
    y: 507,
    w: 90,
    h: 33,
    label: "Retail unit #02-44",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-45",
    unitNumber: "#02-45",
    x: 729,
    y: 514,
    w: 29,
    h: 58,
    label: "Retail unit #02-45",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-48",
    unitNumber: "#02-48",
    x: 649,
    y: 514,
    w: 79,
    h: 58,
    label: "Retail unit #02-48",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-49",
    unitNumber: "#02-49",
    x: 597,
    y: 514,
    w: 51,
    h: 58,
    label: "Retail unit #02-49",
  }),
  jemTenantRect({
    stallId: "jem-l2-2-50",
    unitNumber: "#02-50",
    x: 549,
    y: 514,
    w: 47,
    h: 58,
    label: "Retail unit #02-50",
  }),
  jemCorridor(
    "jem-l2-corr-top",
    [
      [98, 330],
      [836, 330],
      [836, 390],
      [98, 390],
    ],
    "Main concourse",
  ),
  jemCorridor(
    "jem-l2-corr-mid",
    [
      [356, 574],
      [836, 574],
      [836, 620],
      [356, 620],
    ],
    "Lower concourse",
  ),
  jemCorridor(
    "jem-l2-corr-right",
    [
      [760, 330],
      [800, 330],
      [800, 620],
      [760, 620],
    ],
    "Connector",
  ),
  jemFacility({
    stallId: "jem-l2-lift-1",
    unitNumber: "L2-LF1",
    polygon: [
      [648, 332],
      [690, 332],
      [690, 370],
      [648, 370],
    ],
    label: "Lift",
    facilityType: "lift",
  }),
  jemFacility({
    stallId: "jem-l2-escalator-1",
    unitNumber: "L2-ES1",
    polygon: [
      [560, 330],
      [602, 330],
      [602, 370],
      [560, 370],
    ],
    label: "Escalator",
    facilityType: "escalator",
  }),
  jemFacility({
    stallId: "jem-l2-washroom-1",
    unitNumber: "L2-WC1",
    polygon: [
      [902, 352],
      [940, 352],
      [940, 390],
      [902, 390],
    ],
    label: "Washroom",
    facilityType: "washroom",
  }),
  jemFacility({
    stallId: "jem-l2-lift-2",
    unitNumber: "L2-LF2",
    polygon: [
      [688, 576],
      [730, 576],
      [730, 614],
      [688, 614],
    ],
    label: "Lift",
    facilityType: "lift",
  }),
  jemFacility({
    stallId: "jem-l2-escalator-2",
    unitNumber: "L2-ES2",
    polygon: [
      [574, 576],
      [620, 576],
      [620, 614],
      [574, 614],
    ],
    label: "Escalator",
    facilityType: "escalator",
  }),
  jemFacility({
    stallId: "jem-l2-service-1",
    unitNumber: "L2-SVC1",
    polygon: [
      [272, 640],
      [330, 640],
      [330, 690],
      [272, 690],
    ],
    label: "Service",
    facilityType: "service",
  }),
  jemFacility({
    stallId: "jem-l2-washroom-2",
    unitNumber: "L2-WC2",
    polygon: [
      [315, 640],
      [366, 640],
      [366, 690],
      [315, 690],
    ],
    label: "Washroom",
    facilityType: "washroom",
  }),
];

const jemL3Stalls: StallPolygon[] = [
  jemTenant({
    stallId: "jem-l3-hm",
    unitNumber: "#03-01/02",
    polygon: [
      [242, 198],
      [350, 198],
      [350, 248],
      [386, 248],
      [386, 320],
      [334, 378],
      [182, 378],
      [129, 349],
      [170, 258],
      [242, 258],
    ],
    status: "open",
    label: "H&M",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-03",
    unitNumber: "#03-03",
    x: 446,
    y: 248,
    w: 52,
    h: 56,
    label: "Food unit #03-03",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-04",
    unitNumber: "#03-04",
    x: 500,
    y: 248,
    w: 53,
    h: 56,
    label: "Food unit #03-04",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-05-06",
    unitNumber: "#03-05/06",
    x: 594,
    y: 248,
    w: 54,
    h: 56,
    label: "Food unit #03-05/06",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-07",
    unitNumber: "#03-07",
    x: 650,
    y: 248,
    w: 57,
    h: 56,
    label: "Food unit #03-07",
  }),
  jemTenant({
    stallId: "jem-l3-3-08",
    unitNumber: "#03-08",
    polygon: [
      [680, 132],
      [784, 187],
      [784, 304],
      [680, 304],
    ],
    status: "open",
    label: "Food unit #03-08",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-09",
    unitNumber: "#03-09",
    x: 752,
    y: 248,
    w: 68,
    h: 56,
    label: "Food unit #03-09",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-10",
    unitNumber: "#03-10",
    x: 821,
    y: 272,
    w: 30,
    h: 32,
    label: "Food unit #03-10",
  }),
  jemTenant({
    stallId: "jem-l3-3-11-12",
    unitNumber: "#03-11/12",
    polygon: [
      [850, 304],
      [956, 378],
      [910, 458],
      [804, 458],
      [804, 320],
    ],
    status: "open",
    label: "Japanese Curry House",
    venueId: "venue-koufu-japanese-curry",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-13",
    unitNumber: "#03-13",
    x: 804,
    y: 458,
    w: 74,
    h: 73,
    label: "Retail unit #03-13",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-14",
    unitNumber: "#03-14",
    x: 804,
    y: 531,
    w: 74,
    h: 71,
    label: "Retail unit #03-14",
  }),
  jemTenant({
    stallId: "jem-l3-ikea",
    unitNumber: "#03-15/16/17",
    polygon: [
      [878, 458],
      [1136, 458],
      [1136, 705],
      [907, 705],
      [907, 602],
      [878, 602],
    ],
    status: "open",
    label: "IKEA Jurong",
    venueId: "venue-koufu-yong-tau-foo",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-18",
    unitNumber: "#03-18",
    x: 813,
    y: 628,
    w: 92,
    h: 90,
    label: "Food unit #03-18",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-19",
    unitNumber: "#03-19",
    x: 743,
    y: 628,
    w: 68,
    h: 90,
    label: "Retail unit #03-19",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-20",
    unitNumber: "#03-20",
    x: 684,
    y: 628,
    w: 57,
    h: 90,
    label: "Retail unit #03-20",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-21",
    unitNumber: "#03-21",
    x: 623,
    y: 628,
    w: 59,
    h: 90,
    label: "Food unit #03-21",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-22",
    unitNumber: "#03-22",
    x: 563,
    y: 628,
    w: 58,
    h: 90,
    label: "Food unit #03-22",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-23",
    unitNumber: "#03-23",
    x: 502,
    y: 628,
    w: 59,
    h: 90,
    label: "Food unit #03-23",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-24",
    unitNumber: "#03-24",
    x: 432,
    y: 628,
    w: 68,
    h: 90,
    label: "Retail unit #03-24",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-25",
    unitNumber: "#03-25",
    x: 360,
    y: 585,
    w: 57,
    h: 43,
    label: "Retail unit #03-25",
  }),
  jemTenant({
    stallId: "jem-l3-sensensushi",
    unitNumber: "#03-27/28/29",
    polygon: [
      [188, 537],
      [350, 537],
      [350, 635],
      [188, 635],
    ],
    status: "open",
    label: "Sen Sen Sushi",
  }),
  jemTenant({
    stallId: "jem-l3-dondondonki",
    unitNumber: "#03-27/28/29",
    polygon: [
      [13, 636],
      [340, 636],
      [340, 705],
      [10, 729],
    ],
    status: "open",
    label: "DON DON DONKI",
  }),
  jemTenant({
    stallId: "jem-l3-uniqlo",
    unitNumber: "#03-30/31",
    polygon: [
      [39, 392],
      [350, 392],
      [350, 535],
      [130, 535],
    ],
    status: "open",
    label: "UNIQLO",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-32-33",
    unitNumber: "#03-32/33",
    x: 389,
    y: 384,
    w: 51,
    h: 46,
    label: "Retail unit #03-32/33",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-34",
    unitNumber: "#03-34",
    x: 442,
    y: 384,
    w: 81,
    h: 102,
    label: "Retail unit #03-34",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-35",
    unitNumber: "#03-35",
    x: 525,
    y: 384,
    w: 36,
    h: 102,
    label: "Retail unit #03-35",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-36",
    unitNumber: "#03-36",
    x: 563,
    y: 384,
    w: 58,
    h: 102,
    label: "Retail unit #03-36",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-37-39",
    unitNumber: "#03-37/38/39",
    x: 623,
    y: 384,
    w: 137,
    h: 102,
    label: "Retail unit #03-37/38/39",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-40",
    unitNumber: "#03-40",
    x: 760,
    y: 384,
    w: 50,
    h: 54,
    label: "Retail unit #03-40",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-41",
    unitNumber: "#03-41",
    x: 709,
    y: 440,
    w: 101,
    h: 46,
    label: "Retail unit #03-41",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-42",
    unitNumber: "#03-42",
    x: 760,
    y: 487,
    w: 50,
    h: 45,
    label: "Retail unit #03-42",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-43",
    unitNumber: "#03-43",
    x: 760,
    y: 534,
    w: 50,
    h: 39,
    label: "Retail unit #03-43",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-44",
    unitNumber: "#03-44",
    x: 706,
    y: 487,
    w: 52,
    h: 86,
    label: "Retail unit #03-44",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-45",
    unitNumber: "#03-45",
    x: 652,
    y: 487,
    w: 52,
    h: 86,
    label: "Retail unit #03-45",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-46",
    unitNumber: "#03-46",
    x: 596,
    y: 487,
    w: 54,
    h: 86,
    label: "Retail unit #03-46",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-47",
    unitNumber: "#03-47",
    x: 543,
    y: 487,
    w: 51,
    h: 86,
    label: "Retail unit #03-47",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-48",
    unitNumber: "#03-48",
    x: 496,
    y: 487,
    w: 45,
    h: 86,
    label: "Retail unit #03-48",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-49-51",
    unitNumber: "#03-49/50/51",
    x: 389,
    y: 488,
    w: 105,
    h: 85,
    label: "Retail unit #03-49/50/51",
  }),
  jemTenantRect({
    stallId: "jem-l3-3-52",
    unitNumber: "#03-52",
    x: 389,
    y: 430,
    w: 28,
    h: 56,
    label: "Retail unit #03-52",
  }),
  jemCorridor(
    "jem-l3-corr-top",
    [
      [355, 320],
      [812, 320],
      [812, 356],
      [355, 356],
    ],
    "Main concourse",
  ),
  jemCorridor(
    "jem-l3-corr-mid",
    [
      [356, 574],
      [812, 574],
      [812, 620],
      [356, 620],
    ],
    "Lower concourse",
  ),
  jemCorridor(
    "jem-l3-corr-left",
    [
      [355, 320],
      [388, 320],
      [388, 620],
      [355, 620],
    ],
    "Connector",
  ),
  jemCorridor(
    "jem-l3-corr-right",
    [
      [760, 320],
      [787, 320],
      [787, 620],
      [760, 620],
    ],
    "Connector",
  ),
  jemFacility({
    stallId: "jem-l3-lift-1",
    unitNumber: "L3-LF1",
    polygon: [
      [646, 326],
      [688, 326],
      [688, 362],
      [646, 362],
    ],
    label: "Lift",
    facilityType: "lift",
  }),
  jemFacility({
    stallId: "jem-l3-escalator-1",
    unitNumber: "L3-ES1",
    polygon: [
      [558, 326],
      [602, 326],
      [602, 362],
      [558, 362],
    ],
    label: "Escalator",
    facilityType: "escalator",
  }),
  jemFacility({
    stallId: "jem-l3-washroom-1",
    unitNumber: "L3-WC1",
    polygon: [
      [902, 344],
      [942, 344],
      [942, 384],
      [902, 384],
    ],
    label: "Washroom",
    facilityType: "washroom",
  }),
  jemFacility({
    stallId: "jem-l3-lift-2",
    unitNumber: "L3-LF2",
    polygon: [
      [692, 576],
      [734, 576],
      [734, 614],
      [692, 614],
    ],
    label: "Lift",
    facilityType: "lift",
  }),
  jemFacility({
    stallId: "jem-l3-escalator-2",
    unitNumber: "L3-ES2",
    polygon: [
      [574, 576],
      [620, 576],
      [620, 614],
      [574, 614],
    ],
    label: "Escalator",
    facilityType: "escalator",
  }),
  jemFacility({
    stallId: "jem-l3-service-1",
    unitNumber: "L3-SVC1",
    polygon: [
      [274, 638],
      [332, 638],
      [332, 688],
      [274, 688],
    ],
    label: "Service",
    facilityType: "service",
  }),
  jemFacility({
    stallId: "jem-l3-washroom-2",
    unitNumber: "L3-WC2",
    polygon: [
      [316, 638],
      [368, 638],
      [368, 688],
      [316, 688],
    ],
    label: "Washroom",
    facilityType: "washroom",
  }),
];

// ─── Generic floor plan generator (for buildings without custom layouts) ──────

export function generateGenericFloorPlan(
  buildingId: string,
  floor: string,
  totalStalls: number,
  openStalls: number,
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
    canvasWidth: 730,
    canvasHeight: 244,
    stalls: maxwellL1Stalls,
  },
  "hc-maxwell:L2": {
    buildingId: "hc-maxwell",
    floor: "L2",
    canvasWidth: 410,
    canvasHeight: 200,
    stalls: maxwellL2Stalls,
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
  "fc-food-republic-wisma:B1": {
    buildingId: "fc-food-republic-wisma",
    floor: "B1",
    canvasWidth: 760,
    canvasHeight: 520,
    stalls: wismaB1Stalls,
  },
  "fc-food-republic-wisma:L4": {
    buildingId: "fc-food-republic-wisma",
    floor: "L4",
    canvasWidth: 760,
    canvasHeight: 520,
    stalls: wismaL4Stalls,
  },
  "fc-koufu-jem:L2": {
    buildingId: "fc-koufu-jem",
    floor: "L2",
    canvasWidth: 1152,
    canvasHeight: 759,
    backgroundImage: {
      uri: JEM_L2_MAP_URL,
      opacity: 0.84,
    },
    stalls: jemL2Stalls,
  },
  "fc-koufu-jem:L3": {
    buildingId: "fc-koufu-jem",
    floor: "L3",
    canvasWidth: 1152,
    canvasHeight: 768,
    backgroundImage: {
      uri: JEM_L3_MAP_URL,
      opacity: 0.84,
    },
    stalls: jemL3Stalls,
  },
};

const FLOOR_PLAN_BUILDING_ALIASES: Record<string, string[]> = {
  "building-maxwell": ["hc-maxwell"],
  "hc-maxwell": ["building-maxwell"],
  "building-lau-pa-sat": ["hc-lau-pa-sat"],
  "hc-lau-pa-sat": ["building-lau-pa-sat"],
  "building-amoy": ["hc-amoy"],
  "hc-amoy": ["building-amoy"],
  "building-old-airport-road": ["hc-old-airport-road"],
  "hc-old-airport-road": ["building-old-airport-road"],
  "building-tiong-bahru": ["hc-tiong-bahru"],
  "hc-tiong-bahru": ["building-tiong-bahru"],
  "building-food-republic-wisma": ["fc-food-republic-wisma"],
  "fc-food-republic-wisma": ["building-food-republic-wisma"],
  "building-koufu-jem": ["fc-koufu-jem"],
  "fc-koufu-jem": ["building-koufu-jem"],
};

/** Get a floor plan — falls back to generic layout if no custom one exists */
export function getFloorPlan(
  buildingId: string,
  floor: string,
  openStalls = 10,
  totalStalls = 12,
): FloorPlan {
  const key = `${buildingId}:${floor}`;
  const direct = floorPlans[key];
  if (direct) {
    return direct;
  }

  const aliasIds = FLOOR_PLAN_BUILDING_ALIASES[buildingId] ?? [];
  for (const aliasId of aliasIds) {
    const aliasPlan = floorPlans[`${aliasId}:${floor}`];
    if (aliasPlan) {
      return {
        ...aliasPlan,
        buildingId,
      };
    }
  }

  return generateGenericFloorPlan(buildingId, floor, totalStalls, openStalls);
}
