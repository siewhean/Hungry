import { SymbolView, type SFSymbol, type SymbolViewProps } from "expo-symbols";
import type { ComponentType } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BadgeCheck,
  BarChart3,
  Bookmark,
  Bell,
  BellOff,
  BellRing,
  CakeSlice,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDollarSign,
  CircleX,
  Compass,
  Database,
  Download,
  Droplet,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Flame,
  Folder,
  Gift,
  Hand,
  Heart,
  History,
  Info,
  KeyRound,
  Leaf,
  List,
  LocateFixed,
  Lock,
  LockKeyhole,
  LogOut,
  Mail,
  MailCheck,
  Map,
  MapPin,
  MapPinOff,
  MessageSquare,
  MessageSquareHeart,
  Navigation,
  PenLine,
  Plus,
  RefreshCw,
  RotateCcw,
  Salad,
  Search,
  Scale,
  Settings2,
  Share2,
  Shield,
  SlidersHorizontal,
  Smartphone,
  Snowflake,
  Soup,
  Sparkles,
  Star,
  Store,
  Thermometer,
  Trash2,
  User,
  UserPlus,
  UserX,
  Utensils,
  UtensilsCrossed,
  Vibrate,
  Wallet,
  WandSparkles,
  WifiOff,
  X,
  Zap,
  Camera,
  Copy,
  ImagePlus,
  MessageCircleMore,
  MoreHorizontal,
  Send,
  Settings,
  UserCheck,
  Users,
  FlaskConical,
  type LucideIcon,
  type LucideProps,
} from "lucide-react-native";
import { Platform, View } from "react-native";

import type { ReviewTasteTagSymbol } from "@/types/domain";

type SFSymbolName = Extract<SymbolViewProps["name"], string>;

/**
 * Every icon is named by what it means. iOS draws the SF Symbol; Android and web draw the lucide
 * icon of the same meaning, so all three platforms keep one icon language and nothing falls
 * back to an emoji. Add a row here when a screen needs a new symbol, or pass an SF Symbol name
 * with a `fallback` icon for a one-off.
 */
const APP_SYMBOLS = {
  rankedByPeople: { ios: "star.bubble.fill", lucide: MessageSquareHeart },
  nearYou: { ios: "mappin.and.ellipse", lucide: MapPin },
  yourTaste: { ios: "slider.horizontal.3", lucide: SlidersHorizontal },
  selected: { ios: "checkmark", lucide: Check },
  noPhoto: { ios: "fork.knife", lucide: Utensils },
  // Settings
  menuChanges: { ios: "bell.badge", lucide: BellRing },
  notificationsOff: { ios: "bell.slash", lucide: BellOff },
  notifications: { ios: "bell", lucide: Bell },
  weeklyPicks: { ios: "sparkles", lucide: Sparkles },
  mealIdeas: { ios: "fork.knife", lucide: Utensils },
  followRequests: { ios: "person.badge.plus", lucide: UserPlus },
  followedStalls: { ios: "storefront", lucide: Store },
  retry: { ios: "arrow.clockwise", lucide: RefreshCw },
  dietary: { ios: "leaf", lucide: Salad },
  flavourProfile: { ios: "safari", lucide: Compass },
  mealBudget: { ios: "wallet.pass", lucide: Wallet },
  tryingNewFood: { ios: "sparkles", lucide: Sparkles },
  foodHistory: { ios: "clock.arrow.circlepath", lucide: History },
  profilePublic: { ios: "eye", lucide: Eye },
  profilePrivate: { ios: "lock", lucide: Lock },
  blocked: { ios: "person.fill.xmark", lucide: UserX },
  analytics: { ios: "chart.bar", lucide: BarChart3 },
  aiSearch: { ios: "sparkle.magnifyingglass", lucide: WandSparkles },
  location: { ios: "location", lucide: LocateFixed },
  resetLocation: { ios: "arrow.counterclockwise", lucide: RotateCcw },
  phonePermissions: { ios: "gearshape", lucide: Settings2 },
  downloadData: { ios: "square.and.arrow.down", lucide: Download },
  clearCache: { ios: "trash", lucide: Trash2 },
  accountDeletionInfo: { ios: "lock.shield", lucide: Shield },
  changePassword: { ios: "key", lucide: KeyRound },
  signOutEverywhere: { ios: "iphone.and.arrow.forward", lucide: Smartphone },
  haptics: { ios: "iphone.radiowaves.left.and.right", lucide: Vibrate },
  leftHanded: { ios: "hand.point.left", lucide: Hand },
  contact: { ios: "envelope", lucide: Mail },
  privacyPolicy: { ios: "hand.raised", lucide: Hand },
  terms: { ios: "doc.text", lucide: FileText },
  legal: { ios: "scalemass", lucide: Scale },
  openData: { ios: "server.rack", lucide: Database },
  version: { ios: "info.circle", lucide: Info },
  signOut: { ios: "rectangle.portrait.and.arrow.right", lucide: LogOut },
  deleteAccount: { ios: "trash", lucide: Trash2 },
  chevronRight: { ios: "chevron.right", lucide: ChevronRight },
  chevronDown: { ios: "chevron.down", lucide: ChevronDown },
  external: { ios: "arrow.up.right.square", lucide: ExternalLink },
  /** A rating star: filled, in the star colour. */
  rating: { ios: "star.fill", lucide: Star, filled: true },
  /** A rating star not chosen: the outline. */
  ratingEmpty: { ios: "star", lucide: Star },
  // Saved page
  /** A saved dish or stall on the Saved page: the filled bookmark (`saved` is the heart). */
  savedMark: { ios: "bookmark.fill", lucide: Bookmark, filled: true },
  tried: { ios: "checkmark.circle", lucide: CircleCheck },
  triedFilled: { ios: "checkmark.circle.fill", lucide: CircleCheck },
  emptyCheckbox: { ios: "circle", lucide: Circle },
  directions: { ios: "arrow.triangle.turn.up.right.diamond.fill", lucide: Navigation },
  writeReview: { ios: "square.and.pencil", lucide: PenLine },
  clearSearch: { ios: "xmark.circle.fill", lucide: CircleX },
  sort: { ios: "arrow.up.arrow.down", lucide: ArrowUpDown },
  listView: { ios: "list.bullet", lucide: List },
  mapView: { ios: "map", lucide: Map },
  add: { ios: "plus", lucide: Plus },
  folder: { ios: "folder", lucide: Folder },
  trash: { ios: "trash", lucide: Trash2 },
  chevronUp: { ios: "chevron.up", lucide: ChevronUp },
  reviewBubble: { ios: "text.bubble", lucide: MessageSquare },
  /** A dish with no photo or no result yet. */
  dish: { ios: "fork.knife", lucide: Utensils },
  // Profile
  /** The "more" control: a native menu opens from it. */
  moreActions: { ios: "ellipsis.circle", lucide: MoreHorizontal },
  /** A row's own "..." (remove a follower, edit a review). */
  rowActions: { ios: "ellipsis", lucide: MoreHorizontal },
  compose: { ios: "square.and.pencil", lucide: PenLine },
  settings: { ios: "gearshape", lucide: Settings },
  following: { ios: "person.crop.circle.badge.checkmark", lucide: UserCheck },
  people: { ios: "person.2", lucide: Users },
  tasteFingerprint: { ios: "circle.hexagongrid", lucide: FlaskConical },
  camera: { ios: "camera.fill", lucide: Camera, filled: false },
  send: { ios: "paperplane", lucide: Send },
  copy: { ios: "doc.on.doc", lucide: Copy },
  noPosts: { ios: "ellipsis.bubble", lucide: MessageCircleMore },
  addStall: { ios: "plus.rectangle.on.rectangle", lucide: ImagePlus },
  // Search
  search: { ios: "magnifyingglass", lucide: Search },
  /** The clear button of a search field. */
  clear: { ios: "xmark.circle.fill", lucide: CircleX },
  /** Dismiss or remove a chip or a row. */
  close: { ios: "xmark", lucide: X },
  share: { ios: "square.and.arrow.up", lucide: Share2 },
  filters: { ios: "line.3.horizontal.decrease.circle", lucide: SlidersHorizontal },
  nearMe: { ios: "location.fill", lucide: Navigation, filled: true },
  price: { ios: "dollarsign.circle", lucide: CircleDollarSign },
  halal: { ios: "checkmark.seal", lucide: BadgeCheck },
  stall: { ios: "storefront", lucide: Store },
  recent: { ios: "clock.arrow.circlepath", lucide: History },
  info: { ios: "info.circle", lucide: Info },
  offline: { ios: "wifi.slash", lucide: WifiOff },
  locationOff: { ios: "location.slash", lucide: MapPinOff },
  /** A dish that is not saved; `saved` is the filled one. */
  save: { ios: "heart", lucide: Heart },
  saved: { ios: "heart.fill", lucide: Heart, filled: true },
  // The review taste tags (REVIEW_TASTE_TAG_META in types/domain.ts names these keys).
  tasteSpicy: { ios: "flame", lucide: Flame },
  tasteSavoury: { ios: "fork.knife", lucide: Utensils },
  tasteSweet: { ios: "birthday.cake", lucide: CakeSlice },
  tasteSour: { ios: "drop", lucide: Droplet },
  tasteGenerous: { ios: "gift", lucide: Gift },
  tasteFresh: { ios: "leaf", lucide: Leaf },
  tasteWorthIt: { ios: "dollarsign.circle", lucide: CircleDollarSign },
  tasteCold: { ios: "snowflake", lucide: Snowflake },
  tasteRichBroth: { ios: "cup.and.saucer", lucide: Soup },
  tasteChewyNoodles: { ios: "fork.knife.circle", lucide: UtensilsCrossed },
  tasteHotFresh: { ios: "thermometer.medium", lucide: Thermometer },
  tasteQuick: { ios: "bolt", lucide: Zap },
  // Sign-in and account screens
  email: { ios: "envelope", lucide: Mail },
  emailSent: { ios: "envelope.badge", lucide: MailCheck },
  password: { ios: "lock", lucide: Lock },
  resetPassword: { ios: "lock.rotation", lucide: LockKeyhole },
  person: { ios: "person", lucide: User },
  showPassword: { ios: "eye", lucide: Eye },
  hidePassword: { ios: "eye.slash", lucide: EyeOff },
  back: { ios: "chevron.backward", lucide: ArrowLeft },
  forward: { ios: "arrow.right", lucide: ArrowRight },
  done: { ios: "checkmark.circle.fill", lucide: CheckCircle2 },
  notDone: { ios: "circle", lucide: Circle },
  problem: { ios: "exclamationmark.circle", lucide: CircleAlert },
} as const satisfies Record<string, { ios: SFSymbolName; lucide: LucideIcon; filled?: boolean }> &
  Record<ReviewTasteTagSymbol, unknown>;

export type AppSymbolName = keyof typeof APP_SYMBOLS;

/** The SF Symbol an app symbol draws on iOS; native menus take the name, not a view. */
export function appSymbolIosName(name: AppSymbolName): string {
  return APP_SYMBOLS[name].ios;
}

type SymbolWeight = "regular" | "medium" | "semibold" | "bold";
const LUCIDE_STROKE: Record<SymbolWeight, number> = {
  regular: 1.75,
  medium: 2,
  semibold: 2.25,
  bold: 2.5,
};

type AppSymbolBaseProps = {
  size?: number;
  color: string;
  /** Matches the weight of the text beside it. */
  weight?: SymbolWeight;
  /** Set for an icon that carries meaning on its own; a decorative icon is hidden from VoiceOver. */
  accessibilityLabel?: string;
  testID?: string;
};

type RegistrySymbolProps = AppSymbolBaseProps & {
  /** A named row of the registry above. */
  name: AppSymbolName;
  fallback?: never;
  filled?: never;
};

type RawSymbolProps = AppSymbolBaseProps & {
  /** The SF Symbol shown on iOS. */
  name: SFSymbol;
  /** The Lucide icon shown on Android and web, so every icon keeps one weight and size scale. */
  fallback: ComponentType<LucideProps>;
  /** Fills the Lucide fallback; SF Symbols are filled by picking the `.fill` name. */
  filled?: boolean;
};

export type AppSymbolProps = RegistrySymbolProps | RawSymbolProps;

function isRegistryName(name: string): name is AppSymbolName {
  return Object.prototype.hasOwnProperty.call(APP_SYMBOLS, name);
}

/**
 * One icon for the whole app: a real SF Symbol on iOS and the matching Lucide icon elsewhere.
 * Use it instead of text glyphs (★ ▲ ▼ → ✓), which take the text colour, scale like a font and are
 * read out as "black star".
 */
export function AppSymbol(props: AppSymbolProps) {
  const { color, accessibilityLabel, testID } = props;
  const labelled = Boolean(accessibilityLabel);

  if (isRegistryName(props.name)) {
    const symbol = APP_SYMBOLS[props.name];
    const size = props.size ?? 22;
    const weight = props.weight ?? "semibold";
    const Icon = symbol.lucide;
    const filled = "filled" in symbol && symbol.filled;
    return (
      <View
        testID={testID}
        accessible={labelled}
        accessibilityRole={labelled ? "image" : undefined}
        accessibilityLabel={accessibilityLabel}
        aria-hidden={!labelled}
        style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      >
        {Platform.OS === "ios" ? (
          <SymbolView
            name={symbol.ios}
            type="hierarchical"
            weight={weight}
            tintColor={color}
            size={size}
            resizeMode="scaleAspectFit"
            style={{ height: size, width: size }}
          />
        ) : (
          <Icon
            color={color}
            size={size}
            strokeWidth={LUCIDE_STROKE[weight]}
            fill={filled ? color : "none"}
          />
        )}
      </View>
    );
  }

  const { name, fallback: Fallback, filled = false, weight } = props as RawSymbolProps;
  const size = props.size ?? 16;
  return (
    <View
      testID={testID}
      accessible={labelled}
      accessibilityRole={labelled ? "image" : undefined}
      accessibilityLabel={accessibilityLabel}
      aria-hidden={!labelled}
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      {Platform.OS === "ios" ? (
        <SymbolView
          name={name}
          size={size}
          weight={weight}
          tintColor={color}
          resizeMode="scaleAspectFit"
          style={{ width: size, height: size }}
        />
      ) : (
        <Fallback size={size} color={color} fill={filled ? color : "none"} />
      )}
    </View>
  );
}
