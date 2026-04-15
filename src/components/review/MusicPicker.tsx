import { useState, useEffect } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Audio } from "expo-av";
import { Music, Play, Pause, Check } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText, Card } from "../ui";
import { TRENDING_MUSIC, type MusicTrack } from "@/features/review/musicData";

interface MusicPickerProps {
  selectedMusicId?: string;
  onSelectMusic: (id?: string) => void;
}

export function MusicPicker({ selectedMusicId, onSelectMusic }: MusicPickerProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

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

    newSound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        setPlayingId(null);
      }
    });
  };

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <Music size={18} color={palette.orange} />
        <AppText variant="h3">Add Music</AppText>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[3] }}>
        {TRENDING_MUSIC.map((track) => {
          const isSelected = selectedMusicId === track.id;
          const isPlaying = playingId === track.id;

          return (
            <Pressable
              key={track.id}
              onPress={() => onSelectMusic(isSelected ? undefined : track.id)}
              style={({ pressed }) => [
                {
                  width: 140,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Card
                style={{
                  padding: spacing[3],
                  borderColor: isSelected ? palette.orange : palette.border,
                  borderWidth: isSelected ? 2 : 1,
                  backgroundColor: isSelected ? palette.orangeLight : palette.surface,
                }}
              >
                <View style={{ gap: spacing[2] }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleTogglePlay(track);
                      }}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: radii.pill,
                        backgroundColor: palette.orange,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isPlaying ? (
                        <Pause size={16} color={palette.white} fill={palette.white} />
                      ) : (
                        <Play size={16} color={palette.white} fill={palette.white} />
                      )}
                    </Pressable>
                    {isSelected && <Check size={16} color={palette.orange} />}
                  </View>
                  <View>
                    <AppText variant="bodySmall" style={{ fontWeight: "700" }} numberOfLines={1}>
                      {track.title}
                    </AppText>
                    <AppText variant="micro" tone="secondary" numberOfLines={1}>
                      {track.artist}
                    </AppText>
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
