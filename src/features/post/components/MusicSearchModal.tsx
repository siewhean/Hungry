import React, { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Music, Search, X, Check, Play, Pause } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { BottomSheetModal, BottomSheetFlatList } from "@gorhom/bottom-sheet";

import { AppText, EmptyState, Input, IconButton, BottomSheet } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useComposerStore } from "../useComposerStore";

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  tags: string[];
}

const MOCK_TRACKS: Track[] = [
  {
    id: "1",
    title: "Sunrise Chill",
    artist: "Lofi Girl",
    duration: 180,
    tags: ["chill", "morning", "lofi"],
  },
  {
    id: "2",
    title: "Midnight Ramen",
    artist: "Street Food Vibes",
    duration: 150,
    tags: ["vibey", "night", "beats"],
  },
  {
    id: "3",
    title: "Saturday Market",
    artist: "Fresh Flavors",
    duration: 210,
    tags: ["happy", "acoustic", "cheerful"],
  },
  {
    id: "4",
    title: "Chef's Special",
    artist: "Kitchen Jazz",
    duration: 195,
    tags: ["jazz", "classy", "dinner"],
  },
  {
    id: "5",
    title: "Spicy Beats",
    artist: "Hot & Sour",
    duration: 165,
    tags: ["energetic", "upbeat", "street"],
  },
  {
    id: "6",
    title: "Cafe Jasmine",
    artist: "Tea Time Trio",
    duration: 185,
    tags: ["calm", "elegant", "relaxing"],
  },
  {
    id: "7",
    title: "Dim Sum Soul",
    artist: "Steamer Basket",
    duration: 140,
    tags: ["soul", "smooth", "traditional"],
  },
  {
    id: "8",
    title: "Hawker Hustle",
    artist: "Neon Lights",
    duration: 175,
    tags: ["fast", "dynamic", "urban"],
  },
];

interface MusicSearchModalProps {
  innerRef: React.RefObject<BottomSheetModal | null>;
}

export function MusicSearchModal({ innerRef }: MusicSearchModalProps) {
  const { componentRadii, componentSizes, palette, radii, semanticSpacing, spacing } =
    useHungryTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  const currentMusicId = useComposerStore((state) => state.musicId);
  const setMusic = useComposerStore((state) => state.setMusic);

  const filteredTracks = useMemo(() => {
    if (!searchQuery) return MOCK_TRACKS;
    const query = searchQuery.toLowerCase();
    return MOCK_TRACKS.filter(
      (track) =>
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        track.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }, [searchQuery]);

  const handleSelectTrack = useCallback(
    (track: Track) => {
      const isSelected = currentMusicId === track.id;
      if (isSelected) {
        setMusic(null);
      } else {
        setMusic(track.id, track.title, track.artist, track.duration);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [currentMusicId, setMusic],
  );

  const togglePlay = useCallback((trackId: string) => {
    setPlayingTrackId((prev) => (prev === trackId ? null : trackId));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const renderTrackItem = ({ item }: { item: Track }) => {
    const isSelected = currentMusicId === item.id;
    const isPlaying = playingTrackId === item.id;

    return (
      <Pressable
        onPress={() => handleSelectTrack(item)}
        accessibilityRole="button"
        accessibilityLabel={`${isSelected ? "Selected music" : "Select music"} ${item.title} by ${item.artist}`}
        accessibilityHint="Sets this track as the music for the post"
        accessibilityState={{ selected: isSelected }}
        style={({ pressed }) => [
          styles.trackItem,
          {
            backgroundColor: isSelected
              ? palette.orangeLight
              : pressed
                ? palette.surfaceRaised
                : "transparent",
            borderRadius: componentRadii.card,
            marginBottom: spacing[1],
            padding: spacing[3],
          },
        ]}
      >
        <View style={[styles.trackInfo, { gap: spacing[3] }]}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              togglePlay(item.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${isPlaying ? "Pause" : "Play"} preview for ${item.title}`}
            accessibilityHint="Toggles the music preview"
            accessibilityState={{ selected: isPlaying }}
            style={[
              styles.playButton,
              {
                backgroundColor: palette.bgSoft,
                borderRadius: componentRadii.iconButton,
                height: componentSizes.buttonSmMinHeight,
                width: componentSizes.buttonSmMinHeight,
              },
            ]}
          >
            {isPlaying ? (
              <Pause size={16} color={palette.orange} fill={palette.orange} />
            ) : (
              <Play size={16} color={palette.text} fill={palette.text} />
            )}
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText
              variant="bodyBold"
              style={{ color: isSelected ? palette.orange : palette.text }}
            >
              {item.title}
            </AppText>
            <AppText variant="micro" tone="secondary">
              {item.artist} • {Math.floor(item.duration / 60)}:
              {(item.duration % 60).toString().padStart(2, "0")}
            </AppText>
          </View>
        </View>
        {isSelected && <Check size={20} color={palette.orange} />}
      </Pressable>
    );
  };

  return (
    <BottomSheet
      ref={innerRef}
      snapPoints={["85%"]}
      keyboardBehavior="interactive"
      accessibilityLabel="Music library"
    >
      <View style={{ flex: 1, marginHorizontal: -semanticSpacing.screenEdge }}>
        <View
          style={[
            styles.header,
            { marginBottom: spacing[4], paddingHorizontal: semanticSpacing.screenEdge },
          ]}
        >
          <AppText variant="h3">Music Library</AppText>
          <IconButton
            icon={<X size={24} color={palette.text} />}
            accessibilityLabel="Close"
            onPress={() => innerRef.current?.dismiss()}
          />
        </View>

        <View
          style={[
            styles.searchContainer,
            { marginBottom: spacing[4], paddingHorizontal: semanticSpacing.screenEdge },
          ]}
        >
          <Input
            placeholder="Search mood, vibe or genre..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={18} color={palette.textMuted} />}
            rightIcon={
              searchQuery.length > 0 ? (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear music search"
                  accessibilityHint="Clears the current music search text"
                  style={{ padding: spacing[1] }}
                >
                  <X size={16} color={palette.textMuted} />
                </Pressable>
              ) : undefined
            }
          />
        </View>

        <BottomSheetFlatList
          data={filteredTracks}
          keyExtractor={(item) => item.id}
          renderItem={renderTrackItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: spacing[12], paddingVertical: spacing[2] },
          ]}
          style={{ flex: 1, paddingHorizontal: semanticSpacing.screenEdge }}
          ListEmptyComponent={
            <EmptyState
              title="No tracks found"
              body={`No tracks matching "${searchQuery}" were found.`}
              icon={<Music size={38} color={palette.textMuted} />}
            />
          }
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchContainer: {},
  trackItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trackInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  playButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {},
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
  },
});
