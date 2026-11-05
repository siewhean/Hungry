import {
  Beef,
  CakeSlice,
  CircleDollarSign,
  Coffee,
  CookingPot,
  Drumstick,
  Flame,
  Leaf,
  Moon,
  Salad,
  Soup,
  Sunrise,
  Utensils,
  Wheat,
  type LucideIcon,
} from "lucide-react-native";

import { AppSymbol } from "@/components/ui";
import type { SFSymbol } from "expo-symbols";

type ChipSymbol = { ios: SFSymbol; lucide: LucideIcon };

/**
 * The picture on each Home chip, chosen for what the label says: a flame for Spicy, a moon for
 * Late night, a steaming cup for Soup, a grain stalk for Rice, a fork and knife for Western.
 * SF Symbols has no noodle bowl or rice bowl, so Noodles and Rice use the closest glyphs.
 * Halal keeps its neutral icon until the MUIS display decision (see DiscoverHomeScreen).
 */
export const DISCOVER_CHIP_SYMBOLS: Readonly<Record<string, ChipSymbol>> = {
  dietary: { ios: "carrot", lucide: Salad },
  spicy: { ios: "flame", lucide: Flame },
  late: { ios: "moon", lucide: Moon },
  cheap: { ios: "dollarsign.circle", lucide: CircleDollarSign },
  vegetarian: { ios: "leaf", lucide: Leaf },
  noodles: { ios: "fork.knife.circle", lucide: CookingPot },
  rice: { ios: "laurel.leading", lucide: Wheat },
  soup: { ios: "cup.and.heat.waves", lucide: Soup },
  dessert: { ios: "birthday.cake", lucide: CakeSlice },
  drinks: { ios: "cup.and.saucer", lucide: Coffee },
  breakfast: { ios: "sunrise", lucide: Sunrise },
  western: { ios: "fork.knife", lucide: Beef },
};

/** A fork and knife for a chip with no picture of its own, so a new chip is never left blank. */
const FALLBACK_SYMBOL: ChipSymbol = { ios: "fork.knife", lucide: Utensils };

export function DiscoverChipIcon({ chipId, color }: { chipId: string; color: string }) {
  if (chipId === "halal") return <Drumstick size={14} color={color} />;
  const symbol = DISCOVER_CHIP_SYMBOLS[chipId] ?? FALLBACK_SYMBOL;
  return <AppSymbol name={symbol.ios} fallback={symbol.lucide} size={14} color={color} />;
}
