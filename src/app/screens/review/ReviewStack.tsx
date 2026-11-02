import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ChoiceSheetHost } from "@/components/ui";
import type { ReviewStackParamList } from "@/app/navigation/navigationTypes";
import { ReviewScreen } from "./ReviewScreen";
export type { ReviewStackParamList } from "@/app/navigation/navigationTypes";

const Stack = createNativeStackNavigator<ReviewStackParamList>();

export function ReviewStack() {
  return (
    <>
      <Stack.Navigator initialRouteName="ReviewMain" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ReviewMain" component={ReviewScreen} />
      </Stack.Navigator>
      {/* The Post card covers the root, so its sheets (Add a photo) must be presented from here. */}
      <ChoiceSheetHost />
    </>
  );
}
