import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Camera, Plus, Video } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AccessibleImage,
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  FeedErrorBoundary,
  Input,
  Screen,
} from "@/components/ui";
import { publishComposerPost } from "@/features/post/publishing";
import { useComposerStore, type MediaItem } from "@/features/post/useComposerStore";
import { confirmGalleryAccess, isGalleryPermissionGranted } from "@/lib/permissions/gallery";
import { POST_CAPTION_MAX_LENGTH, sanitizeFreeText } from "@/lib/security/inputSanitization";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { isMerchantModeActive, useMerchantStore } from "@/store/useMerchantStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Post">;

function loadImagePickerModule() {
  try {
    return require("expo-image-picker") as {
      MediaTypeOptions: { All: string };
      requestMediaLibraryPermissionsAsync: () => Promise<{ status: string }>;
      launchImageLibraryAsync: (options: {
        allowsMultipleSelection: boolean;
        mediaTypes: string;
        quality: number;
        selectionLimit: number;
        videoMaxDuration: number;
      }) => Promise<{
        canceled: boolean;
        assets?: {
          assetId?: string | null;
          uri: string;
          type?: "image" | "video" | string | null;
          width?: number;
          height?: number;
        }[];
      }>;
    };
  } catch {
    return null;
  }
}

function PostComposerScreenInner({ navigation, route }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);
  const isMerchantMode = useMerchantStore(isMerchantModeActive);
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);
  const isUserMode = !isMerchantMode && !isDeveloperMode;
  const shouldShowComposerBusinessFeatures = !isUserMode;
  const repository = getDataRepository();
  const [caption, setCaption] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>([]);
  const [selectedDishId, setSelectedDishId] = useState<string | null>(route.params?.dishId ?? null);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(
    route.params?.venueId ?? null,
  );
  const [dishSearchQuery, setDishSearchQuery] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const allDishes = useMemo(
    () =>
      repository
        .listBuildings()
        .flatMap((building) => repository.listVenuesByBuilding(building.id))
        .flatMap((item) => repository.listDishesByVenue(item.id)),
    [repository],
  );
  const filteredDishes = useMemo(() => {
    const query = dishSearchQuery.trim().toLowerCase();
    const dishes = allDishes.filter((item) => {
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.venueName.toLowerCase().includes(query) ||
        item.tasteTags.some((tag) => tag.toLowerCase().includes(query)) ||
        item.dietaryFlags.some((flag) => flag.toLowerCase().includes(query))
      );
    });
    return dishes.slice(0, 12);
  }, [allDishes, dishSearchQuery]);

  useEffect(() => {
    if (route.params?.dishId) {
      setSelectedDishId(route.params.dishId);
    }
    if (route.params?.venueId) {
      setSelectedVenueId(route.params.venueId);
    }
  }, [route.params?.dishId, route.params?.venueId]);

  const dish = useMemo(() => {
    if (selectedDishId) {
      return repository.getDishById(selectedDishId) ?? null;
    }
    if (selectedVenueId) {
      return repository.listDishesByVenue(selectedVenueId)[0] ?? null;
    }
    return null;
  }, [repository, selectedDishId, selectedVenueId]);
  const venue = useMemo(() => {
    if (!dish) {
      return selectedVenueId ? repository.getVenueById(selectedVenueId) : undefined;
    }
    if (selectedVenueId) {
      return repository.getVenueById(selectedVenueId) ?? repository.getVenueById(dish.venueId);
    }
    return repository.getVenueById(dish.venueId);
  }, [dish, repository, selectedVenueId]);

  const handlePickMedia = async () => {
    const shouldRequestPermission = await confirmGalleryAccess({
      title: "Allow gallery access",
      message: "Hungry needs access to your photo library to add media to your post.",
      confirmLabel: "Allow",
      cancelLabel: "Not now",
    });

    if (!shouldRequestPermission) {
      return;
    }

    const imagePicker = loadImagePickerModule();
    if (!imagePicker) {
      showToast({
        message: "Media picker unavailable right now.",
        tone: "warning",
      });
      return;
    }

    const permission = await imagePicker.requestMediaLibraryPermissionsAsync();
    if (!isGalleryPermissionGranted(permission)) {
      showToast({
        message: "Photo permission is required to publish a post.",
        tone: "warning",
      });
      return;
    }

    const result = await imagePicker.launchImageLibraryAsync({
      mediaTypes: imagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.92,
      selectionLimit: 5,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const media = result.assets.map((asset, index) => ({
      id: asset.assetId ?? `${asset.uri}-${index}`,
      uri: asset.uri,
      type: asset.type === "video" ? ("video" as const) : ("image" as const),
      width: asset.width,
      height: asset.height,
    }));
    setSelectedMedia(media);
    showToast({ message: "Media attached.", tone: "success" });
  };

  const handleRemoveMedia = (id: string) => {
    setSelectedMedia((current) => current.filter((item) => item.id !== id));
  };

  const handlePublish = () => {
    if (!isAuthenticated) {
      setReturnRoute(
        dish
          ? {
              name: "Post",
              params: { dishId: dish.id, venueId: venue?.id ?? dish.venueId },
            }
          : "Post",
      );
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }

    const targetDish = dish;
    const targetVenue = venue;
    if (!targetDish) {
      showToast({ message: "Choose a dish before publishing.", tone: "warning" });
      return;
    }

    void (async () => {
      setIsPublishing(true);
      try {
        const composer = useComposerStore.getState();
        composer.reset();
        composer.setActiveTab("post");
        composer.setCaption(sanitizeFreeText(caption, POST_CAPTION_MAX_LENGTH) || targetDish.name);
        composer.addMedia(selectedMedia);
        await publishComposerPost({
          publishMode: "post",
          routeDishId: targetDish.id,
          routeVenueId: targetVenue?.id ?? targetDish.venueId,
        });
        showToast({
          message: "Post published successfully.",
          tone: "success",
        });
        useComposerStore.getState().reset();
        navigation.navigate("MainTabs", { screen: "Home" });
      } catch (error) {
        showToast({
          message: error instanceof Error ? error.message : "Could not publish post right now.",
          tone: "warning",
        });
      } finally {
        setIsPublishing(false);
      }
    })();
  };

  if (!dish) {
    return (
      <Screen
        title="Create post"
        subtitle="Choose the dish this post is about, then add your photo or video."
      >
        <View style={{ gap: spacing[3] }}>
          <Input
            label="Find dish"
            placeholder="Search dishes, stalls, or tags"
            value={dishSearchQuery}
            onChangeText={setDishSearchQuery}
            accessibilityLabel="Find a dish to post about"
          />
          {filteredDishes.length ? (
            filteredDishes.map((item) => {
              const itemVenue = repository.getVenueById(item.venueId);
              return (
                <Card key={item.id}>
                  <View style={{ flexDirection: "row", gap: spacing[3], alignItems: "center" }}>
                    <AccessibleImage
                      source={{ uri: item.imageUrl }}
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: componentRadii.card,
                        backgroundColor: palette.bgSoft,
                      }}
                      contentFit="cover"
                      accessibilityLabel={`${item.name} dish photo`}
                    />
                    <View style={{ flex: 1, gap: spacing[1] }}>
                      <AppText variant="bodyBold">{item.name}</AppText>
                      <AppText variant="bodySmall" tone="secondary">
                        {itemVenue?.name ?? item.venueName}
                      </AppText>
                      {shouldShowComposerBusinessFeatures && (
                        <AppText variant="micro" tone="secondary">
                          {item.tasteTags.slice(0, 3).join(" · ")}
                        </AppText>
                      )}
                    </View>
                    <Button
                      label="Choose"
                      size="sm"
                      fullWidth={false}
                      onPress={() => {
                        setSelectedDishId(item.id);
                        setSelectedVenueId(item.venueId);
                      }}
                    />
                  </View>
                </Card>
              );
            })
          ) : (
            <EmptyState title="No dishes found" body="Try a dish name or stall name." />
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Create post" subtitle="Share a photo or video of what you ate.">
      <Card>
        <View style={{ gap: spacing[3] }}>
          <Badge label="Photo or video" tone="neutral" />
          <AppText variant="h3">{dish.name}</AppText>
          <AppText tone="secondary">{venue?.name ?? "Nearby stall"}</AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[2] }}
          >
            {selectedMedia.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel="Remove selected media"
                onPress={() => handleRemoveMedia(item.id)}
                style={{
                  width: 128,
                  height: 128,
                  borderRadius: componentRadii.card,
                  overflow: "hidden",
                  backgroundColor: palette.bgSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {item.type === "video" ? (
                  <View style={{ alignItems: "center", gap: spacing[1] }}>
                    <Video size={24} color={palette.textMuted} />
                    <AppText variant="bodySmall" tone="secondary">
                      Video selected
                    </AppText>
                  </View>
                ) : (
                  <AccessibleImage
                    source={{ uri: item.uri }}
                    style={{ height: "100%", width: "100%" }}
                    contentFit="cover"
                    accessibilityLabel="Selected post image"
                  />
                )}
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={selectedMedia.length ? "Replace post media" : "Add post media"}
              onPress={() => {
                void handlePickMedia();
              }}
              style={{
                width: 128,
                height: 128,
                borderRadius: componentRadii.card,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.bgSoft,
                alignItems: "center",
                justifyContent: "center",
                gap: spacing[1],
              }}
            >
              {selectedMedia.length ? (
                <Plus size={24} color={palette.orange} />
              ) : (
                <Camera size={24} color={palette.orange} />
              )}
              <AppText variant="bodySmall" style={{ color: palette.orange, fontWeight: "800" }}>
                {selectedMedia.length ? "Replace" : "Add media"}
              </AppText>
            </Pressable>
          </ScrollView>
          <Input
            label="Caption"
            multiline
            numberOfLines={5}
            placeholder="What makes this worth the queue?"
            value={caption}
            maxLength={POST_CAPTION_MAX_LENGTH}
            onChangeText={setCaption}
          />
          {shouldShowComposerBusinessFeatures && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              {dish.tasteTags.slice(0, 3).map((tag) => (
                <Badge key={tag} label={tag} tone="neutral" />
              ))}
            </View>
          )}
        </View>
      </Card>
      <Button
        label="Publish post"
        loading={isPublishing}
        disabled={selectedMedia.length === 0}
        onPress={handlePublish}
      />
    </Screen>
  );
}

export function PostComposerScreen(props: Props) {
  return (
    <FeedErrorBoundary
      title="Post composer failed"
      body="We hit a snag loading the post composer. Please try again."
      screenName="PostComposerScreen"
    >
      <PostComposerScreenInner {...props} />
    </FeedErrorBoundary>
  );
}
