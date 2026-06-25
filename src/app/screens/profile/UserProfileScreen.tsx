import { ProfileHomeScreen } from "./ProfileHomeScreen";

import type { ProfileStackParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import type { NavigationProp } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

type UserProfileScreenRouteProps = NativeStackScreenProps<RootStackParamList, "UserProfile">;

export function UserProfileScreen({ navigation, route }: UserProfileScreenRouteProps) {
  return (
    <ProfileHomeScreen
      navigation={
        navigation as unknown as NavigationProp<RootStackParamList & ProfileStackParamList>
      }
      mode="other"
      authorName={route.params.authorName}
      authorAvatarUrl={route.params.authorAvatarUrl}
      authorId={route.params.authorId}
      reviewSignalLabel={route.params.reviewSignalLabel}
    />
  );
}
