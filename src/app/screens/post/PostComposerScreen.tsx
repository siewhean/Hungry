import { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, useWindowDimensions, TextInput } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { Camera, ChevronRight, MapPin, X, Utensils } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, Card, Screen } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Post">;

export function PostComposerScreen({ navigation, route }: Props) {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);

  const [image, setImage] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  
  const initialVenueId = route.params?.venueId;
  const initialDishId = route.params?.dishId;
  
  const venue = useMemo(() => 
    initialVenueId ? mockRepository.getVenueById(initialVenueId) : mockRepository.listBuildings()[0].id ? mockRepository.listVenuesByBuilding(mockRepository.listBuildings()[0].id)[0] : undefined
  , [initialVenueId]);
  
  const dish = useMemo(() => 
    initialDishId ? mockRepository.getDishById(initialDishId) : venue ? mockRepository.listDishesByVenue(venue.id)[0] : undefined
  , [initialDishId, venue]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePublish = () => {
    if (!isAuthenticated) {
      setReturnRoute({ name: "Post", params: route.params });
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }

    if (!image) {
      showToast({ message: "Please select a photo first.", tone: "warning" });
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast({ message: "Posted successfully!", tone: "success" });
    navigation.navigate("MainTabs", { screen: "Home" });
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Custom Header */}
      <View style={{ 
        flexDirection: "row", 
        alignItems: "center", 
        justifyContent: "space-between", 
        paddingHorizontal: spacing[4], 
        paddingTop: spacing[12], 
        paddingBottom: spacing[3],
        backgroundColor: palette.bg,
        borderBottomWidth: 1,
        borderBottomColor: palette.border
      }}>
        <Pressable onPress={() => navigation.goBack()}>
          <X color={palette.text} size={24} />
        </Pressable>
        <AppText variant="h3">New Post</AppText>
        <Pressable onPress={handlePublish}>
          <AppText style={{ color: palette.orange, fontWeight: "700" }}>Publish</AppText>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing[8] }}>
        {/* Media Selection Area - Dominant Top */}
        <Pressable onPress={pickImage} style={{ width: screenWidth, height: screenWidth * 1.25, backgroundColor: palette.bgMuted, justifyContent: "center", alignItems: "center" }}>
          {image ? (
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={{ alignItems: "center", gap: spacing[2] }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: palette.bg, alignItems: "center", justifyContent: "center", ...shadows.floating }}>
                <Camera color={palette.orange} size={32} />
              </View>
              <AppText variant="bodySmall" tone="secondary">Tap to select photo or video</AppText>
            </View>
          )}
        </Pressable>

        {/* Input Controls */}
        <View style={{ padding: spacing[4], gap: spacing[5] }}>
          
          {/* Location / Venue Row */}
          <Pressable style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[2] }}>
            <View style={{ width: 40, height: 40, borderRadius: radii.md, backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center" }}>
              <MapPin color={palette.orange} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodySmall" tone="secondary">Location</AppText>
              <AppText variant="body" style={{ fontWeight: "600" }}>{venue?.name ?? "Select stall..."}</AppText>
            </View>
            <ChevronRight color={palette.textMuted} size={20} />
          </Pressable>

          {/* Dish Row */}
          <Pressable style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[2] }}>
            <View style={{ width: 40, height: 40, borderRadius: radii.md, backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center" }}>
              <Utensils color={palette.orange} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodySmall" tone="secondary">What did you eat?</AppText>
              <AppText variant="body" style={{ fontWeight: "600" }}>{dish?.name ?? "Select dish..."}</AppText>
            </View>
            <ChevronRight color={palette.textMuted} size={20} />
          </Pressable>

          <View style={{ height: 1, backgroundColor: palette.border }} />

          {/* Caption Input */}
          <View style={{ gap: spacing[2] }}>
            <AppText variant="h3">Caption</AppText>
            <TextInput
              style={{
                fontSize: 16,
                fontFamily: "Nunito_400Regular",
                color: palette.text,
                minHeight: 100,
                textAlignVertical: "top",
              }}
              placeholder="What makes this worth the queue?"
              placeholderTextColor={palette.textMuted}
              multiline
              value={caption}
              onChangeText={setCaption}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
