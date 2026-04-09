import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { EmptyState, Screen } from "@/components/ui";

type Props = NativeStackScreenProps<RootStackParamList, "NotFound">;

export function NotFoundScreen({ navigation, route }: Props) {
  return (
    <Screen title="Not found" subtitle="The requested resource or handoff could not be completed.">
      <EmptyState
        title={route.params?.title ?? "Nothing here yet"}
        body={
          route.params?.body ??
          "The frontend flow is wired, but this destination does not exist in the current mock dataset."
        }
        ctaLabel="Go back home"
        onPress={() => navigation.navigate("MainTabs", { screen: "Home" })}
      />
    </Screen>
  );
}
