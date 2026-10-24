import React, { useState, useCallback, useMemo, type ComponentProps } from "react";
import { View, StyleSheet, Pressable, Platform, FlatList, Dimensions } from "react-native";
import { MapPin, Search, X } from "lucide-react-native";
import * as Haptics from "@/lib/haptics";
import { BottomSheetModal, BottomSheetBackdrop, useBottomSheet } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from "react-native-reanimated";

import { AppText, EmptyState, Input, IconButton } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useComposerStore } from "../useComposerStore";
import { MapSurface, MapSurfaceMarker } from "@/components/map/MapSurface";
import type { Coordinate } from "@/types/domain";
import {
  listComposerLocationOptions,
  type ComposerLocationOption,
} from "@/features/post/composerOptions";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface LocationSearchModalProps {
  innerRef: React.RefObject<BottomSheetModal | null>;
}

function DynamicHeader({ onClose }: { onClose: () => void }) {
  const { componentRadii, palette, semanticSpacing, spacing } = useHungryTheme();
  const { animatedIndex } = useBottomSheet();
  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => {
    const targetPadding =
      Platform.OS === "ios"
        ? Math.max(insets.top, semanticSpacing.screenEdge)
        : semanticSpacing.screenEdge;
    const paddingTop = interpolate(
      animatedIndex.value,
      [0, 1],
      [semanticSpacing.screenEdge, targetPadding],
      Extrapolation.CLAMP,
    );

    return {
      paddingTop,
    };
  });

  return (
    <Animated.View
      style={[
        styles.header,
        { marginBottom: spacing[2], paddingHorizontal: semanticSpacing.screenEdge },
        animatedStyle,
      ]}
    >
      <AppText variant="h3">Select location</AppText>
      <IconButton
        icon={<X size={24} color={palette.text} />}
        accessibilityLabel="Close"
        onPress={onClose}
      />
    </Animated.View>
  );
}

function DynamicFooter() {
  const { animatedIndex } = useBottomSheet();
  const { spacing } = useHungryTheme();
  const baseFooterHeight = Platform.OS === "ios" ? spacing[8] + spacing[2] : spacing[5];

  const style = useAnimatedStyle(() => {
    const height = interpolate(
      animatedIndex.value,
      [0, 1],
      [SCREEN_HEIGHT * 0.1 + baseFooterHeight, baseFooterHeight],
      Extrapolation.CLAMP,
    );
    return { height };
  });

  return <Animated.View style={style} />;
}

export function LocationSearchModal({ innerRef }: LocationSearchModalProps) {
  const { componentRadii, opacity, palette, radii, semanticSpacing, shadows, spacing } =
    useHungryTheme();
  const currentLocation = useComposerStore((state) => state.location);
  const setLocation = useComposerStore((state) => state.setLocation);
  const locationOptions = useMemo(() => listComposerLocationOptions(), []);

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedLoc, setSelectedLoc] = useState<ComposerLocationOption | null>(
    () => locationOptions.find((l) => l.id === currentLocation?.id) || null,
  );

  const [mapCenter, setMapCenter] = useState<Coordinate>(() => {
    const loc = locationOptions.find((l) => l.id === currentLocation?.id) ?? locationOptions[0];
    return loc ? loc.coordinate : { latitude: 1.29027, longitude: 103.851959 };
  });

  const filteredLocations = useMemo(() => {
    if (!searchQuery) return locationOptions;
    const query = searchQuery.toLowerCase();
    return locationOptions.filter(
      (loc) => loc.name.toLowerCase().includes(query) || loc.address.toLowerCase().includes(query),
    );
  }, [locationOptions, searchQuery]);

  const handleSelectLocation = useCallback(
    (loc: ComposerLocationOption) => {
      setSelectedLoc((prev) => {
        const isDeselecting = prev?.id === loc.id;
        if (!isDeselecting) {
          setMapCenter(loc.coordinate);
          setLocation({ id: loc.id, name: loc.name, address: loc.address });
        } else {
          setLocation(null);
        }
        return isDeselecting ? null : loc;
      });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [setLocation],
  );

  const markers = useMemo((): MapSurfaceMarker[] => {
    if (selectedLoc) {
      return [
        {
          id: selectedLoc.id,
          label: selectedLoc.name,
          coordinate: selectedLoc.coordinate,
        },
      ];
    }
    return [];
  }, [selectedLoc]);

  const renderBackdrop = useCallback(
    (props: ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={opacity.backdrop}
        accessibilityRole="button"
        accessibilityLabel="Close location search"
        accessibilityHint="Dismisses the location search sheet"
      />
    ),
    [opacity.backdrop],
  );

  const snapPoints = useMemo(() => ["90%", "100%"], []);

  return (
    <BottomSheetModal
      ref={innerRef}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      keyboardBehavior="interactive"
      backdropComponent={renderBackdrop}
      accessibilityLabel="Location search"
      accessibilityViewIsModal
      backgroundStyle={{ backgroundColor: palette.surface }}
      handleIndicatorStyle={{ backgroundColor: palette.border }}
    >
      <View style={{ flex: 1 }}>
        <DynamicHeader onClose={() => innerRef.current?.dismiss()} />

        <View
          style={[
            styles.searchContainer,
            { marginBottom: spacing[2], paddingHorizontal: semanticSpacing.screenEdge },
          ]}
        >
          <Input
            placeholder="Search stalls, malls or streets..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={18} color={palette.textMuted} />}
            rightIcon={
              searchQuery.length > 0 ? (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear location search"
                  accessibilityHint="Clears the current location search text"
                  style={{ padding: spacing[1] }}
                >
                  <X size={16} color={palette.textMuted} />
                </Pressable>
              ) : undefined
            }
          />
        </View>

        <View style={[styles.mapWrapper, { backgroundColor: palette.bgSoft }]}>
          <MapSurface
            centerCoordinate={mapCenter}
            markers={markers}
            zoomLevel={15}
            style={StyleSheet.absoluteFill}
          />
          {selectedLoc && (
            <View
              style={[
                styles.locCard,
                {
                  ...shadows.card,
                  backgroundColor: palette.surfaceGlass,
                  borderRadius: componentRadii.card,
                  bottom: spacing[3],
                  left: spacing[3],
                  padding: spacing[3],
                  right: spacing[3],
                },
              ]}
            >
              <AppText variant="bodyBold">{selectedLoc.name}</AppText>
              <AppText variant="micro" tone="secondary" numberOfLines={1}>
                {selectedLoc.address}
              </AppText>
            </View>
          )}
        </View>

        <FlatList
          data={filteredLocations}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={true}
          ListEmptyComponent={
            <EmptyState
              title="No locations found"
              body={`Try another location query for "${searchQuery}".`}
              icon={<MapPin size={34} color={palette.textMuted} />}
            />
          }
          ListFooterComponent={<DynamicFooter />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelectLocation(item)}
              accessibilityRole="button"
              accessibilityLabel={`Select location ${item.name}, ${item.address}`}
              accessibilityHint="Sets this as the location for the post"
              accessibilityState={{ selected: selectedLoc?.id === item.id }}
              style={({ pressed }) => [
                styles.locationItem,
                {
                  backgroundColor:
                    selectedLoc?.id === item.id
                      ? palette.orangeLight
                      : pressed
                        ? palette.surfaceRaised
                        : "transparent",
                  borderRadius: componentRadii.card,
                  gap: spacing[3],
                  padding: spacing[3],
                },
              ]}
            >
              <MapPin
                size={20}
                color={selectedLoc?.id === item.id ? palette.orange : palette.textMuted}
              />
              <View style={{ flex: 1, gap: spacing[0.5] }}>
                <AppText
                  variant="bodyBold"
                  style={{ color: selectedLoc?.id === item.id ? palette.orange : palette.text }}
                >
                  {item.name}
                </AppText>
                <AppText variant="micro" tone="secondary">
                  {item.address}
                </AppText>
              </View>
            </Pressable>
          )}
          style={{ flex: 1, paddingHorizontal: semanticSpacing.screenEdge, marginTop: spacing[4] }}
          contentContainerStyle={{ paddingTop: 0 }}
        />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchContainer: {},
  mapWrapper: {
    height: 260,
    width: "100%",
    position: "relative",
  },
  locCard: {
    position: "absolute",
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
  },
});
