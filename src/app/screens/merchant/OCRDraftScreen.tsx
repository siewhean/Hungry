import React, { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet, Alert, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Check, X, Edit2 } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { AppText, Button, IconButton, Screen, Chip } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { hungryService } from "@/lib/services/mock/mockService";
import type { OCRDishDraft } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";

type NavigationProp = NativeStackNavigationProp<MerchantTabParamList, "OCRDrafts">;

export function OCRDraftScreen() {
  const { palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const insets = useSafeAreaInsets();

  const [drafts, setDrafts] = useState<OCRDishDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDrafts() {
      if (activeOutlet) {
        try {
          const data = await hungryService.merchant.getOCRDrafts(activeOutlet.id);
          setDrafts(data.filter((d) => d.status === "pending"));
        } catch (e) {
          console.error(e);
        }
      }
      setIsLoading(false);
    }
    loadDrafts();
  }, [activeOutlet]);

  const handleAccept = async (draftId: string) => {
    try {
      await hungryService.merchant.acceptOCRDraft(draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      Alert.alert("Success", "Dish added to your menu.");
    } catch (e) {
      Alert.alert("Error", "Failed to accept draft.");
    }
  };

  const handleReject = async (draftId: string) => {
    try {
      await hungryService.merchant.rejectOCRDraft(draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    } catch (e) {
      Alert.alert("Error", "Failed to reject draft.");
    }
  };

  const handleBatchAccept = async () => {
    Alert.alert(
      "Accept All",
      `Are you sure you want to add ${drafts.length} dishes to your menu?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept All",
          onPress: async () => {
            for (const draft of drafts) {
              await handleAccept(draft.id);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen style={{ backgroundColor: palette.bg }}>
      <View style={[styles.header, { paddingTop: spacing[3], paddingHorizontal: spacing[4] }]}>
        <IconButton
          accessibilityLabel="Go back"
          icon={<ChevronLeft size={24} color={palette.text} />}
          onPress={() => navigation.goBack()}
        />
        <AppText variant="h2" style={{ fontWeight: "800" }}>
          Menu Photo Scan
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing[4], gap: spacing[4], paddingBottom: 100 }}
      >
        <View
          style={{ backgroundColor: palette.infoSoft, padding: spacing[4], borderRadius: radii.md }}
        >
          <AppText variant="bodyBold" style={{ color: palette.info }}>
            Review Extracted Dishes
          </AppText>
          <AppText variant="bodySmall" style={{ color: palette.info, marginTop: 4 }}>
            We scanned your uploaded menu photo and found these dishes. Review them before adding to
            your menu.
          </AppText>
        </View>

        {drafts.length > 0 && (
          <Button
            label={`Accept All (${drafts.length})`}
            variant="secondary"
            onPress={handleBatchAccept}
          />
        )}

        {drafts.length === 0 && !isLoading ? (
          <View style={styles.emptyContainer}>
            <Check size={48} color={palette.success} />
            <AppText variant="bodyBold" style={{ marginTop: spacing[3] }}>
              All caught up!
            </AppText>
            <AppText variant="bodySmall" tone="muted" style={{ marginTop: 4 }}>
              No pending menu scans to review.
            </AppText>
          </View>
        ) : (
          drafts.map((draft) => (
            <View
              key={draft.id}
              style={[
                styles.draftCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  borderRadius: radii.lg,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: spacing[3],
                }}
              >
                <View>
                  <AppText variant="bodyBold">{draft.name}</AppText>
                  {draft.price && (
                    <AppText variant="body" style={{ color: palette.orange }}>
                      ${draft.price.toFixed(2)}
                    </AppText>
                  )}
                </View>
                <View
                  style={{
                    backgroundColor:
                      draft.confidence > 0.8 ? palette.successSoft : palette.warningSoft,
                    borderRadius: 16,
                  }}
                >
                  <Chip label={`${Math.round(draft.confidence * 100)}% Match`} selected={false} />
                </View>
              </View>

              {draft.suggestedDescription && (
                <AppText variant="bodySmall" tone="muted" style={{ marginBottom: spacing[3] }}>
                  {draft.suggestedDescription}
                </AppText>
              )}

              <View style={{ flexDirection: "row", gap: spacing[2] }}>
                <Button
                  label="Reject"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => handleReject(draft.id)}
                  leftIcon={<X size={16} color={palette.textSecondary} />}
                />
                <Button
                  label="Accept"
                  variant="primary"
                  style={{ flex: 1 }}
                  onPress={() => handleAccept(draft.id)}
                  leftIcon={<Check size={16} color={palette.white} />}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  draftCard: {
    padding: 16,
    borderWidth: 1,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
  },
});
