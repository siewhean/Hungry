import { useEffect, useState } from "react";
import { View, Pressable, FlatList, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Search, MapPin, ChevronRight, Music } from "lucide-react-native";

import {
  AccessibleImage,
  AppText,
  Button,
  Card,
  Input,
  Screen,
  Badge,
  ChipGroup,
  EmptyState,
  FeedErrorBoundary,
} from "@/components/ui";
import { MediaPicker, StarRating } from "@/components/review";
import { TRENDING_MUSIC } from "@/features/review/musicData";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { REVIEW_TAGS } from "@/constants/taste";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useMerchantStore } from "@/store/useMerchantStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme } from "@/theme";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { REVIEW_TEXT_MAX_LENGTH } from "@/lib/security/inputSanitization";
import type { ReviewStackParamList } from "@/app/navigation/navigationTypes";
import type { DishDetail, VenueSummary } from "@/types/domain";

type Props = NativeStackScreenProps<ReviewStackParamList, "ReviewMain">;

export function ReviewScreen({ navigation, route }: Props) {
  const hungryService = getHungryService();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const rootNavigation = navigation.getParent()?.getParent();
  const isMerchantMode = useMerchantStore((state) => Boolean(state.account));
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);
  const isUserMode = !isMerchantMode && !isDeveloperMode;
  const reviewRichMediaEnabled = FEATURE_FLAGS.reviewRichMediaEnabled;

  // Store state
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const draft = useReviewDraftStore((state) => state.draft);
  const actions = useReviewDraftStore();
  const profile = useProfileStore((state) => state.profile);
  const currentLocation = useLocationStore((state) => state.currentLocation);

  // Local state
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDish, setSelectedDish] = useState<DishDetail | undefined>();
  const [selectedVenue, setSelectedVenue] = useState<VenueSummary | undefined>();
  const [pickerDishes, setPickerDishes] = useState<DishDetail[]>([]);
  const [pickerStatus, setPickerStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [pickerLoadAttempt, setPickerLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    if (!draft.selectedDishId) {
      setSelectedDish(undefined);
      setSelectedVenue(undefined);
      return () => {
        active = false;
      };
    }

    void hungryService.discovery
      .getDish(draft.selectedDishId)
      .then(async (dish) => {
        if (!active) return;
        setSelectedDish(dish);
        if (!dish) {
          setSelectedVenue(undefined);
          return;
        }
        const venue = await hungryService.discovery.getVenue(dish.venueId);
        if (active) setSelectedVenue(venue);
      })
      .catch(() => {
        if (!active) return;
        setSelectedDish(undefined);
        setSelectedVenue(undefined);
      });

    return () => {
      active = false;
    };
  }, [draft.selectedDishId, hungryService]);

  useEffect(() => {
    if (!isSearching) return undefined;
    let active = true;
    setPickerStatus("loading");
    const timer = setTimeout(() => {
      void hungryService.discovery
        .searchDishes(
          {
            query: query.trim(),
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
          setPickerDishes(results.map((result) => result.dish));
          setPickerStatus("ready");
        })
        .catch(() => {
          if (!active) return;
          setPickerDishes([]);
          setPickerStatus("error");
        });
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    currentLocation.latitude,
    currentLocation.longitude,
    hungryService,
    isSearching,
    profile.dietaryPreferences,
    profile.tasteVector,
    pickerLoadAttempt,
    query,
  ]);

  useEffect(() => {
    if (route.params?.dishId && route.params?.venueId) {
      actions.selectDish(route.params.venueId, route.params.dishId);
    }
  }, [route.params?.dishId, route.params?.venueId, actions]);

  useEffect(() => {
    if (!isAuthenticated) {
      setReturnRoute("ReviewStack");
      rootNavigation?.navigate("AuthStack", { screen: "Login" });
    }
  }, [isAuthenticated, rootNavigation, setReturnRoute]);

  const handleSubmit = async () => {
    if (!selectedDish) {
      useUIStore.getState().showToast({ message: "Please select a dish first.", tone: "warning" });
      return;
    }

    const successPayload = {
      dishName: selectedDish.name,
      venueName: selectedVenue?.name ?? "",
      pointsEarned:
        25 +
        draft.selectedTags.length * 5 +
        draft.photos.length * 10 +
        (reviewRichMediaEnabled && draft.videoUri ? 20 : 0),
      xpEarned:
        25 +
        draft.selectedTags.length * 5 +
        draft.photos.length * 10 +
        (reviewRichMediaEnabled && draft.videoUri ? 20 : 0),
      tagCount: draft.selectedTags.length,
      rating: draft.rating,
    };

    actions.setSubmitting(true);
    try {
      await getHungryService().reviews.submitReview({
        dishId: selectedDish.id,
        venueId: selectedDish.venueId,
        rating: draft.rating,
        text: draft.text.trim(),
        tags: draft.selectedTags,
        photos: draft.photos,
        recommend: draft.recommend,
      });

      useProfileStore.getState().addReviewedDish(selectedDish.id);
      useProfileStore.getState().addReview(selectedDish);
      useProfileStore.getState().recordReviewEntry(selectedDish.id, {
        rating: draft.rating,
        text: draft.text,
        tags: draft.selectedTags,
      });

      trackAnalyticsEvent("review_submitted", {
        dish_id: selectedDish.id,
        venue_id: selectedDish.venueId,
        media_count: draft.photos.length + (reviewRichMediaEnabled && draft.videoUri ? 1 : 0),
        has_music: reviewRichMediaEnabled && Boolean(draft.musicId),
        filter_id: reviewRichMediaEnabled ? draft.filterId : undefined,
      });

      useUIStore.getState().showToast({ message: "Review posted!", tone: "success" });
      useUIStore.getState().showReviewSuccess(successPayload);
      actions.resetDraft();
      navigation.popToTop();
    } catch {
      useUIStore.getState().showToast({
        message: "Could not publish review. Please try again.",
        tone: "warning",
      });
    } finally {
      actions.setSubmitting(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Screen title="Create Post" subtitle="Share your latest meal with the community." scroll>
      <FeedErrorBoundary
        title="Review editor failed"
        body="We hit a snag loading the editor. Please try again."
      >
        <View style={{ gap: spacing[6], paddingBottom: spacing[20] }}>
          {/* 1. Media Picker & Reels */}
          <MediaPicker
            photos={draft.photos}
            videoUri={draft.videoUri}
            filterId={draft.filterId}
            richMediaEnabled={reviewRichMediaEnabled}
            onAddPhoto={actions.addPhoto}
            onRemovePhoto={actions.removePhoto}
            onSetVideo={actions.setVideoUri}
            onSetFilter={actions.setFilterId}
          />

          {/* 2. Music Picker (Navigation Button) */}
          {reviewRichMediaEnabled ? (
            <View style={{ gap: spacing[3] }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                <Music size={18} color={palette.orange} />
                <AppText variant="h3">Music</AppText>
              </View>

              {draft.musicId ? (
                <Card
                  style={{
                    padding: spacing[3],
                    backgroundColor: palette.orangeLight,
                    borderColor: palette.orange,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyBold">
                        {TRENDING_MUSIC.find((m) => m.id === draft.musicId)?.title ??
                          "Selected Track"}
                      </AppText>
                      <AppText variant="micro" tone="secondary">
                        {TRENDING_MUSIC.find((m) => m.id === draft.musicId)?.artist ?? "Artist"}
                      </AppText>
                    </View>
                    <Button
                      label="Change"
                      variant="ghost"
                      size="sm"
                      onPress={() => navigation.navigate("MusicSelection" as any)}
                    />
                  </View>
                </Card>
              ) : (
                <Button
                  label="Add Music"
                  variant="secondary"
                  onPress={() => navigation.navigate("MusicSelection" as any)}
                  leftIcon={<Music size={18} color={palette.text} />}
                />
              )}
            </View>
          ) : null}

          {/* 3. Location & Food Selection */}
          <View style={{ gap: spacing[3] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <MapPin size={18} color={palette.orange} />
              <AppText variant="h3">Where did you eat?</AppText>
            </View>

            {selectedDish ? (
              <Card
                style={{
                  padding: spacing[3],
                  backgroundColor: palette.bgSoft,
                  borderColor: palette.orange,
                }}
              >
                <View style={{ flexDirection: "row", gap: spacing[3], alignItems: "center" }}>
                  <AccessibleImage
                    source={{ uri: selectedDish.imageUrl }}
                    style={{ width: 60, height: 60, borderRadius: radii.md }}
                    accessibilityLabel={`${selectedDish.name} photo`}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontWeight: "700" }}>{selectedDish.name}</AppText>
                    <AppText variant="bodySmall" tone="secondary">
                      {selectedVenue?.name}
                    </AppText>
                  </View>
                  <Button label="Change" variant="ghost" onPress={() => setIsSearching(true)} />
                </View>
              </Card>
            ) : (
              <Button
                label="Select Stall & Dish"
                variant="secondary"
                onPress={() => setIsSearching(true)}
                leftIcon={<Search size={18} color={palette.text} />}
              />
            )}
          </View>

          {/* 4. Caption / Review Text */}
          <View style={{ gap: spacing[3] }}>
            <AppText variant="h3">Caption</AppText>
            <Input
              placeholder="What made this dish special?"
              multiline
              numberOfLines={4}
              maxLength={REVIEW_TEXT_MAX_LENGTH}
              value={draft.text}
              onChangeText={actions.setText}
              style={{ minHeight: 100 }}
            />
          </View>

          {/* 5. Rating & Tags */}
          <View style={{ gap: spacing[4] }}>
            <View style={{ gap: spacing[2] }}>
              <AppText variant="h3">Overall Rating</AppText>
              <StarRating value={draft.rating} onChange={actions.setRating} editable />
            </View>

            {!isUserMode && (
              <View style={{ gap: spacing[3] }}>
                <AppText variant="h3">Taste Tags</AppText>
                <ChipGroup
                  options={REVIEW_TAGS.map((tag) => ({ id: tag, label: tag }))}
                  selectedIds={draft.selectedTags}
                  onSelect={actions.toggleTag}
                />
              </View>
            )}

            <View style={{ gap: spacing[3] }}>
              <AppText variant="h3">Recommendation</AppText>
              <View style={{ flexDirection: "row", gap: spacing[3] }}>
                <Button
                  label="Recommend"
                  variant={draft.recommend ? "primary" : "secondary"}
                  onPress={() => actions.setRecommend(true)}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Skip"
                  variant={!draft.recommend ? "primary" : "secondary"}
                  onPress={() => actions.setRecommend(false)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>

          <Button
            label="Publish Review"
            onPress={handleSubmit}
            loading={actions.isSubmitting}
            disabled={!selectedDish || !draft.rating}
          />
        </View>
      </FeedErrorBoundary>

      {/* Search Modal Overlay */}
      {isSearching && (
        <View style={StyleSheet.absoluteFill}>
          <View
            style={{ flex: 1, backgroundColor: palette.bg, padding: spacing[4], paddingTop: 60 }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[3],
                marginBottom: spacing[4],
              }}
            >
              <Input
                placeholder="Search dishes or stalls..."
                value={query}
                onChangeText={setQuery}
                style={{ flex: 1 }}
                autoFocus
              />
              <Button label="Close" variant="ghost" onPress={() => setIsSearching(false)} />
            </View>

            <FlatList
              data={pickerDishes}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                pickerStatus === "loading" ? (
                  <AppText tone="secondary" style={{ textAlign: "center", padding: spacing[6] }}>
                    Loading nearby dishes…
                  </AppText>
                ) : pickerStatus === "error" ? (
                  <EmptyState
                    title="Unable to load dishes"
                    body="Check your connection or try another search."
                    ctaLabel="Retry"
                    onPress={() => setPickerLoadAttempt((attempt) => attempt + 1)}
                  />
                ) : (
                  <EmptyState title="No dishes found" body="Try another dish or stall name." />
                )
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${item.name} at ${item.venueName}`}
                  onPress={() => {
                    actions.selectDish(item.venueId, item.id);
                    setSelectedDish(item);
                    setIsSearching(false);
                  }}
                  style={{
                    paddingVertical: spacing[3],
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText style={{ fontWeight: "600" }}>{item.name}</AppText>
                      <AppText variant="bodySmall" tone="secondary">
                        {item.venueName} · {item.priceRange}
                      </AppText>
                    </View>
                    <ChevronRight size={18} color={palette.textMuted} />
                  </View>
                </Pressable>
              )}
            />
          </View>
        </View>
      )}
    </Screen>
  );
}
