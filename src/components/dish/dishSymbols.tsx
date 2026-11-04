import {
  ArrowLeft,
  Bookmark,
  Check,
  CheckCircle,
  ChevronRight,
  Circle,
  ExternalLink,
  Flag,
  FolderPlus,
  MapPin,
  MoreHorizontal,
  Plus,
  Share,
  SquareDashed,
  Star,
  ThumbsUp,
  Utensils,
  X,
} from "lucide-react-native";

import { AppSymbol } from "@/components/ui/AppSymbol";

/**
 * The dish page's icons: a system SF Symbol on iOS, the matching Lucide icon elsewhere.
 * Each one takes the `{ size, color, fill }` props the detail bar and header already pass, so
 * they slot in where a Lucide icon went. (The stall page keeps its own icons.)
 */
export type DishSymbolProps = { size?: number; color?: string; fill?: string };

const isFilled = (fill: string | undefined) => Boolean(fill) && fill !== "none";

export function BackSymbol({ size = 22, color = "#000" }: DishSymbolProps) {
  return <AppSymbol name="chevron.backward" fallback={ArrowLeft} size={size} color={color} />;
}

/** `square.and.arrow.up`, the system Share glyph (a paper plane reads as "send a message"). */
export function ShareSymbol({ size = 22, color = "#000" }: DishSymbolProps) {
  return <AppSymbol name="square.and.arrow.up" fallback={Share} size={size} color={color} />;
}

export function TriedOffSymbol({ size = 22, color = "#000" }: DishSymbolProps) {
  return <AppSymbol name="circle" fallback={Circle} size={size} color={color} />;
}

export function TriedOnSymbol({ size = 22, color = "#000" }: DishSymbolProps) {
  return (
    <AppSymbol name="checkmark.circle.fill" fallback={CheckCircle} size={size} color={color} />
  );
}

/** Outline until the bar passes a fill (saved), then `bookmark.fill`. */
export function BookmarkSymbol({ size = 22, color = "#000", fill }: DishSymbolProps) {
  const filled = isFilled(fill);
  return (
    <AppSymbol
      name={filled ? "bookmark.fill" : "bookmark"}
      fallback={Bookmark}
      filled={filled}
      size={size}
      color={color}
    />
  );
}

export function AddToListSymbol({ size = 22, color = "#000" }: DishSymbolProps) {
  return <AppSymbol name="folder.badge.plus" fallback={FolderPlus} size={size} color={color} />;
}

export function StallPinSymbol({ size = 20, color = "#000" }: DishSymbolProps) {
  return <AppSymbol name="mappin.and.ellipse" fallback={MapPin} size={size} color={color} />;
}

export function ChevronForwardSymbol({ size = 20, color = "#000" }: DishSymbolProps) {
  return <AppSymbol name="chevron.forward" fallback={ChevronRight} size={size} color={color} />;
}

/** One filled rating star in the star colour. */
export function RatingStarSymbol({ size = 16, color = "#000" }: DishSymbolProps) {
  return <AppSymbol name="star.fill" fallback={Star} filled size={size} color={color} />;
}

export function NoPhotoSymbol({ size = 24, color = "#000" }: DishSymbolProps) {
  return <AppSymbol name="fork.knife" fallback={Utensils} size={size} color={color} />;
}

export function EllipsisSymbol({ size = 20, color = "#000" }: DishSymbolProps) {
  return <AppSymbol name="ellipsis" fallback={MoreHorizontal} size={size} color={color} />;
}

/** "Helpful" on a review: `hand.thumbsup`, filled once the diner has voted. */
export function HelpfulSymbol({ size = 18, color = "#000", fill }: DishSymbolProps) {
  const filled = isFilled(fill);
  return (
    <AppSymbol
      name={filled ? "hand.thumbsup.fill" : "hand.thumbsup"}
      fallback={ThumbsUp}
      filled={filled}
      size={size}
      color={color}
    />
  );
}

export function ReportFlagSymbol({ size = 16, color = "#000" }: DishSymbolProps) {
  return <AppSymbol name="flag" fallback={Flag} size={size} color={color} />;
}

export function OpenExternalSymbol({ size = 16, color = "#000" }: DishSymbolProps) {
  return (
    <AppSymbol name="arrow.up.forward.app" fallback={ExternalLink} size={size} color={color} />
  );
}

export function CloseSymbol({ size = 22, color = "#000" }: DishSymbolProps) {
  return <AppSymbol name="xmark" fallback={X} size={size} color={color} />;
}

export function PlusSymbol({ size = 16, color = "#000" }: DishSymbolProps) {
  return <AppSymbol name="plus" fallback={Plus} size={size} color={color} />;
}

export function CheckmarkSymbol({ size = 18, color = "#000" }: DishSymbolProps) {
  return <AppSymbol name="checkmark" fallback={Check} size={size} color={color} />;
}

/** The legend swatch for the dashed "typical taste" outline. */
export function DashedBoxSymbol({ size = 14, color = "#000" }: DishSymbolProps) {
  return <AppSymbol name="square.dashed" fallback={SquareDashed} size={size} color={color} />;
}
