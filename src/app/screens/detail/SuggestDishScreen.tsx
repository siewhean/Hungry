import { useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, Input, Screen } from "@/components/ui";
import { buildDishSuggestionNote, dishSuggestionProblem } from "@/features/detail/suggestDish";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "SuggestDish">;

/** submit_catalog_correction refusals the server words for the user (daily cap, bad stall). */
const EXPECTED_REFUSAL_CODES = new Set(["54000", "22023"]);
const SEND_FAILED_MESSAGE = "Couldn't send the dish. Check your connection and try again.";

/**
 * "Suggest a dish": say what a stall serves that its menu does not list yet. The dish goes to
 * the team to check and is added to the menu once someone has; it is not published straight away.
 */
export function SuggestDishScreen({ navigation, route }: Props) {
  const { venueId, subjectName } = route.params;
  const { spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [details, setDetails] = useState("");
  const [isSending, setIsSending] = useState(false);
  const draft = { name, price, details };
  const problem = dishSuggestionProblem(draft);

  const send = async () => {
    if (problem || isSending) return;
    setIsSending(true);
    try {
      await getHungryService().supply.submitCatalogCorrection({
        venueId,
        kind: "wrong_dish_info",
        note: buildDishSuggestionNote(draft),
      });
      showToast({ message: "Thanks, we'll check the dish and add it.", tone: "success" });
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace("StallDetail", { venueId });
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      const serverMessage = (error as { message?: unknown } | null)?.message;
      const expected = typeof code === "string" && EXPECTED_REFUSAL_CODES.has(code);
      if (!expected) {
        reportError(error, { screen: "SuggestDish", action: "submitCatalogCorrection" });
      }
      showToast({
        message:
          expected && typeof serverMessage === "string" && serverMessage
            ? serverMessage
            : SEND_FAILED_MESSAGE,
        tone: "error",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Screen
      title="Suggest a dish"
      subtitle={
        subjectName
          ? `What does ${subjectName} serve that's missing?`
          : "What's missing from the menu?"
      }
      keyboardAvoiding
    >
      <View style={{ gap: spacing[4] }}>
        <Input
          label="Dish name"
          placeholder="e.g. Chicken rice"
          value={name}
          onChangeText={setName}
          maxLength={80}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <Input
          label="Price (optional)"
          placeholder="e.g. 4.50"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          maxLength={8}
        />
        <Input
          label="Anything else? (optional)"
          placeholder="Size, spice level, where it's from"
          value={details}
          onChangeText={setDetails}
          maxLength={200}
          multiline
        />
        <AppText variant="bodySmall" tone="muted">
          The team checks each dish before it joins the menu.
        </AppText>
        {problem && name.length > 0 ? (
          <AppText
            variant="bodySmall"
            tone="secondary"
            style={{ textAlign: "center" }}
            accessibilityLiveRegion="polite"
          >
            {problem}
          </AppText>
        ) : null}
        <Button
          label="Send dish"
          loading={isSending}
          disabled={Boolean(problem)}
          onPress={() => void send()}
        />
      </View>
    </Screen>
  );
}
