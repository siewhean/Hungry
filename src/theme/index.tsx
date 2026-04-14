import { PropsWithChildren, createContext, useContext, useMemo, useState, useEffect } from "react";
import { Appearance, ColorSchemeName } from "react-native";
import {
  DefaultTheme,
  DarkTheme,
  ThemeProvider as NavigationThemeProvider,
  type Theme,
} from "@react-navigation/native";
import { useFonts as useNunitoFonts, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold } from "@expo-google-fonts/nunito";
import { useFonts as useMonoFonts, DMMono_400Regular } from "@expo-google-fonts/dm-mono";

import { useUIStore } from "@/store/useUIStore";
import { colors, motion, radii, shadows, spacing, typography, zIndex } from "./tokens";

type HungryTheme = {
  colorScheme: "light" | "dark";
  theme: Theme;
  palette: (typeof colors)[keyof typeof colors];
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: typeof shadows;
  typography: typeof typography;
  motion: typeof motion;
  zIndex: typeof zIndex;
  fontsLoaded: boolean;
};

const ThemeContext = createContext<HungryTheme | null>(null);

export function HungryThemeProvider({ children }: PropsWithChildren) {
  const themePreference = useUIStore((state) => state.themePreference);
  
  // Track system color scheme via Appearance API for maximum reliability
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  // Resolve active color scheme
  const colorScheme = useMemo(() => {
    if (themePreference === "light") return "light";
    if (themePreference === "dark") return "dark";
    // Default to light if system preference is null/undefined
    return systemScheme === "dark" ? "dark" : "light";
  }, [themePreference, systemScheme]);

  const palette = colors[colorScheme];
  
  const themedShadows = useMemo(
    () => ({
      card: {
        ...shadows.card,
        shadowColor: palette.navy,
      },
      floating: {
        ...shadows.floating,
        shadowColor: palette.navy,
      },
      bottomSheet: {
        ...shadows.bottomSheet,
        shadowColor: palette.navy,
      },
    }),
    [palette],
  );

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
    const base = colorScheme === "dark" ? DarkTheme : DefaultTheme;

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
      shadows: themedShadows,
      typography,
      motion,
      zIndex,
      fontsLoaded: nunitoLoaded && monoLoaded,
    }),
    [colorScheme, theme, palette, themedShadows, nunitoLoaded, monoLoaded],
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
