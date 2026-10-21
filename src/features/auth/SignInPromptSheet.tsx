import { useEffect, useRef } from "react";
import { View } from "react-native";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";

import { navigationRef } from "@/app/navigation/RootNavigator";
import { AppText, BottomSheet, Button } from "@/components/ui";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { clearPendingDishSave } from "./pendingDishSave";

/**
 * One app-wide sheet for guest gates ("Sign in to save Chicken Rice"). "Create account"
 * and "Sign in" open the shared sign-up and Login screens (a new user is not made to hunt
 * for the small link on "Welcome back"); after sign-in the pending action runs once.
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
      clearPendingDishSave();
      useSessionStore.getState().setReturnRoute(undefined);
    }
    ui.closeSignInPrompt();
  };

  const openAuth = (screen: "Login" | "SignUp") => {
    goingToSignIn.current = true;
    const title = prompt?.title;
    useUIStore.getState().closeSignInPrompt();
    if (!navigationRef.isReady()) return;
    // Login says why the user is there ("Sign in to save Chicken Rice"), not "Welcome back".
    if (screen === "Login") {
      navigationRef.navigate("AuthStack", { screen: "Login", params: { title } });
    } else {
      navigationRef.navigate("AuthStack", { screen: "SignUp" });
    }
  };

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={["44%"]}
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
        <Button label="Create account" onPress={() => openAuth("SignUp")} />
        <Button label="Sign in" variant="secondary" onPress={() => openAuth("Login")} />
        <Button label="Not now" variant="ghost" onPress={() => sheetRef.current?.dismiss()} />
      </View>
    </BottomSheet>
  );
}
