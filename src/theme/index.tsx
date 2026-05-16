import { PropsWithChildren, createContext, useContext, useMemo, useState, useEffect } from "react";
import { AppState, Appearance, useColorScheme } from "react-native";
import {
  DefaultTheme,
  DarkTheme,
  ThemeProvider as NavigationThemeProvider,
  type Theme,
} from "@react-navigation/native";
import {
  useFonts as useNunitoFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from "@expo-google-fonts/nunito";
import { useFonts as useMonoFonts, DMMono_400Regular } from "@expo-google-fonts/dm-mono";
import {
  useFonts as useFrauncesFonts,
  Fraunces_700Bold,
  Fraunces_900Black,
} from "@expo-google-fonts/fraunces";

import { useUIStore } from "@/store/useUIStore";
import {
  colors,
  componentCornerCurve,
  componentRadii,
  componentSizes,
  motion,
  opacity,
  radii,
  shadows,
  spacing,
  semanticSpacing,
  typography,
  zIndex,
} from "./tokens";

type HungryTheme = {
  colorScheme: "light" | "dark";
  theme: Theme;
  palette: (typeof colors)[keyof typeof colors];
  spacing: typeof spacing;
  semanticSpacing: typeof semanticSpacing;
  radii: typeof radii;
  shadows: typeof shadows;
  typography: typeof typography;
  motion: typeof motion;
  zIndex: typeof zIndex;
  componentSizes: typeof componentSizes;
  componentRadii: typeof componentRadii;
  componentCornerCurve: typeof componentCornerCurve;
  opacity: typeof opacity;
  fontsLoaded: boolean;
};

type AppColorScheme = "light" | "dark";

const ThemeContext = createContext<HungryTheme | null>(null);

export function HungryThemeProvider({ children }: PropsWithChildren) {
  const themePreference = useUIStore((state) => state.themePreference);
  const hookScheme = useColorScheme();

  // Track system color scheme via Appearance API for maximum reliability
  const [systemScheme, setSystemScheme] = useState<AppColorScheme>(
    Appearance.getColorScheme() === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === "dark" ? "dark" : "light");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setSystemScheme(Appearance.getColorScheme() === "dark" ? "dark" : "light");
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (themePreference === "system") {
      return;
    }
  }, [themePreference]);

  const resolvedSystemScheme: AppColorScheme =
    hookScheme === "dark" || hookScheme === "light" ? hookScheme : systemScheme;

  // Resolve active color scheme
  const colorScheme = useMemo(() => {
    if (themePreference === "light") return "light";
    if (themePreference === "dark") return "dark";
    // system mode: fall back to light only if the OS doesn't report a scheme.
    return resolvedSystemScheme === "dark" ? "dark" : "light";
  }, [themePreference, resolvedSystemScheme]);

  const palette = colors[colorScheme];

  const themedShadows = useMemo(
    () => ({
      card: {
        ...shadows.card,
        shadowColor: palette.navy as any,
      },
      floating: {
        ...shadows.floating,
        shadowColor: palette.navy as any,
      },
      bottomSheet: {
        ...shadows.bottomSheet,
        shadowColor: palette.navy as any,
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
  const [frauncesLoaded] = useFrauncesFonts({
    Fraunces_700Bold,
    Fraunces_900Black,
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
      semanticSpacing,
      radii,
      shadows: themedShadows,
      typography,
      motion,
      zIndex,
      componentSizes,
      componentRadii,
      componentCornerCurve,
      opacity,
      fontsLoaded: nunitoLoaded && monoLoaded && frauncesLoaded,
    }),
    [colorScheme, theme, palette, themedShadows, nunitoLoaded, monoLoaded, frauncesLoaded],
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
