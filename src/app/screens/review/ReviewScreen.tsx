import { useEffect, useMemo, useState } from "react";
import { View, Pressable, ScrollView, FlatList, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { Search, MapPin, ChevronRight, Check, Music } from "lucide-react-native";

import {
  AppText,
  Button,
  Card,
  Input,
  Screen,
  Badge,
  Chip,
  FeedErrorBoundary,
} from "@/components/ui";
import { MediaPicker, StarRating } from "@/components/review";
import { TRENDING_MUSIC } from "@/features/review/musicData";
import { REVIEW_TAGS } from "@/constants/taste";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { REVIEW_TEXT_MAX_LENGTH } from "@/lib/security/inputSanitization";
import type { ReviewStackParamList } from "@/app/navigation/navigationTypes";

type Props = NativeStackScreenProps<ReviewStackParamList, "ReviewMain">;

export function ReviewScreen({ navigation, route }: Props) {
  const repository = getDataRepository();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const rootNavigation = navigation.getParent()?.getParent();

  // Store state
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const draft = useReviewDraftStore((state) => state.draft);
  const actions = useReviewDraftStore();

  // Local state
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Derived data
  const selectedDish = useMemo(
    () => repository.getDishById(draft.selectedDishId || ""),
    [repository, draft.selectedDishId],
  );
  const selectedVenue = useMemo(
    () => repository.getVenueById(draft.selectedVenueId || ""),
    [repository, draft.selectedVenueId],
  );

  const venues = repository
    .listBuildings()
    .flatMap((building) => repository.listVenuesByBuilding(building.id))
    .filter((venue) =>
      `${venue.name} ${venue.unitNumber}`.toLowerCase().includes(query.trim().toLowerCase()),
    );

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
        25 + draft.selectedTags.length * 5 + draft.photos.length * 10 + (draft.videoUri ? 20 : 0),
      xpEarned:
        25 + draft.selectedTags.length * 5 + draft.photos.length * 10 + (draft.videoUri ? 20 : 0),
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
        media_count: draft.photos.length + (draft.videoUri ? 1 : 0),
        has_music: !!draft.musicId,
        filter_id: draft.filterId,
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
            onAddPhoto={actions.addPhoto}
            onRemovePhoto={actions.removePhoto}
            onSetVideo={actions.setVideoUri}
            onSetFilter={actions.setFilterId}
          />

          {/* 2. Music Picker (Navigation Button) */}
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
                  <Image
                    source={{ uri: selectedDish.imageUrl }}
                    style={{ width: 60, height: 60, borderRadius: radii.md }}
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
              <StarRating value={draft.rating} onChange={actions.setRating} />
            </View>

            <View style={{ gap: spacing[3] }}>
              <AppText variant="h3">Taste Tags</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                {REVIEW_TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    selected={draft.selectedTags.includes(tag)}
                    onPress={() => actions.toggleTag(tag)}
                  />
                ))}
              </View>
            </View>

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
                placeholder="Search stalls..."
                value={query}
                onChangeText={setQuery}
                style={{ flex: 1 }}
                autoFocus
              />
              <Button label="Close" variant="ghost" onPress={() => setIsSearching(false)} />
            </View>

            <FlatList
              data={venues}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const dishes = repository.listDishesByVenue(item.id);
                return (
                  <Pressable
                    onPress={() => {
                      if (dishes[0]) {
                        actions.selectDish(item.id, dishes[0].id);
                        setIsSearching(false);
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
          </View>
        </View>
      )}
    </Screen>
  );
}
