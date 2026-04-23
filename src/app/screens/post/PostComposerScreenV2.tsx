/**
 * PostComposerScreenV2 — Enhanced Content Creation
 * Overhaul of the post composer with a "Post to" toggle.
 * Multi-step feel on a single screen.
 */
import { useMemo, useState } from "react";
import { View, ScrollView, Pressable, Switch, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Camera, Music, MapPin, Send, Save, Layout, MessageSquare } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, Input, Chip, Screen as AppScreen, EmptyState } from "@/components/ui";
import { POST_CAPTION_MAX_LENGTH, sanitizeFreeText } from "@/lib/security/inputSanitization";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "PostComposerV2">;

export function PostComposerScreenV2({ navigation, route }: Props) {
  const { spacing, palette, radii } = useHungryTheme();
  const { width } = useWindowDimensions();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);
  const repository = getDataRepository();

  const [caption, setCaption] = useState("");
  const [postToReviewFeed, setPostToReviewFeed] = useState(true);
  const [selectedMusic, setSelectedMusic] = useState<string | null>(null);

  // Derive dish/venue from params
  const dishes = useMemo(() => repository.listPopularNearby(), [repository]);
  const fallbackDish = dishes.length > 0 ? dishes[0] : null;

  const dish = useMemo(() => {
    if (route.params?.dishId) {
      return repository.getDishById(route.params.dishId) || fallbackDish;
    }
    return fallbackDish;
  }, [fallbackDish, repository, route.params?.dishId]);

  const venue = useMemo(
    () => (dish ? repository.getVenueById(dish.venueId) : null),
    [dish, repository],
  );

  const handlePublish = () => {
    if (!isAuthenticated) {
      setReturnRoute("Post");
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }

    if (!dish) {
      showToast({ message: "Unable to identify dish.", tone: "error" });
      return;
    }

    showToast({
      message: `Published to ${postToReviewFeed ? "Review Feed" : "Home Feed"}!`,
      tone: "success",
    });
    navigation.goBack();
  };

  if (!dish) {
    return (
      <AppScreen title="Create Post">
        <EmptyState title="Loading..." body="Preparing your post composer." />
      </AppScreen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing[20] }}>
        {/* Visual Header / Media Placeholder */}
        <View style={{ position: "relative" }}>
          <View
            style={{
              width: "100%",
              height: width * 0.7,
              backgroundColor: palette.bgSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
              }}
              style={{ width: "100%", height: "100%", opacity: 0.6 }}
              contentFit="cover"
            />
            <View style={{ position: "absolute", gap: spacing[2], alignItems: "center" }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: palette.orange,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Camera color={palette.white} size={32} />
              </View>
              <AppText variant="bodyBold" style={{ color: palette.white }}>
                Add Photos / Video
              </AppText>
            </View>
          </View>

          {/* Location Overlay */}
          <View
            style={{
              position: "absolute",
              bottom: spacing[4],
              left: spacing[4],
              right: spacing[4],
              backgroundColor: "rgba(0,0,0,0.5)",
              padding: spacing[3],
              borderRadius: radii.lg,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing[2],
            }}
          >
            <MapPin size={16} color={palette.white} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodySmallBold" style={{ color: palette.white }}>
                {dish.name}
              </AppText>
              <AppText variant="micro" style={{ color: "rgba(255,255,255,0.8)" }}>
                {venue?.name}
              </AppText>
            </View>
          </View>
        </View>

        {/* Form Content */}
        <View style={{ padding: spacing[4], gap: spacing[6] }}>
          {/* Destination Toggle */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: palette.surface,
              padding: spacing[3],
              borderRadius: radii.xl,
              alignItems: "center",
              justifyContent: "space-between",
              borderWidth: 1,
              borderColor: palette.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: postToReviewFeed ? palette.orangeLight : palette.bgSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {postToReviewFeed ? (
                  <MessageSquare size={20} color={palette.orange} />
                ) : (
                  <Layout size={20} color={palette.textSecondary} />
                )}
              </View>
              <View>
                <AppText variant="bodySmallBold">
                  Post to {postToReviewFeed ? "Review Feed" : "Home Feed"}
                </AppText>
                <AppText variant="micro" tone="muted">
                  {postToReviewFeed
                    ? "Public rating & community feedback"
                    : "Your personal food log"}
                </AppText>
              </View>
            </View>
            <Switch
              value={postToReviewFeed}
              onValueChange={setPostToReviewFeed}
              trackColor={{ false: palette.border, true: palette.orange }}
            />
          </View>

          {/* Caption */}
          <View style={{ gap: spacing[2] }}>
            <AppText variant="bodyBold">What&apos;s the verdict?</AppText>
            <Input
              multiline
              numberOfLines={4}
              placeholder="The sauce was incredible, but the queue was long..."
              value={caption}
              onChangeText={(v) => setCaption(sanitizeFreeText(v, POST_CAPTION_MAX_LENGTH))}
              style={{
                backgroundColor: palette.surface,
                borderRadius: radii.lg,
                paddingTop: spacing[3],
              }}
            />
          </View>

          {/* Music Selection */}
          <Pressable
            onPress={() => navigation.navigate("MusicSelection")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: spacing[4],
              backgroundColor: palette.surface,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: palette.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
              <Music size={20} color={palette.text} />
              <AppText variant="body">Background Music</AppText>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AppText variant="bodySmall" tone="muted">
                {selectedMusic ?? "None selected"}
              </AppText>
              <View
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.orange }}
              />
            </View>
          </Pressable>

          {/* Taste Tags */}
          <View style={{ gap: spacing[3] }}>
            <AppText variant="bodyBold">Taste Tags</AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              {(dish.availabilityFlags || []).map((tag) => (
                <Chip key={tag} label={tag} onPress={() => {}} />
              ))}
              <Chip label="+ Add Tag" onPress={() => {}} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: spacing[4],
          backgroundColor: palette.surface,
          borderTopWidth: 1,
          borderTopColor: palette.border,
          flexDirection: "row",
          gap: spacing[3],
        }}
      >
        <Button
          variant="secondary"
          label="Draft"
          style={{ flex: 1 }}
          leftIcon={<Save size={18} color={palette.text} />}
          onPress={() => showToast({ message: "Draft saved.", tone: "info" })}
        />
        <Button
          label="Publish"
          style={{ flex: 3 }}
          leftIcon={<Send size={18} color={palette.white} />}
          onPress={handlePublish}
        />
      </View>
    </View>
  );
}
