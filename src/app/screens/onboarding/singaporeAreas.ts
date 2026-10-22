import type { Coordinate } from "@/types/domain";

export function sortAreasByName<T extends { name: string }>(areas: readonly T[]): T[] {
  return [...areas].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

export type SingaporeArea = {
  id: string;
  name: string;
  /** Other names people search by (a neighbourhood inside the area, or the planning-area name). */
  keywords?: string[];
  coordinate: Coordinate;
};

const SINGAPORE_AREAS: readonly SingaporeArea[] = [
  { id: "ang-mo-kio", name: "Ang Mo Kio", coordinate: { latitude: 1.3691, longitude: 103.8454 } },
  { id: "bedok", name: "Bedok", coordinate: { latitude: 1.3236, longitude: 103.9273 } },
  { id: "bishan", name: "Bishan", coordinate: { latitude: 1.3509, longitude: 103.835 } },
  { id: "boon-lay", name: "Boon Lay", coordinate: { latitude: 1.3387, longitude: 103.7055 } },
  { id: "bukit-batok", name: "Bukit Batok", coordinate: { latitude: 1.349, longitude: 103.7495 } },
  { id: "bukit-merah", name: "Bukit Merah", coordinate: { latitude: 1.2823, longitude: 103.8229 } },
  {
    id: "bukit-panjang",
    name: "Bukit Panjang",
    coordinate: { latitude: 1.3801, longitude: 103.7613 },
  },
  { id: "bukit-timah", name: "Bukit Timah", coordinate: { latitude: 1.3294, longitude: 103.8021 } },
  {
    id: "central-area",
    name: "Central Area",
    coordinate: { latitude: 1.2808, longitude: 103.8515 },
  },
  {
    id: "choa-chu-kang",
    name: "Choa Chu Kang",
    coordinate: { latitude: 1.3844, longitude: 103.7479 },
  },
  { id: "changi", name: "Changi", coordinate: { latitude: 1.3566, longitude: 103.9897 } },
  {
    id: "chinatown",
    name: "Chinatown",
    keywords: ["outram", "tanjong pagar"],
    coordinate: { latitude: 1.2836, longitude: 103.8436 },
  },
  { id: "clementi", name: "Clementi", coordinate: { latitude: 1.3151, longitude: 103.7652 } },
  { id: "geylang", name: "Geylang", coordinate: { latitude: 1.3182, longitude: 103.8871 } },
  { id: "hougang", name: "Hougang", coordinate: { latitude: 1.3712, longitude: 103.8922 } },
  { id: "jalan-besar", name: "Jalan Besar", coordinate: { latitude: 1.3078, longitude: 103.8559 } },
  { id: "jurong-east", name: "Jurong East", coordinate: { latitude: 1.3331, longitude: 103.7437 } },
  { id: "jurong-west", name: "Jurong West", coordinate: { latitude: 1.3404, longitude: 103.7066 } },
  { id: "kallang", name: "Kallang", coordinate: { latitude: 1.3114, longitude: 103.871 } },
  {
    id: "lim-chu-kang",
    name: "Lim Chu Kang",
    coordinate: { latitude: 1.4233, longitude: 103.7102 },
  },
  { id: "mandai", name: "Mandai", coordinate: { latitude: 1.4406, longitude: 103.81 } },
  {
    id: "marine-parade",
    name: "Marine Parade",
    coordinate: { latitude: 1.3023, longitude: 103.9019 },
  },
  { id: "novena", name: "Novena", coordinate: { latitude: 1.3194, longitude: 103.8431 } },
  { id: "orchard", name: "Orchard", coordinate: { latitude: 1.3048, longitude: 103.8318 } },
  { id: "outram", name: "Outram", coordinate: { latitude: 1.2812, longitude: 103.8386 } },
  { id: "pasir-ris", name: "Pasir Ris", coordinate: { latitude: 1.373, longitude: 103.9493 } },
  { id: "paya-lebar", name: "Paya Lebar", coordinate: { latitude: 1.3147, longitude: 103.8931 } },
  { id: "pioneer", name: "Pioneer", coordinate: { latitude: 1.3376, longitude: 103.6974 } },
  {
    id: "potong-pasir",
    name: "Potong Pasir",
    coordinate: { latitude: 1.3344, longitude: 103.8591 },
  },
  { id: "punggol", name: "Punggol", coordinate: { latitude: 1.3984, longitude: 103.9072 } },
  { id: "queenstown", name: "Queenstown", coordinate: { latitude: 1.2942, longitude: 103.7861 } },
  { id: "rochor", name: "Rochor", coordinate: { latitude: 1.3047, longitude: 103.8519 } },
  { id: "seletar", name: "Seletar", coordinate: { latitude: 1.4149, longitude: 103.8778 } },
  { id: "serangoon", name: "Serangoon", coordinate: { latitude: 1.3508, longitude: 103.8723 } },
  { id: "sembawang", name: "Sembawang", coordinate: { latitude: 1.4491, longitude: 103.8185 } },
  { id: "sengkang", name: "Sengkang", coordinate: { latitude: 1.3868, longitude: 103.8935 } },
  { id: "sentosa", name: "Sentosa", coordinate: { latitude: 1.2494, longitude: 103.8303 } },
  {
    id: "sungei-road",
    name: "Sungei Road",
    keywords: ["jalan besar", "rochor"],
    coordinate: { latitude: 1.319, longitude: 103.8637 },
  },
  { id: "tampines", name: "Tampines", coordinate: { latitude: 1.3526, longitude: 103.9448 } },
  { id: "tanglin", name: "Tanglin", coordinate: { latitude: 1.3039, longitude: 103.8168 } },
  { id: "tengah", name: "Tengah", coordinate: { latitude: 1.368, longitude: 103.728 } },
  { id: "toa-payoh", name: "Toa Payoh", coordinate: { latitude: 1.3343, longitude: 103.8563 } },
  { id: "woodlands", name: "Woodlands", coordinate: { latitude: 1.4389, longitude: 103.7861 } },
  { id: "yishun", name: "Yishun", coordinate: { latitude: 1.4294, longitude: 103.8393 } },
];

export const SORTED_SINGAPORE_AREAS = sortAreasByName(SINGAPORE_AREAS);
