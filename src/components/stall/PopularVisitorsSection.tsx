import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Star } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Avatar, BottomSheet, Button } from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useHungryTheme } from "@/theme";
import type { PopularVisitorPin } from "@/types/domain";

type Navigation = NativeStackNavigationProp<RootStackParamList>;

interface PopularVisitorsSectionProps {
  venueId: string;
  horizontalPadding?: number;
  style?: StyleProp<ViewStyle>;
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

export function PopularVisitorsSection({
  venueId,
  horizontalPadding,
  style,
}: PopularVisitorsSectionProps) {
  const navigation = useNavigation<Navigation>();
  const { componentRadii, palette, spacing } = useHungryTheme();
  const actionSheetRef = useRef<BottomSheetModal>(null);
  const reviewSheetRef = useRef<BottomSheetModal>(null);
  const [pins, setPins] = useState<PopularVisitorPin[] | null>(null);
  const [selectedPin, setSelectedPin] = useState<PopularVisitorPin | null>(null);

  useEffect(() => {
    let isMounted = true;
    void getHungryService()
      .content.listPopularVisitorPinsByVenue(venueId)
      .then((data) => {
        if (isMounted) setPins(data);
      })
      .catch(() => {
        if (isMounted) setPins([]);
      });
    return () => {
      isMounted = false;
    };
  }, [venueId]);

  const openActions = useCallback((pin: PopularVisitorPin) => {
    setSelectedPin(pin);
    requestAnimationFrame(() => actionSheetRef.current?.present());
  }, []);

  const openProfile = useCallback(() => {
    const pin = selectedPin;
    actionSheetRef.current?.dismiss();
    if (!pin) return;
    navigation.navigate("UserProfile", {
      authorName: pin.authorName,
      authorAvatarUrl: pin.authorAvatarUrl,
      authorLocation: pin.authorLocation,
      authorId: pin.authorProfileId,
      reviewSignalLabel: "Featured visitor",
    });
  }, [navigation, selectedPin]);

  const openReview = useCallback(() => {
    if (!selectedPin) return;
    actionSheetRef.current?.dismiss();
    requestAnimationFrame(() => reviewSheetRef.current?.present());
  }, [selectedPin]);

  if (!pins || pins.length === 0) {
    return null;
  }
  const sectionPadding = horizontalPadding ?? spacing[4];

  return (
    <View style={[{ gap: spacing[3] }, style]}>
      <View style={{ paddingHorizontal: sectionPadding }}>
        <AppText variant="h3" style={{ fontWeight: "800" }}>
          Popular visitors
        </AppText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: sectionPadding, gap: spacing[3] }}
      >
        {pins.slice(0, 6).map((pin) => (
          <Pressable
            key={pin.id}
            accessibilityRole="button"
            accessibilityLabel={`Open featured visitor ${pin.authorName}`}
            onPress={() => openActions(pin)}
            style={({ pressed }) => ({
              width: 128,
              borderWidth: 1,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
              backgroundColor: pressed ? palette.surfaceRaised : palette.surface,
              padding: spacing[3],
              gap: spacing[2],
            })}
          >
            <Avatar uri={pin.authorAvatarUrl} name={pin.authorName} size={48} />
            <View style={{ gap: spacing[1] }}>
              <AppText variant="bodySmallBold" numberOfLines={1}>
                {pin.authorName}
              </AppText>
              <AppText variant="micro" tone="muted">
                {formatShortDate(pin.visitedAt)}
              </AppText>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <BottomSheet ref={actionSheetRef} snapPoints={["28%"]} accessibilityLabel="Visitor actions">
        <View style={{ gap: spacing[3] }}>
          {selectedPin ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
              <Avatar uri={selectedPin.authorAvatarUrl} name={selectedPin.authorName} size={44} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyBold" numberOfLines={1}>
                  {selectedPin.authorName}
                </AppText>
                <AppText variant="bodySmall" tone="muted">
                  {selectedPin.dishName ?? "Review"} - {formatShortDate(selectedPin.visitedAt)}
                </AppText>
              </View>
            </View>
          ) : null}
          <Button label="View profile" variant="secondary" onPress={openProfile} />
          <Button label="View review" variant="secondary" onPress={openReview} />
        </View>
      </BottomSheet>

      <BottomSheet ref={reviewSheetRef} snapPoints={["48%"]} accessibilityLabel="Visitor review">
        {selectedPin ? (
          <View style={{ gap: spacing[3] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
              <Avatar uri={selectedPin.authorAvatarUrl} name={selectedPin.authorName} size={44} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyBold">{selectedPin.authorName}</AppText>
                <AppText variant="bodySmall" tone="muted">
                  {selectedPin.dishName ?? "Stall review"} -{" "}
                  {formatShortDate(selectedPin.visitedAt)}
                </AppText>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: spacing[1] }}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  size={16}
                  color={index < Math.round(selectedPin.rating) ? palette.amber : palette.border}
                  fill={index < Math.round(selectedPin.rating) ? palette.amber : "transparent"}
                />
              ))}
            </View>
            <AppText variant="body" tone="secondary">
              {selectedPin.reviewText}
            </AppText>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}
