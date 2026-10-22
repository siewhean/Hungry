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
  assert.match(
    source,
    /const \{ componentRadii, componentSizes, palette, spacing, typography \} = useHungryTheme\(\)/,
  );
  assert.match(source, /\.\.\.typography\.h1/);
  assert.match(source, /\.\.\.typography\.bodySmall/);
  assert.match(source, /titleStyle\?: TextStyle/);
  assert.match(source, /style=\{titleStyle \? \[styles\.title, titleStyle\] : styles\.title\}/);
  assert.match(source, /copy: \{[\s\S]*justifyContent: "center"/);
  assert.doesNotMatch(source, /fontSize: 24/);
  assert.doesNotMatch(source, /lineHeight: 30/);
  assert.doesNotMatch(source, /fontWeight: "900"/);
  assert.match(source, /minHeight: componentSizes\.headerMinHeight/);
  assert.match(source, /borderRadius: componentRadii\.iconButton/);
  assert.match(source, /height: componentSizes\.headerBackButton/);
  assert.doesNotMatch(screenSource, /paddingLeft: scrollBackVisible/);
  assert.doesNotMatch(screenSource, /paddingTop: scrollBackVisible/);
  assert.match(expandableSearch, /dismissOnTapAway = true/);
  assert.match(expandableSearch, /accessibilityLabel="Close search"/);
  assert.match(expandableSearch, /styles\.tapAwayLayer/);
  assert.match(expandableSearch, /useNativeDriver: false/);
  assert.match(expandableSearch, /duration: motion\.searchExpand/);
  assert.match(expandableSearch, /outputRange: \[0\.92, 1\]/);
  assert.match(expandableSearch, /width: expandedWidth/);
  assert.doesNotMatch(expandableSearch, /outputRange: \[0, expandedWidth\]/);
  assert.match(
    expandableSearch,
    /const backingHeight = Math\.max\(resolvedBarHeight, componentSizes\.headerMinHeight\)/,
  );
  assert.match(expandableSearch, /styles\.expandedBacking/);
  assert.match(expandableSearch, /backgroundColor: palette\.white/);
  assert.match(expandableSearch, /clearButtonMode="never"/);
  assert.doesNotMatch(expandableSearch, /clearButtonMode="while-editing"/);
  assert.doesNotMatch(expandableSearch, /flexDirection: "row-reverse"/);
});

test("Screen header contract: live Discover, Review, and New Post headers use AppHeader", () => {
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const tabs = read("src/app/navigation/SwipeableTabNavigator.tsx");
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  const reviews = read("src/app/screens/review/ReviewFeedScreen.tsx");
  const profileShell = read("src/app/screens/profile/ProfileScreenShell.tsx");
  const composerHeader = read("src/features/post/components/ComposerHeader.tsx");
  const reviewSearchSummary =
    reviews.match(/function ReviewSearchQuerySummary[\s\S]*?\n}\n\n\/\//)?.[0] ?? "";
  assert.match(discover, /YOU ARE AT/);
  assert.doesNotMatch(discover, /<AppHeader[\s\S]*title="Discover"/);
  assert.match(
    discover,
    /getEffectiveLocation\(\{\s*permission: locationPermission,\s*currentLocation,\s*manualCoordinate,\s*\}\)[\s\S]*const discoverLocationLatitude = discoverCoordinate\.latitude/,
  );
  assert.match(
    discover,
    /getNearestSingaporeAreaWithin\(discoverLocationLatitude, discoverLocationLongitude\)/,
  );
  assert.match(tabs, /<Tab\.Screen name="Discover" component=\{DiscoverWrapper\}/);
  assert.match(tabs, /require\("@\/app\/screens\/discover\/DiscoverHomeScreen"\)/);
  assert.doesNotMatch(tabs, /DiscoverHomeScreenV2/);
  assert.match(home, /<AppHeader[\s\S]*title="Home"/);
  assert.match(home, /horizontalPadding=\{semanticSpacing\.screenEdge\}/);
  assert.doesNotMatch(home, /homeHeaderTopOffset/);
  assert.doesNotMatch(home, /homeHeaderTitle/);
  assert.match(reviews, /const reviewHeaderTitle = "Reviews"/);
  assert.doesNotMatch(reviews, /getNearestSingaporeArea|useLocationStore|locationLabel/);
  assert.match(reviews, /<AppHeader[\s\S]*title=\{reviewHeaderTitle\}/);
  assert.match(
    reviews,
    /right=\{\s*<ExpandableSearchLauncher[\s\S]*accessibilityLabel="Search reviews"[\s\S]*placeholder="Search Reviews"[\s\S]*iconAlignment="right"[\s\S]*enableMovingPlaceholder=\{false\}[\s\S]*showExpandedBacking=\{false\}[\s\S]*\/>\s*\}/,
  );
  assert.doesNotMatch(reviews, /ReviewSearchBar|navigation\.navigate\("SearchHome"\)/);
  assert.doesNotMatch(reviews, /useMovingSearchPlaceholder|movingSearchPlaceholder/);
  assert.match(reviews, /const searchBarWidth = screenWidth - spacing\[8\]/);
  assert.match(reviews, /FilterChipRail/);
  assert.match(
    reviews,
    /\/\* Filter chips \*\/[\s\S]*<FilterChipRail[\s\S]*options=\{FILTER_OPTIONS\}[\s\S]*selectedId=\{filterMode\}[\s\S]*onSelect=\{setFilterMode\}[\s\S]*onSwipeLockChange=\{setTabSwipeLocked\}[\s\S]*gap=\{spacing\[2\]\}/,
  );
  assert.doesNotMatch(
    reviews,
    /filterChipRailScrollStyle|filterChipRailContentStyle|handleChipRailGestureStart|handleChipRailGestureEnd|chipRailUnlockTimerRef/,
  );
  assert.match(reviews, /navigation\.setOptions\(\{ swipeEnabled: !isLocked \}\)/);
  assert.match(reviews, /function ReviewSearchQuerySummary/);
  assert.match(reviews, /<ReviewSearchQuerySummary query=\{searchQuery\} \/>/);
  assert.match(reviews, /\{trimmedQuery\}/);
  assert.match(reviewSearchSummary, /Showing results for/);
  assert.doesNotMatch(reviewSearchSummary, /Searching for|backgroundColor|borderRadius/);
  assert.doesNotMatch(reviews, /showSearch|setShowSearch/);
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
    /Hawker classics[\s\S]*shouldShowPopularFoodSkeleton \? \([\s\S]*<PopularFoodStyleSkeleton \/>[\s\S]*\) : popularFoodStyleItems\.length \? \(/,
  );
  assert.match(
    discover,
    /<DiscoverFoodRailLoadingSkeleton[\s\S]*\) : cards\.length \? \([\s\S]*\) : isFiltering \? \([\s\S]*<FilteredResultsEmptyState preserveHeight minHeight=\{layout\.reservedHeight\} \/>/,
  );
  for (const [rail, cards] of [
    ["quickBites", "quickBiteCards"],
    ["trending", "trendingCards"],
    ["editorChoice", "editorChoiceCards"],
    ["budget", "budgetCards"],
    ["lateNight", "lateNightCards"],
  ]) {
    assert.match(discover, new RegExp(`rail="${rail}"[\\s\\S]*?cards=\\{${cards}\\}`));
  }
  assert.match(discover, /const DiscoverBiteRail = memo\(function DiscoverBiteRail/);
  assert.match(discover, /const DiscoverBiteCard = memo\(function DiscoverBiteCard/);
  assert.match(
    discover,
    /Stalls \$\{discoverAreaPhrase\}[\s\S]*areaStallCards\.length \? \([\s\S]*areaStallCards\.map[\s\S]*\) : isDiscoverFiltering \?/,
  );
  assert.match(
    discover,
    /import \{ dedupeNearestVenueCandidates \} from "@\/features\/search\/venueDedupe"/,
  );
  assert.match(
    discover,
    /const nearestChainCards = dedupeNearestVenueCandidates\([\s\S]*filteredCards,[\s\S]*\(card\) => card\.venue,[\s\S]*\(card\) => card\.topDish\?\.distanceMeters/,
  );
  assert.match(discover, /type DiscoverStallShowcaseCard = \{/);
  assert.match(discover, /id: string/);
  assert.match(discover, /imageSource: ImageSourcePropType/);
  assert.match(discover, /const STALL_SHOWCASE_CARD_LIMIT = 30/);
  assert.match(discover, /const STALL_SHOWCASE_FALLBACK_IMAGES = \[/);
  assert.match(discover, /function buildStallShowcaseCardsFromVenues/);
  assert.match(discover, /repositoryLookup: Pick<DiscoverRepositoryLookup/);
  assert.match(
    discover,
    /const uniqueVenues = Array\.from\(new Map\(venues\.map\(\(venue\) => \[venue\.id, venue\]\)\)\.values\(\)\)/,
  );
  // One card per stall, never padded with repeats.
  assert.match(discover, /return uniqueVenues\.flatMap\(\(venue, venueIndex\) =>/);
  assert.match(
    discover,
    /const heroDish = repositoryLookup\.getDishById\(venue\.topDishId\) \?\? venueDishes\[0\]/,
  );
  assert.doesNotMatch(discover, /heroCandidates/);
  assert.doesNotMatch(discover, /function extendStallShowcaseCards/);
  assert.doesNotMatch(discover, /cards\[index % cards\.length\]/);
  assert.match(discover, /const image = getDiscoverCardImage\(\[/);
  assert.match(discover, /\.\.\.getDishImageCandidates\(heroDish\)/);
  assert.match(
    discover,
    /STALL_SHOWCASE_FALLBACK_IMAGES\[venueIndex % STALL_SHOWCASE_FALLBACK_IMAGES\.length\]/,
  );
  assert.match(discover, /function VerticalStallShowcaseSection/);
  assert.match(discover, /const unfilteredStallShowcaseCards = useMemo/);
  assert.match(discover, /const stallShowcaseCards = useMemo/);
  assert.match(discover, /return filteredCards\.slice\(0, STALL_SHOWCASE_CARD_LIMIT\)/);
  assert.match(
    discover,
    /const visibleCards = useMemo\(\(\) => cards\.slice\(0, STALL_SHOWCASE_CARD_LIMIT\), \[cards\]\)/,
  );
  assert.match(discover, /\{visibleCards\.length === 1 \? "stall" : "stalls"\}/);
  assert.match(discover, /const columnGap = spacing\[2\]/);
  assert.match(discover, /const rowGap = spacing\[1\.5\]/);
  assert.match(discover, /const columnCardWidth = \(cardWidth - columnGap\) \/ 2/);
  assert.match(discover, /const maxTallCardHeight = columnCardWidth \* 1\.1/);
  assert.match(
    discover,
    /const cardImageHeight = Math\.max\(0, Math\.floor\(tallCardHeight - compactCardDetailsHeight\)\)/,
  );
  assert.match(discover, /return rows/);
  assert.match(discover, /const showcaseVenuePool = \[\.\.\.areaVenues, \.\.\.allDiscoverVenues\]/);
  assert.match(
    discover,
    /return buildStallShowcaseCardsFromVenues\(showcaseVenuePool, repositoryLookup\)/,
  );
  assert.match(
    discover,
    /matchesDiscoverChipSelection\(product, \[\s*venue\.name,\s*heroDish\.name,\s*\.\.\.product\.tasteTags,/,
  );
  // The showcase is a plain grid in the page scroll: no nested scroller, parallax or scroll lock.
  assert.doesNotMatch(discover, /Animated\.ScrollView/);
  assert.doesNotMatch(discover, /snapToInterval/);
  assert.doesNotMatch(discover, /scrollY\.interpolate/);
  assert.doesNotMatch(discover, /isStallShowcaseGestureActive/);
  assert.doesNotMatch(discover, /onTopBoundaryPull|updateParentScrollLock|handleDiscoverScrollEnd/);
  assert.doesNotMatch(discover, /buildLoopingStallShowcaseImageSources/);
  assert.match(discover, /showcaseRows\.map\(\(rowCards, rowIndex\) =>/);
  assert.match(discover, /source=\{card\.imageSource\}/);
  assert.match(
    discover,
    /bottom: spacing\[2\],[\s\S]*right: spacing\[2\],[\s\S]*<Star color=\{palette\.amber\} size=\{11\} fill=\{palette\.amber\} \/>[\s\S]*\{card\.heroDish\.rating\.toFixed\(1\)\}/,
  );
  assert.match(
    discover,
    /\{card\.venue\.name\}[\s\S]*flexShrink: 0[\s\S]*\{card\.venue\.unitNumber\}/,
  );
  assert.doesNotMatch(discover, /secondaryProducts\.map/);
  assert.match(discover, /minHeight: tallCardHeight/);
  assert.match(discover, /width: columnCardWidth/);
  assert.match(discover, /onOpenCard=\{openStallShowcaseCard\}/);
  assert.match(discover, /onPrefetchCard=\{prefetchStallShowcaseCard\}/);
  assert.match(
    discover,
    /Stalls \$\{discoverAreaPhrase\}[\s\S]*areaStallCards\.map[\s\S]*stallShowcaseCards\.length \? \([\s\S]*<VerticalStallShowcaseSection/,
  );
  assert.match(discover, /No matching results/);
  assert.match(discover, /Try removing a filter\./);
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
  assert.match(
    discover,
    /const deferredDiscoverChipIds = useDeferredValue\(activeDiscoverChipIds\)/,
  );
  assert.doesNotMatch(discover, /const activeDiscoverChipSet = useMemo/);
  assert.match(discover, /const deferredDiscoverChipSet = useMemo/);
  assert.match(discover, /const activeDiscoverChipSignature = activeDiscoverChipIds\.join\("\|"\)/);
  assert.match(
    discover,
    /const deferredDiscoverChipSignature = deferredDiscoverChipIds\.join\("\|"\)/,
  );
  assert.match(
    discover,
    /const isPopularFoodFilterPending =[\s\S]*activeDiscoverChipSignature !== deferredDiscoverChipSignature/,
  );
  assert.match(discover, /const isDiscoverFiltering =/);
  assert.match(
    discover,
    /const toggleDiscoverChip = useCallback\(\s*\(chipId: DiscoverChipId\) =>/,
  );
  assert.match(discover, /const matchesDiscoverChipSelection = useCallback/);
  assert.match(discover, /const filterDiscoverBites = useCallback/);
  assert.match(discover, /Array\.from\(deferredDiscoverChipSet\)\.every\(\(chipId\) =>/);
  assert.match(discover, /const discoverBiteCollections = useMemo/);
  assert.match(
    discover,
    /const discoverBaseBites = useMemo\([\s\S]*getDiscoverBites\(repository\)\.filter/,
  );
  assert.match(discover, /getDiscoverBiteCollections\(\s*discoverBaseBites,\s*repository,/);
  assert.match(discover, /const discoverDishById = useMemo/);
  assert.match(discover, /discoverDishById\.get\(bite\.dishId\)/);
  assert.match(discover, /function PopularFoodStyleSkeleton/);
  assert.match(discover, /function DiscoverFoodRailLoadingSkeleton/);
  assert.match(discover, /function DiscoverStallListLoadingSkeleton/);
  assert.doesNotMatch(discover, /setShowPopularFoodSkeleton/);
  assert.match(
    discover,
    /const isWaitingForPopularFoodStyles = !isDiscoverFiltering && popularFoodStyleItems\.length === 0/,
  );
  assert.match(discover, /shouldShowPopularFoodSkeleton \? \([\s\S]*<PopularFoodStyleSkeleton \/>/);
  assert.match(
    discover,
    /function FoodStyleButton[\s\S]*const labelGap = spacing\[1\.5\][\s\S]*const labelLineHeight = typography\.bodySmallBold\.fontSize \+ spacing\[1\][\s\S]*const buttonHeight = bowlSize \+ labelGap \+ labelLineHeight \* 2[\s\S]*style=\{\{ alignItems: "center", minHeight: buttonHeight, width: 88 \}\}[\s\S]*lineHeight: labelLineHeight[\s\S]*marginTop: labelGap[\s\S]*minHeight: labelLineHeight \* 2/,
  );
  assert.match(
    discover,
    /numberOfLines=\{2\}[\s\S]*adjustsFontSizeToFit[\s\S]*minimumFontScale=\{0\.84\}/,
  );
  assert.doesNotMatch(discover, /sublabel: string/);
  assert.doesNotMatch(discover, /Always a classic|Comfort bowl/);
  assert.doesNotMatch(discover, /setTimeout\(\(\) => setIsLoading\(false\), 800\)/);
  assert.doesNotMatch(discover, /isDiscoverFiltering \? \(\s*<PopularFoodStyleSkeleton/);
  assert.match(
    discover,
    /const showDiscoverFilterRailSkeleton =[\s\S]*showPopularFoodFilterSkeleton \|\| showInitialDiscoverSkeleton/,
  );
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
    /const decisionCardWidth = \(screenWidth - semanticSpacing\.screenEdge \* 2 - decisionCardGap\) \/ 2/,
  );
  assert.match(discover, /const discoverSectionGap = spacing\[4\]/);
  assert.match(discover, /const discoverContentGap = spacing\[2\]/);
  assert.match(discover, /const decisionCardGap = discoverContentGap/);
  assert.match(discover, /const decisionCardInnerGap = spacing\[2\]/);
  assert.match(discover, /const decisionCardPadding = spacing\[2\]/);
  assert.match(discover, /const decisionCardIconSize = 36/);
  assert.match(
    discover,
    /const decisionCardLabelFontSize = Math\.max\(15, typography\.bodySmallBold\.fontSize \+ 1\)/,
  );
  assert.match(discover, /const decisionCardLabelMaxWidth = Math\.max\(/);
  assert.match(
    discover,
    /const popularFoodLabelLineHeight = typography\.bodySmallBold\.fontSize \+ spacing\[1\]/,
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
  assert.match(discover, /onPress=\{\(\) => onSeeAll\(rail\)\}/);
  assert.match(discover, /onSeeAll: openDiscoverCollection/);
  assert.match(
    discover,
    /S\$\{bite\.price\.toFixed\(2\)\}[\s\S]*<Star color=\{palette\.amber\} size=\{12\} fill=\{palette\.amber\} \/>[\s\S]*\{bite\.rating\.toFixed\(1\)\}/,
  );
  assert.match(discover, /title="Budget < S\$8"[\s\S]*label="VALUE"/);
  assert.match(discover, /navigation\.navigate\("DishDetail", \{ dishId: bite\.dishId \}\)/);
  assert.match(discover, /const isLateNightMakanVisible = isLateNightHour\(currentHour\)/);
  assert.match(
    discover,
    /\{isLateNightMakanVisible && shouldRenderDiscoverRail\(lateNightCards\.length\) \? \([\s\S]*title="Late night eats"[\s\S]*cards=\{lateNightCards\}/,
  );
  assert.match(discover, /trackAnalyticsEvent\("discover_see_all_tapped", \{ collection \}\)/);
  assert.doesNotMatch(discover, /const foodInset = 5/);
  assert.match(discover, /imageSource\?: number/);
  assert.match(discover, /imageSource: POPULAR_LAKSA_GRAPHIC/);
  assert.match(discover, /imageSource: POPULAR_CHICKEN_RICE_GRAPHIC/);
  assert.match(discover, /imageSource: POPULAR_CHAR_KWAY_TEOW_GRAPHIC/);
  assert.match(discover, /imageSource: POPULAR_BAK_CHOR_MEE_GRAPHIC/);
  assert.match(
    discover,
    /imageSource: image\.imageUrl \? \{ uri: image\.imageUrl \} : style\.imageSource/,
  );
  assert.match(discover, /source=\{imageSource\}/);
  assert.match(discover, /<MemoFoodStyleButton[\s\S]*imageSource=\{item\.imageSource\}/);
  assert.match(discover, /const showPopularFoodFilterSkeleton = isPopularFoodFilterPending/);
  assert.doesNotMatch(discover, /POPULAR_FOOD_FILTER_SKELETON_MIN_MS/);
  assert.doesNotMatch(discover, /setIsPopularFoodFilterSkeletonPending/);
  assert.match(
    discover,
    /const shouldShowPopularFoodSkeleton =[\s\S]*showPopularFoodSkeleton \|\| showPopularFoodFilterSkeleton \|\| showInitialDiscoverSkeleton/,
  );
  assert.match(discover, /function DiscoverDishImagePlaceholder\(/);
  assert.match(discover, /backgroundColor: palette\.surfaceRaised/);
  assert.match(discover, /<Utensils color=\{palette\.orange\} size=\{iconSize\} \/>/);
  assert.match(discover, /function DiscoverBiteImage\(\{ bite, height \}/);
  assert.match(discover, /\[bite\.photoUrl, \.\.\.\(bite\.mediaUrls \?\? \[\]\)\]/);
  assert.match(discover, /source=\{\{ uri: activeImageUrl \}\}/);
  assert.match(
    discover,
    /<DiscoverDishImagePlaceholder[\s\S]*accessibilityLabel=\{`\$\{bite\.dishName\} photo unavailable`\}/,
  );
  assert.match(discover, /<DiscoverBiteImage bite=\{bite\} height=\{imageHeight\} \/>/);
  assert.match(discover, /function DiscoverStallThumbnail\(/);
  assert.match(discover, /import \{ StallLogoMark \} from "@\/components\/stall\/StallLogoMark"/);
  assert.match(
    discover,
    /<StallLogoMark[\s\S]*logoUrl=\{venue\.logoUrl\}[\s\S]*name=\{venue\.name\}[\s\S]*size=\{56\}/,
  );
  assert.match(discover, /<DiscoverStallThumbnail venue=\{venue\} \/>/);
  assert.doesNotMatch(discover, /<DiscoverStallThumbnail topDish=\{topDish\} venue=\{venue\} \/>/);
  assert.doesNotMatch(discover, /getDishImageCandidates\(topDish,\s*"representative_dish"\)/);
  assert.doesNotMatch(discover, /source=\{\{ uri: logoUrl \}\}/);
  assert.doesNotMatch(discover, /const DISCOVER_DISH_PLACEHOLDER_IMAGES/);
  assert.doesNotMatch(discover, /getDiscoverDishPlaceholderSource/);
  assert.doesNotMatch(discover, /source=\{\{ uri: topDish\?\.imageUrl \}\}/);
  assert.match(
    discover,
    /\{shouldShowPopularFoodSkeleton \? \([\s\S]*<PopularFoodStyleSkeleton \/>/,
  );
  assert.match(discover, /overflow: "hidden"/);
  assert.match(discover, /onPress=\{handleFoodStylePress\}/);
  // The map and Quick Bites bars keep their own text, so a chip no longer writes into them (r2 H21).
  assert.doesNotMatch(discover, /updateSearchQuery/);
  // A chip tap is not a typed search: no recent-search entry, and the grid skips its own signal.
  assert.doesNotMatch(discover, /rememberSearch/);
  assert.match(discover, /source: "discover_chip"/);
  assert.match(discover, /navigation\.navigate\("SearchResults", \{/);
  assert.match(discover, /places to eat \$\{/);
  assert.match(
    discover,
    /contentContainerStyle=\{\{\s*gap: discoverSectionGap,\s*paddingHorizontal: semanticSpacing\.screenEdge,\s*\}\}/,
  );
  assert.match(discover, /paddingTop: spacing\[1\]/);
  assert.match(discover, /Stalls & Restaurants/);
  assert.match(discover, /Dishes/);
  assert.match(discover, /backgroundColor: palette\.imageLabelSurface/);
  assert.match(discover, /borderColor: palette\.imageLabelBorder/);
  assert.match(discover, /const bowlSize = 72/);
  assert.match(
    discover,
    /style=\{\{ alignItems: "center", minHeight: buttonHeight, width: 88 \}\}/,
  );
  assert.doesNotMatch(discover, /fontSize: 24, lineHeight: 28/);
  assert.doesNotMatch(discover, /fontSize: 11, lineHeight: 13/);
  assert.doesNotMatch(discover, /TextAlignVertical: "center"[\s\S]*paddingRight: spacing\[2\]/);
  assert.match(discover, /height: 48/);
  assert.match(discover, /Dishes, stalls, or hawker centres…/);
  assert.match(discover, /useMovingSearchPlaceholder/);
  assert.match(discover, /\{movingSearchPlaceholder\}/);
  assert.doesNotMatch(discover, /flexWrap: "wrap"/);
  assert.match(
    discover,
    /<Screen scroll=\{false\} fullWidth style=\{\{ backgroundColor: themeTints\.bg \}\}>/,
  );
  assert.match(discover, /const edgeToEdgeHorizontalScrollStyle = \{\s*width: screenWidth,\s*\}/);
  assert.doesNotMatch(discover, /const chipRailScrollStyle|const chipRailContentStyle/);
  assert.doesNotMatch(discover, /sortedChips\.map\(\(chip\) =>/);
  assert.doesNotMatch(
    discover,
    /style=\{index === 0 \? \{ marginLeft: spacing\[1\] \} : undefined\}/,
  );
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
    /\/\* Intent Chips with Icons \*\/[\s\S]*<FilterChipRail[\s\S]*options=\{sortedChips\}[\s\S]*selectedIds=\{activeDiscoverChipIds\}[\s\S]*onSelect=\{toggleDiscoverChip\}[\s\S]*onSwipeLockChange=\{setTabSwipeLocked\}[\s\S]*renderLeftIcon=\{\(chip, isActive\) =>/,
  );
  assert.match(discover, /navigation\.setOptions\(\{ swipeEnabled: !isLocked \}\)/);
  // Every rail card is the one memoised card, in the themed surface (no dark-only styling).
  const biteCard =
    discover.match(
      /const DiscoverBiteCard = memo\(function DiscoverBiteCard[\s\S]*?\n\}\);/,
    )?.[0] ?? "";
  assert.ok(biteCard, "DiscoverBiteCard should exist");
  assert.match(biteCard, /backgroundColor: palette\.surface/);
  assert.match(biteCard, /borderColor: palette\.border/);
  assert.doesNotMatch(biteCard, /palette\.navy/);
  assert.doesNotMatch(biteCard, /tone="inverse"/);
  assert.doesNotMatch(biteCard, /opacity: 0\.85/);
  assert.doesNotMatch(discover, /contentContainerStyle=\{\{ gap: spacing\[(2|4)\], paddingRight:/);
  assert.match(discover, /renderLeftIcon=\{\(chip, isActive\) =>/);
  assert.match(discover, /onSelect=\{toggleDiscoverChip\}/);
  assert.match(
    discover,
    /<AppText variant="h2" style=\{\{ color: themeTints\.text \}\}>\s*Hawker classics\s*<\/AppText>/,
  );
  assert.doesNotMatch(discover, /<DecideForMeCard compact \/>/);
  assert.doesNotMatch(discover, /import \{ DecideForMeCard \}/);
  assert.match(
    discover,
    /\/\* Decision action chips \*\/[\s\S]*<View style=\{\{ flexDirection: "row", gap: decisionCardGap \}\}>[\s\S]*onPress=\{handleDecideForMe\}[\s\S]*Decide for Me[\s\S]*navigation\.navigate\("WheelStack", \{ screen: "WheelHome" \}\)[\s\S]*Pick with friends[\s\S]*<\/View>/,
  );
  assert.match(
    discover,
    /const handleDecideForMe = \(\) => \{[\s\S]*navigation\.navigate\("DecideForMeResult", \{ surface: "discover" \}/,
  );
  assert.match(
    discover,
    /<Dices color=\{palette\.white\} size=\{decisionCardIconGraphicSize\} \/>/,
  );
  // Cards grow with large text instead of clipping at a fixed 72.
  assert.match(discover, /minHeight: 72,[\s\S]*width: decisionCardWidth/);
  assert.match(discover, /height: "100%"/);
  assert.match(discover, /justifyContent: "center"/);
  assert.doesNotMatch(discover, /adjustsFontSizeToFit[\s\S]{0,80}minimumFontScale=\{0\.88\}/);
  assert.match(discover, /maxWidth: decisionCardLabelMaxWidth/);
  assert.match(discover, /textAlign: "center"/);
  assert.match(discover, /numberOfLines=\{2\}/);
  assert.doesNotMatch(discover, /height: 72,[\s\S]{0,40}width: decisionCardWidth/);
  assert.doesNotMatch(discover, /height: 52/);
  assert.match(discover, /Most reviewed \$\{trendingAreaPhrase\}/);
  assert.match(discover, /Stalls \$\{discoverAreaPhrase\}/);
  assert.match(discover, /const DISCOVER_AREA_RADIUS_METERS = 3000/);
  assert.match(
    discover,
    /const isSupabaseDataSource = getServiceProvider\(\)\.mode === "supabase"/,
  );
  assert.match(
    discover,
    /const \[supabaseDiscoverAreaCount, setSupabaseDiscoverAreaCount\] = useState<number \| null>\(null\)/,
  );
  assert.match(
    discover,
    /const \[isSupabaseDiscoveryFeedLoading, setIsSupabaseDiscoveryFeedLoading\] = useState\(false\)/,
  );
  assert.match(discover, /setIsSupabaseDiscoveryFeedLoading\(true\)/);
  assert.match(discover, /setIsSupabaseDiscoveryFeedLoading\(false\)/);
  assert.match(
    discover,
    /const discoveryService = getHungryService\(\)\.discovery[\s\S]*discoveryService\.countVenuesInArea\([\s\S]*discoverGeoCellLatitude,[\s\S]*discoverGeoCellLongitude,[\s\S]*DISCOVER_AREA_RADIUS_METERS,[\s\S]*discoverLocationLabel/,
  );
  assert.match(
    discover,
    /venueCountResult\.status === "fulfilled" && typeof venueCountResult\.value === "number"/,
  );
  assert.match(
    discover,
    /const showInitialDiscoverSkeleton = isSupabaseDataSource && isSupabaseDiscoveryFeedLoading/,
  );
  assert.match(
    discover,
    /const showDiscoverFilterRailSkeleton =[\s\S]*showPopularFoodFilterSkeleton \|\| showInitialDiscoverSkeleton/,
  );
  assert.match(
    discover,
    /const discoverAreaCountLabel = isSupabaseDataSource[\s\S]*\? getDiscoverAreaCountLabel\(\{[\s\S]*rpcCount: supabaseDiscoverAreaCount,[\s\S]*: String\(areaVenues\.length\)/,
  );
  // The count line shows a skeleton only while the feed loads, and hides on failure.
  assert.match(
    discover,
    /discoverAreaCountLabel === null \? \(\s*isSupabaseDiscoveryFeedLoading \? \([\s\S]*<Skeleton width=\{150\} height=\{14\} borderRadius=\{radii\.sm\} \/>\s*\) : null/,
  );
  assert.match(
    discover,
    /Stalls \$\{discoverAreaPhrase\}[\s\S]*<View style=\{\{ gap: discoverContentGap \}\}>[\s\S]*areaStallCards\.map/,
  );
  assert.match(
    discover,
    /const \[discoverViewportHeight, setDiscoverViewportHeight\] = useState\(0\)/,
  );
  assert.match(discover, /import \{ useSafeAreaInsets \} from "react-native-safe-area-context"/);
  assert.match(discover, /const insets = useSafeAreaInsets\(\)/);
  assert.match(
    discover,
    /const bottomTabVisibleHeight = componentSizes\.bottomTabBar \+ Math\.max\(insets\.bottom, spacing\[2\]\)/,
  );
  assert.match(
    discover,
    /const fallbackDiscoverViewportHeight = Math\.max\(0, screenHeight - insets\.top\)/,
  );
  assert.match(
    discover,
    /const effectiveDiscoverViewportHeight =[\s\S]*discoverViewportHeight \|\| fallbackDiscoverViewportHeight/,
  );
  assert.match(
    discover,
    /const stallShowcasePageHeight =[\s\S]*Math\.max\(0, effectiveDiscoverViewportHeight - bottomTabVisibleHeight\)[\s\S]*effectiveDiscoverViewportHeight[\s\S]*fallbackDiscoverViewportHeight/,
  );
  assert.match(discover, /const handleDiscoverViewportLayout = useCallback/);
  assert.match(
    discover,
    /setDiscoverViewportHeight\(\(currentHeight\) =>[\s\S]*Math\.abs\(currentHeight - nextHeight\) > 1 \? nextHeight : currentHeight/,
  );
  assert.doesNotMatch(discover, /setDiscoverViewportHeight\(screenHeight\)/);
  assert.match(discover, /onLayout=\{handleDiscoverViewportLayout\}/);
  assert.match(
    discover,
    /const stallShowcaseCardWidth = screenWidth - semanticSpacing\.screenEdge \* 2/,
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
  assert.match(
    targetCardsBlock,
    /<View style=\{\{ flexDirection: "row", gap: discoverContentGap \}\}>/,
  );
  assert.match(targetCardsBlock, /accessibilityLabel="Browse stalls and restaurants"/);
  assert.match(targetCardsBlock, /accessibilityLabel="Browse dishes"/);
  assert.match(discover, /const stallsCategoryImageSource = useMemo/);
  assert.match(discover, /const dishesCategoryImageSource = useMemo/);
  assert.match(targetCardsBlock, /source=\{stallsCategoryImageSource\}/);
  assert.match(targetCardsBlock, /source=\{dishesCategoryImageSource\}/);
  assert.match(
    targetCardsBlock,
    /source=\{stallsCategoryImageSource\}[\s\S]*style=\{\{ aspectRatio: 1\.55, width: "100%" \}\}[\s\S]*contentFit="cover"/,
  );
  assert.match(
    targetCardsBlock,
    /source=\{dishesCategoryImageSource\}[\s\S]*style=\{\{ aspectRatio: 1\.55, width: "100%" \}\}[\s\S]*contentFit="cover"/,
  );
  assert.doesNotMatch(targetCardsBlock, /aspectRatio: 1\.75/);
  assert.doesNotMatch(targetCardsBlock, /aspectRatio: 1\.8/);
  assert.doesNotMatch(targetCardsBlock, /contentFit="contain"/);
  assert.match(targetCardsBlock, /<LinearGradient[\s\S]*palette\.imageOverlayGradientEnd/);
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
    /SearchResults:\s*\|\s*\{[\s\S]*browseMode\?: "dishes" \| "stalls"[\s\S]*\}\s*\|\s*undefined/,
  );
  assert.match(navigationTypes, /BrowseDishes: undefined/);
  assert.match(navigationTypes, /BrowseStalls: undefined/);
  assert.match(searchResults, /export function BrowseDishesScreen/);
  assert.match(searchResults, /export function BrowseStallsScreen/);
  assert.match(
    searchResults,
    /const RAW_BROWSE_FILTER_OPTIONS = \[BROWSE_ALL_FILTER, \.\.\.BROWSE_FILTER_IDS\]/,
  );
  assert.match(
    read("src/features/search/browseFilters.ts"),
    /BROWSE_ALL_FILTER = "All"[\s\S]*"Halal"/,
  );
  assert.match(searchResults, /<Screen scroll=\{false\} fullWidth/);
  assert.match(searchResults, /"Search all dishes"[\s\S]*"Search all stalls"/);
  assert.doesNotMatch(searchResults, /useMovingSearchPlaceholder|movingSearchPlaceholder/);
  assert.match(searchResults, /<FlashList[\s\S]*numColumns=\{2\}/);
  assert.match(searchResults, /const itemWidth = width \/ 2/);
  assert.match(searchResults, /navigation\.navigate\("CatalogRawDetail"/);
  assert.doesNotMatch(searchResults, /navigation\.navigate\("StallDetail"/);
  assert.doesNotMatch(searchResults, /Dishes nearby/);
  assert.doesNotMatch(searchResults, /Stalls & restaurants nearby/);
  assert.match(searchResults, /function BrowseGridLoadingState/);
});

test("Quick Bites contract: empty-state icon is not clipped", () => {
  const quickBites = read("src/app/screens/discover/QuickBitesScreen.tsx");
  const discoverBites = read("src/features/discover/bites.ts");
  const navigationTypes = read("src/app/navigation/navigationTypes.ts");

  assert.match(
    navigationTypes,
    /collection\?: "quickBites" \| "trending" \| "editorChoice" \| "budget" \| "lateNight"/,
  );
  assert.match(quickBites, /export const COLLECTION_COPY/);
  assert.match(quickBites, /getDiscoverBites/);
  assert.match(quickBites, /function getQuickBiteImageUrls/);
  assert.match(quickBites, /images=\{imageUrls\}/);
  assert.match(discoverBites, /export function getDiscoverBiteCollection/);
  assert.match(discoverBites, /export function syncBiteWithDish/);
  assert.match(discoverBites, /dishName: dish\.name/);
  assert.match(discoverBites, /export function getDiscoverCardImage/);
  assert.match(discoverBites, /photoUrl: image\.imageUrl/);
  assert.match(discoverBites, /imageSourceType: image\.imageSourceType/);
  assert.match(discoverBites, /price: dish\.price/);
  assert.match(discoverBites, /rating: dish\.rating/);
  assert.match(discoverBites, /venueName: dish\.venueName/);
  assert.match(discoverBites, /const bitesWithImages = syncedBites[\s\S]*\.map/);
  assert.doesNotMatch(quickBites, /mockDishes/);
  assert.doesNotMatch(quickBites, /DISH_IMAGE_URLS/);
  assert.match(quickBites, /return collectionBites\s*\.filter/);
  assert.doesNotMatch(
    quickBites,
    /collectionBites\.some\(\(collectionBite\) => collectionBite\.id === bite\.id\)/,
  );
  assert.match(
    quickBites,
    /const openBite = useCallback\([\s\S]*navigation\.navigate\("DishDetail", \{ dishId: activeItem\.dishId \}\)/,
  );
  assert.match(quickBites, /onOpen=\{openBite\}/);
  assert.doesNotMatch(quickBites, /navigation\.navigate\("StallDetail"/);
  const mockData = read("src/lib/services/mock/data.ts");
  assert.match(mockData, /id: "dish-pandan-cake"[\s\S]*name: "Pandan Cake"/);
  assert.match(mockData, /id: "dish-wagyu-burger"[\s\S]*name: "Wagyu Burger"/);
  assert.match(mockData, /id: "dish-salmon-don"[\s\S]*name: "Salmon Don"/);
  assert.match(mockData, /id: "dish-mala-xiang-guo"[\s\S]*name: "Mala Xiang Guo"/);
  const detail = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  assert.doesNotMatch(detail, /fallbackDishes/);
  assert.doesNotMatch(detail, /fallbackVenues/);
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
  assert.match(
    discoverBites,
    /const imagePriorityBites = sortBitesByImagePriority\(bitesWithImages\)/,
  );
  assert.match(discoverBites, /quickBites: imagePriorityBites/);
  assert.match(
    discoverBites,
    /budget: sortBitesByImagePriority\(\s*bitesWithImages\.filter\(\(bite\) => bite\.price < BUDGET_PRICE_CEILING\),?\s*\)/,
  );
  // Top rated needs a rating and some reviews behind it.
  assert.match(
    discoverBites,
    /bite\.rating >= TOP_RATED_MIN_RATING && bite\.cravingCount >= TOP_RATED_MIN_REVIEWS/,
  );
  // Most reviewed is review count only.
  assert.match(
    discoverBites,
    /trending: bitesWithImages\s*\.filter\(\(bite\) => bite\.cravingCount > 0\)\s*\.sort\(\(a, b\) => b\.cravingCount - a\.cravingCount/,
  );
  assert.match(discoverBites, /const lateNight = syncedBites/);
  assert.match(
    quickBites,
    /return getDiscoverBiteCollection\(collection, bites, undefined, venueHours\)/,
  );
  // The footer carousel repeated the grid above it.
  assert.doesNotMatch(quickBites, /renderFoodCarousel|carousel-\$\{bite\.id\}/);
  // Distances come from the read or are hidden; counts are labelled as ratings.
  assert.doesNotMatch(quickBites, /\{item\.distance\}m/);
  assert.match(quickBites, /item\.distance !== undefined \?/);
  assert.match(quickBites, /route\.params\?\.latitude/);
  assert.match(quickBites, /Couldn't load dishes/);
  assert.match(quickBites, /<AppText style=\{styles\.emptyStateIcon\}>🥣<\/AppText>/);
  assert.match(
    quickBites,
    /emptyStateIcon: \{[\s\S]*height: 72,[\s\S]*lineHeight: 64,[\s\S]*width: 72,/,
  );
});

test("Discover collapses empty rails and offers pull-to-refresh plus one error state", () => {
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");

  assert.doesNotMatch(discover, /NoFoodSectionEmptyState/);
  assert.doesNotMatch(discover, /Try again later\./);
  assert.doesNotMatch(discover, /Sparkles/);
  assert.match(
    discover,
    /const shouldRenderDiscoverRail = \(count: number\) =>\s*showDiscoverFilterRailSkeleton \|\| count > 0 \|\| isDiscoverFiltering/,
  );
  for (const cards of [
    "quickBiteCards",
    "trendingCards",
    "editorChoiceCards",
    "budgetCards",
    "areaStallCards",
  ]) {
    assert.match(discover, new RegExp(`shouldRenderDiscoverRail\\(${cards}\\.length\\)`));
  }
  assert.match(
    discover,
    /refreshControl=\{\s*<RefreshControl[\s\S]*refreshing=\{isDiscoverRefreshing\}/,
  );
  assert.match(discover, /setDiscoverLoadError\(true\)/);
  assert.match(
    discover,
    /\{discoverLoadError \|\| isFeedFallbackEmpty \? \(\s*<EmptyState[\s\S]*ctaLabel="Try again"[\s\S]*reloadDiscover\(\)/,
  );
});
