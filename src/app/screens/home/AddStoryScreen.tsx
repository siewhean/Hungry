import { ZoomableVideo } from "@/components/social/ZoomableVideo";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Camera, Check, ChevronLeft, Film, Image as ImageIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccessibleImage, AppText, Button, IconButton, Screen } from "@/components/ui";
import { useStoryStore } from "@/store/useStoryStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { StoryContent, StoryGalleryAsset } from "@/types/domain";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";

type GalleryFilter = "all" | StoryContent["type"];

export function AddStoryScreen() {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { addStory } = useStoryStore();
  const showToast = useUIStore((state) => state.showToast);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [galleryAssets, setGalleryAssets] = useState<StoryGalleryAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [filter, setFilter] = useState<GalleryFilter>("all");

  useEffect(() => {
    if (getServiceProvider().mode !== "mock") return;
    let isMounted = true;

    getHungryService()
      .social.listStoryGalleryAssets()
      .then((assets) => {
        if (!isMounted) return;
        setGalleryAssets(assets);
        setSelectedAssetId((current) => current || assets[0]?.id || "");
      })
      .catch(() => {
        if (isMounted) {
          showToast({ message: "Failed to load gallery assets.", tone: "error" });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [showToast]);

  const visibleAssets = useMemo(
    () => galleryAssets.filter((asset) => filter === "all" || asset.type === filter),
    [filter, galleryAssets],
  );
  const selectedAsset =
    visibleAssets.find((asset) => asset.id === selectedAssetId) ?? visibleAssets[0];

  const handlePost = async () => {
    if (isSubmitting) return;
    if (!selectedAsset) {
      Alert.alert("Select a story", "Choose a photo or video from your gallery first.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addStory({ type: selectedAsset.type, url: selectedAsset.url });
      showToast({ message: "Local demo story added", tone: "success" });
      navigation.goBack();
    } catch {
      showToast({ message: "Failed to post story.", tone: "error" });
      setIsSubmitting(false);
    }
  };

  if (getServiceProvider().mode !== "mock")
    return (
      <Screen title="Story demos">
        <AppText>Stories are available as local demos only.</AppText>
        <Button label="Go back" onPress={() => navigation.goBack()} />
      </Screen>
    );

  return (
    <Screen fullWidth style={{ backgroundColor: palette.bg }}>
      <View
        style={[
          styles.header,
          {
            borderBottomColor: palette.border,
            paddingHorizontal: spacing[3],
            paddingTop: insets.top + spacing[2],
          },
        ]}
      >
        <IconButton
          accessibilityLabel="Go back"
          icon={<ChevronLeft size={24} color={palette.text} />}
          onPress={() => navigation.goBack()}
        />
        <View style={{ flex: 1 }}>
          <AppText variant="h3" style={{ fontWeight: "800" }}>
            Gallery
          </AppText>
          <AppText variant="micro" tone="secondary">
            Choose a photo or video for your story
          </AppText>
        </View>
        <Camera size={22} color={palette.orange} />
      </View>

      <ScrollView
        contentContainerStyle={{
          gap: spacing[4],
          paddingBottom: insets.bottom + spacing[24],
          paddingHorizontal: spacing[3],
          paddingTop: spacing[4],
        }}
        showsVerticalScrollIndicator={false}
      >
        {selectedAsset ? (
          <View style={[styles.preview, { borderRadius: componentRadii.card }]}>
            {selectedAsset.type === "video" ? (
              <ZoomableVideo
                uri={selectedAsset.url}
                style={StyleSheet.absoluteFill}
                accessibilityLabel="Selected demo video"
              />
            ) : (
              <AccessibleImage
                source={{ uri: selectedAsset.url }}
                contentFit="cover"
                style={StyleSheet.absoluteFill}
                accessibilityLabel={`Selected ${selectedAsset.type} preview`}
              />
            )}
            {selectedAsset.type === "video" ? (
              <View style={[styles.videoPill, { backgroundColor: palette.detailImageOverlay }]}>
                <Film color={palette.white} size={16} />
                <AppText variant="micro" style={{ color: palette.white, fontWeight: "900" }}>
                  Video
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          {(["all", "image", "video"] as GalleryFilter[]).map((value) => {
            const selected = value === filter;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`Show ${value === "all" ? "all media" : `${value}s`}`}
                onPress={() => setFilter(value)}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor: selected ? palette.orange : palette.surface,
                    borderColor: selected ? palette.orange : palette.border,
                    borderRadius: radii.pill,
                  },
                ]}
              >
                <AppText
                  variant="bodySmallBold"
                  style={{ color: selected ? palette.white : palette.text }}
                >
                  {value === "all" ? "All" : value === "image" ? "Photos" : "Videos"}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.galleryGrid}>
          {visibleAssets.map((asset) => {
            const selected = asset.id === selectedAsset?.id;
            return (
              <Pressable
                key={asset.id}
                accessibilityRole="button"
                accessibilityLabel={`Select ${asset.title}`}
                onPress={() => setSelectedAssetId(asset.id)}
                style={[
                  styles.galleryItem,
                  {
                    borderColor: selected ? palette.orange : palette.border,
                    borderRadius: componentRadii.button,
                  },
                ]}
              >
                <AccessibleImage
                  source={{ uri: asset.url }}
                  contentFit="cover"
                  style={StyleSheet.absoluteFill}
                  decorative
                />
                <View
                  style={[
                    styles.mediaTypeBadge,
                    { backgroundColor: palette.imageOverlayGradientEnd },
                  ]}
                >
                  {asset.type === "video" ? (
                    <Film color={palette.white} size={13} />
                  ) : (
                    <ImageIcon color={palette.white} size={13} />
                  )}
                </View>
                {selected ? (
                  <View style={[styles.selectedBadge, { backgroundColor: palette.orange }]}>
                    <Check color={palette.white} size={14} strokeWidth={3} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: palette.bg,
            borderTopColor: palette.border,
            paddingBottom: Math.max(insets.bottom, spacing[4]),
            paddingHorizontal: spacing[4],
            paddingTop: spacing[3],
          },
        ]}
      >
        <Button
          label={isSubmitting ? "Adding demo..." : "Add local demo story"}
          variant="primary"
          fullWidth
          disabled={!selectedAsset || isSubmitting || galleryAssets.length === 0}
          onPress={handlePost}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingBottom: 12,
  },
  preview: {
    aspectRatio: 9 / 14,
    overflow: "hidden",
    width: "100%",
  },
  videoPill: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: "absolute",
    right: 12,
    top: 12,
  },
  filterButton: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  galleryItem: {
    aspectRatio: 1,
    borderWidth: 2,
    overflow: "hidden",
    width: "31.9%",
  },
  mediaTypeBadge: {
    borderRadius: 999,
    left: 8,
    padding: 5,
    position: "absolute",
    top: 8,
  },
  selectedBadge: {
    alignItems: "center",
    borderRadius: 999,
    bottom: 8,
    height: 24,
    justifyContent: "center",
    position: "absolute",
    right: 8,
    width: 24,
  },
  footer: {
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
});
