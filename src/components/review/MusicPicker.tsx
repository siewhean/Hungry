import { useState, useEffect, useMemo } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Audio } from "expo-av";
import { Music, Play, Pause, Check, Search } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText, Card, Input } from "../ui";
import { TRENDING_MUSIC, type MusicTrack } from "@/features/review/musicData";

interface MusicPickerProps {
  selectedMusicId?: string;
  onSelectMusic: (id?: string) => void;
}

export function MusicPicker({ selectedMusicId, onSelectMusic }: MusicPickerProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const filteredMusic = useMemo(() => {
    if (!query.trim()) return TRENDING_MUSIC;
    const lowerQuery = query.toLowerCase();
    return TRENDING_MUSIC.filter(
      (track) =>
        track.title.toLowerCase().includes(lowerQuery) ||
        track.artist.toLowerCase().includes(lowerQuery)
    );
  }, [query]);

  const handleTogglePlay = async (track: MusicTrack) => {
    if (playingId === track.id) {
      await sound?.pauseAsync();
      setPlayingId(null);
      return;
    }

    if (sound) {
      await sound.unloadAsync();
    }

    const { sound: newSound } = await Audio.Sound.createAsync({ uri: track.url }, { shouldPlay: true });
    setSound(newSound);
    setPlayingId(track.id);

    newSound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.isLoaded && status.didJustFinish) {
        setPlayingId(null);
      }
    });
  };

  return (
    <View style={{ gap: spacing[4], flex: 1 }}>
      <Input
        placeholder="Search for music..."
        value={query}
        onChangeText={setQuery}
        leftIcon={<Search size={18} color={palette.textMuted} />}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2], paddingBottom: 40 }}>
        {filteredMusic.map((track) => {
          const isSelected = selectedMusicId === track.id;
          const isPlaying = playingId === track.id;

          return (
            <Pressable
              key={track.id}
              onPress={() => handleTogglePlay(track)}
            >
              <Card
                style={{
                  padding: spacing[3],
                  borderColor: isSelected ? palette.orange : palette.border,
                  borderWidth: isSelected ? 2 : 1,
                  backgroundColor: isSelected ? palette.orangeLight : palette.surface,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radii.pill,
                    backgroundColor: isPlaying ? palette.orange : palette.bgSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isPlaying ? (
                    <Pause size={20} color={palette.white} fill={palette.white} />
                  ) : (
                    <View style={{ marginLeft: 2 }}>
                      <Play size={20} color={palette.orange} fill={palette.orange} />
                    </View>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <AppText variant="bodyBold" numberOfLines={1}>
                    {track.title}
                  </AppText>
                  <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                    {track.artist}
                  </AppText>
                </View>

                <Pressable 
                  onPress={(e) => {
                    e.stopPropagation();
                    onSelectMusic(isSelected ? undefined : track.id);
                  }}
                  style={{
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[1.5],
                    backgroundColor: isSelected ? palette.orange : palette.bgSoft,
                    borderRadius: radii.pill,
                  }}
                >
                  <AppText variant="micro" style={{ color: isSelected ? palette.white : palette.text, fontWeight: "700" }}>
                    {isSelected ? "SELECTED" : "SELECT"}
                  </AppText>
                </Pressable>
              </Card>
            </Pressable>
          );
        })}

        {filteredMusic.length === 0 && (
          <View style={{ paddingVertical: spacing[8], alignItems: "center" }}>
            <AppText tone="secondary">No music found for "{query}"</AppText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
