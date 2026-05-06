import React, { useState, useCallback, useMemo } from "react";
import { View, StyleSheet, Pressable, Platform, FlatList, Dimensions } from "react-native";
import { MapPin, Search, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { BottomSheetModal, BottomSheetBackdrop, useBottomSheet } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from "react-native-reanimated";

import { AppText, Input, IconButton } from "@/components/ui";
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
  const { palette } = useHungryTheme();
  const { animatedIndex } = useBottomSheet();
  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => {
    const targetPadding = Platform.OS === "ios" ? Math.max(insets.top, 16) : 16;
    const paddingTop = interpolate(
      animatedIndex.value,
      [0, 1],
      [16, targetPadding],
      Extrapolation.CLAMP,
    );

    return {
      paddingTop,
    };
  });

  return (
    <Animated.View style={[styles.header, animatedStyle]}>
      <AppText variant="h3">Select Location</AppText>
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

  const style = useAnimatedStyle(() => {
    const base = Platform.OS === "ios" ? 40 : 20;
    const height = interpolate(
      animatedIndex.value,
      [0, 1],
      [SCREEN_HEIGHT * 0.1 + base, base],
      Extrapolation.CLAMP,
    );
    return { height };
  });

  return <Animated.View style={style} />;
}

export function LocationSearchModal({ innerRef }: LocationSearchModalProps) {
  const { palette, radii, spacing } = useHungryTheme();
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
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    [],
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
      backgroundStyle={{ backgroundColor: palette.surface }}
      handleIndicatorStyle={{ backgroundColor: palette.border }}
    >
      <View style={{ flex: 1 }}>
        <DynamicHeader onClose={() => innerRef.current?.dismiss()} />

        <View style={styles.searchContainer}>
          <Input
            placeholder="Search stalls, malls or streets..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={18} color={palette.textMuted} />}
            rightIcon={
              searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
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
                { backgroundColor: palette.surfaceGlass, borderRadius: radii.md },
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
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                marginTop: 60,
                paddingHorizontal: 16,
              }}
            >
              <MapPin size={48} color={palette.textMuted} style={{ marginBottom: 16 }} />
              <AppText tone="secondary" style={{ textAlign: "center" }}>
                No locations found matching {`"${searchQuery}"`}
              </AppText>
            </View>
          }
          ListFooterComponent={<DynamicFooter />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelectLocation(item)}
              style={({ pressed }) => [
                styles.locationItem,
                {
                  backgroundColor:
                    selectedLoc?.id === item.id
                      ? palette.orangeLight
                      : pressed
                        ? palette.surfaceRaised
                        : "transparent",
                  borderRadius: radii.md,
                },
              ]}
            >
              <MapPin
                size={20}
                color={selectedLoc?.id === item.id ? palette.orange : palette.textMuted}
              />
              <View style={{ flex: 1, gap: 2 }}>
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
          style={{ flex: 1, paddingHorizontal: 16, marginTop: spacing["4"] }}
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
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  mapWrapper: {
    height: 260,
    width: "100%",
    position: "relative",
  },
  locCard: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
});
