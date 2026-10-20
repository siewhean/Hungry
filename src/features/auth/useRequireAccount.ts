import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { useSessionStore, type PendingRoute } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";

// Guests can browse; anything that saves needs an account. Returns true when signed
// in. Otherwise it asks the guest to sign in and returns them to `returnRoute` after.
export function useRequireAccount() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);

  return useCallback(
    (message: string, returnRoute: string | PendingRoute) => {
      if (isAuthenticated) return true;
      setReturnRoute(returnRoute);
      showToast({ message, tone: "warning" });
      navigation.navigate("AuthStack", { screen: "Login" });
      return false;
    },
    [isAuthenticated, navigation, setReturnRoute, showToast],
  );
}
