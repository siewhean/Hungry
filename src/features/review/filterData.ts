export interface Filter {
  id: string;
  name: string;
  matrix: number[];
}

// Skia-compatible color matrices
export const FILTERS: Filter[] = [
  {
    id: "none",
    name: "Normal",
    matrix: [
      1, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      0, 0, 1, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: "vivid",
    name: "Vivid",
    matrix: [
      1.2, 0, 0, 0, 0,
      0, 1.2, 0, 0, 0,
      0, 0, 1.2, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: "grayscale",
    name: "B&W",
    matrix: [
      0.33, 0.33, 0.33, 0, 0,
      0.33, 0.33, 0.33, 0, 0,
      0.33, 0.33, 0.33, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: "sepia",
    name: "Sepia",
    matrix: [
      0.393, 0.769, 0.189, 0, 0,
      0.349, 0.686, 0.168, 0, 0,
      0.272, 0.534, 0.131, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: "cold",
    name: "Cold",
    matrix: [
      0.9, 0, 0, 0, 0,
      0, 0.9, 0, 0, 0,
      0, 0, 1.3, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  {
    id: "warm",
    name: "Warm",
    matrix: [
      1.3, 0, 0, 0, 0,
      0, 1.1, 0, 0, 0,
      0, 0, 0.9, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
];
