import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Dimensions } from "react-native";
import { X, Heart, MapPin } from "lucide-react-native";
import { Image } from "expo-image";
import { AppText, IconButton, HungryLogo, Badge } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useComposerStore } from "../useComposerStore";

const { width: screenWidth } = Dimensions.get("window");

export function LivePreviewSheet() {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const showPreview = useComposerStore((state) => state.showPreview);
  const setShowPreview = useComposerStore((state) => state.setShowPreview);
  const previewPlatform = useComposerStore((state) => state.previewPlatform);
  const setPreviewPlatform = useComposerStore((state) => state.setPreviewPlatform);

  const postCaption = useComposerStore((state) => state.postCaption);
  const reviewCaption = useComposerStore((state) => state.reviewCaption);
  const media = useComposerStore((state) => state.media);
  const location = useComposerStore((state) => state.location);
  const tasteTags = useComposerStore((state) => state.tasteTags);
  const rating = useComposerStore((state) => state.rating);

  if (!showPreview) return null;

  const captionToDisplay = postCaption || reviewCaption || "No caption written yet...";

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.9)", zIndex: 2000 }]}>
      <View
        style={{
          flex: 1,
          marginTop: 60,
          backgroundColor: palette.bg,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
        }}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <View style={styles.tabs}>
            <Pressable
              onPress={() => setPreviewPlatform("hungry")}
              style={[
                styles.tab,
                previewPlatform === "hungry" && {
                  borderBottomColor: palette.orange,
                  borderBottomWidth: 2,
                },
              ]}
            >
              <AppText
                variant="bodyBold"
                style={{ color: previewPlatform === "hungry" ? palette.orange : palette.textMuted }}
              >
                Hungry
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => setPreviewPlatform("instagram")}
              style={[
                styles.tab,
                previewPlatform === "instagram" && {
                  borderBottomColor: palette.orange,
                  borderBottomWidth: 2,
                },
              ]}
            >
              <AppText
                variant="bodyBold"
                style={{
                  color: previewPlatform === "instagram" ? palette.orange : palette.textMuted,
                }}
              >
                Instagram
              </AppText>
            </Pressable>
          </View>
          <IconButton
            variant="ghost"
            accessibilityLabel="Close preview"
            onPress={() => setShowPreview(false)}
            icon={<X size={24} color={palette.text} />}
          />
        </View>

        <ScrollView contentContainerStyle={styles.previewContent}>
          {previewPlatform === "hungry" ? (
            <View
              style={[
                styles.hungryPreview,
                shadows.card,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              {/* User Header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: spacing.md,
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: palette.orange,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
                    ME
                  </AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodySmallBold">You</AppText>
                  {location ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <MapPin size={10} color={palette.orange} />
                      <AppText variant="micro" tone="muted" numberOfLines={1}>
                        {location.name}
                      </AppText>
                    </View>
                  ) : (
                    <AppText variant="micro" tone="muted">
                      Just now
                    </AppText>
                  )}
                </View>
              </View>

              {/* Media */}
              <View style={{ width: "100%", aspectRatio: 1, backgroundColor: palette.bgSoft }}>
                {media.length > 0 ? (
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    style={{ flex: 1 }}
                  >
                    {media.map((item) => (
                      <Image
                        key={item.id}
                        source={item.uri}
                        style={{ width: screenWidth - 42, height: screenWidth - 42 }}
                        contentFit="cover"
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <HungryLogo size={40} opacity={0.2} />
                  </View>
                )}
                {media.length > 1 && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 12,
                      right: 12,
                      backgroundColor: "rgba(0,0,0,0.5)",
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 12,
                    }}
                  >
                    <AppText variant="micro" style={{ color: palette.white }}>
                      1/{media.length}
                    </AppText>
                  </View>
                )}
              </View>

              {/* Engagement & Content */}
              <View style={{ padding: spacing.md, gap: spacing.sm }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                    <HungryLogo size={18} showWordmark={false} />
                    <AppText variant="bodySmallBold">Recommend this dish</AppText>
                  </View>
                  {rating > 0 && <Badge label={`★ ${rating}`} tone="orange" />}
                </View>

                <AppText variant="bodySmall" style={{ color: palette.text }}>
                  {captionToDisplay}
                </AppText>

                {tasteTags.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    {tasteTags.map((tag) => (
                      <AppText key={tag} variant="micro" style={{ color: palette.orange }}>
                        #{tag.toLowerCase().replace(/\s+/g, "")}
                      </AppText>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={[styles.instaPreview, { backgroundColor: palette.surface }]}>
              <View style={{ flexDirection: "row", alignItems: "center", padding: 10, gap: 8 }}>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: palette.bgSoft,
                  }}
                />
                <AppText style={{ fontWeight: "600", fontSize: 13, color: palette.text }}>
                  your_account
                </AppText>
              </View>

              <View style={{ width: "100%", aspectRatio: 1, backgroundColor: palette.bgSoft }}>
                {media.length > 0 ? (
                  <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                    {media.map((item) => (
                      <Image
                        key={item.id}
                        source={item.uri}
                        style={{ width: screenWidth - 42, height: screenWidth - 42 }}
                        contentFit="cover"
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <View style={{ flex: 1, backgroundColor: palette.bgSoft }} />
                )}
                {media.length > 1 && (
                  <View
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      backgroundColor: "rgba(0,0,0,0.7)",
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 12,
                    }}
                  >
                    <AppText variant="micro" style={{ color: palette.white, fontSize: 10 }}>
                      1/{media.length}
                    </AppText>
                  </View>
                )}
              </View>

              <View style={{ padding: 10, gap: 4 }}>
                <View style={{ flexDirection: "row", gap: 15, marginBottom: 5 }}>
                  <Heart size={22} color={palette.text} />
                </View>
                <AppText style={{ fontSize: 13, color: palette.text }}>
                  <AppText style={{ fontWeight: "600" }}>your_account</AppText> {captionToDisplay}
                  {tasteTags.map((tag) => ` #${tag.toLowerCase().replace(/\s+/g, "")}`).join("")}
                </AppText>
              </View>
            </View>
          )}

          <AppText
            variant="micro"
            tone="muted"
            style={{ marginTop: spacing.xl, textAlign: "center" }}
          >
            Preview is based on current selections. Final layout may vary.
          </AppText>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 8,
    borderBottomWidth: 1,
  },
  tabs: {
    flexDirection: "row",
    flex: 1,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  previewContent: {
    padding: 20,
    alignItems: "center",
  },
  hungryPreview: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  instaPreview: {
    width: "100%",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#efefee",
  },
});
