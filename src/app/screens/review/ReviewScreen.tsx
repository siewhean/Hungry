import { useEffect, useMemo, useState } from "react";
import { View, Pressable, ScrollView, FlatList, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Search, MapPin, ChevronRight, Check, Music } from "lucide-react-native";

import {
  AccessibleImage,
  AppText,
  Button,
  Card,
  Input,
  Screen,
  Badge,
  ChipGroup,
  FeedErrorBoundary,
} from "@/components/ui";
import { MediaPicker, StarRating } from "@/components/review";
import { TRENDING_MUSIC } from "@/features/review/musicData";
import { REVIEW_TAGS } from "@/constants/taste";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useMerchantStore } from "@/store/useMerchantStore";
import { useHungryTheme } from "@/theme";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { REVIEW_TEXT_MAX_LENGTH, sanitizeFreeText } from "@/lib/security/inputSanitization";
import type { ReviewStackParamList } from "@/app/navigation/navigationTypes";
import type { DishDetail } from "@/types/domain";

type Props = NativeStackScreenProps<ReviewStackParamList, "ReviewMain">;

// Music is never saved and video is never uploaded with a review, so both stay prototype-only.
const reviewMusicEnabled = FEATURE_FLAGS.prototypeRoutesEnabled;
const reviewVideoEnabled = FEATURE_FLAGS.prototypeRoutesEnabled;

export function ReviewScreen({ navigation, route }: Props) {
  const repository = getDataRepository();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const rootNavigation = navigation.getParent()?.getParent();
  const isMerchantMode = useMerchantStore((state) => Boolean(state.account));
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);
  const isUserMode = !isMerchantMode && !isDeveloperMode;

  // Store state
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const draft = useReviewDraftStore((state) => state.draft);
  const isSubmitting = useReviewDraftStore((state) => state.isSubmitting);
  const selectDish = useReviewDraftStore((state) => state.selectDish);
  const setRating = useReviewDraftStore((state) => state.setRating);
  const toggleTag = useReviewDraftStore((state) => state.toggleTag);
  const setRecommend = useReviewDraftStore((state) => state.setRecommend);
  const setText = useReviewDraftStore((state) => state.setText);
  const addPhoto = useReviewDraftStore((state) => state.addPhoto);
  const removePhoto = useReviewDraftStore((state) => state.removePhoto);
  const setVideoUri = useReviewDraftStore((state) => state.setVideoUri);
  const setFilterId = useReviewDraftStore((state) => state.setFilterId);
  const setSubmitting = useReviewDraftStore((state) => state.setSubmitting);
  const resetDraft = useReviewDraftStore((state) => state.resetDraft);
  const ensurePendingReviewId = useReviewDraftStore((state) => state.ensurePendingReviewId);

  // Local state
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [pickerVenueId, setPickerVenueId] = useState<string | null>(null);
  const [remoteDish, setRemoteDish] = useState<DishDetail | undefined>(undefined);

  // Derived data
  const routeDishId = route.params?.dishId || undefined;
  const routeVenueId = route.params?.venueId || undefined;
  const selectedDishId = draft.selectedDishId || routeDishId;
  const selectedDish = useMemo(() => {
    if (!selectedDishId) return undefined;
    return (
      repository.getDishById(selectedDishId) ??
      (remoteDish?.id === selectedDishId ? remoteDish : undefined)
    );
  }, [repository, selectedDishId, remoteDish]);
  const selectedVenue = useMemo(
    () => repository.getVenueById(draft.selectedVenueId || selectedDish?.venueId || ""),
    [repository, draft.selectedVenueId, selectedDish?.venueId],
  );

  const venues = repository
    .listBuildings()
    .flatMap((building) => repository.listVenuesByBuilding(building.id))
    .filter((venue) =>
      `${venue.name} ${venue.unitNumber}`.toLowerCase().includes(query.trim().toLowerCase()),
    );

  // Opened for a stall without a dish: ask which dish instead of guessing.
  useEffect(() => {
    if (routeVenueId && !routeDishId && !draft.selectedDishId) {
      setPickerVenueId(routeVenueId);
      setIsSearching(true);
    }
    // Only when the route changes; picking a dish clears the picker itself.
  }, [routeVenueId, routeDishId]);

  // Cold legacy cache: the sync repository may not have the routed dish yet.
  useEffect(() => {
    if (!selectedDishId || repository.getDishById(selectedDishId)) return;
    let active = true;
    getHungryService()
      .discovery.getDish(selectedDishId)
      .then((dish) => {
        if (active && dish) setRemoteDish(dish);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [repository, selectedDishId]);

  // selectDish is a no-op when the dish is already selected, so this cannot loop.
  useEffect(() => {
    if (routeDishId && routeVenueId) {
      selectDish(routeVenueId, routeDishId);
    }
  }, [routeDishId, routeVenueId, selectDish]);

  useEffect(() => {
    if (!isAuthenticated) {
      setReturnRoute("ReviewStack");
      rootNavigation?.navigate("AuthStack", { screen: "Login" });
    }
  }, [isAuthenticated, rootNavigation, setReturnRoute]);

  const pickerVenue = pickerVenueId ? repository.getVenueById(pickerVenueId) : undefined;
  const pickerDishes = pickerVenue ? repository.listDishesByVenue(pickerVenue.id) : [];

  const openPicker = () => {
    setPickerVenueId(null);
    setIsSearching(true);
  };

  const closePicker = () => {
    setPickerVenueId(null);
    setIsSearching(false);
  };

  const handleSubmit = async () => {
    if (!selectedDish) {
      useUIStore.getState().showToast({ message: "Please select a dish first.", tone: "warning" });
      return;
    }

    const hasVideo = reviewVideoEnabled && Boolean(draft.videoUri);
    const reviewScore =
      25 + draft.selectedTags.length * 5 + draft.photos.length * 10 + (hasVideo ? 20 : 0);
    const successPayload = {
      dishName: selectedDish.name,
      venueName: selectedVenue?.name ?? selectedDish.venueName ?? "",
      pointsEarned: reviewScore,
      xpEarned: reviewScore,
      tagCount: draft.selectedTags.length,
      rating: draft.rating,
    };

    const reviewText = sanitizeFreeText(draft.text, REVIEW_TEXT_MAX_LENGTH);
    setSubmitting(true);
    try {
      await getHungryService().reviews.submitReview({
        dishId: selectedDish.id,
        venueId: selectedDish.venueId,
        rating: draft.rating,
        text: reviewText,
        tags: draft.selectedTags,
        photos: draft.photos,
        wouldRecommend: draft.recommend,
        // Reused on retry so a failed photo step never creates a second review.
        clientReviewId: ensurePendingReviewId(),
      });

      useProfileStore.getState().addReviewedDish(selectedDish.id);
      useProfileStore.getState().addReview(selectedDish);
      useProfileStore.getState().recordReviewEntry(selectedDish.id, {
        rating: draft.rating,
        text: reviewText,
        tags: draft.selectedTags,
      });

      trackAnalyticsEvent("review_submitted", {
        dish_id: selectedDish.id,
        venue_id: selectedDish.venueId,
        media_count: draft.photos.length + (hasVideo ? 1 : 0),
        has_music: reviewMusicEnabled && !!draft.musicId,
        filter_id: draft.filterId,
      });

      useUIStore.getState().showToast({ message: "Review posted!", tone: "success" });
      useUIStore.getState().showReviewSuccess(successPayload);
      resetDraft();
      navigation.popToTop();
    } catch {
      useUIStore.getState().showToast({
        message: "Could not publish review. Please try again.",
        tone: "warning",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Screen title="Write a review" subtitle="Share your latest meal with the community." scroll>
      <FeedErrorBoundary
        title="Review editor failed"
        body="We hit a snag loading the editor. Please try again."
      >
        <View style={{ gap: spacing[6], paddingBottom: spacing[20] }}>
          {/* 1. Media Picker & Reels */}
          <MediaPicker
            photos={draft.photos}
            videoUri={reviewVideoEnabled ? draft.videoUri : undefined}
            filterId={draft.filterId}
            onAddPhoto={addPhoto}
            onRemovePhoto={removePhoto}
            onSetVideo={reviewVideoEnabled ? setVideoUri : undefined}
            onSetFilter={setFilterId}
          />

          {/* 2. Music Picker (Navigation Button) */}
          {reviewMusicEnabled ? (
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
                      {selectedVenue?.name ?? selectedDish.venueName}
                    </AppText>
                  </View>
                  <Button label="Change" variant="ghost" onPress={openPicker} />
                </View>
              </Card>
            ) : (
              <Button
                label="Select Stall & Dish"
                variant="secondary"
                onPress={openPicker}
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
              onChangeText={setText}
              style={{ minHeight: 100 }}
            />
          </View>

          {/* 5. Rating & Tags */}
          <View style={{ gap: spacing[4] }}>
            <View style={{ gap: spacing[2] }}>
              <AppText variant="h3">Overall Rating</AppText>
              <StarRating value={draft.rating} onChange={setRating} editable />
            </View>

            {!isUserMode && (
              <View style={{ gap: spacing[3] }}>
                <AppText variant="h3">Taste Tags</AppText>
                <ChipGroup
                  options={REVIEW_TAGS.map((tag) => ({ id: tag, label: tag }))}
                  selectedIds={draft.selectedTags}
                  onSelect={toggleTag}
                />
              </View>
            )}

            <View style={{ gap: spacing[3] }}>
              <AppText variant="h3">Recommendation</AppText>
              <View style={{ flexDirection: "row", gap: spacing[3] }}>
                <Button
                  label="Recommend"
                  variant={draft.recommend ? "primary" : "secondary"}
                  onPress={() => setRecommend(true)}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Skip"
                  variant={!draft.recommend ? "primary" : "secondary"}
                  onPress={() => setRecommend(false)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>

          <Button
            label="Publish Review"
            onPress={handleSubmit}
            loading={isSubmitting}
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
              {pickerVenue ? (
                <>
                  <Button label="Back" variant="ghost" onPress={() => setPickerVenueId(null)} />
                  <AppText variant="h3" style={{ flex: 1 }} numberOfLines={1}>
                    {pickerVenue.name}
                  </AppText>
                </>
              ) : (
                <Input
                  placeholder="Search stalls..."
                  value={query}
                  onChangeText={setQuery}
                  style={{ flex: 1 }}
                  autoFocus
                />
              )}
              <Button label="Close" variant="ghost" onPress={closePicker} />
            </View>

            {pickerVenue ? (
              <FlatList
                data={pickerDishes}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                  <AppText tone="secondary">No dishes listed for this stall yet.</AppText>
                }
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Review ${item.name}`}
                    onPress={() => {
                      selectDish(pickerVenue.id, item.id);
                      closePicker();
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
                      <AppText style={{ fontWeight: "600", flex: 1 }}>{item.name}</AppText>
                      {draft.selectedDishId === item.id ? (
                        <Check size={18} color={palette.orange} />
                      ) : null}
                    </View>
                  </Pressable>
                )}
              />
            ) : (
              <FlatList
                data={venues}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Choose a dish at ${item.name}`}
                      onPress={() => setPickerVenueId(item.id)}
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
                        <View>
                          <AppText style={{ fontWeight: "600" }}>{item.name}</AppText>
                          <AppText variant="bodySmall" tone="secondary">
                            {item.unitNumber}
                          </AppText>
                        </View>
                        <ChevronRight size={18} color={palette.textMuted} />
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}
