import { useEffect } from "react";

import { UserProfileContent } from "./UserProfileContent";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { useProfileStore } from "@/store/useProfileStore";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

type UserProfileScreenRouteProps = NativeStackScreenProps<RootStackParamList, "UserProfile">;

// Rendered directly: going through ProfileHomeScreen ran all of the viewer's own profile loads.
export function UserProfileScreen({ navigation, route }: UserProfileScreenRouteProps) {
  const viewerId = useProfileStore((state) => state.profile.id);
  const isSelf = Boolean(route.params.authorId && route.params.authorId === viewerId);

  // Your own avatar or name opens your own Profile tab, not a stranger view of yourself.
  useEffect(() => {
    if (!isSelf) return;
    navigation.popTo("MainTabs", { screen: "Profile", params: { screen: "ProfileHome" } });
  }, [isSelf, navigation]);

  if (isSelf) return null;

  return (
    <UserProfileContent
      navigation={navigation}
      authorName={route.params.authorName}
      authorAvatarUrl={route.params.authorAvatarUrl}
      authorId={route.params.authorId}
    />
  );
}
