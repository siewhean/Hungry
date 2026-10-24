import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { Check, Edit2, RefreshCw, X } from "lucide-react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  AccessibleImage,
  AppText,
  Button,
  ChipGroup,
  EmptyState,
  Screen,
  StatusChip,
} from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import { reportError } from "@/lib/monitoring/reportError";
import { useMerchantDialog } from "@/features/merchant/useMerchantDialog";
import type { OCRDishDraft } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";

type NavigationProp = NativeStackNavigationProp<MerchantTabParamList, "OCRDrafts">;

export function OCRDraftScreen() {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const { showAlert, dialog } = useMerchantDialog();

  const [drafts, setDrafts] = useState<OCRDishDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busyDraftIds = useRef(new Set<string>());

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
      reportError(e, { screen: "OCRDraft", action: "load_drafts" });
      setError(e instanceof Error ? e.message : "Failed to load photo drafts.");
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet]);

  // Reload on focus so a draft saved from the editor drops off the list.
  useFocusEffect(
    useCallback(() => {
      void loadDrafts();
    }, [loadDrafts]),
  );

  if (error) {
    return (
      <Screen title="Photo drafts">
        <EmptyState
          title="Failed to load photo drafts"
          body="The photo draft list is currently unavailable."
          icon={<X size={40} color={palette.error} />}
          errorMessage={error}
          sendErrorContext="OCR draft list"
          ctaLabel="Retry"
          onPress={loadDrafts}
        />
      </Screen>
    );
  }

  const handleAccept = async (
    draftId: string,
    options: { silent?: boolean } = {},
  ): Promise<boolean> => {
    if (busyDraftIds.current.has(draftId)) return false;
    busyDraftIds.current.add(draftId);
    try {
      await getHungryService().merchant.acceptOCRDraft(draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      if (!options.silent) {
        showAlert("Success", "Dish added to your menu.");
      }
      return true;
    } catch (e) {
      reportError(e, { screen: "OCRDraft", action: "accept_draft" });
      if (!options.silent) showAlert("Error", "Failed to accept draft.");
      return false;
    } finally {
      busyDraftIds.current.delete(draftId);
    }
  };

  // Nothing is published until the merchant saves the pre-filled editor.
  const handleEditDraft = (draftId: string) => {
    navigation.navigate("DishEditor", { ocrDraftId: draftId });
  };

  const handleReject = async (draftId: string) => {
    try {
      await getHungryService().merchant.rejectOCRDraft(draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    } catch (e) {
      reportError(e, { screen: "OCRDraft", action: "reject_draft" });
      showAlert("Error", "Failed to reject draft.");
    }
  };

  const handleBatchAccept = async () => {
    showAlert("Accept All", `Are you sure you want to add ${drafts.length} dishes to your menu?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Accept All",
        onPress: async () => {
          const draftIds = drafts
            .map((draft) => draft.id)
            .filter((id) => !busyDraftIds.current.has(id));
          let acceptedIds: string[] = [];
          let failed = drafts.length;
          draftIds.forEach((id) => busyDraftIds.current.add(id));
          try {
            const result = await getHungryService().merchant.acceptOCRDrafts(draftIds);
            acceptedIds = result.acceptedIds;
            failed = drafts.length - acceptedIds.length;
          } catch {
            // Every draft stays listed so the merchant can try again.
          } finally {
            draftIds.forEach((id) => busyDraftIds.current.delete(id));
          }
          const accepted = new Set(acceptedIds);
          setDrafts((prev) => prev.filter((d) => !accepted.has(d.id)));
          const added = drafts.length - failed;
          if (failed === 0) {
            showAlert("Success", `${added} ${added === 1 ? "dish" : "dishes"} added to your menu.`);
          } else {
            showAlert(
              "Some drafts were not added",
              `${added} added, ${failed} failed. The failed drafts are still listed so you can try again.`,
            );
          }
        },
      },
    ]);
  };

  return (
    <Screen title="Photo drafts">
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
            Dishes found in your menu photos are listed here. Review them before adding them to your
            menu.
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
              No pending photo drafts to review.
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
                  {typeof draft.price === "number" && draft.price > 0 ? (
                    <AppText variant="body" style={{ color: palette.orange }}>
                      S${draft.price.toFixed(2)}
                    </AppText>
                  ) : null}
                </View>
                <StatusChip
                  label={`${Math.round(draft.confidence * 100)}% Match`}
                  tone={draft.confidence > 0.8 ? "success" : "warning"}
                />
              </View>

              {draft.sourcePhotoUrl ? (
                <AccessibleImage
                  source={{ uri: draft.sourcePhotoUrl }}
                  style={[
                    styles.sourceImage,
                    { borderRadius: componentRadii.card, marginBottom: spacing[3] },
                  ]}
                  accessibilityLabel={`${draft.name} source menu photo`}
                />
              ) : null}

              {draft.suggestedDescription ? (
                <AppText variant="bodySmall" tone="muted" style={{ marginBottom: spacing[3] }}>
                  {draft.suggestedDescription}
                </AppText>
              ) : null}

              {draft.suggestedTasteTags && draft.suggestedTasteTags.length > 0 && (
                <ChipGroup
                  options={draft.suggestedTasteTags
                    .slice(0, 4)
                    .map((tag) => ({ id: tag, label: tag }))}
                  style={{ marginBottom: spacing[3] }}
                />
              )}

              {draft.suggestedDietaryTags && draft.suggestedDietaryTags.length > 0 && (
                <ChipGroup
                  options={draft.suggestedDietaryTags.slice(0, 4).map((tag) => ({
                    id: tag,
                    label: tag.replace(/_/g, "-"),
                  }))}
                  style={{ marginBottom: spacing[3] }}
                />
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
      {dialog}
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
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
});
