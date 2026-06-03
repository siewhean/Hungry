import { ProfileHomeScreen } from "./ProfileHomeScreen";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

type UserProfileScreenRouteProps = NativeStackScreenProps<RootStackParamList, "UserProfile">;

export function UserProfileScreen({ navigation, route }: UserProfileScreenRouteProps) {
  return (
    <ProfileHomeScreen
      navigation={navigation}
      mode="other"
      authorName={route.params.authorName}
      authorAvatarUrl={route.params.authorAvatarUrl}
      authorId={route.params.authorId}
      reviewSignalLabel={route.params.reviewSignalLabel}
    />
  );
}
