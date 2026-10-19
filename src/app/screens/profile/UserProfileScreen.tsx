import { UserProfileContent } from "./UserProfileContent";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

type UserProfileScreenRouteProps = NativeStackScreenProps<RootStackParamList, "UserProfile">;

// Rendered directly: going through ProfileHomeScreen ran all of the viewer's own profile loads.
export function UserProfileScreen({ navigation, route }: UserProfileScreenRouteProps) {
  return (
    <UserProfileContent
      navigation={navigation}
      authorName={route.params.authorName}
      authorAvatarUrl={route.params.authorAvatarUrl}
      authorId={route.params.authorId}
    />
  );
}
