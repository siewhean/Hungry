import { useState, useMemo } from "react";
import { View, Pressable, ScrollView, Modal, Dimensions } from "react-native";
import { Canvas, ColorMatrix, Image, useImage } from "@shopify/react-native-skia";
import { X, Check } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText, Button } from "../ui";
import { FILTERS } from "@/features/review/filterData";

interface MediaEditorProps {
  uri: string;
  isVisible: boolean;
  onClose: () => void;
  onSave: (filterId: string) => void;
  initialFilterId?: string;
}

const { width } = Dimensions.get("window");
const PREVIEW_SIZE = width - 40;

export function MediaEditor({
  uri,
  isVisible,
  onClose,
  onSave,
  initialFilterId = "none",
}: MediaEditorProps) {
  const { componentRadii, palette, spacing, shadows } = useHungryTheme();
  const [selectedFilterId, setSelectedFilterId] = useState(initialFilterId);
  const skiaImage = useImage(uri);

  const activeFilter = useMemo(
    () => FILTERS.find((f) => f.id === selectedFilterId) || FILTERS[0],
    [selectedFilterId],
  );

  if (!skiaImage) return null;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={{ flex: 1, backgroundColor: palette.bg, padding: spacing[4], paddingTop: 60 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing[4],
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close media editor"
            accessibilityHint="Closes the editor without applying the selected filter"
            onPress={onClose}
          >
            <X size={24} color={palette.text} />
          </Pressable>
          <AppText accessibilityRole="header" variant="h2">
            Edit Media
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save edited media"
            accessibilityHint={`Applies the ${activeFilter.name} filter and closes the editor`}
            onPress={() => onSave(selectedFilterId)}
          >
            <Check size={24} color={palette.orange} />
          </Pressable>
        </View>

        <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Media preview with ${activeFilter.name} filter`}
            style={{
              width: PREVIEW_SIZE,
              height: PREVIEW_SIZE,
              borderRadius: componentRadii.card,
              overflow: "hidden",
              backgroundColor: palette.bgMuted,
              ...shadows.card,
            }}
          >
            <Canvas accessibilityElementsHidden importantForAccessibility="no" style={{ flex: 1 }}>
              <Image
                image={skiaImage}
                x={0}
                y={0}
                width={PREVIEW_SIZE}
                height={PREVIEW_SIZE}
                fit="cover"
              >
                <ColorMatrix matrix={activeFilter.matrix} />
              </Image>
            </Canvas>
          </View>
        </View>

        <View style={{ height: 140 }}>
          <AppText variant="bodySmall" tone="secondary" style={{ marginBottom: spacing[2] }}>
            Choose a Filter
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[3] }}
          >
            {FILTERS.map((filter) => {
              const isSelected = selectedFilterId === filter.id;
              return (
                <Pressable
                  key={filter.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${filter.name} filter preview`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelectedFilterId(filter.id)}
                  style={{ alignItems: "center", gap: spacing[2] }}
                >
                  <View
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: componentRadii.card,
                      borderWidth: isSelected ? 3 : 1,
                      borderColor: isSelected ? palette.orange : palette.border,
                      overflow: "hidden",
                    }}
                  >
                    <Canvas
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                      style={{ flex: 1 }}
                    >
                      <Image image={skiaImage} x={0} y={0} width={70} height={70} fit="cover">
                        <ColorMatrix matrix={filter.matrix} />
                      </Image>
                    </Canvas>
                  </View>
                  <AppText variant="micro" style={{ fontWeight: isSelected ? "700" : "400" }}>
                    {filter.name}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <Button
          label="Apply & Save"
          onPress={() => onSave(selectedFilterId)}
          style={{ marginTop: spacing[4] }}
        />
      </View>
    </Modal>
  );
}
