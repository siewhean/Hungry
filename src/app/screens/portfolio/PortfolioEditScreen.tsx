import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";
import { useShallow } from "zustand/react/shallow";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { PortfolioTypeSelector, PortfolioVisibilitySelector } from "@/components/portfolio";
import { AppText, Button, Card, Input } from "@/components/ui";
import {
  PORTFOLIO_NAME_MAX_LENGTH,
  PORTFOLIO_TEXT_MAX_LENGTH,
} from "@/features/checklistPortfolio/listLabels";
import {
  listErrorMessage,
  listLoadStateForError,
  type ListLoadState,
} from "@/features/checklistPortfolio/listLoadState";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useHungryTheme } from "@/theme";
import type { PortfolioType, PortfolioVisibility } from "@/types/domain";
import { reportError } from "@/lib/monitoring/reportError";

type Props = NativeStackScreenProps<ProfileStackParamList, "PortfolioEdit">;

export function PortfolioEditScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const portfolioId = route.params.portfolioId;
  const { portfolios, refreshPortfolio, updatePortfolio, conflicts, clearConflict } =
    usePortfolioStore(
      useShallow((state) => ({
        portfolios: state.portfolios,
        refreshPortfolio: state.refreshPortfolio,
        updatePortfolio: state.updatePortfolio,
        conflicts: state.conflicts,
        clearConflict: state.clearConflict,
      })),
    );
  const portfolio = portfolios.find((entry) => entry.id === portfolioId);
  const conflict = conflicts[portfolioId];
  const [name, setName] = useState(portfolio?.name ?? "");
  const [description, setDescription] = useState(portfolio?.description ?? "");
  const [type, setType] = useState<PortfolioType>(portfolio?.type ?? "recommendation");
  const [visibility, setVisibility] = useState<PortfolioVisibility>(
    portfolio?.visibility ?? "private",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [loadState, setLoadState] = useState<ListLoadState>(portfolio ? "ready" : "loading");
  // The id the form was last filled from: a reload of the same list must not wipe typing.
  const seededFor = useRef<string | null>(portfolio ? portfolio.id : null);

  useEffect(() => {
    let mounted = true;
    // Load just this list: an unfiltered, capped read could miss it.
    void refreshPortfolio(portfolioId)
      .then(() => mounted && setLoadState("ready"))
      .catch((error) => {
        console.error("Failed to load list:", error);
        reportError(error, { screen: "PortfolioEditScreen", action: "load_list" });
        if (mounted) setLoadState(listLoadStateForError(error));
      });
    return () => {
      mounted = false;
    };
  }, [portfolioId, refreshPortfolio]);

  useEffect(() => {
    // Fill the form once per list, when it first becomes available.
    if (!portfolio || seededFor.current === portfolio.id) return;
    seededFor.current = portfolio.id;
    setName(portfolio.name);
    setDescription(portfolio.description ?? "");
    setType(portfolio.type);
    setVisibility(portfolio.visibility);
  }, [portfolio]);

  async function save() {
    if (!portfolio || !name.trim()) return;
    setIsSaving(true);
    try {
      await updatePortfolio(portfolio.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        visibility,
      });
      navigation.goBack();
    } catch (error) {
      reportError(error, { screen: "PortfolioEditScreen", action: "update_list" });
      Alert.alert("List update failed", listErrorMessage(error, "Please refresh and try again."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg, paddingTop: Math.max(insets.top, spacing[4]) }}
      contentContainerStyle={[styles.content, { gap: spacing[4], padding: spacing[4] }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
        >
          <ArrowLeft color={palette.text} size={22} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="h1">Edit list</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Update the title, type, and who can see it.
          </AppText>
        </View>
      </View>

      {!portfolio ? (
        <Card>
          <AppText variant="h3">
            {loadState === "loading"
              ? "Loading list…"
              : loadState === "error"
                ? "Couldn't load this list"
                : "List not found"}
          </AppText>
          {loadState === "error" ? (
            <Button
              label="Retry"
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => {
                setLoadState("loading");
                void refreshPortfolio(portfolioId)
                  .then(() => setLoadState("ready"))
                  .catch((error) => setLoadState(listLoadStateForError(error)));
              }}
            />
          ) : null}
        </Card>
      ) : (
        <>
          {conflict ? (
            <Card>
              <AppText variant="bodyBold">Latest version loaded</AppText>
              <AppText variant="bodySmall" tone="secondary">
                {conflict.message}
              </AppText>
              <Button
                label="Review latest"
                size="sm"
                fullWidth={false}
                variant="secondary"
                onPress={() => clearConflict(portfolioId)}
              />
            </Card>
          ) : null}
          <Card>
            <Input
              label="Title"
              value={name}
              onChangeText={setName}
              maxLength={PORTFOLIO_NAME_MAX_LENGTH}
            />
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              maxLength={PORTFOLIO_TEXT_MAX_LENGTH}
              multiline
            />
          </Card>
          <Card>
            <AppText variant="bodyBold">Type</AppText>
            <PortfolioTypeSelector value={type} onChange={setType} />
          </Card>
          <Card>
            <AppText variant="bodyBold">Who can see it</AppText>
            <PortfolioVisibilitySelector value={visibility} onChange={setVisibility} />
          </Card>
          <Button label="Save changes" loading={isSaving} disabled={!name.trim()} onPress={save} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    alignItems: "center",
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
  },
});
