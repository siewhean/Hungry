import { StackActions } from "@react-navigation/native";
import { useDraftExitGuard } from "@/features/post/useDraftExitGuard";
import { useLocationStore } from "@/store/useLocationStore";
import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, View, Pressable, ScrollView, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Search, MapPin, ChevronRight, Check } from "lucide-react-native";

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
import { REVIEW_TAGS } from "@/constants/taste";
import { getAccountGeneration } from "@/lib/security/accountScope";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { REVIEW_TEXT_MAX_LENGTH } from "@/lib/security/inputSanitization";
import type { ReviewStackParamList } from "@/app/navigation/navigationTypes";
import type { DishDetail, VenueSummary } from "@/types/domain";

type Props = NativeStackScreenProps<ReviewStackParamList, "ReviewMain">;

// Music is never saved and video is never uploaded with a review, so both stay prototype-only.
const reviewMusicEnabled = false;
const reviewVideoEnabled = false;

export function ReviewScreen({ navigation, route }: Props) {
  const repository = getDataRepository();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const rootNavigation = navigation.getParent()?.getParent();

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
  const proceedToExit = useDraftExitGuard({
    dirty: Boolean(draft.text || draft.rating || draft.photos.length),
    title: "Leave this review?",
    discard: resetDraft,
    dispatch: navigation.dispatch,
  });
  const searchLocation = useLocationStore((state) => state.currentLocation);
  const [intentLoading, setIntentLoading] = useState(false);
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

  const [remoteVenues, setRemoteVenues] = useState<VenueSummary[]>([]);
  const [pickerDishes, setPickerDishes] = useState<DishDetail[]>([]);
  const [pickerStatus, setPickerStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pickerRetry, setPickerRetry] = useState(0);
  const venues = remoteVenues;
  useEffect(() => {
    if (!isSearching) return;
    let current = true;
    setPickerStatus("loading");
    const service = getHungryService();
    const load = pickerVenueId
      ? Promise.all([
          service.discovery.listDishesByVenue(pickerVenueId),
          service.discovery.getVenue(pickerVenueId),
        ]).then(([dishes, venue]) => {
          if (current) {
            setPickerDishes(dishes);
            if (venue)
              setRemoteVenues((venues) => [
                ...venues.filter((item) => item.id !== venue.id),
                venue,
              ]);
          }
        })
      : service.discovery
          .searchVenuesByLocation({
            query,
            lat: searchLocation.latitude,
            lng: searchLocation.longitude,
            radiusMeters: 5000,
            limit: 30,
          })
          .then((venues) => {
            if (current) setRemoteVenues(venues ?? []);
          });
    void load
      .then(() => {
        if (current) setPickerStatus("ready");
      })
      .catch(() => {
        if (current) setPickerStatus("error");
      });
    return () => {
      current = false;
    };
  }, [
    isSearching,
    pickerVenueId,
    pickerRetry,
    query,
    searchLocation.latitude,
    searchLocation.longitude,
  ]);

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

  // A dish-only deep link must resolve its canonical venue before changing a saved draft.
  useEffect(() => {
    if (!routeDishId) return;
    let active = true;
    setIntentLoading(true);
    void getHungryService()
      .discovery.getDish(routeDishId)
      .then((dish) => {
        if (!active) return;
        if (!dish || (routeVenueId && routeVenueId !== dish.venueId))
          throw new Error("This dish is unavailable. Choose it again.");
        setRemoteDish(dish);
        const current = useReviewDraftStore.getState().draft;
        const choose = (preserve: boolean) => {
          selectDish(dish.venueId, dish.id, preserve);
          setIntentLoading(false);
        };
        if (
          current.selectedDishId &&
          current.selectedDishId !== dish.id &&
          (current.text || current.rating || current.photos.length)
        ) {
          Alert.alert(
            "Change reviewed dish?",
            "Keep your existing review content or start a new review.",
            [
              { text: "Keep editing", style: "cancel", onPress: () => setIntentLoading(false) },
              { text: "Keep content", onPress: () => choose(true) },
              { text: "Start again", style: "destructive", onPress: () => choose(false) },
            ],
          );
        } else choose(false);
      })
      .catch((error: unknown) => {
        if (active) {
          setIntentLoading(false);
          useUIStore.getState().showToast({
            message: error instanceof Error ? error.message : "Could not open this dish.",
            tone: "warning",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [routeDishId, routeVenueId, selectDish, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setReturnRoute("ReviewStack");
      rootNavigation?.navigate("AuthStack", { screen: "Login" });
    }
  }, [isAuthenticated, rootNavigation, setReturnRoute]);

  const pickerVenue = pickerVenueId
    ? (remoteVenues.find((venue) => venue.id === pickerVenueId) ??
      repository.getVenueById(pickerVenueId))
    : undefined;

  const openPicker = () => {
    setPickerVenueId(null);
    setIsSearching(true);
  };

  const closePicker = () => {
    setPickerVenueId(null);
    setIsSearching(false);
  };

  const handleSubmit = async () => {
    if (useReviewDraftStore.getState().isSubmitting) return;
    if (!selectedDish) {
      useUIStore.getState().showToast({ message: "Please select a dish first.", tone: "warning" });
      return;
    }

    const hasVideo = reviewVideoEnabled && Boolean(draft.videoUri);
    const successPayload = {
      dishName: selectedDish.name,
      venueName: selectedVenue?.name ?? selectedDish.venueName ?? "",
      pointsEarned: 0,
      xpEarned: 0,
      tagCount: draft.selectedTags.length,
      rating: draft.rating,
    };

    const generation = getAccountGeneration();
    const accountId = useSessionStore.getState().authenticatedUserId;
    setSubmitting(true);
    try {
      const receipt = await getHungryService().reviews.submitReview({
        dishId: selectedDish.id,
        venueId: selectedDish.venueId,
        rating: draft.rating,
        text: draft.text.trim(),
        tags: draft.selectedTags,
        photos: draft.photos,
        wouldRecommend: draft.recommend,
        // Reused on retry so a failed photo step never creates a second review.
        clientReviewId: ensurePendingReviewId(),
      });

      if (
        getAccountGeneration() !== generation ||
        useSessionStore.getState().authenticatedUserId !== accountId
      )
        return;
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
        media_count: draft.photos.length + (hasVideo ? 1 : 0),
        has_music: reviewMusicEnabled && !!draft.musicId,
        filter_id: draft.filterId,
      });

      useUIStore.getState().showToast({ message: "Review posted!", tone: "success" });
      useUIStore.getState().showReviewSuccess({
        ...successPayload,
        pointsEarned: receipt.pointsEarned ?? 0,
        xpEarned: 0,
      });
      resetDraft();
      proceedToExit(StackActions.popToTop());
    } catch {
      if (getAccountGeneration() !== generation) return;
      useUIStore.getState().showToast({
        message: "Could not publish review. Please try again.",
        tone: "warning",
      });
    } finally {
      if (
        getAccountGeneration() === generation &&
        useSessionStore.getState().authenticatedUserId === accountId
      )
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
        <View
          pointerEvents={isSubmitting ? "none" : "auto"}
          accessibilityState={{ busy: isSubmitting }}
          style={{ gap: spacing[6], paddingBottom: spacing[20] }}
        >
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

          {/* 5. Rating & Tags */}
          <View style={{ gap: spacing[4] }}>
            <View style={{ gap: spacing[2] }}>
              <AppText variant="h3">Overall Rating</AppText>
              <StarRating value={draft.rating} onChange={setRating} editable />
            </View>

            {
              <View style={{ gap: spacing[3] }}>
                <AppText variant="h3">Taste Tags</AppText>
                <ChipGroup
                  options={REVIEW_TAGS.map((tag) => ({ id: tag, label: tag }))}
                  selectedIds={draft.selectedTags}
                  onSelect={toggleTag}
                />
              </View>
            }

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

          {/* 4. Caption / Review Text */}
          <View style={{ gap: spacing[3] }}>
            <AppText variant="h3">Review note (optional)</AppText>
            <Input
              label="Review note"
              placeholder="What made this dish special?"
              multiline
              numberOfLines={4}
              maxLength={REVIEW_TEXT_MAX_LENGTH}
              value={draft.text}
              onChangeText={setText}
              style={{ minHeight: 100 }}
            />
          </View>

          <Button
            label="Publish Review"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!selectedDish || !draft.rating || intentLoading}
          />
        </View>
      </FeedErrorBoundary>

      {/* Search Modal Overlay */}
      {isSearching && (
        <Modal visible onRequestClose={closePicker} accessibilityViewIsModal>
          <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
            <View style={{ flex: 1, backgroundColor: palette.bg, padding: spacing[4] }}>
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
                    label="Search stalls"
                    placeholder="Search stalls..."
                    value={query}
                    onChangeText={setQuery}
                    style={{ flex: 1 }}
                    autoFocus
                  />
                )}
                <Button label="Close" variant="ghost" onPress={closePicker} />
              </View>

              {pickerStatus === "loading" ? (
                <AppText>Loading dishes and stalls…</AppText>
              ) : pickerStatus === "error" ? (
                <Button
                  label="Retry loading dishes"
                  onPress={() => setPickerRetry((value) => value + 1)}
                />
              ) : pickerVenue ? (
                <FlatList
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
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
                        if (
                          draft.selectedDishId &&
                          draft.selectedDishId !== item.id &&
                          (draft.text || draft.rating || draft.photos.length)
                        ) {
                          Alert.alert(
                            "Change reviewed dish?",
                            "Keep your review content with this dish, or start again.",
                            [
                              { text: "Keep editing", style: "cancel" },
                              {
                                text: "Keep content",
                                onPress: () => {
                                  selectDish(pickerVenue.id, item.id, true);
                                  closePicker();
                                },
                              },
                              {
                                text: "Start again",
                                style: "destructive",
                                onPress: () => {
                                  selectDish(pickerVenue.id, item.id);
                                  closePicker();
                                },
                              },
                            ],
                          );
                        } else {
                          selectDish(pickerVenue.id, item.id);
                          closePicker();
                        }
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
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
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
          </SafeAreaView>
        </Modal>
      )}
    </Screen>
  );
}
