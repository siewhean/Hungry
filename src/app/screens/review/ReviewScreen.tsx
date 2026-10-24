import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  View,
  type LayoutChangeEvent,
  type ScrollView,
} from "react-native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  Skeleton,
} from "@/components/ui";
import { MediaPicker, StarRating, TasteRatingInput } from "@/components/review";
import { TRENDING_MUSIC } from "@/features/review/musicData";
import { REVIEW_EDITOR_TAGS, REVIEW_MAX_TAGS, TASTE_DIMENSIONS } from "@/constants/taste";
import { perceivedTasteLevel, standardTasteRating } from "@/features/detail/perceivedTaste";
import { reportError } from "@/lib/monitoring/reportError";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useReviewDraftHydrated, useReviewDraftStore } from "@/store/useReviewDraftStore";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { describePublishError, isExpectedPublishError } from "@/features/review/publishErrorCopy";
import { normalizeReviewTags } from "@/features/review/reviewEdit";
import {
  buildDishPickerRows,
  formatPickerDistance,
  type PickerRow,
} from "@/features/review/dishPicker";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { REVIEW_TEXT_MAX_LENGTH, sanitizeFreeText } from "@/lib/security/inputSanitization";
import {
  REVIEW_PHOTOS_NOT_ATTACHED,
  firstMissingReviewField,
  resolveWouldRecommend,
  type ReviewRequiredField,
  reviewDraftHasContent,
} from "@/features/review/reviewDraft";
import type { ReviewStackParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import type { DishDetail, TasteKey } from "@/types/domain";

type Props = NativeStackScreenProps<ReviewStackParamList, "ReviewMain">;

// Music is never saved and video is never uploaded with a review, so the editor hides both
// (Reels and Music) in every build until they ship.
const reviewMusicEnabled = false;
const reviewVideoEnabled = false;

export function ReviewScreen({ navigation, route }: Props) {
  const repository = getDataRepository();
  const { palette, radii, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  // The editor is mounted under the root stack and under the Profile stack;
  // navigate() bubbles up to whichever navigator owns AuthStack.
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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
  const setSubmitting = useReviewDraftStore((state) => state.setSubmitting);
  const resetDraft = useReviewDraftStore((state) => state.resetDraft);
  const ensurePendingReviewId = useReviewDraftStore((state) => state.ensurePendingReviewId);
  // The saved draft loads asynchronously; acting on the route before it has would let the
  // old draft land on top of the dish the person just chose.
  const draftHydrated = useReviewDraftHydrated();

  // Local state
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [pickerVenueId, setPickerVenueId] = useState<string | null>(null);
  const [remoteDish, setRemoteDish] = useState<DishDetail | undefined>(undefined);
  const scrollRef = useRef<ScrollView>(null) as RefObject<ScrollView>;
  const sectionYRef = useRef<Partial<Record<ReviewRequiredField, number>>>({});

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
  // Optional "How did it taste?": what the reviewer felt, per taste, on the 0-10 scale.
  // Saved with the draft and kept per dish, so picking another dish starts blank.
  const feltTasteState = useReviewDraftStore((state) => state.feltTaste);
  const setFeltTaste = useReviewDraftStore((state) => state.setFeltTaste);
  const clearFeltTaste = useReviewDraftStore((state) => state.clearFeltTaste);
  const feltTaste = useMemo<Partial<Record<TasteKey, number>>>(
    () => (feltTasteState.dishId === selectedDishId ? feltTasteState.values : {}),
    [feltTasteState, selectedDishId],
  );
  const userTasteVector = useProfileStore((state) => state.profile.tasteVector);
  // Our guess: the dish's standard level as this reviewer is likely to feel it.
  const tasteSuggestions = useMemo(() => {
    const dishVector = selectedDish?.tasteVector;
    if (!dishVector) return undefined;
    return Object.fromEntries(
      TASTE_DIMENSIONS.map(({ key }) => [
        key,
        perceivedTasteLevel(dishVector[key] ?? 0, userTasteVector?.[key]),
      ]),
    ) as Partial<Record<TasteKey, number>>;
  }, [selectedDish?.tasteVector, userTasteVector]);
  const selectedVenue = useMemo(
    () => repository.getVenueById(draft.selectedVenueId || selectedDish?.venueId || ""),
    [repository, draft.selectedVenueId, selectedDish?.venueId],
  );

  const allVenues = useMemo(
    () =>
      repository
        .listBuildings()
        .flatMap((building) => repository.listVenuesByBuilding(building.id)),
    [repository],
  );
  const allPickerDishes = useMemo(
    () =>
      allVenues.flatMap((venue) =>
        repository.listDishesByVenue(venue.id).map((dish) => ({
          id: dish.id,
          name: dish.name,
          venueId: venue.id,
          venueName: venue.name,
        })),
      ),
    [allVenues, repository],
  );
  const buildingCoordinates = useMemo(
    () => new Map(repository.listBuildings().map((building) => [building.id, building.coordinate])),
    [repository],
  );
  const permission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const pickerOrigin = useMemo(() => {
    const { coordinate, isApproximate } = getEffectiveLocation({
      permission,
      currentLocation,
      manualCoordinate,
    });
    // The built-in default is not "you": no nearby ordering from it.
    return isApproximate ? undefined : coordinate;
  }, [permission, currentLocation, manualCoordinate]);
  const pickerRows = useMemo(
    () =>
      buildDishPickerRows({
        venues: allVenues,
        dishes: allPickerDishes,
        query,
        origin: pickerOrigin,
        buildingCoordinates,
      }),
    [allVenues, allPickerDishes, query, pickerOrigin, buildingCoordinates],
  );

  // The route says what to review. A saved draft for something else never
  // silently wins (or is silently wiped): ask when it has content.
  const handledRouteKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draftHydrated) return;
    if (!routeDishId && !routeVenueId) return;
    const routeKey = `${routeVenueId ?? ""}|${routeDishId ?? ""}`;
    if (handledRouteKeyRef.current === routeKey) return;
    handledRouteKeyRef.current = routeKey;

    const routeVenueForDish =
      routeVenueId ?? (routeDishId ? repository.getDishById(routeDishId)?.venueId : undefined);
    // Read after hydration: the render-time draft may still be the empty initial one.
    const draft = useReviewDraftStore.getState().draft;
    const draftMatchesRoute = routeDishId
      ? draft.selectedDishId === routeDishId
      : draft.selectedVenueId === routeVenueId;
    if (draftMatchesRoute) return;

    const startFromRoute = () => {
      // Start from an empty draft (selectDish keeps content when no dish was
      // picked yet, so reset first).
      resetDraft();
      if (routeDishId && routeVenueForDish) {
        selectDish(routeVenueForDish, routeDishId);
        return;
      }
      // Opened for a stall without a dish: ask which dish instead of guessing.
      if (routeVenueId) {
        setPickerVenueId(routeVenueId);
        setIsSearching(true);
      }
    };

    if (!reviewDraftHasContent(draft)) {
      startFromRoute();
      return;
    }
    const previousDishName = draft.selectedDishId
      ? (repository.getDishById(draft.selectedDishId)?.name ?? "your last dish")
      : undefined;
    Alert.alert(
      "Unfinished review",
      previousDishName
        ? `You started a review of ${previousDishName}. Continue it, or start a new one here?`
        : "You have an unfinished review. Continue it, or start a new one here?",
      [
        {
          text: previousDishName ? `Continue ${previousDishName}` : "Continue",
          style: "cancel",
        },
        { text: "Start new", onPress: startFromRoute },
      ],
    );
    // Only when the route changes (or once the saved draft has loaded).
  }, [routeVenueId, routeDishId, draftHydrated]);

  // Cold legacy cache: the sync repository may not have the routed dish yet.
  useEffect(() => {
    if (!selectedDishId || repository.getDishById(selectedDishId)) return;
    let active = true;
    getHungryService()
      .discovery.getDish(selectedDishId)
      .then((dish) => {
        if (active && dish) setRemoteDish(dish);
      })
      .catch((error: unknown) =>
        reportError(error, { screen: "ReviewScreen", action: "load_selected_dish" }),
      );
    return () => {
      active = false;
    };
  }, [repository, selectedDishId]);

  // Leaving with an unpublished draft (it is kept, but the user walked away).
  useEffect(
    () =>
      navigation.addListener("beforeRemove", () => {
        const { draft: currentDraft, isSubmitting: submitting } = useReviewDraftStore.getState();
        if (submitting || !reviewDraftHasContent(currentDraft)) return;
        trackAnalyticsEvent("review_abandoned", {
          dish_id: currentDraft.selectedDishId || undefined,
          has_rating: currentDraft.rating > 0,
          media_count: currentDraft.photos.length,
        });
      }),
    [navigation],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setReturnRoute("ReviewStack");
      rootNavigation.navigate("AuthStack", { screen: "Login" });
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

  const chooseDish = (venueId: string, dishId: string) => {
    const switchingDish = Boolean(draft.selectedDishId) && draft.selectedDishId !== dishId;
    if (!switchingDish || !reviewDraftHasContent(draft)) {
      selectDish(venueId, dishId);
      closePicker();
      return;
    }
    Alert.alert("Change dish?", "Switching dish clears the rating, text and photos you added.", [
      { text: "Keep current dish", style: "cancel" },
      {
        text: "Change dish",
        style: "destructive",
        onPress: () => {
          selectDish(venueId, dishId);
          closePicker();
        },
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!selectedDish) {
      useUIStore.getState().showToast({ message: "Please select a dish first.", tone: "warning" });
      return;
    }

    const hasVideo = reviewVideoEnabled && Boolean(draft.videoUri);
    // Points exist only where gamification is on; the success modal hides them otherwise.
    const reviewScore = FEATURE_FLAGS.gamificationEnabled
      ? 25 + draft.selectedTags.length * 5 + draft.photos.length * 10 + (hasVideo ? 20 : 0)
      : 0;
    // What the server keeps (allowed list, at most REVIEW_MAX_TAGS), so the device matches it.
    const reviewTags = normalizeReviewTags(draft.selectedTags);
    // Fixed before the submit so the success modal can offer to share this exact review.
    const reviewId = ensurePendingReviewId();
    const successPayload = {
      reviewId,
      dishId: selectedDish.id,
      dishName: selectedDish.name,
      venueName: selectedVenue?.name ?? selectedDish.venueName ?? "",
      pointsEarned: reviewScore,
      xpEarned: reviewScore,
      tagCount: reviewTags.length,
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
        tags: reviewTags,
        photos: draft.photos,
        wouldRecommend: resolveWouldRecommend(draft.recommend, draft.rating),
        // Reused on retry so a failed photo step never creates a second review.
        clientReviewId: reviewId,
      });

      // The felt levels go in as the dish's standard levels, undoing this reviewer's palate.
      if (Object.keys(feltTaste).length > 0) {
        void getHungryService()
          .ai.adjustCommunityTasteVector(
            selectedDish.id,
            standardTasteRating(feltTaste, userTasteVector),
            reviewId,
          )
          .catch((error: unknown) =>
            reportError(error, { screen: "ReviewScreen", action: "adjust_taste_vector" }),
          );
        clearFeltTaste();
      }

      useProfileStore.getState().addReviewedDish(selectedDish.id);
      useProfileStore.getState().addReview(selectedDish);
      useProfileStore.getState().recordReviewEntry(selectedDish.id, {
        rating: draft.rating,
        text: reviewText,
        tags: reviewTags,
      });

      trackAnalyticsEvent("review_submitted", {
        dish_id: selectedDish.id,
        venue_id: selectedDish.venueId,
        media_count: draft.photos.length + (hasVideo ? 1 : 0),
        has_music: reviewMusicEnabled && !!draft.musicId,
      });

      // One confirmation: the success modal.
      useUIStore.getState().showReviewSuccess(successPayload);
      resetDraft();
      // The editor is the only screen in its stack: leave the stack so the user
      // lands back where they started (usually the dish they reviewed).
      const parentNavigation = navigation.getParent();
      if (parentNavigation?.canGoBack()) {
        parentNavigation.goBack();
      } else {
        rootNavigation.navigate("MainTabs", { screen: "Review" });
      }
    } catch (error) {
      const photosOnly = (error as { code?: string } | null)?.code === REVIEW_PHOTOS_NOT_ATTACHED;
      trackAnalyticsEvent("review_submit_failed", {
        dish_id: selectedDish.id,
        venue_id: selectedDish.venueId,
        media_count: draft.photos.length,
        reason: photosOnly ? "photos_not_attached" : "submit_failed",
      });
      // Refusals written for the person (text filter, own stall, rate limit) are expected;
      // every other failure of the app's main write reaches error tracking.
      if (!isExpectedPublishError(error)) {
        reportError(error, { screen: "ReviewScreen", action: "submit_review", photosOnly });
      }
      useUIStore.getState().showToast({
        message: photosOnly
          ? "Your review is posted, but the photos didn't upload. Tap Publish again to add them."
          : describePublishError(error, "review"),
        tone: "warning",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Where each required section sits, so the "Add a photo…" line can scroll to it.
  const rememberSectionY = (field: ReviewRequiredField) => (event: LayoutChangeEvent) => {
    sectionYRef.current[field] = event.nativeEvent.layout.y;
  };
  const scrollToSection = (field: ReviewRequiredField) => {
    if (field === "dish" && !selectedDish) {
      openPicker();
      return;
    }
    scrollRef.current?.scrollTo({ y: Math.max(0, (sectionYRef.current[field] ?? 0) - 16) });
  };

  if (!isAuthenticated) return null;

  if (!draftHydrated) {
    return (
      <Screen title="Write a review" subtitle="Share what you ate">
        <View accessibilityLabel="Loading your draft" style={{ gap: spacing[4] }}>
          <Skeleton width="100%" height={88} />
          <Skeleton width="60%" height={32} />
          <Skeleton width="100%" height={120} />
        </View>
      </Screen>
    );
  }

  const missingField = firstMissingReviewField(draft, Boolean(selectedDish));
  const publishBlockedReason = missingField?.message ?? null;

  return (
    <Screen
      keyboardAvoiding
      title="Write a review"
      subtitle="Share what you ate"
      scroll
      scrollRef={scrollRef}
    >
      <FeedErrorBoundary
        title="Review editor failed"
        body="We hit a snag loading the editor. Please try again."
      >
        <View style={{ gap: spacing[6], paddingBottom: spacing[20] }}>
          {/* 1. Dish */}
          <View style={{ gap: spacing[3] }} onLayout={rememberSectionY("dish")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <MapPin size={18} color={palette.orange} />
              <AppText variant="h3">What did you eat?</AppText>
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
                  <Button label="Change" variant="ghost" fullWidth={false} onPress={openPicker} />
                </View>
              </Card>
            ) : (
              <Button
                label="Select stall & dish"
                variant="secondary"
                onPress={openPicker}
                leftIcon={<Search size={18} color={palette.text} />}
              />
            )}
          </View>

          {/* 2. Photo: required (sh, STITCH-BUILD-03), so it comes right after the dish. */}
          <View onLayout={rememberSectionY("photo")}>
            <MediaPicker
              title="Photo (required)"
              photos={draft.photos}
              videoUri={reviewVideoEnabled ? draft.videoUri : undefined}
              onAddPhoto={addPhoto}
              onRemovePhoto={removePhoto}
              onSetVideo={reviewVideoEnabled ? setVideoUri : undefined}
            />
          </View>

          {/* 3. Rating */}
          <View style={{ gap: spacing[2] }} onLayout={rememberSectionY("rating")}>
            <AppText variant="h3">Overall rating</AppText>
            <StarRating
              value={draft.rating}
              onChange={setRating}
              editable
              showDescriptor
              centered
            />
          </View>

          {/* 4. Review text */}
          <View style={{ gap: spacing[3] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText variant="h3">Your review</AppText>
              <AppText variant="micro" tone="muted">
                {draft.text.length}/{REVIEW_TEXT_MAX_LENGTH}
              </AppText>
            </View>
            <Input
              placeholder="What made this dish special?"
              accessibilityLabel="Your review"
              multiline
              numberOfLines={4}
              maxLength={REVIEW_TEXT_MAX_LENGTH}
              value={draft.text}
              onChangeText={setText}
              style={{ minHeight: 100 }}
            />
          </View>

          {/* Music Picker (Navigation Button) */}
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
                  label="Add music"
                  variant="secondary"
                  onPress={() => navigation.navigate("MusicSelection" as any)}
                  leftIcon={<Music size={18} color={palette.text} />}
                />
              )}
            </View>
          ) : null}

          {/* Every reviewer can tag taste; the tags feed dish taste profiles. */}
          <View style={{ gap: spacing[3] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText variant="h3">Taste tags</AppText>
              <AppText variant="micro" tone="muted">
                Up to {REVIEW_MAX_TAGS} · {draft.selectedTags.length}/{REVIEW_MAX_TAGS}
              </AppText>
            </View>
            <ChipGroup
              options={REVIEW_EDITOR_TAGS.map((tag) => ({ id: tag, label: tag }))}
              selectedIds={draft.selectedTags}
              onSelect={toggleTag}
            />
          </View>

          {/* Optional: how strong each taste felt. Saved as the dish's standard levels. */}
          {selectedDish ? (
            <View style={{ gap: spacing[2] }}>
              <View style={{ gap: spacing[1] }}>
                <AppText variant="h3">How did it taste?</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Optional. Dashed rings are our guess for your palate; tap what you tasted.
                </AppText>
              </View>
              <TasteRatingInput
                values={feltTaste}
                suggestions={tasteSuggestions}
                onChange={(key, value) => {
                  if (selectedDishId) setFeltTaste(selectedDishId, key, value);
                }}
              />
            </View>
          ) : null}

          {/* 5. Recommend: unanswered until the reviewer picks one. */}
          <View style={{ gap: spacing[3] }}>
            <AppText variant="h3">Would you recommend it?</AppText>
            <View style={{ flexDirection: "row", gap: spacing[3] }}>
              <Button
                label="Yes"
                variant={draft.recommend === true ? "primary" : "secondary"}
                accessibilityState={{ selected: draft.recommend === true }}
                onPress={() => setRecommend(true)}
                style={{ flex: 1 }}
              />
              <Button
                label="No"
                variant={draft.recommend === false ? "primary" : "secondary"}
                accessibilityState={{ selected: draft.recommend === false }}
                onPress={() => setRecommend(false)}
                style={{ flex: 1 }}
              />
            </View>
          </View>

          <View style={{ gap: spacing[2] }}>
            <Button
              label="Publish review"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={Boolean(publishBlockedReason)}
            />
            {missingField ? (
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Scrolls to the missing field"
                onPress={() => scrollToSection(missingField.field)}
                style={{ alignItems: "center", justifyContent: "center", minHeight: 44 }}
              >
                <AppText
                  variant="bodySmall"
                  tone="secondary"
                  accessibilityLiveRegion="polite"
                  style={{ textAlign: "center", textDecorationLine: "underline" }}
                >
                  {missingField.message}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </FeedErrorBoundary>

      {/* Dish picker: a real modal (viewport-sized, Android back closes it) instead
          of an overlay inside the scroll content. */}
      <Modal
        visible={isSearching}
        animationType="slide"
        onRequestClose={() => (pickerVenue ? setPickerVenueId(null) : closePicker())}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: palette.bg,
            paddingHorizontal: spacing[4],
            paddingTop: insets.top + spacing[4],
            paddingBottom: insets.bottom,
          }}
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
                placeholder="Search dishes or stalls..."
                accessibilityLabel="Search dishes or stalls"
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
                <View style={{ gap: spacing[3] }}>
                  <AppText tone="secondary">No dishes listed for this stall yet.</AppText>
                  <Button
                    label="Suggest a dish"
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => {
                      // The stall page has the menu-photo flow that adds dishes.
                      closePicker();
                      rootNavigation.navigate("StallDetail", { id: pickerVenue.id });
                    }}
                  />
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Review ${item.name}`}
                  onPress={() => chooseDish(pickerVenue.id, item.id)}
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
              data={pickerRows}
              keyExtractor={(row) => row.key}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <AppText tone="secondary">
                  {query.trim()
                    ? `No dishes or stalls match "${query.trim()}".`
                    : "No stalls to show yet."}
                </AppText>
              }
              renderItem={({ item }: { item: PickerRow }) => {
                const distance =
                  item.distanceMeters === undefined
                    ? ""
                    : ` · ${formatPickerDistance(item.distanceMeters)}`;
                const isDish = item.kind === "dish";
                const title = isDish ? item.dish.name : item.venue.name;
                const subtitle = isDish
                  ? `${item.dish.venueName}${distance}`
                  : `${item.venue.unitNumber}${distance}`;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      isDish
                        ? `Review ${title} at ${item.dish.venueName}`
                        : `Choose a dish at ${title}`
                    }
                    onPress={() =>
                      isDish
                        ? chooseDish(item.dish.venueId, item.dish.id)
                        : setPickerVenueId(item.venue.id)
                    }
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
                        <AppText style={{ fontWeight: "600" }}>{title}</AppText>
                        <AppText variant="bodySmall" tone="secondary">
                          {subtitle}
                        </AppText>
                      </View>
                      {isDish ? null : <ChevronRight size={18} color={palette.textMuted} />}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </Screen>
  );
}
