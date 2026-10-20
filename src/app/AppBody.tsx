import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { RootNavigator } from "@/app/navigation/RootNavigator";
import { PreAuthNavigator } from "@/app/navigation/PreAuthNavigator";
import { getReleasedSupabaseConfigurationError } from "@/lib/services/supabase/client";
import { isE2eDeveloperLauncherRequested } from "@/lib/runtime/e2eDeveloperLauncher";
import { useSessionStore } from "@/store/useSessionStore";
import { SignInPromptSheet } from "@/features/auth/SignInPromptSheet";

const APP_SHELL_FONT_GRACE_MS = 900;

export function AppBody() {
  const isBootstrapReady = useAppBootstrap();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const isAuthReady = useSessionStore((state) => state.isAuthReady);
  const passwordRecoveryInProgress = useSessionStore((state) => state.passwordRecoveryInProgress);
  const { colorScheme, theme, palette, spacing, fontsLoaded } = useHungryTheme();
  const [fontGraceReached, setFontGraceReached] = useState(false);
  const configurationError = getReleasedSupabaseConfigurationError();
  const isE2eDeveloperLauncherAvailable = isE2eDeveloperLauncherRequested();
  const wantsRootNavigator = isAuthenticated || isE2eDeveloperLauncherAvailable;
  // A password-recovery code exchange signs the user in before the new password
  // is saved. Hold whichever navigator is mounted until recovery finishes so the
  // reset form (and its success screen) is not unmounted by the auth swap.
  const mountedNavigatorIsRoot = useRef(wantsRootNavigator);
  if (!passwordRecoveryInProgress) mountedNavigatorIsRoot.current = wantsRootNavigator;
  const showRootNavigator = passwordRecoveryInProgress
    ? mountedNavigatorIsRoot.current
    : wantsRootNavigator;

  useEffect(() => {
    if (fontsLoaded) {
      setFontGraceReached(false);
      return;
    }

    const timeout = setTimeout(() => setFontGraceReached(true), APP_SHELL_FONT_GRACE_MS);
    return () => clearTimeout(timeout);
  }, [fontsLoaded]);

  const centeredMessage = (title: string, body?: string) => (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.bg,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing[3],
        paddingHorizontal: spacing[6],
      }}
    >
      <AppText variant="h3" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      {body ? (
        <AppText tone="secondary" style={{ textAlign: "center" }}>
          {body}
        </AppText>
      ) : null}
    </View>
  );

  if (!fontsLoaded && !fontGraceReached) {
    return centeredMessage("Loading fonts…");
  }

  if (configurationError) {
    return centeredMessage(
      "Hungry is temporarily unavailable",
      `${configurationError} Install the latest build or contact Hungry support.`,
    );
  }

  if (!isBootstrapReady || !isAuthReady) {
    return centeredMessage("Connecting securely…");
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <BottomSheetModalProvider>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        {showRootNavigator ? <RootNavigator theme={theme} /> : <PreAuthNavigator theme={theme} />}
        {/* Backstop only: the app is sign-in only, but a session can expire mid-use. */}
        <SignInPromptSheet />
      </BottomSheetModalProvider>
    </View>
  );
}
