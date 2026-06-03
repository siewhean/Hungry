/**
 * MusicSelectionScreen
 * Vertical list of tracks for reviews.
 * Features simulated playback, thumbnails, Spotify-style seeking, and search.
 * Enhanced with smooth persistent waveforms and modernized player controls.
 */
import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Animated,
  Easing,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft, Play, Pause, Bookmark, Search, X, Music2 } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";

import { AccessibleImage, AppText, Input, Button } from "@/components/ui";
import { useHungryTheme } from "@/theme";

// ─── Mock Data ──────────────────────────────────────────────────────────────

type Track = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  durationSec: number;
  thumbnail: string;
};

const MOCK_TRACKS: Track[] = [
  {
    id: "1",
    title: "Midnight Hawker",
    artist: "LoFi Beats",
    duration: "2:45",
    durationSec: 165,
    thumbnail: "https://images.unsplash.com/photo-1541529086526-db283c563270?w=200",
  },
  {
    id: "2",
    title: "Katong Groove",
    artist: "Island Soul",
    duration: "3:12",
    durationSec: 192,
    thumbnail: "https://images.unsplash.com/photo-1555126634-323283e090fa?w=200",
  },
  {
    id: "3",
    title: "Wok Hei Fire",
    artist: "Canton Disco",
    duration: "1:58",
    durationSec: 118,
    thumbnail: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200",
  },
  {
    id: "4",
    title: "Chilli Crab Chill",
    artist: "Makan Music",
    duration: "4:05",
    durationSec: 245,
    thumbnail: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200",
  },
  {
    id: "5",
    title: "Sling & Sip",
    artist: "Marina Bay Trio",
    duration: "2:30",
    durationSec: 150,
    thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200",
  },
  {
    id: "6",
    title: "Raffles Rain",
    artist: "Piano Dreams",
    duration: "3:45",
    durationSec: 225,
    thumbnail: "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=200",
  },
  {
    id: "7",
    title: "Orchard Haze",
    artist: "Vaporwave SG",
    duration: "2:15",
    durationSec: 135,
    thumbnail: "https://images.unsplash.com/photo-1621236378699-8597fac6bb4d?w=200",
  },
  {
    id: "8",
    title: "Geylang Lights",
    artist: "Neon Nights",
    duration: "5:20",
    durationSec: 320,
    thumbnail: "https://images.unsplash.com/photo-1605098702935-b61af3b4ff3d?w=800",
  },
  {
    id: "9",
    title: "Sentosa Sunset",
    artist: "Tropical House",
    duration: "3:33",
    durationSec: 213,
    thumbnail: "https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=600&q=80",
  },
  {
    id: "10",
    title: "Holland Village Vibes",
    artist: "Jazz Quartet",
    duration: "2:55",
    durationSec: 175,
    thumbnail: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80",
  },
];

// ─── Enhanced Smooth Waveform ──────────────────────────────────────────────

function WaveformIndicator({
  isActive,
  isPaused,
  position,
}: {
  isActive: boolean;
  isPaused: boolean;
  position: number;
}) {
  const { palette } = useHungryTheme();

  // Create 5 animated bars
  const bars = useRef([
    new Animated.Value(6),
    new Animated.Value(12),
    new Animated.Value(8),
    new Animated.Value(16),
    new Animated.Value(10),
  ]).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation;

    if (isActive && !isPaused) {
      const createAnim = (val: Animated.Value, base: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(val, {
              toValue: base + 8,
              duration: 200 + Math.random() * 150,
              useNativeDriver: false,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            }),
            Animated.timing(val, {
              toValue: base - 4,
              duration: 200 + Math.random() * 150,
              useNativeDriver: false,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            }),
          ]),
        );
      };

      animation = Animated.parallel(bars.map((b, i) => createAnim(b, [6, 12, 8, 16, 10][i])));
      animation.start();
    } else if (isActive && isPaused) {
      // Static but varied based on slider position
      bars.forEach((b, i) => {
        const seed = (position + i) % 10;
        const staticHeight = 6 + seed * 1.5;
        Animated.timing(b, {
          toValue: staticHeight,
          duration: 300,
          useNativeDriver: false,
        }).start();
      });
    } else {
      // Hidden or minimal
      bars.forEach((b) => b.setValue(4));
    }

    return () => {
      if (animation) animation.stop();
    };
  }, [isActive, isPaused, bars, position]);

  if (!isActive) return null;

  return (
    <View style={styles.waveformContainer}>
      {bars.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveformBar,
            {
              height: anim,
              backgroundColor: isPaused ? palette.textMuted : palette.orange,
              opacity: isPaused ? 0.6 : 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── MusicSelectionScreen ──────────────────────────────────────────────────

export function MusicSelectionScreen() {
  const navigation = useNavigation();
  const { componentRadii, palette, radii, spacing } = useHungryTheme();

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const playingTrack = MOCK_TRACKS.find((t) => t.id === playingId);

  // ── Search Logic ──────────────────────────────────────────────────────────
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_TRACKS;
    const q = searchQuery.toLowerCase();
    return MOCK_TRACKS.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // ── Simulated Playback ────────────────────────────────────────────────────
  useEffect(() => {
    let interval: any;
    if (playingId && !isPaused) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (playingTrack && prev >= playingTrack.durationSec) return 0;
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [playingId, isPaused, playingTrack]);

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectTrack = (track: Track) => {
    if (playingId === track.id) {
      setIsPaused(!isPaused);
    } else {
      setPlayingId(track.id);
      setCurrentTime(0);
      setIsPaused(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderItem = useCallback(
    ({ item, index }: { item: Track; index: number }) => {
      const isPlaying = playingId === item.id;
      const isSaved = savedIds.has(item.id);
      const isLast = index === filteredTracks.length - 1;

      return (
        <Pressable
          onPress={() => handleSelectTrack(item)}
          style={[
            styles.trackRow,
            {
              backgroundColor: isPlaying ? palette.bgSoft : "transparent",
              borderBottomColor: palette.border,
              borderBottomWidth: isLast ? 0 : 0.5,
              paddingVertical: spacing[2.5],
              paddingHorizontal: spacing[4],
            },
          ]}
        >
          <View style={styles.trackInfo}>
            <View style={styles.thumbnailContainer}>
              <AccessibleImage
                source={{ uri: item.thumbnail }}
                style={[StyleSheet.absoluteFill, { borderRadius: radii.sm }]}
                contentFit="cover"
                decorative
              />
              {isPlaying && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: palette.mediaScrim,
                      borderRadius: radii.sm,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  ]}
                >
                  {isPaused ? (
                    <Play size={20} color="white" fill="white" />
                  ) : (
                    <Pause size={20} color="white" fill="white" />
                  )}
                </View>
              )}
            </View>
            <View style={{ flex: 1, marginLeft: spacing[4] }}>
              <AppText
                variant="bodyBold"
                style={{ color: isPlaying ? palette.orange : palette.text }}
              >
                {item.title}
              </AppText>
              <AppText variant="micro" tone="muted" style={{ marginTop: 2 }}>
                {item.artist} • {item.duration}
              </AppText>
            </View>

            <WaveformIndicator isActive={isPlaying} isPaused={isPaused} position={currentTime} />
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                toggleSave(item.id);
              }}
              hitSlop={12}
              style={{ padding: 4 }}
            >
              <Bookmark
                size={20}
                color={isSaved ? palette.orange : palette.textMuted}
                fill={isSaved ? palette.orange : "transparent"}
              />
            </Pressable>
          </View>
        </Pressable>
      );
    },
    [
      playingId,
      isPaused,
      savedIds,
      palette,
      spacing,
      radii,
      filteredTracks,
      currentTime,
      handleSelectTrack,
    ],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      {/* Modern Header with Search */}
      <View style={[styles.header, { borderBottomWidth: 1, borderBottomColor: palette.border }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft color={palette.text} size={32} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <AppText variant="displaySm" style={{ color: palette.text, fontWeight: "900" }}>
              Soundtrack
            </AppText>
            <AppText variant="micro" tone="muted">
              Pick a vibe for your review
            </AppText>
          </View>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: componentRadii.iconButton,
              backgroundColor: palette.bgSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Music2 color={palette.orange} size={20} />
          </View>
        </View>

        <View style={{ marginTop: spacing[4] }}>
          <Input
            placeholder="Search songs, artists..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={18} color={palette.textMuted} />}
            rightIcon={
              searchQuery ? (
                <Pressable onPress={() => setSearchQuery("")}>
                  <X size={18} color={palette.textMuted} />
                </Pressable>
              ) : undefined
            }
            style={{
              borderRadius: componentRadii.input,
              backgroundColor: palette.surfaceRaised,
              minHeight: 50,
              borderWidth: 0,
            }}
          />
        </View>
      </View>

      <FlatList
        data={filteredTracks}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: playingId ? 180 : 40 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Modernized Mini Player at Bottom */}
      {playingId && playingTrack && (
        <View
          style={[
            styles.playerContainer,
            {
              backgroundColor: palette.surface,
              borderColor: palette.inverseSurfaceBarely,
              borderRadius: componentRadii.card,
              shadowColor: palette.navy,
              shadowOpacity: 0.15,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 10,
            },
          ]}
        >
          <View style={styles.playerRow}>
            <AccessibleImage
              source={{ uri: playingTrack.thumbnail }}
              style={[styles.playerThumbnail, { borderRadius: radii.sm }]}
              contentFit="cover"
              accessibilityLabel={`${playingTrack.title} artwork`}
            />
            <View style={{ flex: 1, marginLeft: spacing[3] }}>
              <AppText variant="bodyBold" numberOfLines={1}>
                {playingTrack.title}
              </AppText>
              <AppText variant="micro" tone="muted" numberOfLines={1}>
                {playingTrack.artist}
              </AppText>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[5] }}>
              <Pressable onPress={() => setIsPaused(!isPaused)} hitSlop={12}>
                {isPaused ? (
                  <Play size={32} color={palette.text} fill={palette.text} />
                ) : (
                  <Pause size={32} color={palette.text} fill={palette.text} />
                )}
              </Pressable>
              <Button
                label="Select"
                variant="primary"
                size="sm"
                fullWidth={false}
                onPress={() => navigation.goBack()}
                style={{ paddingHorizontal: spacing[5] }}
              />
            </View>
          </View>

          {/* Premium Progress Slider */}
          <View style={styles.sliderContainer}>
            <Slider
              style={{ width: "100%", height: 30 }}
              minimumValue={0}
              maximumValue={playingTrack.durationSec}
              value={currentTime}
              onValueChange={setCurrentTime}
              tapToSeek={true}
              minimumTrackTintColor={palette.orange}
              maximumTrackTintColor={palette.border}
              thumbTintColor={palette.orange}
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingHorizontal: 2,
                marginTop: 4,
              }}
            >
              <AppText variant="micro" style={{ color: palette.orange, fontWeight: "700" }}>
                {formatTime(currentTime)}
              </AppText>
              <AppText variant="micro" tone="muted">
                {playingTrack.duration}
              </AppText>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  backButton: {
    marginLeft: -8,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trackInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  thumbnailContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginRight: 16,
    height: 32,
    justifyContent: "center",
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  playerContainer: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    padding: 16,
    borderWidth: 1,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  playerThumbnail: {
    width: 48,
    height: 48,
  },
  sliderContainer: {
    width: "100%",
  },
});
