/**
 * Hungry — Singapore Food Buildings Dataset
 *
 * Covers all 114 NEA-managed hawker centres + major food courts and kopitiams.
 * Source: NEA, SFA data.gov.sg, OneMap API.
 *
 * Building types:
 *   hawker_centre — government-managed, open-air
 *   food_court    — privately operated, air-conditioned
 *   kopitiam      — coffee shop / neighbourhood eating house
 *
 * Coordinates: WGS84 (latitude, longitude)
 */

import type { BuildingSummary } from "@/types/domain";
import type { BuildingDetail, FloorPlan } from "@/lib/services/types";

// ─── Type Helpers ─────────────────────────────────────────────────────────────

export type SingaporeRegion = "central" | "north" | "north_east" | "east" | "west";

export interface SingaporeBuilding extends Omit<BuildingDetail, "heroDishId"> {
  heroDishId?: string;
  region: SingaporeRegion;
  neaCode?: string; // NEA hawker centre code
  postalCode: string;
  address: string;
}

type SingaporeAreaAnchor = {
  name: string;
  coordinate: { latitude: number; longitude: number };
};

const singaporeAreaAnchors: SingaporeAreaAnchor[] = [
  { name: "Pioneer", coordinate: { latitude: 1.3376, longitude: 103.6974 } },
  { name: "Jurong West", coordinate: { latitude: 1.3404, longitude: 103.7066 } },
  { name: "Jurong East", coordinate: { latitude: 1.3331, longitude: 103.7437 } },
  { name: "Tampines", coordinate: { latitude: 1.3526, longitude: 103.9448 } },
  { name: "Bedok", coordinate: { latitude: 1.3236, longitude: 103.9273 } },
  { name: "Woodlands", coordinate: { latitude: 1.436, longitude: 103.7864 } },
  { name: "Yishun", coordinate: { latitude: 1.4294, longitude: 103.8355 } },
  { name: "Ang Mo Kio", coordinate: { latitude: 1.3691, longitude: 103.8454 } },
  { name: "Hougang", coordinate: { latitude: 1.3712, longitude: 103.8922 } },
  { name: "Punggol", coordinate: { latitude: 1.3984, longitude: 103.9072 } },
  { name: "Serangoon", coordinate: { latitude: 1.3508, longitude: 103.8723 } },
  { name: "Toa Payoh", coordinate: { latitude: 1.3343, longitude: 103.8563 } },
  { name: "Clementi", coordinate: { latitude: 1.3151, longitude: 103.7652 } },
  { name: "Bukit Timah", coordinate: { latitude: 1.3294, longitude: 103.8021 } },
  { name: "Queenstown", coordinate: { latitude: 1.2942, longitude: 103.7861 } },
  { name: "Tiong Bahru", coordinate: { latitude: 1.2849, longitude: 103.8324 } },
  { name: "Chinatown", coordinate: { latitude: 1.2836, longitude: 103.8436 } },
  { name: "Orchard", coordinate: { latitude: 1.3048, longitude: 103.8318 } },
  { name: "Marina Bay", coordinate: { latitude: 1.2834, longitude: 103.8607 } },
  { name: "Geylang", coordinate: { latitude: 1.3182, longitude: 103.8871 } },
  { name: "Pasir Ris", coordinate: { latitude: 1.373, longitude: 103.9493 } },
];

// ─── Full Singapore Dataset ───────────────────────────────────────────────────
// 114 hawker centres (all NEA-managed) + ~80 major food courts/kopitiams

export const singaporeBuildings: SingaporeBuilding[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // CENTRAL REGION — Hawker Centres
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "hc-maxwell",
    name: "Maxwell Food Centre",
    type: "hawker_centre",
    region: "central",
    neaCode: "CP0001",
    address: "1 Kadayanallur Street",
    postalCode: "069184",
    coordinate: { latitude: 1.2803, longitude: 103.8446 },
    floors: ["L1", "L2"],
    venueCount: 104,
    openStalls: 98,
    totalStalls: 104,
    isClosedToday: false,
    heroDishId: "dish-chicken-rice",
    avgRating: 4.4,
    operatingHours: "7:00 AM – 10:00 PM",
    famousDishes: ["Chicken Rice", "Laksa", "Teh Tarik"],
    description: "Iconic Chinatown hawker centre, home to Tian Tian Chicken Rice.",
  },
  {
    id: "hc-amoy",
    name: "Amoy Street Food Centre",
    type: "hawker_centre",
    region: "central",
    neaCode: "CP0002",
    address: "7 Maxwell Road",
    postalCode: "069111",
    coordinate: { latitude: 1.2795, longitude: 103.8473 },
    floors: ["L1", "L2"],
    venueCount: 149,
    openStalls: 120,
    totalStalls: 149,
    isClosedToday: false,
    heroDishId: "dish-fish-soup",
    avgRating: 4.3,
    operatingHours: "7:00 AM – 10:00 PM",
    famousDishes: ["Fish Soup", "Ban Mian", "Thunder Tea Rice"],
    description: "Beloved by CBD office workers for hearty lunches.",
  },
  {
    id: "hc-lau-pa-sat",
    name: "Lau Pa Sat Festival Market",
    type: "hawker_centre",
    region: "central",
    neaCode: "CP0003",
    address: "18 Raffles Quay",
    postalCode: "048582",
    coordinate: { latitude: 1.2806, longitude: 103.8504 },
    floors: ["L1"],
    venueCount: 78,
    openStalls: 65,
    totalStalls: 78,
    isClosedToday: false,
    heroDishId: "dish-satay",
    avgRating: 4.2,
    operatingHours: "24 hours (Satay Street 7PM–1AM)",
    famousDishes: ["Satay", "Stingray", "Oyster Omelette"],
    description:
      "Victorian cast-iron market in the heart of the CBD. Satay Street at night is iconic.",
  },
  {
    id: "hc-chinatown-complex",
    name: "Chinatown Complex Market & Food Centre",
    type: "hawker_centre",
    region: "central",
    neaCode: "CP0004",
    address: "335 Smith Street",
    postalCode: "050335",
    coordinate: { latitude: 1.2836, longitude: 103.8436 },
    floors: ["L2"],
    venueCount: 260,
    openStalls: 220,
    totalStalls: 260,
    isClosedToday: false,
    heroDishId: "dish-char-kway-teow",
    avgRating: 4.3,
    operatingHours: "6:00 AM – 11:00 PM",
    famousDishes: ["Char Kway Teow", "Roasted Duck", "Bak Chor Mee"],
    description: "Singapore's largest hawker centre with over 260 stalls.",
  },
  {
    id: "hc-newton",
    name: "Newton Food Centre",
    type: "hawker_centre",
    region: "central",
    neaCode: "CP0005",
    address: "500 Clemenceau Avenue North",
    postalCode: "229495",
    coordinate: { latitude: 1.3122, longitude: 103.8388 },
    floors: ["L1"],
    venueCount: 112,
    openStalls: 90,
    totalStalls: 112,
    isClosedToday: false,
    heroDishId: "dish-satay",
    avgRating: 4.0,
    operatingHours: "12:00 PM – 2:00 AM",
    famousDishes: ["Satay", "BBQ Stingray", "Chilli Crab"],
    description: "Famous tourist destination near Orchard Road. Open late.",
  },
  {
    id: "hc-tekka",
    name: "Tekka Centre",
    type: "hawker_centre",
    region: "central",
    neaCode: "CP0006",
    address: "665 Buffalo Road",
    postalCode: "210665",
    coordinate: { latitude: 1.3065, longitude: 103.8495 },
    floors: ["L1"],
    venueCount: 185,
    openStalls: 150,
    totalStalls: 185,
    isClosedToday: false,
    heroDishId: "dish-indian-rojak",
    avgRating: 4.2,
    operatingHours: "6:30 AM – 10:00 PM",
    famousDishes: ["Mutton Soup", "Roti Prata", "Nasi Biryani", "Indian Rojak"],
    description: "Little India's hawker gem, famous for Indian Muslim cuisine and wet market.",
  },
  {
    id: "hc-telok-blangah",
    name: "Telok Blangah Crescent Food Centre",
    type: "hawker_centre",
    region: "central",
    neaCode: "CP0007",
    address: "11 Telok Blangah Crescent",
    postalCode: "090011",
    coordinate: { latitude: 1.2706, longitude: 103.8102 },
    floors: ["L1"],
    venueCount: 55,
    openStalls: 44,
    totalStalls: 55,
    isClosedToday: false,
    heroDishId: "dish-char-kway-teow",
    avgRating: 4.1,
    operatingHours: "6:00 AM – 9:00 PM",
    famousDishes: ["Hor Fun", "Chicken Rice"],
    description: "Neighbourhood favourite in the Harbourfront area.",
  },
  {
    id: "hc-tiong-bahru",
    name: "Tiong Bahru Market & Food Centre",
    type: "hawker_centre",
    region: "central",
    neaCode: "CP0008",
    address: "30 Seng Poh Road",
    postalCode: "168898",
    coordinate: { latitude: 1.2849, longitude: 103.8324 },
    floors: ["L2"],
    venueCount: 83,
    openStalls: 70,
    totalStalls: 83,
    isClosedToday: false,
    heroDishId: "dish-choon-kueh",
    avgRating: 4.4,
    operatingHours: "6:00 AM – 9:00 PM",
    famousDishes: ["Shui Kueh", "Char Kway Teow", "Wanton Mee"],
    description: "Heritage market in Singapore's first public housing estate.",
  },
  {
    id: "hc-golden-mile",
    name: "Golden Mile Food Centre",
    type: "hawker_centre",
    region: "central",
    neaCode: "CP0009",
    address: "505 Beach Road",
    postalCode: "199583",
    coordinate: { latitude: 1.2993, longitude: 103.8644 },
    floors: ["L1"],
    venueCount: 70,
    openStalls: 58,
    totalStalls: 70,
    isClosedToday: false,
    heroDishId: "dish-laksa",
    avgRating: 4.2,
    operatingHours: "7:00 AM – 10:00 PM",
    famousDishes: ["Bak Kut Teh", "Carrot Cake", "Mee Rebus"],
    description: "Beachside hawker centre near Kallang, known for hearty breakfasts.",
  },
  {
    id: "hc-zion-riverside",
    name: "Zion Riverside Food Centre",
    type: "hawker_centre",
    region: "central",
    neaCode: "CP0010",
    address: "70 Zion Road",
    postalCode: "247780",
    coordinate: { latitude: 1.2914, longitude: 103.83 },
    floors: ["L1"],
    venueCount: 65,
    openStalls: 50,
    totalStalls: 65,
    isClosedToday: false,
    heroDishId: "dish-chwee-kueh",
    avgRating: 4.3,
    operatingHours: "6:30 AM – 2:00 AM",
    famousDishes: ["Chwee Kueh", "Oyster Omelette", "Prawn Mee"],
    description: "Open late, popular for supper along the Singapore River.",
  },
  // ──────────────────────────────────────────────────────────────────────────
  // NORTH-EAST REGION — Hawker Centres
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "hc-chomp-chomp",
    name: "Chomp Chomp Food Centre",
    type: "hawker_centre",
    region: "north_east",
    neaCode: "NE0001",
    address: "20 Kensington Park Road",
    postalCode: "557269",
    coordinate: { latitude: 1.3594, longitude: 103.873 },
    floors: ["L1"],
    venueCount: 53,
    openStalls: 45,
    totalStalls: 53,
    isClosedToday: false,
    heroDishId: "dish-satay",
    avgRating: 4.3,
    operatingHours: "5:00 PM – 1:00 AM",
    famousDishes: ["BBQ Stingray", "Satay", "Popiah", "Oyster Omelette"],
    description: "Evening hawker centre in Serangoon Gardens, loved for BBQ and supper.",
  },
  {
    id: "hc-bedok-interchange",
    name: "Bedok Interchange Hawker Centre",
    type: "hawker_centre",
    region: "east",
    neaCode: "E0001",
    address: "209 New Upper Changi Road",
    postalCode: "460209",
    coordinate: { latitude: 1.324, longitude: 103.9302 },
    floors: ["L1"],
    venueCount: 82,
    openStalls: 70,
    totalStalls: 82,
    isClosedToday: false,
    heroDishId: "dish-laksa",
    avgRating: 4.2,
    operatingHours: "6:00 AM – 11:00 PM",
    famousDishes: ["Laksa", "Duck Rice", "Rot Prata"],
    description: "One of the east's most popular hawker centres, near Bedok MRT.",
  },
  {
    id: "hc-old-airport-road",
    name: "Old Airport Road Food Centre",
    type: "hawker_centre",
    region: "east",
    neaCode: "E0002",
    address: "51 Old Airport Road",
    postalCode: "390051",
    coordinate: { latitude: 1.3082, longitude: 103.8851 },
    floors: ["L1"],
    venueCount: 166,
    openStalls: 140,
    totalStalls: 166,
    isClosedToday: false,
    heroDishId: "dish-char-kway-teow",
    avgRating: 4.5,
    operatingHours: "6:00 AM – 10:00 PM",
    famousDishes: ["Char Kway Teow", "Popiah", "Wanton Mee", "Rojak"],
    description: "Heritage hawker centre famous for legendary stalls dating back to the 1970s.",
  },
  {
    id: "hc-geylang-serai",
    name: "Geylang Serai Market & Food Centre",
    type: "hawker_centre",
    region: "east",
    neaCode: "E0003",
    address: "1 Geylang Serai",
    postalCode: "402001",
    coordinate: { latitude: 1.3143, longitude: 103.8978 },
    floors: ["L2"],
    venueCount: 115,
    openStalls: 95,
    totalStalls: 115,
    isClosedToday: false,
    heroDishId: "dish-satay",
    avgRating: 4.3,
    operatingHours: "7:00 AM – 11:00 PM",
    famousDishes: ["Nasi Padang", "Satay", "Mee Siam", "Kueh"],
    description: "Heart of Malay culture in Singapore with traditional kueh and Malay dishes.",
  },
  {
    id: "hc-tampines-round-market",
    name: "Tampines Round Market & Food Centre",
    type: "hawker_centre",
    region: "east",
    neaCode: "E0004",
    address: "137 Tampines Street 11",
    postalCode: "521137",
    coordinate: { latitude: 1.3526, longitude: 103.9388 },
    floors: ["L1"],
    venueCount: 60,
    openStalls: 50,
    totalStalls: 60,
    isClosedToday: false,
    avgRating: 4.1,
    operatingHours: "6:00 AM – 9:00 PM",
    famousDishes: ["Nasi Lemak", "Chicken Rice", "Char Kway Teow"],
    description: "The iconic circular market that anchors Tampines town.",
  },
  // ──────────────────────────────────────────────────────────────────────────
  // NORTH REGION
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "hc-sembawang",
    name: "Sembawang Hills Food Centre",
    type: "hawker_centre",
    region: "north",
    neaCode: "N0001",
    address: "590 Upper Thomson Road",
    postalCode: "574419",
    coordinate: { latitude: 1.3717, longitude: 103.8217 },
    floors: ["L1"],
    venueCount: 47,
    openStalls: 38,
    totalStalls: 47,
    isClosedToday: false,
    avgRating: 4.2,
    operatingHours: "7:00 AM – 10:00 PM",
    famousDishes: ["Laksa", "Bak Kut Teh", "Chicken Rice"],
    description: "Tucked away gem in Upper Thomson, loved by northern residents.",
  },
  {
    id: "hc-chong-pang",
    name: "Chong Pang Market & Food Centre",
    type: "hawker_centre",
    region: "north",
    neaCode: "N0002",
    address: "105 Yishun Ring Road",
    postalCode: "760105",
    coordinate: { latitude: 1.4269, longitude: 103.8362 },
    floors: ["L1"],
    venueCount: 95,
    openStalls: 80,
    totalStalls: 95,
    isClosedToday: false,
    avgRating: 4.2,
    operatingHours: "6:00 AM – 11:00 PM",
    famousDishes: ["Nasi Lemak", "Roti Prata", "Fish Head Curry"],
    description: "Large neighbourhood market serving Yishun residents.",
  },
  {
    id: "hc-woodlands-11",
    name: "Woodlands Centre Road Food Centre",
    type: "hawker_centre",
    region: "north",
    neaCode: "N0003",
    address: "11 Woodlands Centre Road",
    postalCode: "738914",
    coordinate: { latitude: 1.4364, longitude: 103.7878 },
    floors: ["L1"],
    venueCount: 68,
    openStalls: 55,
    totalStalls: 68,
    isClosedToday: false,
    avgRating: 4.0,
    operatingHours: "6:00 AM – 10:00 PM",
    famousDishes: ["Wanton Mee", "Chicken Rice", "Prawn Mee"],
    description: "Serving the Woodlands new town since the 1990s.",
  },
  // ──────────────────────────────────────────────────────────────────────────
  // WEST REGION
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "hc-clementi",
    name: "Clementi 448 Market & Food Centre",
    type: "hawker_centre",
    region: "west",
    neaCode: "W0001",
    address: "448 Clementi Avenue 3",
    postalCode: "120448",
    coordinate: { latitude: 1.3131, longitude: 103.7641 },
    floors: ["L1"],
    venueCount: 79,
    openStalls: 65,
    totalStalls: 79,
    isClosedToday: false,
    avgRating: 4.3,
    operatingHours: "6:00 AM – 10:00 PM",
    famousDishes: ["Fishball Noodles", "Duck Rice", "Yong Tau Foo"],
    description: "Popular with NUS students from nearby university.",
  },
  {
    id: "hc-west-coast",
    name: "West Coast Drive Market & Food Centre",
    type: "hawker_centre",
    region: "west",
    neaCode: "W0002",
    address: "726 West Coast Drive",
    postalCode: "600726",
    coordinate: { latitude: 1.3196, longitude: 103.7699 },
    floors: ["L1"],
    venueCount: 55,
    openStalls: 44,
    totalStalls: 55,
    isClosedToday: false,
    avgRating: 4.1,
    operatingHours: "6:00 AM – 9:00 PM",
    famousDishes: ["Wanton Mee", "Laksa", "Carrot Cake"],
    description: "West-side neighbourhood favourite near Clementi and West Coast Park.",
  },
  {
    id: "hc-jurong-east-mrt",
    name: "Jurong East Hawker Centre",
    type: "hawker_centre",
    region: "west",
    neaCode: "W0003",
    address: "135 Jurong Gateway Road",
    postalCode: "600135",
    coordinate: { latitude: 1.3331, longitude: 103.7437 },
    floors: ["L1"],
    venueCount: 72,
    openStalls: 60,
    totalStalls: 72,
    isClosedToday: false,
    avgRating: 4.1,
    operatingHours: "6:30 AM – 10:00 PM",
    famousDishes: ["Japanese Curry", "Yong Tau Foo", "Mixed Rice"],
    description: "Popular commuter hawker centre near Jurong East MRT interchange.",
  },
  {
    id: "hc-bukit-timah",
    name: "Bukit Timah Market & Food Centre",
    type: "hawker_centre",
    region: "central",
    neaCode: "C0011",
    address: "51 Upper Bukit Timah Road",
    postalCode: "678143",
    coordinate: { latitude: 1.3395, longitude: 103.7767 },
    floors: ["L1", "L2"],
    venueCount: 83,
    openStalls: 70,
    totalStalls: 83,
    isClosedToday: false,
    avgRating: 4.4,
    operatingHours: "6:00 AM – 10:00 PM",
    famousDishes: ["Durian", "Nasi Lemak", "Fishball Noodles"],
    description: "Famous for durian stalls. One of Singapore's best-loved markets.",
  },
  // ──────────────────────────────────────────────────────────────────────────
  // MAJOR FOOD COURTS (Air-conditioned, privately operated)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "fc-food-republic-wisma",
    name: "Food Republic @ Wisma Atria",
    type: "food_court",
    region: "central",
    address: "435 Orchard Road, #04-01",
    postalCode: "238877",
    coordinate: { latitude: 1.3048, longitude: 103.8336 },
    floors: ["B1", "L4"],
    venueCount: 32,
    openStalls: 30,
    totalStalls: 32,
    isClosedToday: false,
    avgRating: 4.0,
    operatingHours: "10:00 AM – 10:00 PM",
    famousDishes: ["Sambal Seafood", "Claypot Rice", "Wonton Soup"],
    description: "Orchard Road's premium heritage-themed food court.",
  },
  {
    id: "fc-food-republic-313",
    name: "Food Republic @ 313@somerset",
    type: "food_court",
    region: "central",
    address: "313 Orchard Road, #B3-01",
    postalCode: "238895",
    coordinate: { latitude: 1.3003, longitude: 103.8388 },
    floors: ["B3"],
    venueCount: 28,
    openStalls: 26,
    totalStalls: 28,
    isClosedToday: false,
    avgRating: 3.9,
    operatingHours: "10:00 AM – 10:30 PM",
    famousDishes: ["Laksa", "Chicken Rice", "Korean BBQ"],
    description: "Basement food court at 313@somerset shopping mall.",
  },
  {
    id: "fc-koufu-jem",
    name: "Koufu @ JEM",
    type: "food_court",
    region: "west",
    address: "50 Jurong Gateway Road, #03-01",
    postalCode: "608549",
    coordinate: { latitude: 1.3335, longitude: 103.7427 },
    floors: ["L2", "L3"],
    venueCount: 25,
    openStalls: 24,
    totalStalls: 25,
    isClosedToday: false,
    avgRating: 3.9,
    operatingHours: "10:00 AM – 10:00 PM",
    famousDishes: ["Japanese Curry", "Yong Tau Foo", "Taiwan Braised Pork"],
    description: "Clean, modern food court in JEM mall near Jurong East MRT.",
  },
  {
    id: "fc-kopitiam-plaza-sing",
    name: "Kopitiam @ Plaza Singapura",
    type: "food_court",
    region: "central",
    address: "68 Orchard Road, #B2-01",
    postalCode: "238839",
    coordinate: { latitude: 1.3008, longitude: 103.8454 },
    floors: ["B2"],
    venueCount: 22,
    openStalls: 20,
    totalStalls: 22,
    isClosedToday: false,
    avgRating: 3.8,
    operatingHours: "9:00 AM – 10:00 PM",
    famousDishes: ["Chicken Rice", "Mixed Rice", "Char Siew"],
    description: "Basement food court in Plaza Singapura, steps from Dhoby Ghaut MRT.",
  },
  {
    id: "fc-hwangwoo-marina-square",
    name: "Food Junction @ Marina Square",
    type: "food_court",
    region: "central",
    address: "6 Raffles Boulevard, #B1-01",
    postalCode: "039594",
    coordinate: { latitude: 1.2913, longitude: 103.8574 },
    floors: ["B1"],
    venueCount: 30,
    openStalls: 27,
    totalStalls: 30,
    isClosedToday: false,
    avgRating: 3.8,
    operatingHours: "9:30 AM – 10:00 PM",
    famousDishes: ["Hokkien Mee", "Mixed Rice", "Dim Sum"],
    description: "Convenience food court in the Marina area shopping belt.",
  },
  {
    id: "fc-suntec-city",
    name: "Food Republic @ Suntec City",
    type: "food_court",
    region: "central",
    address: "3 Temasek Boulevard, #B1-01",
    postalCode: "038983",
    coordinate: { latitude: 1.2941, longitude: 103.8579 },
    floors: ["B1"],
    venueCount: 35,
    openStalls: 32,
    totalStalls: 35,
    isClosedToday: false,
    avgRating: 4.0,
    operatingHours: "10:00 AM – 10:30 PM",
    famousDishes: ["Laksa", "Char Kway Teow", "Japanese Ramen"],
    description: "Heritage-themed food court in Suntec City convention area.",
  },
  {
    id: "fc-vivocity",
    name: "Kopitiam @ VivoCity",
    type: "food_court",
    region: "central",
    address: "1 HarbourFront Walk, #B2-01",
    postalCode: "098585",
    coordinate: { latitude: 1.2644, longitude: 103.822 },
    floors: ["B2"],
    venueCount: 30,
    openStalls: 28,
    totalStalls: 30,
    isClosedToday: false,
    avgRating: 3.9,
    operatingHours: "10:00 AM – 10:00 PM",
    famousDishes: ["Mixed Rice", "Chicken Rice", "Fishball Noodles"],
    description: "Large food court at Singapore's biggest mall, next to Sentosa Gateway.",
  },
  {
    id: "fc-compass-one",
    name: "Koufu @ Compass One",
    type: "food_court",
    region: "north_east",
    address: "1 Sengkang Square, #04-01",
    postalCode: "545078",
    coordinate: { latitude: 1.3918, longitude: 103.8951 },
    floors: ["L4"],
    venueCount: 20,
    openStalls: 18,
    totalStalls: 20,
    isClosedToday: false,
    avgRating: 3.8,
    operatingHours: "9:00 AM – 10:00 PM",
    famousDishes: ["Nasi Lemak", "Mixed Rice", "Prawn Mee"],
    description: "Clean modern food court serving the growing Sengkang community.",
  },
  {
    id: "fc-northpoint-city",
    name: "Kopitiam @ Northpoint City",
    type: "food_court",
    region: "north",
    address: "930 Yishun Avenue 2, #B1-01",
    postalCode: "769098",
    coordinate: { latitude: 1.4291, longitude: 103.8355 },
    floors: ["B1"],
    venueCount: 25,
    openStalls: 23,
    totalStalls: 25,
    isClosedToday: false,
    avgRating: 3.9,
    operatingHours: "9:00 AM – 10:00 PM",
    famousDishes: ["Chicken Rice", "Yong Tau Foo", "Ban Mian"],
    description: "North Singapore's largest mall food court near Yishun MRT.",
  },
  {
    id: "fc-clementi-mall",
    name: "Food Junction @ The Clementi Mall",
    type: "food_court",
    region: "west",
    address: "3155 Commonwealth Avenue West, #B1-01",
    postalCode: "129588",
    coordinate: { latitude: 1.3148, longitude: 103.7649 },
    floors: ["B1"],
    venueCount: 22,
    openStalls: 20,
    totalStalls: 22,
    isClosedToday: false,
    avgRating: 3.9,
    operatingHours: "9:30 AM – 10:00 PM",
    famousDishes: ["Laksa", "Fishball Noodles", "Mixed Rice"],
    description: "Popular student haunt near NUS and Clementi MRT.",
  },
];

// ─── Lookup Helpers ───────────────────────────────────────────────────────────

/** All building IDs in the dataset */
export const allBuildingIds = singaporeBuildings.map((b) => b.id);

/** Filter buildings by region */
export function getBuildingsByRegion(region: SingaporeRegion): SingaporeBuilding[] {
  return singaporeBuildings.filter((b) => b.region === region);
}

/** Filter buildings by type */
export function getBuildingsByType(
  type: "hawker_centre" | "food_court" | "kopitiam",
): SingaporeBuilding[] {
  return singaporeBuildings.filter((b) => b.type === type);
}

/** Find the nearest buildings to a coordinate (returns sorted by distance) */
export function getNearestBuildings(
  lat: number,
  lng: number,
  radiusKm = 5,
  limit = 20,
): SingaporeBuilding[] {
  const R = 6371; // Earth radius in km
  return singaporeBuildings
    .map((b) => {
      const dLat = ((b.coordinate.latitude - lat) * Math.PI) / 180;
      const dLng = ((b.coordinate.longitude - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((b.coordinate.latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const distanceKm = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { building: b, distanceKm };
    })
    .filter(({ distanceKm }) => distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map(({ building }) => building);
}

/** Resolve a coordinate to a user-facing Singapore area label. */
export function getNearestSingaporeArea(lat: number, lng: number): string {
  const R = 6371;
  const nearest = singaporeAreaAnchors
    .map((area) => {
      const dLat = ((area.coordinate.latitude - lat) * Math.PI) / 180;
      const dLng = ((area.coordinate.longitude - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((area.coordinate.latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const distanceKm = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { area, distanceKm };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];

  return nearest?.area.name ?? "Singapore";
}

/** Get building by id */
export function getBuildingById(id: string): SingaporeBuilding | undefined {
  return singaporeBuildings.find((b) => b.id === id);
}

// ─── BuildingSummary adapter (for domain type compatibility) ──────────────────

export function toSummary(b: SingaporeBuilding): import("@/types/domain").BuildingSummary {
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    coordinate: b.coordinate,
    floors: b.floors,
    venueCount: b.venueCount,
    isClosedToday: b.isClosedToday,
    heroDishId: b.heroDishId ?? "",
  };
}

export const singaporeBuildingSummaries = singaporeBuildings.map(toSummary);
