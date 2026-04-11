export const colors = {
  light: {
    bg: "#FFFFFF",
    bgMuted: "#FFFFFF",
    bgSoft: "#F8EFE4",
    surface: "#FFFFFF",
    surfaceRaised: "#FFF9F3",
    text: "#1A2E44",
    textSecondary: "#41566F",
    textMuted: "#6F7D8D",
    border: "#E7DED4",
    orange: "#E8531E",
    orangeDark: "#CD0302",
    orangeLight: "#FFF1E6",
    navy: "#1A2E44",
    amber: "#F5A623",
    amberLight: "#FFF3DB",
    teal: "#14B8A6",
    success: "#4F7E17",
    successSoft: "#EEF5E5",
    warning: "#C78712",
    warningSoft: "#FFF3DB",
    error: "#CD0302",
    errorSoft: "#FDE3E2",
    info: "#1A2E44",
    infoSoft: "#EAF0F6",
    mapBg: "#FFFFFF",
    mapRoadPrimary: "#FFFFFF",
    mapRoadSecondary: "#E7DED4",
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
    teal: "#14B8A6",
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
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  floating: {
    shadowColor: "#111827",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontFamily: "Nunito_700Bold" },
  h1: { fontSize: 26, lineHeight: 32, fontFamily: "Nunito_700Bold" },
  h2: { fontSize: 22, lineHeight: 28, fontFamily: "Nunito_600SemiBold" },
  h3: { fontSize: 19, lineHeight: 24, fontFamily: "Nunito_600SemiBold" },
  bodyLarge: { fontSize: 18, lineHeight: 26, fontFamily: "Nunito_400Regular" },
  body: { fontSize: 16, lineHeight: 24, fontFamily: "Nunito_400Regular" },
  bodySmall: { fontSize: 14, lineHeight: 22, fontFamily: "Nunito_400Regular" },
  micro: { fontSize: 12, lineHeight: 16, fontFamily: "Nunito_500Medium", letterSpacing: 0.6 },
  price: { fontSize: 16, lineHeight: 24, fontFamily: "DMMono_400Regular" },
  code: { fontSize: 14, lineHeight: 22, fontFamily: "DMMono_400Regular" },
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
