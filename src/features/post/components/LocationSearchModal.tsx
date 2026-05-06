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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const MOCK_LOCATIONS = [
  {
    id: "loc-1",
    name: "Old Airport Road Food Centre",
    address: "51 Old Airport Rd, Singapore",
    coordinate: { latitude: 1.3084, longitude: 103.8859 },
  },
  {
    id: "loc-2",
    name: "Maxwell Food Centre",
    address: "1 Kadayanallur St, Singapore",
    coordinate: { latitude: 1.2803, longitude: 103.8448 },
  },
  {
    id: "loc-3",
    name: "Newton Food Centre",
    address: "500 Clemenceau Ave N, Singapore",
    coordinate: { latitude: 1.312, longitude: 103.8392 },
  },
  {
    id: "loc-4",
    name: "Chomp Chomp Food Centre",
    address: "20 Kensington Park Rd, Singapore",
    coordinate: { latitude: 1.3645, longitude: 103.8665 },
  },
  {
    id: "loc-5",
    name: "Lau Pa Sat",
    address: "18 Raffles Quay, Singapore",
    coordinate: { latitude: 1.2808, longitude: 103.8504 },
  },
  {
    id: "loc-6",
    name: "Amoy Street Food Centre",
    address: "7 Maxwell Rd, Singapore",
    coordinate: { latitude: 1.2793, longitude: 103.8466 },
  },
  {
    id: "loc-7",
    name: "Tiong Bahru Food Centre",
    address: "30 Seng Poh Rd, Singapore",
    coordinate: { latitude: 1.285, longitude: 103.8322 },
  },
];

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

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedLoc, setSelectedLoc] = useState<(typeof MOCK_LOCATIONS)[0] | null>(
    () => MOCK_LOCATIONS.find((l) => l.id === currentLocation?.id) || null,
  );

  const [mapCenter, setMapCenter] = useState<Coordinate>(() => {
    const loc = MOCK_LOCATIONS.find((l) => l.id === currentLocation?.id);
    return loc ? (loc.coordinate as Coordinate) : { latitude: 1.29027, longitude: 103.851959 };
  });

  const filteredLocations = useMemo(() => {
    if (!searchQuery) return MOCK_LOCATIONS;
    const query = searchQuery.toLowerCase();
    return MOCK_LOCATIONS.filter(
      (loc) => loc.name.toLowerCase().includes(query) || loc.address.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  const handleSelectLocation = useCallback(
    (loc: (typeof MOCK_LOCATIONS)[0]) => {
      setSelectedLoc((prev) => {
        const isDeselecting = prev?.id === loc.id;
        if (!isDeselecting) {
          setMapCenter(loc.coordinate as Coordinate);
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
          coordinate: selectedLoc.coordinate as Coordinate,
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
