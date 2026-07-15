import { useEffect, useState } from "react";
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
import { getHungryService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useUIStore } from "@/store/useUIStore";
import { useMerchantStore } from "@/store/useMerchantStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail, VenueSummary } from "@/types/domain";

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
  const isMerchantMode = useMerchantStore((state) => Boolean(state.account));
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);
  const isUserMode = !isMerchantMode && !isDeveloperMode;
  const shouldShowComposerBusinessFeatures = !isUserMode;
  const hungryService = getHungryService();
  const profile = useProfileStore((state) => state.profile);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const [caption, setCaption] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>([]);
  const [selectedDishId, setSelectedDishId] = useState<string | null>(route.params?.dishId ?? null);
  const [dishSearchQuery, setDishSearchQuery] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [dish, setDish] = useState<DishDetail | null>(null);
  const [venue, setVenue] = useState<VenueSummary | undefined>();
  const [filteredDishes, setFilteredDishes] = useState<DishDetail[]>([]);
  const [dishSearchStatus, setDishSearchStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [dishSearchAttempt, setDishSearchAttempt] = useState(0);

  useEffect(() => {
    if (route.params?.dishId) {
      setSelectedDishId(route.params.dishId);
    }
  }, [route.params?.dishId]);

  useEffect(() => {
    let active = true;
    if (!selectedDishId) {
      setDish(null);
      setVenue(undefined);
      return () => {
        active = false;
      };
    }

    void hungryService.discovery
      .getDish(selectedDishId)
      .then(async (nextDish) => {
        if (!active) return;
        setDish(nextDish ?? null);
        if (!nextDish) return;
        const nextVenue = await hungryService.discovery.getVenue(nextDish.venueId);
        if (active) setVenue(nextVenue);
      })
      .catch(() => {
        if (active) setDish(null);
      });

    return () => {
      active = false;
    };
  }, [hungryService, selectedDishId]);

  useEffect(() => {
    if (dish) return undefined;
    let active = true;
    setDishSearchStatus("loading");
    const timer = setTimeout(() => {
      void hungryService.discovery
        .searchDishes(
          {
            query: dishSearchQuery.trim(),
            categories: [],
            dietaryFlags: profile.dietaryPreferences,
            tasteValues: profile.tasteVector,
            radius: 100000,
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            openOnly: false,
          },
          profile.tasteVector,
        )
        .then((results) => {
          if (!active) return;
          setFilteredDishes(results.slice(0, 12).map((result) => result.dish));
          setDishSearchStatus("ready");
        })
        .catch(() => {
          if (!active) return;
          setFilteredDishes([]);
          setDishSearchStatus("error");
        });
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    currentLocation.latitude,
    currentLocation.longitude,
    dish,
    dishSearchAttempt,
    dishSearchQuery,
    hungryService,
    profile.dietaryPreferences,
    profile.tasteVector,
  ]);

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
        composer.setCaption(caption.trim() || targetDish.name);
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
                        {item.venueName}
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
                        setDish(item);
                      }}
                    />
                  </View>
                </Card>
              );
            })
          ) : dishSearchStatus === "loading" ? (
            <AppText tone="secondary" style={{ textAlign: "center", padding: spacing[6] }}>
              Loading source-backed dishes…
            </AppText>
          ) : dishSearchStatus === "error" ? (
            <EmptyState
              title="Unable to load dishes"
              body="Check your connection and try again."
              ctaLabel="Retry"
              onPress={() => setDishSearchAttempt((attempt) => attempt + 1)}
            />
          ) : (
            <EmptyState title="No dishes found" body="Try a dish name or stall name." />
          )}
        </View>
      </Screen>
    );
  }

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
            onChangeText={(value) => setCaption(sanitizeFreeText(value, POST_CAPTION_MAX_LENGTH))}
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
