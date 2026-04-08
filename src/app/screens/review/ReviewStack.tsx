import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { ReviewStackParamList } from "@/app/navigation/navigationTypes";
import { ReviewComposeScreen } from "./ReviewComposeScreen";
import { ReviewHubScreen } from "./ReviewHubScreen";
import { ReviewRatingScreen } from "./ReviewRatingScreen";
import { ReviewTagsScreen } from "./ReviewTagsScreen";
export type { ReviewStackParamList } from "@/app/navigation/navigationTypes";

const Stack = createNativeStackNavigator<ReviewStackParamList>();

export function ReviewStack() {
  return (
    <Stack.Navigator initialRouteName="ReviewHub" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ReviewHub" component={ReviewHubScreen} />
      <Stack.Screen name="ReviewRating" component={ReviewRatingScreen} />
      <Stack.Screen name="ReviewTags" component={ReviewTagsScreen} />
      <Stack.Screen name="ReviewCompose" component={ReviewComposeScreen} />
    </Stack.Navigator>
  );
}
