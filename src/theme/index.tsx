import { PropsWithChildren, createContext, useContext, useMemo } from "react";
import {
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
  type Theme,
} from "@react-navigation/native";
import { useFonts as useNunitoFonts, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold } from "@expo-google-fonts/nunito";
import { useFonts as useMonoFonts, DMMono_400Regular } from "@expo-google-fonts/dm-mono";

import { colors, motion, radii, shadows, spacing, typography } from "./tokens";

type HungryTheme = {
  colorScheme: "light" | "dark";
  theme: Theme;
  palette: (typeof colors)[keyof typeof colors];
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: typeof shadows;
  typography: typeof typography;
  motion: typeof motion;
  fontsLoaded: boolean;
};

const ThemeContext = createContext<HungryTheme | null>(null);

export function HungryThemeProvider({ children }: PropsWithChildren) {
  const colorScheme: "light" = "light";
  const palette = colors[colorScheme];

  const [nunitoLoaded] = useNunitoFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });
  const [monoLoaded] = useMonoFonts({
    DMMono_400Regular,
  });

  const theme = useMemo<Theme>(() => {
    const base = DefaultTheme;

    return {
      ...base,
      colors: {
        ...base.colors,
        primary: palette.orange,
        background: palette.bg,
        card: palette.surface,
        text: palette.text,
        border: palette.border,
        notification: palette.orange,
      },
    };
  }, [colorScheme, palette]);

  const value = useMemo<HungryTheme>(
    () => ({
      colorScheme,
      theme,
      palette,
      spacing,
      radii,
      shadows,
      typography,
      motion,
      fontsLoaded: nunitoLoaded && monoLoaded,
    }),
    [colorScheme, theme, palette, nunitoLoaded, monoLoaded],
  );

  return (
    <ThemeContext.Provider value={value}>
      <NavigationThemeProvider value={theme}>{children}</NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useHungryTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useHungryTheme must be used within HungryThemeProvider");
  }

  return context;
}
