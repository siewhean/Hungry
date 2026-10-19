import { useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { WheelStackParamList } from "@/app/navigation/navigationTypes";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useWheelStore } from "@/store/useWheelStore";
import { WheelHomeScreen } from "./WheelHomeScreen";
import { WheelLobbyScreen } from "./WheelLobbyScreen";
import { WheelSpinScreen } from "./WheelSpinScreen";
import { WheelResultModal } from "./WheelResultModal";
export type { WheelStackParamList } from "@/app/navigation/navigationTypes";

const Stack = createNativeStackNavigator<WheelStackParamList>();

export function WheelStack() {
  useEffect(() => {
    trackAnalyticsEvent("wheel_opened");
    // Leaving the wheel any way (back, swipe, tab change that removes the stack)
    // closes the party channel and clears its state.
    return () => useWheelStore.getState().leaveParty();
  }, []);

  return (
    <Stack.Navigator initialRouteName="WheelHome" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WheelHome" component={WheelHomeScreen} />
      <Stack.Screen name="WheelLobby" component={WheelLobbyScreen} />
      <Stack.Screen name="WheelSpin" component={WheelSpinScreen} />
      <Stack.Screen
        name="WheelResult"
        component={WheelResultModal}
        options={{ presentation: "transparentModal" }}
      />
    </Stack.Navigator>
  );
}
