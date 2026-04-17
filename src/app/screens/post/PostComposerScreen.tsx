import { useMemo, useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Badge, Button, Card, Input, Screen } from "@/components/ui";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Post">;

export function PostComposerScreen({ navigation, route }: Props) {
  const { spacing } = useHungryTheme();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);
  const repository = getDataRepository();
  const [caption, setCaption] = useState("");
  const fallbackDish = useMemo(() => repository.listPopularNearby()[0], [repository]);
  const dish = useMemo(() => {
    if (route.params?.dishId) {
      return repository.getDishById(route.params.dishId) ?? fallbackDish;
    }
    if (route.params?.venueId) {
      return repository.listDishesByVenue(route.params.venueId)[0] ?? fallbackDish;
    }
    return fallbackDish;
  }, [fallbackDish, repository, route.params?.dishId, route.params?.venueId]);
  const venue = useMemo(() => {
    if (route.params?.venueId) {
      return repository.getVenueById(route.params.venueId) ?? repository.getVenueById(dish.venueId);
    }
    return repository.getVenueById(dish.venueId);
  }, [dish.venueId, repository, route.params?.venueId]);

  const handlePublish = () => {
    if (!isAuthenticated) {
      setReturnRoute("Post");
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }

    showToast({
      message: "Post created in the local mock flow.",
      tone: "success",
    });
    navigation.navigate("MainTabs", { screen: "Home" });
  };

  return (
    <Screen
      title="Create post"
      subtitle="Share a quick dish update without turning the app into a creator platform."
    >
      <Card>
        <View style={{ gap: spacing[3] }}>
          <Badge label="Photo or video" tone="neutral" />
          <AppText variant="h3">{dish.name}</AppText>
          <AppText tone="secondary">{venue?.name ?? "Nearby stall"}</AppText>
          <Input
            label="Caption"
            multiline
            numberOfLines={5}
            placeholder="What makes this worth the queue?"
            value={caption}
            onChangeText={setCaption}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {dish.tasteTags.slice(0, 3).map((tag) => (
              <Badge key={tag} label={tag} tone="neutral" />
            ))}
          </View>
        </View>
      </Card>
      <Button label="Publish post" onPress={handlePublish} />
      <Button
        label="Save draft for later"
        variant="secondary"
        onPress={() => showToast({ message: "Draft saved locally.", tone: "info" })}
      />
    </Screen>
  );
}
