import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { AccessibleImage, AppText, Button, Card } from "@/components/ui";
import { PROFILE_FAVOURITE_DISHES_MAX } from "@/features/profile/useProfileFavouriteDishes";
import { useReviewDishDetails } from "@/features/profile/useReviewDishDetails";
import { useHungryTheme } from "@/theme";

type FavouriteDishesRowProps = {
  /** The pinned dishes, in order. */
  dishIds: string[];
  onOpenDish: (dishId: string) => void;
  /** Your own profile: dishes you saved or reviewed that you may pin. Omit on someone else's. */
  candidateDishIds?: string[];
  /** Stores the new pins; resolves false when the save failed (the picker stays open). */
  onSave?: (dishIds: string[]) => Promise<boolean>;
  testID?: string;
};

/**
 * Up to four dishes pinned on a profile. On your own profile "Edit" opens a checklist of the
 * dishes you saved or reviewed; tapping a dish ticks it (the first four stay ticked).
 */
export function FavouriteDishesRow({
  dishIds,
  onOpenDish,
  candidateDishIds,
  onSave,
  testID = "profile-favourite-dishes",
}: FavouriteDishesRowProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const canEdit = Boolean(onSave && candidateDishIds && candidateDishIds.length > 0);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // The pinned dishes plus every dish you may pin, looked up in one batched call.
  const lookupIds = useMemo(
    () => [...new Set([...dishIds, ...(isEditing ? (candidateDishIds ?? []) : [])])],
    [candidateDishIds, dishIds, isEditing],
  );
  const { infoFor } = useReviewDishDetails(lookupIds.map((dishId) => ({ dishId })));

  if (dishIds.length === 0 && !canEdit) return null;

  const startEditing = () => {
    setDraft(dishIds);
    setSaveFailed(false);
    setIsEditing(true);
  };
  const toggle = (dishId: string) =>
    setDraft((current) =>
      current.includes(dishId)
        ? current.filter((id) => id !== dishId)
        : current.length < PROFILE_FAVOURITE_DISHES_MAX
          ? [...current, dishId]
          : current,
    );
  const save = async () => {
    if (!onSave) return;
    setIsSaving(true);
    setSaveFailed(false);
    const saved = await onSave(draft);
    setIsSaving(false);
    if (saved) setIsEditing(false);
    else setSaveFailed(true);
  };

  const nameFor = (dishId: string) => {
    const info = infoFor(dishId);
    return info.status === "ready"
      ? info.name
      : info.status === "loading"
        ? "Loading…"
        : info.status === "failed"
          ? "Couldn't load this dish"
          : "Dish no longer available";
  };

  return (
    <Card style={{ gap: spacing[3] }} testID={testID}>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <AppText variant="h3">Favourite dishes</AppText>
        {canEdit && !isEditing ? (
          <Button
            label={dishIds.length ? "Edit" : "Pin dishes"}
            variant="ghost"
            size="sm"
            fullWidth={false}
            accessibilityLabel={dishIds.length ? "Edit favourite dishes" : "Pin favourite dishes"}
            onPress={startEditing}
          />
        ) : null}
      </View>
      {isEditing ? (
        <View style={{ gap: spacing[2] }}>
          <AppText variant="bodySmall" tone="secondary">
            Pick up to {PROFILE_FAVOURITE_DISHES_MAX} from the dishes you saved or reviewed.
          </AppText>
          {(candidateDishIds ?? []).map((dishId) => {
            const checked = draft.includes(dishId);
            const disabled = !checked && draft.length >= PROFILE_FAVOURITE_DISHES_MAX;
            return (
              <Pressable
                key={dishId}
                accessibilityRole="checkbox"
                accessibilityLabel={nameFor(dishId)}
                accessibilityState={{ checked, disabled }}
                disabled={disabled}
                onPress={() => toggle(dishId)}
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  gap: spacing[3],
                  minHeight: 44,
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: checked ? palette.orange : "transparent",
                    borderColor: checked ? palette.orange : palette.border,
                    borderRadius: radii.sm,
                    borderWidth: 2,
                    height: spacing[6],
                    justifyContent: "center",
                    width: spacing[6],
                  }}
                >
                  {checked ? (
                    <AppText variant="micro" tone="inverse">
                      ✓
                    </AppText>
                  ) : null}
                </View>
                <AppText style={{ flex: 1 }} numberOfLines={2}>
                  {nameFor(dishId)}
                </AppText>
              </Pressable>
            );
          })}
          {saveFailed ? (
            <AppText variant="bodySmall" style={{ color: palette.error }} accessibilityRole="alert">
              Couldn&apos;t save your favourite dishes. Try again.
            </AppText>
          ) : null}
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <Button
              label="Cancel"
              variant="secondary"
              size="sm"
              fullWidth={false}
              style={{ flex: 1 }}
              disabled={isSaving}
              onPress={() => setIsEditing(false)}
            />
            <Button
              label="Save"
              size="sm"
              fullWidth={false}
              style={{ flex: 1 }}
              loading={isSaving}
              onPress={() => void save()}
            />
          </View>
        </View>
      ) : dishIds.length > 0 ? (
        <View style={{ gap: spacing[2] }}>
          {dishIds.map((dishId) => {
            const info = infoFor(dishId);
            return (
              <Pressable
                key={dishId}
                accessibilityRole="button"
                accessibilityLabel={nameFor(dishId)}
                accessibilityHint="Opens the dish"
                onPress={() => onOpenDish(dishId)}
                style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}
              >
                {info.status === "ready" && info.imageUrl ? (
                  <AccessibleImage
                    source={{ uri: info.imageUrl }}
                    decorative
                    contentFit="cover"
                    style={{ borderRadius: radii.md, height: spacing[12], width: spacing[12] }}
                  />
                ) : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="bodyBold" numberOfLines={1}>
                    {nameFor(dishId)}
                  </AppText>
                  {info.status === "ready" && info.stallName ? (
                    <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                      {info.stallName}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <AppText variant="bodySmall" tone="secondary">
          Pin up to {PROFILE_FAVOURITE_DISHES_MAX} dishes you love so people see them first.
        </AppText>
      )}
    </Card>
  );
}
