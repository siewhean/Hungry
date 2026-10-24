import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { Camera, Plus, Video, X } from "lucide-react-native";

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
import { askMediaSource, captureWithCamera } from "@/lib/permissions/mediaSource";
import { createClientReviewId } from "@/features/review/reviewDraft";
import { describePublishError } from "@/features/review/publishErrorCopy";
import { POST_CAPTION_MAX_LENGTH, sanitizeFreeText } from "@/lib/security/inputSanitization";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { isMerchantModeActive, useMerchantStore } from "@/store/useMerchantStore";
import { useHungryTheme } from "@/theme";
import { trackAnalyticsEvent } from "@/lib/analytics";

type Props = NativeStackScreenProps<RootStackParamList, "Post">;

/** Most media one post carries. */
const POST_MAX_MEDIA = 5;

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
  // Set once the post is published so leaving the screen skips the discard prompt.
  const hasPublishedRef = useRef(false);
  // Reused when "Publish" is tapped again after a failure, so a retry resumes the same post.
  const pendingPostIdRef = useRef<string | null>(null);
  const allDishes = useMemo(
    () =>
      repository
        .listBuildings()
        .flatMap((building) => repository.listVenuesByBuilding(building.id))
        .flatMap((item) => repository.listDishesByVenue(item.id)),
    [repository],
  );
  // Opened for a stall only (e.g. /order?venueId=): pick from that stall's dishes.
  const pickerVenueId = !selectedDishId ? selectedVenueId : null;
  const pickerVenue = pickerVenueId ? repository.getVenueById(pickerVenueId) : undefined;
  const filteredDishes = useMemo(() => {
    const query = dishSearchQuery.trim().toLowerCase();
    const candidates = pickerVenueId ? repository.listDishesByVenue(pickerVenueId) : allDishes;
    const dishes = candidates.filter((item) => {
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.venueName.toLowerCase().includes(query) ||
        item.tasteTags.some((tag) => tag.toLowerCase().includes(query)) ||
        item.dietaryFlags.some((flag) => flag.toLowerCase().includes(query))
      );
    });
    return dishes.slice(0, 12);
  }, [allDishes, dishSearchQuery, pickerVenueId, repository]);

  useEffect(() => {
    if (route.params?.dishId) {
      setSelectedDishId(route.params.dishId);
    }
    if (route.params?.venueId) {
      setSelectedVenueId(route.params.venueId);
    }
  }, [route.params?.dishId, route.params?.venueId]);

  // Never guess the dish from the venue: a venue-only entry shows the picker.
  const dish = useMemo(
    () => (selectedDishId ? (repository.getDishById(selectedDishId) ?? null) : null),
    [repository, selectedDishId],
  );
  const venue = useMemo(() => {
    if (!dish) {
      return selectedVenueId ? repository.getVenueById(selectedVenueId) : undefined;
    }
    if (selectedVenueId) {
      return repository.getVenueById(selectedVenueId) ?? repository.getVenueById(dish.venueId);
    }
    return repository.getVenueById(dish.venueId);
  }, [dish, repository, selectedVenueId]);

  const addPickedMedia = (assets: ImagePicker.ImagePickerAsset[]) => {
    const media = assets.map((asset, index) => ({
      id: asset.assetId ?? `${asset.uri}-${index}`,
      uri: asset.uri,
      type: asset.type === "video" ? ("video" as const) : ("image" as const),
      width: asset.width,
      height: asset.height,
    }));
    // New picks are added after the earlier ones instead of replacing them.
    setSelectedMedia((current) => {
      const existingUris = new Set(current.map((item) => item.uri));
      const added = media.filter((item) => !existingUris.has(item.uri));
      return [...current, ...added].slice(0, POST_MAX_MEDIA);
    });
    showToast({ message: "Media attached.", tone: "success" });
  };

  const handlePickMedia = async () => {
    const remaining = POST_MAX_MEDIA - selectedMedia.length;
    if (remaining <= 0) {
      showToast({ message: `Up to ${POST_MAX_MEDIA} photos or videos.`, tone: "info" });
      return;
    }

    const source = await askMediaSource("Add media");
    if (!source) return;

    if (source === "camera") {
      const capture = await captureWithCamera({
        mediaTypes: ["images", "videos"],
        quality: 0.92,
        videoMaxDuration: 60,
      });
      if (capture.status === "denied") {
        showToast({ message: "Camera permission is required to take a photo.", tone: "warning" });
      } else if (capture.status === "ok") {
        addPickedMedia(capture.assets);
      }
      return;
    }

    // The system photo picker needs no library permission; it only returns what is picked.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.92,
      selectionLimit: remaining,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }
    addPickedMedia(result.assets);
  };

  const handleRemoveMedia = (id: string) => {
    setSelectedMedia((current) => current.filter((item) => item.id !== id));
  };

  const hasUnsavedWork = caption.trim().length > 0 || selectedMedia.length > 0;
  // Read when the discard is confirmed, so the listener is not re-registered on every keystroke.
  const selectedMediaCountRef = useRef(0);
  const captionLengthRef = useRef(0);
  useEffect(() => {
    selectedMediaCountRef.current = selectedMedia.length;
    captionLengthRef.current = caption.trim().length;
  }, [selectedMedia.length, caption]);
  useEffect(() => {
    if (!hasUnsavedWork) return undefined;
    return navigation.addListener("beforeRemove", (event) => {
      if (hasPublishedRef.current) return;
      event.preventDefault();
      Alert.alert("Discard this post?", "Your photos and caption will not be saved.", [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            trackAnalyticsEvent("post_abandoned", {
              dish_id: selectedDishId ?? undefined,
              media_count: selectedMediaCountRef.current,
              has_caption: captionLengthRef.current > 0,
            });
            navigation.dispatch(event.data.action);
          },
        },
      ]);
    });
  }, [hasUnsavedWork, navigation, selectedDishId]);

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
        pendingPostIdRef.current ??= createClientReviewId();
        await publishComposerPost({
          publishMode: "post",
          routeDishId: targetDish.id,
          routeVenueId: targetVenue?.id ?? targetDish.venueId,
          clientPostId: pendingPostIdRef.current,
        });
        pendingPostIdRef.current = null;
        showToast({
          message: "Post published successfully.",
          tone: "success",
        });
        useComposerStore.getState().reset();
        hasPublishedRef.current = true;
        trackAnalyticsEvent("post_published", {
          dish_id: targetDish.id,
          venue_id: targetVenue?.id ?? targetDish.venueId,
          media_count: selectedMedia.length,
          has_video: selectedMedia.some((item) => item.type === "video"),
        });
        navigation.navigate("MainTabs", { screen: "Home" });
      } catch (error) {
        // The composer store is shared with the V2 composer: never leave this draft in it.
        useComposerStore.getState().reset();
        trackAnalyticsEvent("post_publish_failed", {
          dish_id: targetDish.id,
          venue_id: targetVenue?.id ?? targetDish.venueId,
          media_count: selectedMedia.length,
          reason: (error as { code?: string } | null)?.code ?? "publish_failed",
        });
        showToast({ message: describePublishError(error, "post"), tone: "warning" });
      } finally {
        setIsPublishing(false);
      }
    })();
  };

  if (!dish) {
    return (
      <Screen
        keyboardAvoiding
        title="Create post"
        subtitle={
          pickerVenue
            ? `Which dish from ${pickerVenue.name} is this post about?`
            : "Choose the dish this post is about, then add your photo or video."
        }
      >
        <View style={{ gap: spacing[3] }}>
          {pickerVenue ? (
            <Button
              label="Search all stalls"
              variant="ghost"
              fullWidth={false}
              onPress={() => setSelectedVenueId(null)}
            />
          ) : null}
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
    <Screen keyboardAvoiding title="Create post" subtitle="Share a photo or video of what you ate.">
      <Card>
        <View style={{ gap: spacing[3] }}>
          <Badge label="Photo or video" tone="neutral" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <View style={{ flex: 1 }}>
              <AppText variant="h3">{dish.name}</AppText>
              <AppText tone="secondary">{venue?.name ?? "Nearby stall"}</AppText>
            </View>
            <Button
              label="Change"
              variant="ghost"
              size="sm"
              fullWidth={false}
              accessibilityLabel={`Change dish, currently ${dish.name}`}
              onPress={() => setSelectedDishId(null)}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[2] }}
          >
            {selectedMedia.map((item) => (
              <View
                key={item.id}
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove selected ${item.type === "video" ? "video" : "photo"}`}
                  onPress={() => handleRemoveMedia(item.id)}
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: palette.mediaScrim,
                  }}
                >
                  <X size={18} color={palette.white} />
                </Pressable>
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={selectedMedia.length ? "Add more post media" : "Add post media"}
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
                {selectedMedia.length ? "Add more" : "Add media"}
              </AppText>
            </Pressable>
          </ScrollView>
          <Input
            label="Caption"
            multiline
            numberOfLines={5}
            placeholder="What makes this dish special?"
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
