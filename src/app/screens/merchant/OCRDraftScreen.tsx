import { useMerchantOperationScope } from "@/features/merchant/useMerchantOperationScope";
import { useRef as useMerchantRequestRef } from "react";
import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { Check, Edit2, RefreshCw, X } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  AccessibleImage,
  AppText,
  Button,
  ChipGroup,
  EmptyState,
  Input,
  Screen,
  StatusChip,
} from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { OCRDishDraft } from "@/types/domain";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";

import { parseMerchantPrice, runMerchantBatch } from "@/features/merchant/workflowSafety";

type NavigationProp = NativeStackNavigationProp<MerchantTabParamList, "OCRDrafts">;

export function OCRDraftScreen() {
  const captureOperation = useMerchantOperationScope();

  const { componentRadii, palette, spacing } = useHungryTheme();
  const navigation = useNavigation<NavigationProp>();
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [drafts, setDrafts] = useState<OCRDishDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setBusy(false);
    setEditing(null);
  }, [activeOutlet?.id]);
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    price: string;
    description: string;
  } | null>(null);

  const requestGeneration = useMerchantRequestRef(0);
  const currentOutlet = useMerchantRequestRef(activeOutlet?.id);
  currentOutlet.current = activeOutlet?.id;
  const loadDrafts = useCallback(async () => {
    const isOperationCurrent = captureOperation();
    if (!isOperationCurrent()) return;

    const request = ++requestGeneration.current;
    const outletId = activeOutlet?.id;
    const isCurrent = () =>
      request === requestGeneration.current && outletId === currentOutlet.current;
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
      if (!isOperationCurrent()) return;

      if (!isCurrent()) return;
      setDrafts(data.filter((draft) => draft.status === "pending"));
    } catch (e) {
      if (!isOperationCurrent()) return;

      if (!isCurrent()) return;
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load OCR drafts.");
    } finally {
      if (isOperationCurrent()) {
        if (isCurrent()) setIsLoading(false);
      }
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

  const accept = async (draftId: string) => {
    const isOperationCurrent = captureOperation();
    if (!isOperationCurrent()) return;

    const corrections =
      editing?.id === draftId
        ? {
            name: editing.name.trim(),
            price: parseMerchantPrice(editing.price),
            description: editing.description.trim(),
          }
        : undefined;
    if (corrections && !corrections.name) throw new Error("Dish name is required.");
    await getHungryService().merchant.acceptOCRDraft(draftId, corrections);
    if (!isOperationCurrent()) return;

    setDrafts((previous) => previous.filter((draft) => draft.id !== draftId));
    setEditing(null);
  };
  const handleAccept = async (draftId: string) => {
    const isOperationCurrent = captureOperation();
    if (!isOperationCurrent()) return;

    if (busy) return;
    setBusy(true);
    try {
      await accept(draftId);
      if (!isOperationCurrent()) return;

      Alert.alert("Dish added", "Your reviewed dish is now in the menu.");
    } catch (error) {
      if (!isOperationCurrent()) return;

      Alert.alert(
        "Could not add dish",
        error instanceof Error ? error.message : "Retry this draft.",
      );
    } finally {
      if (isOperationCurrent()) {
        setBusy(false);
      }
    }
  };
  const handleEditDraft = (draftId: string) => {
    const draft = drafts.find((item) => item.id === draftId);
    if (draft)
      setEditing({
        id: draft.id,
        name: draft.name,
        price: draft.price?.toString() ?? "",
        description: draft.suggestedDescription ?? "",
      });
  };
  const handleReject = async (draftId: string) => {
    const isOperationCurrent = captureOperation();
    if (!isOperationCurrent()) return;

    if (busy) return;
    setBusy(true);
    try {
      await getHungryService().merchant.rejectOCRDraft(draftId);
      if (!isOperationCurrent()) return;

      setDrafts((previous) => previous.filter((draft) => draft.id !== draftId));
    } catch (error) {
      if (!isOperationCurrent()) return;

      Alert.alert(
        "Could not reject draft",
        error instanceof Error ? error.message : "Please retry.",
      );
    } finally {
      if (isOperationCurrent()) {
        setBusy(false);
      }
    }
  };
  const handleBatchAccept = () => {
    if (busy) return;
    Alert.alert(
      "Accept reviewed drafts?",
      `Add ${drafts.length} dishes? Review names and prices first.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept All",
          onPress: async () => {
            const isOperationCurrent = captureOperation();
            if (!isOperationCurrent()) return;

            setBusy(true);
            try {
              const result = await runMerchantBatch(
                drafts,
                (draft) => accept(draft.id),
                isOperationCurrent,
              );
              if (!isOperationCurrent()) return;

              Alert.alert(
                "Menu scan results",
                `${result.succeeded.length} added. ${result.failed.length} could not be added and remain available to retry.`,
              );
            } finally {
              if (isOperationCurrent()) {
                setBusy(false);
              }
            }
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
            disabled={busy}
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
                  {draft.price !== undefined && (
                    <AppText variant="body" style={{ color: palette.orange }}>
                      ${draft.price.toFixed(2)}
                    </AppText>
                  )}
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

              {draft.suggestedDescription && (
                <AppText variant="bodySmall" tone="muted" style={{ marginBottom: spacing[3] }}>
                  {draft.suggestedDescription}
                </AppText>
              )}

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

              {editing?.id === draft.id ? (
                <View style={{ gap: spacing[2], marginBottom: spacing[3] }}>
                  <Input
                    label="Dish name"
                    value={editing.name}
                    onChangeText={(name) => setEditing({ ...editing, name })}
                  />
                  <Input
                    label="Price (SGD)"
                    value={editing.price}
                    keyboardType="decimal-pad"
                    onChangeText={(price) => setEditing({ ...editing, price })}
                  />
                  <Input
                    label="Description"
                    value={editing.description}
                    onChangeText={(description) => setEditing({ ...editing, description })}
                  />
                  <AppText variant="bodySmall" tone="muted">
                    Changes stay in this draft until you accept.
                  </AppText>
                </View>
              ) : null}
              <Button
                disabled={busy}
                label="Edit before adding"
                variant="secondary"
                fullWidth
                onPress={() => handleEditDraft(draft.id)}
                leftIcon={<Edit2 size={16} color={palette.textSecondary} />}
                style={{ marginBottom: spacing[2] }}
              />

              <View style={{ flexDirection: "row", gap: spacing[2] }}>
                <Button
                  disabled={busy}
                  label="Reject"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => handleReject(draft.id)}
                  leftIcon={<X size={16} color={palette.textSecondary} />}
                />
                <Button
                  disabled={busy}
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
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
});
