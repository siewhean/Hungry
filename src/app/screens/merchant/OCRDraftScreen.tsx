import React, { useState, useEffect, useCallback } from "react";
import { Image, View, StyleSheet, Alert } from "react-native";
import { Check, Edit2, RefreshCw, X } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { AppText, Button, Screen, Chip, EmptyState } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { OCRDishDraft } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";

type NavigationProp = NativeStackNavigationProp<MerchantTabParamList, "OCRDrafts">;

export function OCRDraftScreen() {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [drafts, setDrafts] = useState<OCRDishDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    if (!activeOutlet) {
      setDrafts([]);
      setError("No active outlet selected for menu scan.");
      setIsLoading(false);
      return;
    }

    try {
      const data = await getHungryService().merchant.getOCRDrafts(activeOutlet.id);
      setDrafts(data.filter((draft) => draft.status === "pending"));
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load OCR drafts.");
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  if (error) {
    return (
      <Screen title="Menu Photo Scan">
        <EmptyState
          title="Failed to load OCR drafts"
          body="The OCR draft list is currently unavailable."
          icon={<X size={40} color={palette.error} />}
          errorMessage={error}
          sendErrorContext="OCR draft list"
          ctaLabel="Retry"
          onPress={loadDrafts}
        />
      </Screen>
    );
  }

  const handleAccept = async (draftId: string, options: { silent?: boolean } = {}) => {
    try {
      await getHungryService().merchant.acceptOCRDraft(draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      if (!options.silent) {
        Alert.alert("Success", "Dish added to your menu.");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to accept draft.");
    }
  };

  const handleEditDraft = async (draftId: string) => {
    try {
      const dish = await getHungryService().merchant.acceptOCRDraft(draftId);
      setDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
      navigation.navigate("DishEditor", { dishId: dish.id });
    } catch (e) {
      Alert.alert("Error", "Failed to open OCR draft for editing.");
    }
  };

  const handleReject = async (draftId: string) => {
    try {
      await getHungryService().merchant.rejectOCRDraft(draftId);
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
              await handleAccept(draft.id, { silent: true });
            }
            Alert.alert("Success", "OCR drafts added to your menu.");
          },
        },
      ],
    );
  };

  return (
    <Screen title="Menu Photo Scan">
      <View style={{ gap: spacing[4], width: "100%" }}>
        <View
          style={{
            backgroundColor: palette.infoSoft,
            padding: spacing[4],
            borderRadius: componentRadii.card,
          }}
        >
          <AppText variant="bodyBold" style={{ color: palette.info }}>
            Review Extracted Dishes
          </AppText>
          <AppText variant="bodySmall" style={{ color: palette.info, marginTop: 4 }}>
            We scanned your uploaded menu photo and found these dishes. Review them before adding to
            your menu.
          </AppText>
        </View>

        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          <Button
            label="Add manually"
            variant="primary"
            style={{ flex: 1 }}
            onPress={() => navigation.navigate("DishEditor")}
            leftIcon={<Edit2 size={16} color={palette.white} />}
          />
          <Button
            label="Refresh scans"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={loadDrafts}
            leftIcon={<RefreshCw size={16} color={palette.textSecondary} />}
          />
        </View>

        {drafts.length > 0 && (
          <Button
            label={`Accept All (${drafts.length})`}
            variant="secondary"
            onPress={handleBatchAccept}
          />
        )}

        {drafts.length === 0 && !isLoading ? (
          <View style={[styles.emptyContainer, { padding: spacing[8], marginTop: spacing[8] }]}>
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
                  borderRadius: componentRadii.card,
                  padding: spacing[4],
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
                    borderRadius: componentRadii.button,
                  }}
                >
                  <Chip label={`${Math.round(draft.confidence * 100)}% Match`} selected={false} />
                </View>
              </View>

              {draft.sourcePhotoUrl ? (
                <Image
                  source={{ uri: draft.sourcePhotoUrl }}
                  style={[
                    styles.sourceImage,
                    { borderRadius: componentRadii.card, marginBottom: spacing[3] },
                  ]}
                />
              ) : null}

              {draft.suggestedDescription && (
                <AppText variant="bodySmall" tone="muted" style={{ marginBottom: spacing[3] }}>
                  {draft.suggestedDescription}
                </AppText>
              )}

              {draft.suggestedTasteTags && draft.suggestedTasteTags.length > 0 && (
                <View style={[styles.tagRow, { gap: spacing[2], marginBottom: spacing[3] }]}>
                  {draft.suggestedTasteTags.slice(0, 4).map((tag) => (
                    <Chip key={tag} label={tag} selected={false} />
                  ))}
                </View>
              )}

              {draft.suggestedDietaryTags && draft.suggestedDietaryTags.length > 0 && (
                <View style={[styles.tagRow, { gap: spacing[2], marginBottom: spacing[3] }]}>
                  {draft.suggestedDietaryTags.slice(0, 4).map((tag) => (
                    <Chip key={tag} label={tag.replace(/_/g, "-")} selected={false} />
                  ))}
                </View>
              )}

              <Button
                label="Edit before adding"
                variant="secondary"
                fullWidth
                onPress={() => handleEditDraft(draft.id)}
                leftIcon={<Edit2 size={16} color={palette.textSecondary} />}
                style={{ marginBottom: spacing[2] }}
              />

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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  draftCard: {
    borderWidth: 1,
  },
  sourceImage: {
    width: "100%",
    height: 160,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
});
