import { useEffect, useRef } from "react";
import { View } from "react-native";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";

import { navigationRef } from "@/app/navigation/RootNavigator";
import { AppText, BottomSheet, Button } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

/**
 * One app-wide sheet for guest gates ("Sign in to save Chicken Rice"). "Sign in"
 * opens the shared Login screen; after sign-in the pending action runs once.
 * "Not now" (or swiping the sheet away) drops the action and the return route.
 */
export function SignInPromptSheet() {
  const { spacing } = useHungryTheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const goingToSignIn = useRef(false);
  const prompt = useUIStore((state) => state.signInPrompt);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (prompt) {
      goingToSignIn.current = false;
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [prompt]);

  // RootNavigator returns to the gated screen on sign-in; finish the action after that.
  useEffect(() => {
    if (!isAuthenticated) return;
    const action = useUIStore.getState().takePendingAuthAction();
    if (!action) return;
    const timer = setTimeout(action, 0);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  const handleDismiss = () => {
    const ui = useUIStore.getState();
    if (!goingToSignIn.current) {
      ui.takePendingAuthAction();
      useSessionStore.getState().setReturnRoute(undefined);
    }
    ui.closeSignInPrompt();
  };

  const handleSignIn = () => {
    goingToSignIn.current = true;
    useUIStore.getState().closeSignInPrompt();
    if (navigationRef.isReady()) {
      navigationRef.navigate("AuthStack", { screen: "Login" });
    }
  };

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={["34%"]}
      accessibilityLabel="Sign in to continue"
      onDismiss={handleDismiss}
    >
      <View style={{ gap: spacing[3] }}>
        <AppText variant="h3" accessibilityRole="header">
          {prompt?.title ?? "Sign in to continue"}
        </AppText>
        <AppText tone="secondary">
          We&apos;ll finish this for you as soon as you&apos;re signed in.
        </AppText>
        <Button label="Sign in" onPress={handleSignIn} />
        <Button label="Not now" variant="ghost" onPress={() => sheetRef.current?.dismiss()} />
      </View>
    </BottomSheet>
  );
}
