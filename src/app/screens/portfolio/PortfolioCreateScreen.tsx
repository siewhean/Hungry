import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { PortfolioTypeSelector, PortfolioVisibilitySelector } from "@/components/portfolio";
import { AppText, Button, Card, Dialog, Input } from "@/components/ui";
import { listErrorMessage } from "@/features/checklistPortfolio/listLoadState";
import {
  PORTFOLIO_NAME_MAX_LENGTH,
  PORTFOLIO_TEXT_MAX_LENGTH,
} from "@/features/checklistPortfolio/listLabels";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import { useHungryTheme } from "@/theme";
import type { PortfolioType, PortfolioVisibility } from "@/types/domain";
import { reportError } from "@/lib/monitoring/reportError";

type Props = NativeStackScreenProps<ProfileStackParamList, "PortfolioCreate">;

export function PortfolioCreateScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const createPortfolio = usePortfolioStore((state) => state.createPortfolio);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<PortfolioType>("recommendation");
  const [visibility, setVisibility] = useState<PortfolioVisibility>("private");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const canSave = name.trim().length > 0;

  async function save() {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const portfolio = await createPortfolio({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        visibility,
      });
      navigation.replace("PortfolioDetail", { portfolioId: portfolio.id });
    } catch (error) {
      reportError(error, { screen: "PortfolioCreateScreen", action: "create_list" });
      // A rate limit, being offline or a too-long title must not fail silently.
      // A Dialog, not Alert.alert: Alert is a no-op on web.
      setSaveError(listErrorMessage(error, "Check your connection and try again."));
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
          <AppText variant="h1">Create list</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Start with a private list and publish when it is ready.
          </AppText>
        </View>
      </View>

      <Card>
        <Input
          label="Title"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Best laksa nearby"
          maxLength={PORTFOLIO_NAME_MAX_LENGTH}
        />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What makes this list useful?"
          maxLength={PORTFOLIO_TEXT_MAX_LENGTH}
          multiline
        />
      </Card>

      <Card>
        <AppText variant="bodyBold">Type</AppText>
        <PortfolioTypeSelector value={type} onChange={setType} />
      </Card>

      <Card>
        <AppText variant="bodyBold">Visibility</AppText>
        <PortfolioVisibilitySelector value={visibility} onChange={setVisibility} />
      </Card>

      <Button label="Create list" loading={isSaving} disabled={!canSave} onPress={save} />
      <Dialog
        visible={saveError !== null}
        title="Couldn't create the list"
        message={saveError ?? ""}
        buttons={[{ text: "OK", style: "cancel" }]}
        onClose={() => setSaveError(null)}
      />
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
