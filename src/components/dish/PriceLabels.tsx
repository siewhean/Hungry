import { View } from "react-native";

import {
  formatPriceWithBasis,
  halalStatusCopy,
  priceBasisCopy,
} from "@/features/detail/priceBasis";
import { useHungryTheme } from "@/theme";
import type { DishDetail, HalalStatus, PriceBasis } from "@/types/domain";
import { AppSymbol, AppText, type AppSymbolName } from "../ui";

const PRICE_SYMBOL: Record<PriceBasis, AppSymbolName> = {
  counter: "priceCounter",
  menu: "priceMenu",
  delivery: "priceDelivery",
};

interface PriceBasisTagProps {
  basis: PriceBasis | undefined;
  /** "short" on cards and menus ("Counter"), "long" on the dish page ("Counter price"). */
  form?: "short" | "long";
}

/**
 * Where a price came from, next to the price: counter (green, the true price), menu (grey) or
 * delivery app (amber, usually higher). Renders nothing when the source is unknown.
 */
export function PriceBasisTag({ basis, form = "short" }: PriceBasisTagProps) {
  const { palette, radii, spacing } = useHungryTheme();
  if (!basis) return null;
  const copy = priceBasisCopy(basis);
  const tone =
    basis === "counter"
      ? { bg: palette.successSoft, border: palette.success, text: palette.successText }
      : basis === "delivery"
        ? { bg: palette.warningSoft, border: palette.warning, text: palette.warningText }
        : { bg: palette.surfaceRaised, border: palette.border, text: palette.textSecondary };
  const small = form === "short";
  return (
    <View
      testID={`price-basis-${basis}`}
      accessible
      accessibilityRole="text"
      accessibilityLabel={copy.accessibilityLabel}
      style={{
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: tone.bg,
        borderColor: tone.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        flexDirection: "row",
        gap: spacing[1],
        paddingHorizontal: small ? spacing[1.5] : spacing[2],
        paddingVertical: small ? 1 : spacing[0.5],
      }}
    >
      <AppSymbol name={PRICE_SYMBOL[basis]} size={small ? 12 : 14} color={tone.text} />
      <AppText
        variant={small ? "micro" : "bodySmall"}
        style={{ color: tone.text, fontWeight: "800" }}
      >
        {small ? copy.short : copy.long}
      </AppText>
    </View>
  );
}

/**
 * Dish page only (owner rule): halal (solid green with the halal mark), not halal (grey
 * outline) or not confirmed (dashed amber, so unknown never looks like "no").
 */
export function HalalStatusTag({ status }: { status: HalalStatus }) {
  const { palette, radii, spacing } = useHungryTheme();
  const copy = halalStatusCopy(status);
  const style =
    status === "yes"
      ? { bg: palette.success, border: palette.success, text: palette.textOnPrimary, dashed: false }
      : status === "no"
        ? {
            bg: palette.surface,
            border: palette.textMuted,
            text: palette.textSecondary,
            dashed: false,
          }
        : { bg: palette.surface, border: palette.warning, text: palette.warningText, dashed: true };
  return (
    <View
      testID={`halal-status-${status}`}
      accessible
      accessibilityRole="text"
      accessibilityLabel={copy.tag}
      style={{
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: style.bg,
        borderColor: style.border,
        borderRadius: radii.pill,
        borderStyle: style.dashed ? "dashed" : "solid",
        borderWidth: 1.5,
        flexDirection: "row",
        gap: spacing[1],
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[0.5],
      }}
    >
      <AppSymbol
        name={status === "yes" ? "halal" : status === "no" ? "notHalal" : "halalUnknown"}
        size={status === "yes" ? 18 : 14}
        color={style.text}
      />
      <AppText variant="bodySmall" style={{ color: style.text, fontWeight: "800" }}>
        {copy.tag}
      </AppText>
    </View>
  );
}

interface PriceWithBasisProps {
  dish: Pick<DishDetail, "price" | "priceRange" | "priceBasis">;
  /** Colour of a counter or menu price; a delivery price is always amber. */
  color?: string;
  testID?: string;
}

/**
 * A card or menu price with its source tag: "S$5.50 [Counter]", "~S$6.80 [Delivery]". No halal
 * here: halal shows on the dish page only.
 */
export function PriceWithBasis({ dish, color, testID }: PriceWithBasisProps) {
  const { palette, spacing } = useHungryTheme();
  const shown = formatPriceWithBasis(dish, "short");
  return (
    <View
      testID={testID}
      style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing[1.5] }}
    >
      <AppText
        variant="price"
        style={{
          color: shown.estimated ? palette.warningText : (color ?? palette.text),
        }}
      >
        {shown.text}
      </AppText>
      {shown.listed ? <PriceBasisTag basis={dish.priceBasis} /> : null}
    </View>
  );
}
