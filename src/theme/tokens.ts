export const colors = {
  light: {
    bg: "#FFFFFF",
    bgMuted: "#F9FAFB",
    bgSoft: "#FDF0EB",
    surface: "#FFFFFF",
    surfaceRaised: "#FAF7F2",
    text: "#111827",
    textSecondary: "#374151",
    textMuted: "#6B7280",
    border: "#D1D5DB",
    orange: "#E8531E",
    orangeDark: "#C43E10",
    orangeLight: "#FDF0EB",
    navy: "#1A2E44",
    amber: "#F5A623",
    amberLight: "#FEF9EE",
    teal: "#14B8A6",
    success: "#16A34A",
    successSoft: "#DCFCE7",
    warning: "#D97706",
    warningSoft: "#FEF3C7",
    error: "#DC2626",
    errorSoft: "#FEE2E2",
    info: "#2563EB",
    infoSoft: "#DBEAFE",
    mapBg: "#FAF7F2",
    mapRoadPrimary: "#FFFFFF",
    mapRoadSecondary: "#E5E7EB",
    overlay: "rgba(17, 24, 39, 0.45)",
  },
  dark: {
    bg: "#0D0F14",
    bgMuted: "#121722",
    bgSoft: "#1D2430",
    surface: "#161C27",
    surfaceRaised: "#1B2433",
    text: "#F9FAFB",
    textSecondary: "#D1D5DB",
    textMuted: "#9CA3AF",
    border: "#374151",
    orange: "#E8531E",
    orangeDark: "#F06A34",
    orangeLight: "#3A1E17",
    navy: "#E4EBF4",
    amber: "#F5A623",
    amberLight: "#342A14",
    teal: "#2DD4BF",
    success: "#4ADE80",
    successSoft: "#163722",
    warning: "#F59E0B",
    warningSoft: "#3D2B14",
    error: "#F87171",
    errorSoft: "#3A1B1B",
    info: "#60A5FA",
    infoSoft: "#17283B",
    mapBg: "#121722",
    mapRoadPrimary: "#303845",
    mapRoadSecondary: "#1F2937",
    overlay: "rgba(13, 15, 20, 0.6)",
  },
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  12: 48,
  16: 64,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: "#111827",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  floating: {
    shadowColor: "#111827",
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontFamily: "Nunito_700Bold" },
  h1: { fontSize: 24, lineHeight: 30, fontFamily: "Nunito_700Bold" },
  h2: { fontSize: 20, lineHeight: 26, fontFamily: "Nunito_600SemiBold" },
  h3: { fontSize: 17, lineHeight: 22, fontFamily: "Nunito_600SemiBold" },
  bodyLarge: { fontSize: 17, lineHeight: 24, fontFamily: "Nunito_400Regular" },
  body: { fontSize: 15, lineHeight: 22, fontFamily: "Nunito_400Regular" },
  bodySmall: { fontSize: 13, lineHeight: 18, fontFamily: "Nunito_400Regular" },
  micro: { fontSize: 11, lineHeight: 14, fontFamily: "Nunito_500Medium", letterSpacing: 0.6 },
  price: { fontSize: 15, lineHeight: 22, fontFamily: "DMMono_400Regular" },
  code: { fontSize: 13, lineHeight: 18, fontFamily: "DMMono_400Regular" },
} as const;

export const motion = {
  buttonPress: 100,
  screenTransition: 250,
  sheet: 300,
  toast: 250,
  skeleton: 1500,
} as const;

export const zIndex = {
  map: 1,
  overlay: 10,
  fab: 20,
  toast: 30,
} as const;

export type HungryPalette = (typeof colors)[keyof typeof colors];
