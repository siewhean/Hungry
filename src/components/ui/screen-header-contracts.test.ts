import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function readFilesUnder(relativePath: string): string {
  const base = path.join(root, relativePath);
  const files: string[] = [];

  function collect(currentPath: string) {
    const stat = statSync(currentPath);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(currentPath)) {
        collect(path.join(currentPath, entry));
      }
      return;
    }
    if (currentPath.endsWith(".ts") || currentPath.endsWith(".tsx")) {
      files.push(readFileSync(currentPath, "utf8"));
    }
  }

  collect(base);
  return files.join("\n");
}

test("Screen header contract: shared app headers use one fixed title treatment", () => {
  const source = read("src/components/ui/AppHeader.tsx");
  const screenSource = read("src/components/ui/Screen.tsx");
  const expandableSearch = read("src/components/ui/ExpandableSearchLauncher.tsx");

  assert.match(screenSource, /<AppHeader/);
  assert.match(source, /const \{ spacing, palette, typography \} = useHungryTheme\(\)/);
  assert.match(source, /\.\.\.typography\.h1/);
  assert.match(source, /\.\.\.typography\.bodySmall/);
  assert.match(source, /titleStyle\?: TextStyle/);
  assert.match(source, /style=\{titleStyle \? \[styles\.title, titleStyle\] : styles\.title\}/);
  assert.match(source, /copy: \{[\s\S]*justifyContent: "flex-start"/);
  assert.doesNotMatch(source, /fontSize: 24/);
  assert.doesNotMatch(source, /lineHeight: 30/);
  assert.doesNotMatch(source, /fontWeight: "900"/);
  assert.match(source, /minHeight: 56/);
  assert.doesNotMatch(screenSource, /paddingLeft: scrollBackVisible/);
  assert.doesNotMatch(screenSource, /paddingTop: scrollBackVisible/);
  assert.match(expandableSearch, /dismissOnTapAway = true/);
  assert.match(expandableSearch, /accessibilityLabel="Close search"/);
  assert.match(expandableSearch, /styles\.tapAwayLayer/);
  assert.match(expandableSearch, /useNativeDriver: false/);
  assert.match(expandableSearch, /duration: 320/);
  assert.match(expandableSearch, /outputRange: \[0\.92, 1\]/);
  assert.match(expandableSearch, /width: expandedWidth/);
  assert.doesNotMatch(expandableSearch, /outputRange: \[0, expandedWidth\]/);
  assert.match(expandableSearch, /const backingHeight = Math\.max\(barHeight, 56\)/);
  assert.match(expandableSearch, /styles\.expandedBacking/);
  assert.match(expandableSearch, /backgroundColor: palette\.white/);
});

test("Screen header contract: V2 Discover, Review, and New Post headers use AppHeader", () => {
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const discoverV2 = read("src/app/screens/discover/DiscoverHomeScreenV2.tsx");
  const tabs = read("src/app/navigation/SwipeableTabNavigator.tsx");
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  const reviews = read("src/app/screens/review/ReviewFeedScreen.tsx");
  const reviewsV2 = read("src/app/screens/review/ReviewFeedScreenV2.tsx");
  const profileShell = read("src/app/screens/profile/ProfileScreenShell.tsx");
  const composerHeader = read("src/features/post/components/ComposerHeader.tsx");
  const reviewHeaderAction =
    reviews.match(/right=\{\s*<ExpandableSearchLauncher[\s\S]*?\/>\s*\}/)?.[0] ?? "";

  assert.match(discover, /YOU ARE AT/);
  assert.doesNotMatch(discover, /<AppHeader[\s\S]*title="Discover"/);
  assert.match(discoverV2, /<AppHeader[\s\S]*title="Discover"/);
  assert.match(
    discover,
    /getNearestSingaporeArea\(currentLocation\.latitude, currentLocation\.longitude\)/,
  );
  assert.match(
    discoverV2,
    /getNearestSingaporeArea\(currentLocation\.latitude, currentLocation\.longitude\)/,
  );
  assert.doesNotMatch(discoverV2, /\?\? "Nearby"/);
  assert.match(tabs, /<Tab\.Screen name="Discover" component=\{DiscoverHomeScreen\}/);
  assert.doesNotMatch(tabs, /<Tab\.Screen name="Discover" component=\{DiscoverHomeScreenV2\}/);
  assert.match(home, /<AppHeader[\s\S]*title="Hungry"/);
  assert.match(home, /horizontalPadding=\{semanticSpacing\.screenEdge\}/);
  assert.doesNotMatch(home, /homeHeaderTopOffset/);
  assert.match(home, /titleStyle=\{\{ color: palette\.orange \}\}/);
  assert.doesNotMatch(home, /homeHeaderTitle/);
  assert.match(reviews, /<AppHeader[\s\S]*title="Reviews"/);
  assert.ok(reviewHeaderAction);
  assert.match(reviewHeaderAction, /iconAlignment="right"/);
  assert.match(reviews, /const headerActionSize = spacing\[8\] \+ spacing\[2\.5\]/);
  assert.match(reviewHeaderAction, /barHeight=\{headerActionSize\}/);
  assert.match(reviews, /const searchBarWidth = screenWidth - spacing\[8\]/);
  assert.match(reviewsV2, /<AppHeader[\s\S]*title="Reviews"/);
  assert.match(reviewsV2, /right=\{\s*<ExpandableSearchLauncher/);
  assert.match(reviewsV2, /const searchBarWidth = screenWidth - spacing\[8\]/);
  assert.doesNotMatch(reviews, /showSearch|setShowSearch/);
  assert.doesNotMatch(reviewsV2, /placeholder="Search dish or location\.\.\."[\s\S]*<Input/);
  assert.match(profileShell, /contentContainerStyle=\{\{ paddingTop: 0 \}\}/);
  assert.match(composerHeader, /<AppHeader[\s\S]*title=\{title\}/);
  assert.doesNotMatch(composerHeader, /fontSize: 16/);
});

test("Discover V1 contract: situation intents live in their matching sections", () => {
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const discoverSources = readFilesUnder("src/app/screens/discover");

  assert.match(discover, /const POPULAR_FOOD_STYLES: readonly PopularFoodStyle\[\] = \[/);
  assert.match(
    discover,
    /const POPULAR_LAKSA_GRAPHIC = require\("\.\.\/\.\.\/\.\.\/assets\/discover\/popular-laksa-topdown\.png"\)/,
  );
  assert.match(
    discover,
    /const POPULAR_CHICKEN_RICE_GRAPHIC = require\("\.\.\/\.\.\/\.\.\/assets\/discover\/popular-chicken-rice-topdown\.png"\)/,
  );
  assert.match(
    discover,
    /const POPULAR_CHAR_KWAY_TEOW_GRAPHIC = require\("\.\.\/\.\.\/\.\.\/assets\/discover\/popular-char-kway-teow-topdown\.png"\)/,
  );
  assert.match(
    discover,
    /const POPULAR_BAK_CHOR_MEE_GRAPHIC = require\("\.\.\/\.\.\/\.\.\/assets\/discover\/popular-bak-chor-mee-topdown\.png"\)/,
  );
  assert.match(discover, /function FoodStyleButton/);
  assert.match(discover, /const openSearchHome = useCallback\(\(\) => \{/);
  assert.match(discover, /onPress=\{openSearchHome\}/);
  assert.doesNotMatch(discover, /const \[isSearchExpanded, setIsSearchExpanded\]/);
  assert.doesNotMatch(discover, /searchRevealProgress|revealSearch|hideSearch/);
  assert.match(discover, /SearchX/);
  assert.match(discover, /function FilteredResultsEmptyState/);
  assert.doesNotMatch(discover, /const showDiscoverFilterEmptyState =/);
  assert.doesNotMatch(
    discover,
    /\{showDiscoverFilterEmptyState \? <FilteredResultsEmptyState \/> : null\}/,
  );
  assert.match(
    discover,
    /import \{ useDelayedLoadingSkeleton \} from "@\/hooks\/useDelayedLoadingSkeleton"/,
  );
  assert.doesNotMatch(discover, /showFilterClearSkeleton/);
  assert.doesNotMatch(discover, /previousDiscoverFilterCountRef/);
  assert.doesNotMatch(discover, /const hasDiscoverSectionContent =/);
  assert.match(
    discover,
    /const showPopularFoodSkeleton = useDelayedLoadingSkeleton\(isWaitingForPopularFoodStyles\)/,
  );
  assert.match(
    discover,
    /Popular right now[\s\S]*!popularFoodStyleItems\.length && showPopularFoodSkeleton \? \([\s\S]*<PopularFoodStyleSkeleton \/>[\s\S]*\) : popularFoodStyleItems\.length \? \(/,
  );
  assert.match(
    discover,
    /Quick Bites[\s\S]*quickBiteCards\.length \? \([\s\S]*\) : isDiscoverFiltering \? \([\s\S]*<FilteredResultsEmptyState \/>/,
  );
  assert.match(
    discover,
    /Trending in \{discoverLocationLabel\}[\s\S]*trendingCards\.length \? \([\s\S]*\) : isDiscoverFiltering \? \([\s\S]*<FilteredResultsEmptyState \/>/,
  );
  assert.match(
    discover,
    /Editor&apos;s Choice[\s\S]*editorChoiceCards\.length \? \([\s\S]*\) : isDiscoverFiltering \? \([\s\S]*<FilteredResultsEmptyState \/>/,
  );
  assert.match(
    discover,
    /Budget &lt; S\$8[\s\S]*budgetCards\.length \? \([\s\S]*\) : isDiscoverFiltering \? \([\s\S]*<FilteredResultsEmptyState \/>/,
  );
  assert.match(
    discover,
    /Late Night Makan[\s\S]*lateNightCards\.length \? \([\s\S]*\) : isDiscoverFiltering \? \([\s\S]*<FilteredResultsEmptyState \/>/,
  );
  assert.match(
    discover,
    /Stalls in \{discoverLocationLabel\}[\s\S]*areaStallCards\.length \? \([\s\S]*areaStallCards\.map[\s\S]*\) : isDiscoverFiltering \?/,
  );
  assert.match(discover, /No matching results/);
  assert.match(discover, /Try removing a filter or choosing a broader category\./);
  assert.doesNotMatch(discover, /NoFoodForFilter|No food for this filter|BowlIllustrationV2/);
  assert.doesNotMatch(discoverSources, /Find something for\.\.\./);
  assert.doesNotMatch(discoverSources, /function SituationTile/);
  assert.match(
    discover,
    /type DiscoverChipId = "dietary" \| "spicy" \| "halal" \| "late" \| "cheap"/,
  );
  assert.match(
    discover,
    /const DISCOVER_DIETARY_FALLBACKS: readonly DietaryFlag\[\] = \["halal", "vegetarian", "pork_free"\]/,
  );
  assert.match(
    discover,
    /const \[activeDiscoverChipIds, setActiveDiscoverChipIds\] = useState<DiscoverChipId\[\]>\(\[\]\)/,
  );
  assert.match(discover, /const isDiscoverFiltering =/);
  assert.match(discover, /const toggleDiscoverChip = useCallback\(\(chipId: DiscoverChipId\) =>/);
  assert.match(discover, /const matchesDiscoverChipSelection = useCallback/);
  assert.match(discover, /const filterDiscoverBites = useCallback/);
  assert.match(discover, /activeDiscoverChipIds\.every\(\(chipId\) =>/);
  assert.match(discover, /const discoverBiteCollections = useMemo/);
  assert.match(discover, /quickBites: getDiscoverBiteCollection\("quickBites"\)/);
  assert.match(discover, /function PopularFoodStyleSkeleton/);
  assert.doesNotMatch(discover, /setShowPopularFoodSkeleton/);
  assert.match(
    discover,
    /const isWaitingForPopularFoodStyles = !isDiscoverFiltering && popularFoodStyleItems\.length === 0/,
  );
  assert.match(
    discover,
    /!popularFoodStyleItems\.length && showPopularFoodSkeleton \? \([\s\S]*<PopularFoodStyleSkeleton \/>/,
  );
  assert.match(
    discover,
    /function FoodStyleButton[\s\S]*const labelGap = spacing\[1\.5\][\s\S]*const buttonHeight = bowlSize \+ labelGap \+ typography\.bodySmallBold\.lineHeight \* 2[\s\S]*style=\{\{ alignItems: "center", height: buttonHeight, width: 88 \}\}[\s\S]*marginTop: labelGap/,
  );
  assert.doesNotMatch(discover, /sublabel: string/);
  assert.doesNotMatch(discover, /Always a classic|Comfort bowl/);
  assert.doesNotMatch(discover, /setTimeout\(\(\) => setIsLoading\(false\), 800\)/);
  assert.doesNotMatch(discover, /isDiscoverFiltering \? \(\s*<PopularFoodStyleSkeleton/);
  assert.doesNotMatch(discover, /function DiscoverBiteRailSkeleton/);
  assert.doesNotMatch(discover, /function DiscoverStallListSkeleton/);
  assert.match(discover, /chipId === "dietary"[\s\S]*discoverDietaryFlags\.some/);
  assert.match(discover, /chipId === "halal"[\s\S]*dietaryFlags\.includes\("halal"\)/);
  assert.match(discover, /chipId === "spicy"[\s\S]*tasteVector\.spicy >= 6/);
  assert.match(discover, /chipId === "cheap"[\s\S]*dish\.price < 8/);
  assert.doesNotMatch(discover, /navigation\.navigate\("UserProfile"/);
  assert.match(
    discover,
    /const areaDishPool = areaDishes\.length \? areaDishes : allDiscoverDishes/,
  );
  assert.match(
    discover,
    /const quickBiteCards = useMemo\([\s\S]*filterDiscoverBites\(unfilteredQuickBiteCards\)/,
  );
  assert.match(discover, /const discoverRailCardWidth = screenWidth \* 0\.55/);
  assert.match(discover, /const discoverRailImageHeight = 130/);
  assert.match(
    discover,
    /const decisionCardWidth = \(screenWidth - spacing\[8\] - spacing\[3\]\) \/ 2/,
  );
  assert.doesNotMatch(discover, /width: screenWidth \* 0\.65/);
  assert.doesNotMatch(discover, /height: 160/);
  assert.doesNotMatch(discover, /height: 150/);
  assert.match(
    discover,
    /const unfilteredTrendingCards = useMemo\([\s\S]*discoverBiteCollections\.trending\.slice\(0, 6\)[\s\S]*const trendingCards = useMemo\([\s\S]*filterDiscoverBites\(unfilteredTrendingCards\)/,
  );
  assert.match(
    discover,
    /const unfilteredEditorChoiceCards = useMemo\([\s\S]*discoverBiteCollections\.editorChoice\.slice\(0, 6\)[\s\S]*const editorChoiceCards = useMemo\([\s\S]*filterDiscoverBites\(unfilteredEditorChoiceCards\)/,
  );
  assert.match(
    discover,
    /const unfilteredBudgetCards = useMemo\([\s\S]*discoverBiteCollections\.budget\.slice\(0, 6\)[\s\S]*const budgetCards = useMemo\([\s\S]*filterDiscoverBites\(unfilteredBudgetCards\)/,
  );
  assert.match(
    discover,
    /const unfilteredLateNightCards = useMemo\([\s\S]*discoverBiteCollections\.lateNight\.slice\(0, 5\)[\s\S]*const lateNightCards = useMemo\([\s\S]*filterDiscoverBites\(unfilteredLateNightCards\)/,
  );
  assert.match(discover, /const areaStallCards = useMemo/);
  assert.match(
    discover,
    /Quick Bites[\s\S]*&lt; 15 MIN[\s\S]*navigation\.navigate\("QuickBites", \{ collection: "quickBites" \}\)[\s\S]*quickBiteCards\.map/,
  );
  assert.doesNotMatch(
    discover.match(
      /Quick Bites[\s\S]*?\{quickBiteCards\.map[\s\S]*?\/\* Recommended Dishes/,
    )?.[0] ?? "",
    /Under 15 min/,
  );
  assert.match(
    discover,
    /S\$\{bite\.price\.toFixed\(2\)\}[\s\S]*<Star color=\{palette\.amber\} size=\{12\} fill=\{palette\.amber\} \/>[\s\S]*\{bite\.rating\.toFixed\(1\)\}/,
  );
  assert.match(
    discover,
    /Trending in \{discoverLocationLabel\}[\s\S]*navigation\.navigate\("QuickBites", \{ collection: "trending" \}\)[\s\S]*trendingCards\.map/,
  );
  assert.match(discover, /Editor&apos;s Choice[\s\S]*editorChoiceCards\.map/);
  assert.match(discover, /Budget &lt; S\$8[\s\S]*VALUE[\s\S]*budgetCards\.map/);
  assert.doesNotMatch(
    discover.match(
      /Budget &lt; S\$8[\s\S]*?\{budgetCards\.map[\s\S]*?\/\* Late Night Makan \*\//,
    )?.[0] ?? "",
    /Under 15 min/,
  );
  assert.match(discover, /navigation\.navigate\("DishDetail", \{ dishId: bite\.dishId \}\)/);
  assert.match(discover, /const isLateNightMakanVisible = currentHour >= 21 \|\| currentHour < 4/);
  assert.match(
    discover,
    /\{isLateNightMakanVisible \? \([\s\S]*Late Night Makan[\s\S]*lateNightCards\.map/,
  );
  assert.match(discover, /navigation\.navigate\("QuickBites", \{ collection: "trending" \}\)/);
  assert.match(discover, /navigation\.navigate\("QuickBites", \{ collection: "editorChoice" \}\)/);
  assert.match(discover, /navigation\.navigate\("QuickBites", \{ collection: "budget" \}\)/);
  assert.match(discover, /navigation\.navigate\("QuickBites", \{ collection: "lateNight" \}\)/);
  assert.doesNotMatch(discover, /const foodInset = 5/);
  assert.match(discover, /imageSource\?: number/);
  assert.match(discover, /imageSource: POPULAR_LAKSA_GRAPHIC/);
  assert.match(discover, /imageSource: POPULAR_CHICKEN_RICE_GRAPHIC/);
  assert.match(discover, /imageSource: POPULAR_CHAR_KWAY_TEOW_GRAPHIC/);
  assert.match(discover, /imageSource: POPULAR_BAK_CHOR_MEE_GRAPHIC/);
  assert.match(
    discover,
    /source=\{typeof imageSource === "string" \? \{ uri: imageSource \} : imageSource\}/,
  );
  assert.match(discover, /<FoodStyleButton[\s\S]*imageSource=\{item\.imageSource\}/);
  assert.match(discover, /overflow: "hidden"/);
  assert.match(discover, /handleFoodStylePress\(item\.query\)/);
  assert.match(discover, /updateSearchQuery\(query\)/);
  assert.match(discover, /navigation\.navigate\("SearchResults", \{/);
  assert.match(discover, /places in this area/);
  assert.match(
    discover,
    /contentContainerStyle=\{\{\s*gap: semanticSpacing\.sectionGap - spacing\[1\],\s*paddingHorizontal: semanticSpacing\.screenEdge,\s*\}\}/,
  );
  assert.match(discover, /paddingTop: spacing\[1\]/);
  assert.match(discover, /Stalls & Restaurants/);
  assert.match(discover, /Dishes/);
  assert.match(discover, /backgroundColor: "rgba\(15, 23, 42, 0\.34\)"/);
  assert.match(discover, /borderColor: "rgba\(255, 255, 255, 0\.16\)"/);
  assert.match(discover, /const bowlSize = 72/);
  assert.match(discover, /style=\{\{ alignItems: "center", height: buttonHeight, width: 88 \}\}/);
  assert.doesNotMatch(discover, /fontSize: 24, lineHeight: 28/);
  assert.doesNotMatch(discover, /fontSize: 11, lineHeight: 13/);
  assert.doesNotMatch(discover, /paddingRight: spacing\[2\]/);
  assert.match(discover, /height: 48/);
  assert.match(discover, /Dishes, stalls, or hawker centres…/);
  assert.doesNotMatch(discover, /flexWrap: "wrap"/);
  assert.match(
    discover,
    /<Screen scroll=\{false\} fullWidth style=\{\{ backgroundColor: themeTints\.bg \}\}>/,
  );
  assert.match(discover, /const edgeToEdgeHorizontalScrollStyle = \{\s*width: screenWidth,\s*\}/);
  assert.doesNotMatch(discover, /paddingRight: spacing\[4\]/);
  assert.doesNotMatch(discover, /visibleIntentRailWidth/);
  assert.doesNotMatch(discover, /visibleIntentChipWidths/);
  assert.match(discover, /function HalalLogoIcon\(\{ color \}: \{ color: string \}\)/);
  assert.match(discover, />\s*حلال\s*<\/AppText>/);
  assert.match(
    discover,
    /chip\.id === "halal" \? \(\s*<HalalLogoIcon color=\{isActive \? palette\.orange : themeTints\.secondaryText\} \/>/,
  );
  assert.doesNotMatch(discover, /Home,\s*Utensils/);
  assert.match(
    discover,
    /\/\* Intent Chips with Icons \*\/[\s\S]*<ScrollView[\s\S]*horizontal[\s\S]*style=\{edgeToEdgeHorizontalScrollStyle\}[\s\S]*contentContainerStyle=\{\{ gap: spacing\[2\] \}\}[\s\S]*onPress=\{\(\) => toggleDiscoverChip\(chip\.id\)\}/,
  );
  assert.match(
    discover,
    /Quick Bites[\s\S]*style=\{edgeToEdgeHorizontalScrollStyle\}[\s\S]*contentContainerStyle=\{\{ gap: spacing\[4\] \}\}[\s\S]*quickBiteCards\.map/,
  );
  assert.match(
    discover,
    /Trending in \{discoverLocationLabel\}[\s\S]*style=\{edgeToEdgeHorizontalScrollStyle\}[\s\S]*contentContainerStyle=\{\{ gap: spacing\[4\] \}\}[\s\S]*trendingCards\.map/,
  );
  assert.match(
    discover,
    /Editor&apos;s Choice[\s\S]*style=\{edgeToEdgeHorizontalScrollStyle\}[\s\S]*contentContainerStyle=\{\{ gap: spacing\[4\] \}\}[\s\S]*editorChoiceCards\.map/,
  );
  assert.match(
    discover,
    /Budget &lt; S\$8[\s\S]*style=\{edgeToEdgeHorizontalScrollStyle\}[\s\S]*contentContainerStyle=\{\{ gap: spacing\[4\] \}\}[\s\S]*budgetCards\.map/,
  );
  assert.match(
    discover,
    /Late Night Makan[\s\S]*style=\{edgeToEdgeHorizontalScrollStyle\}[\s\S]*contentContainerStyle=\{\{ gap: spacing\[4\] \}\}[\s\S]*lateNightCards\.map/,
  );
  const lateNightBlock =
    discover.match(/\/\* Late Night Makan \*\/[\s\S]*?\{\/\* Hawker Centres Near You/)?.[0] ?? "";
  const lateNightCardsBlock =
    lateNightBlock.match(/lateNightCards\.map\(\(bite\) => \([\s\S]*?<\/Pressable>/)?.[0] ?? "";
  assert.match(lateNightBlock, /backgroundColor: themeTints\.cardBg/);
  assert.match(lateNightBlock, /borderColor: palette\.border/);
  assert.match(lateNightBlock, /style=\{\{ color: themeTints\.text \}\}/);
  assert.match(lateNightBlock, /style=\{\{ color: themeTints\.secondaryText \}\}/);
  assert.doesNotMatch(lateNightCardsBlock, /palette\.navy/);
  assert.doesNotMatch(lateNightCardsBlock, /tone="inverse"/);
  assert.doesNotMatch(lateNightCardsBlock, /opacity: 0\.85/);
  assert.doesNotMatch(discover, /contentContainerStyle=\{\{ gap: spacing\[(2|4)\], paddingRight:/);
  assert.match(discover, /const isActive = activeDiscoverChipIds\.includes\(chip\.id\)/);
  assert.match(discover, /onPress=\{\(\) => toggleDiscoverChip\(chip\.id\)\}/);
  assert.match(
    discover,
    /<AppText variant="h2" style=\{\{ color: themeTints\.text \}\}>\s*Popular right now\s*<\/AppText>/,
  );
  assert.doesNotMatch(discover, /<DecideForMeCard compact \/>/);
  assert.doesNotMatch(discover, /import \{ DecideForMeCard \}/);
  assert.match(
    discover,
    /\/\* Decision action chips \*\/[\s\S]*<View style=\{\{ flexDirection: "row", gap: spacing\[3\] \}\}>[\s\S]*navigation\.navigate\("DecideForMeResult"\)[\s\S]*Decide for Me[\s\S]*navigation\.navigate\("WheelStack", \{ screen: "WheelHome" \}\)[\s\S]*Hungry Wheel[\s\S]*<\/View>/,
  );
  assert.match(discover, /<Dices color=\{palette\.white\} size=\{20\} \/>/);
  assert.match(discover, /height: 72,[\s\S]*width: decisionCardWidth/);
  assert.match(discover, /height: "100%"/);
  assert.doesNotMatch(discover, /minHeight: 72/);
  assert.doesNotMatch(discover, /height: 52/);
  assert.match(discover, /Trending in \{discoverLocationLabel\}/);
  assert.match(discover, /Stalls in \{discoverLocationLabel\}/);
  assert.match(
    discover,
    /Stalls in \{discoverLocationLabel\}[\s\S]*<View style=\{\{ gap: spacing\[3\] \}\}>[\s\S]*areaStallCards\.map/,
  );
  assert.doesNotMatch(discover, /areaStallCards\.map[\s\S]*width: screenWidth \* 0\.72/);
  assert.doesNotMatch(discover, /discoverNearbyCount/);
});

test("Discover V1 contract: browse cards open the image-feed browse mode", () => {
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const navigationTypes = read("src/app/navigation/navigationTypes.ts");
  const searchResults = read("src/app/screens/search/SearchResultsScreen.tsx");
  const targetCardsBlock = discover.match(
    /\{\/\* Discovery Targets — two large tap targets \*\/\}[\s\S]*?\{\/\* Proactive Selection \*\//,
  )?.[0];

  assert.ok(targetCardsBlock);

  assert.doesNotMatch(discover, /function DiscoveryTargetGridPreview/);
  assert.doesNotMatch(discover, /<DiscoveryTargetGridPreview/);
  assert.match(
    discover,
    /const STALLS_CARD_GRAPHIC = require\("\.\.\/\.\.\/\.\.\/assets\/discover\/stalls-restaurants-card-wide\.png"\)/,
  );
  assert.match(
    discover,
    /const DISHES_CARD_GRAPHIC = require\("\.\.\/\.\.\/\.\.\/assets\/discover\/dishes-card-wide\.png"\)/,
  );
  assert.match(targetCardsBlock, /<View style=\{\{ flexDirection: "row", gap: spacing\[3\] \}\}>/);
  assert.match(targetCardsBlock, /accessibilityLabel="Browse stalls and restaurants"/);
  assert.match(targetCardsBlock, /accessibilityLabel="Browse dishes"/);
  assert.match(targetCardsBlock, /source=\{STALLS_CARD_GRAPHIC\}/);
  assert.match(targetCardsBlock, /source=\{DISHES_CARD_GRAPHIC\}/);
  assert.match(
    targetCardsBlock,
    /source=\{STALLS_CARD_GRAPHIC\}[\s\S]*style=\{\{ aspectRatio: 1\.55, width: "100%" \}\}[\s\S]*contentFit="cover"/,
  );
  assert.match(
    targetCardsBlock,
    /source=\{DISHES_CARD_GRAPHIC\}[\s\S]*style=\{\{ aspectRatio: 1\.55, width: "100%" \}\}[\s\S]*contentFit="cover"/,
  );
  assert.doesNotMatch(targetCardsBlock, /aspectRatio: 1\.75/);
  assert.doesNotMatch(targetCardsBlock, /aspectRatio: 1\.8/);
  assert.doesNotMatch(targetCardsBlock, /contentFit="contain"/);
  assert.match(targetCardsBlock, /<LinearGradient[\s\S]*rgba\(15,23,42,0\.68\)/);
  assert.match(targetCardsBlock, /Stalls & Restaurants/);
  assert.match(targetCardsBlock, /Dishes/);
  assert.match(targetCardsBlock, /position: "absolute"/);
  assert.doesNotMatch(targetCardsBlock, /Browse this area/);
  assert.doesNotMatch(targetCardsBlock, /What are you craving\?/);
  assert.doesNotMatch(discover, /stallTargetImage/);
  assert.doesNotMatch(discover, /dishTargetImage/);
  assert.doesNotMatch(discover, /stallPreviewImages/);
  assert.doesNotMatch(discover, /dishPreviewImages/);
  assert.doesNotMatch(discover, />🏪</);
  assert.doesNotMatch(discover, />🍜</);
  assert.match(discover, /navigation\.navigate\("BrowseStalls"\)/);
  assert.match(discover, /navigation\.navigate\("BrowseDishes"\)/);
  assert.match(
    navigationTypes,
    /SearchResults: \{[\s\S]*browseMode\?: "dishes" \| "stalls"[\s\S]*\} \| undefined/,
  );
  assert.match(navigationTypes, /BrowseDishes: undefined/);
  assert.match(navigationTypes, /BrowseStalls: undefined/);
  assert.match(searchResults, /export function BrowseDishesScreen/);
  assert.match(searchResults, /export function BrowseStallsScreen/);
  assert.match(
    searchResults,
    /const BROWSE_FILTERS = \[[\s\S]*"All",[\s\S]*"Local",[\s\S]*"Halal"/,
  );
  assert.match(searchResults, /<Screen scroll=\{false\} fullWidth/);
  assert.match(
    searchResults,
    /const browseTitle = isDishGrid \? "Dishes" : "Stalls & Restaurants"/,
  );
  assert.match(searchResults, /<View style=\{\[browseStyles\.titleRow/);
  assert.match(searchResults, /<AppText[\s\S]*variant="h1"[\s\S]*\{browseTitle\}/);
  assert.match(searchResults, /titleRow: \{ alignItems: "center", flexDirection: "row"/);
  assert.match(
    searchResults,
    /style=\{\[browseStyles\.inlineSearchLauncher[\s\S]*\{isSearchExpanded \? \([\s\S]*<Animated\.View/,
  );
  assert.match(searchResults, /<TextInput[\s\S]*placeholder=\{searchPlaceholder\}/);
  assert.match(
    searchResults,
    /const searchPlaceholder = isDishGrid \? "Find dishes\.\.\." : "Find stalls\.\.\."/,
  );
  assert.match(searchResults, /<FlashList[\s\S]*numColumns=\{numColumns\}/);
  assert.match(searchResults, /const numColumns = 2/);
  assert.match(searchResults, /const itemWidth = screenWidth \/ numColumns/);
  assert.match(searchResults, /<LinearGradient[\s\S]*rgba\(0,0,0,0\.82\)/);
  assert.match(searchResults, /<Avatar uri=\{item\.authorAvatarUrl\}/);
  assert.match(searchResults, /navigation\.navigate\("DishDetail", \{ dishId: item\.dish\.id \}\)/);
  assert.doesNotMatch(searchResults, /navigation\.navigate\("StallDetail"/);
  assert.doesNotMatch(searchResults, /Dishes in \$\{areaLabel\}/);
  assert.doesNotMatch(searchResults, /Stalls & restaurants in \$\{areaLabel\}/);
  assert.doesNotMatch(searchResults, /Dishes, stalls, or hawker centres…/);
  assert.doesNotMatch(
    searchResults,
    /const browseCardWidth = \(screenWidth - gridPadding - gridGap \* 2\) \/ 3/,
  );
  assert.match(searchResults, /const allDishes = useMemo/);
  assert.match(searchResults, /const browseVenues = useMemo/);
  assert.match(searchResults, /topDish,\s*minDistanceMeters/s);
  assert.doesNotMatch(searchResults, /groupResultsByVenue/);
  assert.match(searchResults, /const browseMode = route\.params\?\.browseMode/);
  assert.doesNotMatch(searchResults, /Dishes nearby/);
  assert.doesNotMatch(searchResults, /Stalls & restaurants nearby/);
  assert.doesNotMatch(searchResults, /flexWrap: "wrap"/);
});

test("Quick Bites contract: empty-state icon is not clipped", () => {
  const quickBites = read("src/app/screens/discover/QuickBitesScreen.tsx");
  const navigationTypes = read("src/app/navigation/navigationTypes.ts");

  assert.match(
    navigationTypes,
    /collection\?: "quickBites" \| "trending" \| "editorChoice" \| "budget" \| "lateNight"/,
  );
  assert.match(quickBites, /export const COLLECTION_COPY/);
  assert.match(quickBites, /export function getDiscoverBiteCollection/);
  assert.match(quickBites, /const DISH_IMAGE_URLS: Record<string, string>/);
  assert.match(
    quickBites,
    /"Chicken Rice":\s*"https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/7\/71\/Hainanese_Chicken_Rice\.jpg"/,
  );
  assert.match(quickBites, /"Pandan Cake":\s*"https:\/\/images\.unsplash\.com\/photo-/);
  assert.match(quickBites, /function getDishImageUrl\(dishName: string, photoUrl\?: string\)/);
  assert.match(
    quickBites,
    /return DISH_IMAGE_URLS\[dishName\] \|\| photoUrl\?\.trim\(\) \|\| FALLBACK_DISH_IMAGE_URL/,
  );
  assert.match(quickBites, /const DISH_ID_BY_NAME: Record<string, string>/);
  assert.match(quickBites, /"Chicken Rice": "dish-chicken-rice"/);
  assert.match(quickBites, /"Wagyu Burger": "dish-wagyu-burger"/);
  assert.match(quickBites, /"Salmon Don": "dish-salmon-don"/);
  assert.match(quickBites, /"Mala Xiang Guo": "dish-mala-xiang-guo"/);
  assert.match(quickBites, /"Pandan Cake": "dish-pandan-cake"/);
  assert.match(quickBites, /function getDishId\(dishName: string, dishId\?: string\)/);
  assert.match(quickBites, /function withFoodImages\(bites: Bite\[\]\)/);
  assert.match(quickBites, /import \{ dishes as mockDishes \} from "@\/lib\/services\/mock\/data"/);
  assert.match(
    quickBites,
    /const DISH_BY_ID = new Map\(mockDishes\.map\(\(dish\) => \[dish\.id, dish\]\)\)/,
  );
  assert.match(quickBites, /function getDishSyncedFields\(bite: Bite\)/);
  assert.match(quickBites, /\.\.\.getDishSyncedFields\(bite\)/);
  assert.match(quickBites, /dishName: dish\.name/);
  assert.match(quickBites, /photoUrl: dish\.imageUrl/);
  assert.match(quickBites, /price: dish\.price/);
  assert.match(quickBites, /rating: dish\.rating/);
  assert.match(quickBites, /venueName: dish\.venueName/);
  assert.match(quickBites, /const bitesWithImages = withFoodImages\(bites\)/);
  assert.match(quickBites, /const list = collectionBites\s*\.filter/);
  assert.doesNotMatch(
    quickBites,
    /collectionBites\.some\(\(collectionBite\) => collectionBite\.id === bite\.id\)/,
  );
  assert.match(quickBites, /navigation\.navigate\("DishDetail", \{ dishId: item\.dishId \}\)/);
  assert.match(quickBites, /navigation\.navigate\("DishDetail", \{ dishId: bite\.dishId \}\)/);
  assert.doesNotMatch(quickBites, /navigation\.navigate\("StallDetail"/);
  const mockData = read("src/lib/services/mock/data.ts");
  assert.match(mockData, /id: "dish-pandan-cake"[\s\S]*name: "Pandan Cake"/);
  assert.match(mockData, /id: "dish-wagyu-burger"[\s\S]*name: "Wagyu Burger"/);
  assert.match(mockData, /id: "dish-salmon-don"[\s\S]*name: "Salmon Don"/);
  assert.match(mockData, /id: "dish-mala-xiang-guo"[\s\S]*name: "Mala Xiang Guo"/);
  const detail = read("src/app/screens/detail/DishDetailScreen.tsx");
  assert.match(
    detail,
    /fallbackDishes\.find\(\(candidate\) => candidate\.id === deepLinkedDishId\)/,
  );
  assert.match(detail, /fallbackVenues\.find\(\(candidate\) => candidate\.id === dish\.venueId\)/);
  assert.match(
    quickBites,
    /const collection: DiscoverCollection = route\.params\?\.collection \?\? "quickBites"/,
  );
  assert.match(quickBites, /placeholder="Search dishes\.\.\."/);
  assert.match(
    quickBites,
    /<View style=\{styles\.titleRow\}>[\s\S]*navigation\.goBack\(\)[\s\S]*\{collectionCopy\.title\}[\s\S]*<ExpandableSearchLauncher/,
  );
  assert.match(quickBites, /titleRow: \{[\s\S]*flexDirection: "row"[\s\S]*marginBottom: 8/);
  assert.match(quickBites, /collection === "budget"[\s\S]*bite\.price < 8/);
  assert.match(quickBites, /collection === "editorChoice"[\s\S]*bite\.rating >= 4\.4/);
  assert.match(quickBites, /collection === "trending"[\s\S]*b\.cravingCount - a\.cravingCount/);
  assert.match(quickBites, /collection === "lateNight"/);
  assert.match(quickBites, /return getDiscoverBiteCollection\(collection, bites\)/);
  assert.match(quickBites, /ListFooterComponent=\{renderFoodCarousel\}/);
  assert.match(quickBites, /key=\{`carousel-\$\{bite\.id\}`\}/);
  assert.match(quickBites, /<AppText style=\{styles\.emptyStateIcon\}>🥣<\/AppText>/);
  assert.match(
    quickBites,
    /emptyStateIcon: \{[\s\S]*height: 72,[\s\S]*lineHeight: 64,[\s\S]*width: 72,/,
  );
});
