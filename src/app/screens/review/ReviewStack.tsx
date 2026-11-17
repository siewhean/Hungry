import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { ReviewStackParamList } from "@/app/navigation/navigationTypes";
import { ReviewScreen } from "./ReviewScreen";
export type { ReviewStackParamList } from "@/app/navigation/navigationTypes";

const Stack = createNativeStackNavigator<ReviewStackParamList>();

export function ReviewStack() {
  return (
    <Stack.Navigator initialRouteName="ReviewMain" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ReviewMain" component={ReviewScreen} />
    </Stack.Navigator>
  );
}
