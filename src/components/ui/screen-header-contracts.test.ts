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
    /const discoverLocationLatitude = manualCoordinate\?\.latitude \?\? currentLocation\.latitude/,
  );
  assert.match(
    discover,
    /getNearestSingaporeArea\(discoverLocationLatitude, discoverLocationLongitude\)/,
  );
  assert.match(tabs, /<Tab\.Screen name="Discover" component=\{DiscoverWrapper\}/);
  assert.match(tabs, /require\("@\/app\/screens\/discover\/DiscoverHomeScreen"\)/);
  assert.doesNotMatch(tabs, /DiscoverHomeScreenV2/);
  assert.match(home, /<AppHeader[\s\S]*title="Hungry"/);
  assert.match(home, /horizontalPadding=\{semanticSpacing\.screenEdge\}/);
  assert.doesNotMatch(home, /homeHeaderTopOffset/);
  assert.match(home, /titleStyle=\{\{ color: palette\.orange \}\}/);
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
    /Popular right now[\s\S]*shouldShowPopularFoodSkeleton \? \([\s\S]*<PopularFoodStyleSkeleton \/>[\s\S]*\) : popularFoodStyleItems\.length \? \(/,
  );
  assert.match(
    discover,
    /Quick Bites[\s\S]*showDiscoverFilterRailSkeleton \? \([\s\S]*<DiscoverFoodRailLoadingSkeleton[\s\S]*\) : quickBiteCards\.length \? \([\s\S]*\) : isDiscoverFiltering \? \([\s\S]*<FilteredResultsEmptyState preserveHeight minHeight=\{discoverRailReservedHeight\} \/>/,
  );
  assert.match(
    discover,
    /Trending in \{discoverLocationLabel\}[\s\S]*showDiscoverFilterRailSkeleton \? \([\s\S]*<DiscoverFoodRailLoadingSkeleton[\s\S]*\) : trendingCards\.length \? \([\s\S]*\) : isDiscoverFiltering \? \([\s\S]*<FilteredResultsEmptyState preserveHeight minHeight=\{discoverRailReservedHeight\} \/>/,
  );
  assert.match(
    discover,
    /Editor&apos;s Choice[\s\S]*showDiscoverFilterRailSkeleton \? \([\s\S]*<DiscoverFoodRailLoadingSkeleton[\s\S]*\) : editorChoiceCards\.length \? \([\s\S]*\) : isDiscoverFiltering \? \([\s\S]*<FilteredResultsEmptyState preserveHeight minHeight=\{discoverRailReservedHeight\} \/>/,
  );
  assert.match(
    discover,
    /Budget &lt; S\$8[\s\S]*showDiscoverFilterRailSkeleton \? \([\s\S]*<DiscoverFoodRailLoadingSkeleton[\s\S]*\) : budgetCards\.length \? \([\s\S]*\) : isDiscoverFiltering \? \([\s\S]*<FilteredResultsEmptyState preserveHeight minHeight=\{discoverRailReservedHeight\} \/>/,
  );
  assert.match(
    discover,
    /Late Night Makan[\s\S]*showDiscoverFilterRailSkeleton \? \([\s\S]*<DiscoverFoodRailLoadingSkeleton[\s\S]*\) : lateNightCards\.length \? \([\s\S]*lateNightCards\.map[\s\S]*\) : isDiscoverFiltering \? \([\s\S]*<FilteredResultsEmptyState preserveHeight minHeight=\{discoverRailReservedHeight\} \/>/,
  );
  assert.match(
    discover,
    /Stalls in \{discoverLocationLabel\}[\s\S]*areaStallCards\.length \? \([\s\S]*areaStallCards\.map[\s\S]*\) : isDiscoverFiltering \?/,
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
  assert.match(discover, /return uniqueVenues\.flatMap\(\(venue\) =>/);
  assert.match(discover, /const heroCandidates = \[/);
  assert.match(discover, /return heroCandidates\.map\(\(heroDish, heroIndex\) =>/);
  assert.match(discover, /const image = getDiscoverCardImage\(\[/);
  assert.match(discover, /\.\.\.getDishImageCandidates\(heroDish\)/);
  assert.match(
    discover,
    /STALL_SHOWCASE_FALLBACK_IMAGES\[heroIndex % STALL_SHOWCASE_FALLBACK_IMAGES\.length\]/,
  );
  assert.match(discover, /function extendStallShowcaseCards/);
  assert.match(
    discover,
    /Array\.from\(\{ length: limit \}, \(_, index\) => cards\[index % cards\.length\]\)/,
  );
  assert.match(discover, /function VerticalStallShowcaseSection/);
  assert.match(discover, /const unfilteredStallShowcaseCards = useMemo/);
  assert.match(discover, /const stallShowcaseCards = useMemo/);
  assert.match(discover, /const STALL_SHOWCASE_IMAGE_REPEAT_BUFFER = 2/);
  assert.match(discover, /\.slice\(0, STALL_SHOWCASE_CARD_LIMIT\)/);
  assert.match(
    discover,
    /const visibleCards = useMemo\(\(\) => cards\.slice\(0, STALL_SHOWCASE_CARD_LIMIT\), \[cards\]\)/,
  );
  assert.match(discover, /function getStallShowcaseImageSources/);
  assert.match(discover, /function buildLoopingStallShowcaseImageSources/);
  assert.match(discover, /const columnGap = spacing\[2\]/);
  assert.match(discover, /const rowGap = spacing\[1\.5\]/);
  assert.match(discover, /const columnCardWidth = \(cardWidth - columnGap\) \/ 2/);
  assert.match(discover, /const headingReserveHeight = typography\.h2\.lineHeight \+ spacing\[3\]/);
  assert.match(
    discover,
    /const showcaseViewportHeight = Math\.max\(0, pageHeight - headingReserveHeight\)/,
  );
  assert.match(
    discover,
    /const availableRowHeight = \(showcaseViewportHeight - rowGap \* 2\) \/ 3/,
  );
  assert.match(discover, /const maxTallCardHeight = columnCardWidth \* 1\.1/);
  assert.match(
    discover,
    /const tallCardHeight = Math\.max\(0, Math\.floor\(Math\.min\(availableRowHeight, maxTallCardHeight\)\)\)/,
  );
  assert.match(
    discover,
    /const compactCardDetailsHeight =[\s\S]*typography\.bodySmall\.lineHeight \* 2 \+ spacing\[0\.5\] \+ spacing\[1\]/,
  );
  assert.match(
    discover,
    /const cardImageHeight = Math\.max\(0, Math\.floor\(tallCardHeight - compactCardDetailsHeight\)\)/,
  );
  assert.doesNotMatch(
    discover,
    /const showcaseSwipeX = useRef\(new Animated\.Value\(0\)\)\.current/,
  );
  assert.match(discover, /return rows/);
  assert.doesNotMatch(discover, /return rows\.slice\(0, 3\)/);
  assert.match(discover, /const showcaseVenuePool = \[\.\.\.areaVenues, \.\.\.allDiscoverVenues\]/);
  assert.match(
    discover,
    /return buildStallShowcaseCardsFromVenues\(showcaseVenuePool, repositoryLookup\)/,
  );
  assert.match(
    discover,
    /matchesDiscoverChipSelection\(product, \[\s*venue\.name,\s*heroDish\.name,\s*\.\.\.product\.tasteTags,/,
  );
  assert.match(discover, /directionalLockEnabled/);
  assert.doesNotMatch(discover, /pagingEnabled/);
  assert.doesNotMatch(discover, /disableIntervalMomentum/);
  assert.match(discover, /const showcaseKey = useMemo/);
  assert.match(discover, /const lastTouchYRef = useRef<number \| null>\(null\)/);
  assert.doesNotMatch(discover, /const gestureStartTouchYRef = useRef<number \| null>\(null\)/);
  assert.match(discover, /showcaseScrollOffsetRef\.current = 0/);
  assert.match(discover, /updateParentScrollLock\(false\)/);
  assert.doesNotMatch(discover, /Animated\.spring\(showcaseSwipeX/);
  assert.match(discover, /function VerticalStallShowcaseSection[\s\S]*onTopBoundaryPull/);
  assert.match(discover, /function VerticalStallShowcaseSection[\s\S]*onRequestSectionFocus/);
  assert.match(discover, /function VerticalStallShowcaseSection[\s\S]*onSectionLayout/);
  assert.match(discover, /onRequestSectionFocus\(\)/);
  assert.match(discover, /updateParentScrollLock\(true\)/);
  assert.match(discover, /const handleShowcaseTouchMove = useCallback/);
  assert.match(discover, /showcaseScrollOffsetRef\.current <= 1 && deltaY > 0/);
  assert.match(discover, /onTopBoundaryPull\(deltaY\)/);
  assert.match(discover, /const discoverScrollOffsetYRef = useRef\(0\)/);
  assert.match(
    discover,
    /const discoverScrollDirectionRef = useRef<"up" \| "down" \| null>\(null\)/,
  );
  assert.match(discover, /const stallShowcaseTopYRef = useRef\(0\)/);
  assert.match(discover, /const handleDiscoverScroll = useCallback/);
  assert.match(discover, /const previousOffsetY = discoverScrollOffsetYRef\.current/);
  assert.match(discover, /discoverScrollDirectionRef\.current = "down"/);
  assert.match(discover, /discoverScrollDirectionRef\.current = "up"/);
  assert.match(discover, /discoverScrollOffsetYRef\.current = nextOffsetY/);
  assert.match(discover, /const handleStallShowcaseLayout = useCallback/);
  assert.match(discover, /stallShowcaseTopYRef\.current = event\.nativeEvent\.layout\.y/);
  assert.match(discover, /const focusStallShowcaseSection = useCallback/);
  assert.match(discover, /const sectionTopY = stallShowcaseTopYRef\.current/);
  assert.match(
    discover,
    /discoverScrollRef\.current\?\.scrollTo\(\{ x: 0, y: sectionTopY, animated \}\)/,
  );
  assert.match(discover, /const handleDiscoverScrollEnd = useCallback/);
  assert.match(discover, /nextOffsetY < sectionTopY - stallShowcasePageHeight \/ 2/);
  assert.match(discover, /focusStallShowcaseSection\(true\)/);
  assert.match(discover, /const handleStallShowcaseTopBoundaryPull = useCallback/);
  assert.match(
    discover,
    /discoverScrollRef\.current\?\.scrollTo\(\{ x: 0, y: nextParentOffsetY, animated: false \}\)/,
  );
  assert.match(discover, /onScroll=\{handleDiscoverScroll\}/);
  assert.match(discover, /onScrollEndDrag=\{handleDiscoverScrollEnd\}/);
  assert.match(discover, /onMomentumScrollEnd=\{handleDiscoverScrollEnd\}/);
  assert.match(discover, /scrollY\.setValue\(0\)/);
  assert.match(discover, /key=\{showcaseKey\}/);
  assert.match(discover, /\$\{card\.id\}-\$\{index\}/);
  assert.match(discover, /onTouchStart=\{handleShowcaseTouchStart\}/);
  assert.match(discover, /onTouchMove=\{handleShowcaseTouchMove\}/);
  assert.match(
    discover,
    /<View onLayout=\{onSectionLayout\} style=\{\{ gap: spacing\[2\], height: pageHeight \}\}>/,
  );
  assert.match(discover, /snapToInterval=\{rowSnapInterval\}/);
  assert.match(discover, /snapToAlignment="start"/);
  assert.match(discover, /style=\{\{ height: showcaseViewportHeight, width: cardWidth \}\}/);
  assert.match(discover, /contentContainerStyle=\{\{ gap: rowGap \}\}/);
  assert.match(discover, /showcaseRows\.map\(\(rowCards, rowIndex\) =>/);
  assert.match(discover, /rowCards\.map\(\(card, columnIndex\) =>/);
  assert.match(
    discover,
    /const imageInputStart = Math\.max\(0, \(rowIndex - 3\) \* rowSnapInterval\)/,
  );
  assert.match(
    discover,
    /const imageInputEnd = Math\.max\(rowSnapInterval, \(rowIndex \+ 1\) \* rowSnapInterval\)/,
  );
  assert.match(discover, /const imageScrollStepCount = Math\.max/);
  assert.match(discover, /const imageRailSources = buildLoopingStallShowcaseImageSources/);
  assert.match(discover, /const imageTranslateX = scrollY\.interpolate/);
  assert.match(
    discover,
    /outputRange:\s*columnIndex === 0 \? \[0, -imageTravel\] : \[-imageTravel, 0\]/,
  );
  assert.match(discover, /const direction = columnIndex === 0 \? -1 : 1/);
  assert.match(discover, /const contentTravel = columnCardWidth/);
  assert.match(
    discover,
    /outputRange: \[-contentTravel \* direction, 0, 0, contentTravel \* direction\]/,
  );
  assert.match(discover, /outputRange: \[0\.42, 1, 1, 0\.42\]/);
  assert.match(discover, /opacity,\s*transform: \[\{ translateX \}\]/);
  assert.match(discover, /imageRailSources\.map\(\(imageSource, imageIndex\) =>/);
  assert.match(discover, /transform: \[\{ translateX: imageTranslateX \}\]/);
  assert.match(discover, /source=\{imageSource\}/);
  assert.match(
    discover,
    /flatMap\(\(product\) => getDiscoverCardImage\(getDishImageCandidates\(product\)\)\.candidateUrls\)/,
  );
  assert.match(
    discover,
    /bottom: spacing\[2\],[\s\S]*right: spacing\[2\],[\s\S]*<Star color=\{palette\.amber\} size=\{11\} fill=\{palette\.amber\} \/>[\s\S]*\{card\.heroDish\.rating\.toFixed\(1\)\}/,
  );
  assert.match(
    discover,
    /\{card\.venue\.name\}[\s\S]*flexShrink: 0[\s\S]*\{card\.venue\.unitNumber\}/,
  );
  assert.doesNotMatch(
    discover,
    /style=\{\{ alignItems: "center", flexDirection: "row", gap: spacing\[1\] \}\}[\s\S]*\{card\.heroDish\.rating\.toFixed\(1\)\}/,
  );
  assert.doesNotMatch(discover, /secondaryProducts\.map/);
  assert.match(discover, /height: tallCardHeight/);
  assert.match(discover, /width: columnCardWidth/);
  assert.match(
    discover,
    /const \[isStallShowcaseGestureActive, setIsStallShowcaseGestureActive\] = useState\(false\)/,
  );
  assert.match(discover, /scrollEnabled=\{!isStallShowcaseGestureActive\}/);
  assert.match(discover, /onTouchStart=\{handleShowcaseTouchStart\}/);
  assert.match(discover, /onTopBoundaryPull=\{handleStallShowcaseTopBoundaryPull\}/);
  assert.match(discover, /onRequestSectionFocus=\{focusStallShowcaseSection\}/);
  assert.match(discover, /onSectionLayout=\{handleStallShowcaseLayout\}/);
  assert.match(discover, /onTouchEnd=\{handleShowcaseGestureEnd\}/);
  assert.match(discover, /onScrollBeginDrag=\{handleShowcaseGestureStart\}/);
  assert.match(discover, /onScrollEndDrag=\{handleShowcaseGestureEnd\}/);
  assert.match(discover, /listener: handleShowcaseScroll/);
  assert.match(discover, /onOpenCard=\{openStallShowcaseCard\}/);
  assert.match(discover, /onPrefetchCard=\{prefetchStallShowcaseCard\}/);
  assert.match(
    discover,
    /Stalls in \{discoverLocationLabel\}[\s\S]*areaStallCards\.map[\s\S]*stallShowcaseCards\.length \? \([\s\S]*<VerticalStallShowcaseSection/,
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
  assert.match(discover, /getDiscoverBiteCollections\(discoverBaseBites, repository\)/);
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
    /function FoodStyleButton[\s\S]*const labelGap = spacing\[1\.5\][\s\S]*const labelLineHeight = typography\.bodySmallBold\.fontSize \+ spacing\[1\][\s\S]*const buttonHeight = bowlSize \+ labelGap \+ labelLineHeight \* 2[\s\S]*style=\{\{ alignItems: "center", height: buttonHeight, width: 88 \}\}[\s\S]*lineHeight: labelLineHeight[\s\S]*marginTop: labelGap[\s\S]*minHeight: labelLineHeight \* 2/,
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
    /\{isLateNightMakanVisible && shouldRenderDiscoverRail\(lateNightCards\.length\) \? \([\s\S]*Late Night Makan[\s\S]*lateNightCards\.map/,
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
    /imageSource: image\.imageUrl \? \{ uri: image\.imageUrl \} : style\.imageSource/,
  );
  assert.match(discover, /source=\{imageSource\}/);
  assert.match(discover, /<MemoFoodStyleButton[\s\S]*imageSource=\{item\.imageSource\}/);
  assert.match(discover, /const showPopularFoodFilterSkeleton = isPopularFoodFilterPending/);
  assert.match(discover, /POPULAR_FOOD_FILTER_SKELETON_MIN_MS = 1200/);
  assert.match(discover, /setIsPopularFoodFilterSkeletonPending\(true\)/);
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
  assert.match(discover, /<DiscoverBiteImage bite=\{bite\} height=\{discoverRailImageHeight\} \/>/);
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
  assert.match(discover, /updateSearchQuery\(item\.query\)/);
  assert.match(discover, /rememberSearch\(item\.query\)/);
  assert.match(discover, /navigation\.navigate\("SearchResults", \{/);
  assert.match(discover, /places to eat in this area/);
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
  assert.match(discover, /style=\{\{ alignItems: "center", height: buttonHeight, width: 88 \}\}/);
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
  assert.match(discover, /renderLeftIcon=\{\(chip, isActive\) =>/);
  assert.match(discover, /onSelect=\{toggleDiscoverChip\}/);
  assert.match(
    discover,
    /<AppText variant="h2" style=\{\{ color: themeTints\.text \}\}>\s*Popular right now\s*<\/AppText>/,
  );
  assert.doesNotMatch(discover, /<DecideForMeCard compact \/>/);
  assert.doesNotMatch(discover, /import \{ DecideForMeCard \}/);
  assert.match(
    discover,
    /\/\* Decision action chips \*\/[\s\S]*<View style=\{\{ flexDirection: "row", gap: decisionCardGap \}\}>[\s\S]*onPress=\{handleDecideForMe\}[\s\S]*Decide for Me[\s\S]*navigation\.navigate\("WheelStack", \{ screen: "WheelHome" \}\)[\s\S]*Hungry Wheel[\s\S]*<\/View>/,
  );
  assert.match(
    discover,
    /const handleDecideForMe = \(\) => \{[\s\S]*navigation\.navigate\("DecideForMeResult", \{ surface: "discover" \}/,
  );
  assert.match(
    discover,
    /<Dices color=\{palette\.white\} size=\{decisionCardIconGraphicSize\} \/>/,
  );
  assert.match(discover, /height: 72,[\s\S]*width: decisionCardWidth/);
  assert.match(discover, /height: "100%"/);
  assert.match(discover, /justifyContent: "center"/);
  assert.match(discover, /adjustsFontSizeToFit[\s\S]*minimumFontScale=\{0\.88\}/);
  assert.match(discover, /maxWidth: decisionCardLabelMaxWidth/);
  assert.match(discover, /textAlign: "center"/);
  assert.match(discover, /numberOfLines=\{1\}/);
  assert.doesNotMatch(discover, /minHeight: 72/);
  assert.doesNotMatch(discover, /height: 52/);
  assert.match(discover, /Trending in \{discoverLocationLabel\}/);
  assert.match(discover, /Stalls in \{discoverLocationLabel\}/);
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
    /const discoveryService = getHungryService\(\)\.discovery[\s\S]*discoveryService\.countVenuesInArea\([\s\S]*discoverLocationLatitude,[\s\S]*discoverLocationLongitude,[\s\S]*DISCOVER_AREA_RADIUS_METERS,[\s\S]*discoverLocationLabel/,
  );
  assert.match(
    discover,
    /setSupabaseDiscoverAreaCount\(typeof venueCount === "number" \? venueCount : null\)/,
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
    /const discoverAreaCount = isSupabaseDataSource[\s\S]*\? supabaseDiscoverAreaCount[\s\S]*: areaVenues\.length/,
  );
  assert.match(
    discover,
    /discoverAreaCount === null \? \([\s\S]*<Skeleton width=\{150\} height=\{14\} borderRadius=\{radii\.sm\} \/>/,
  );
  assert.match(
    discover,
    /Stalls in \{discoverLocationLabel\}[\s\S]*<View style=\{\{ gap: discoverContentGap \}\}>[\s\S]*areaStallCards\.map/,
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
  assert.doesNotMatch(searchResults, /useMovingSearchPlaceholder|movingSearchPlaceholder/);
  assert.match(
    searchResults,
    /const searchPlaceholder = isDishGrid \? "Find dishes\.\.\." : "Find stalls\.\.\."/,
  );
  assert.match(searchResults, /<FlashList[\s\S]*numColumns=\{numColumns\}/);
  assert.match(searchResults, /const numColumns = 2/);
  assert.match(searchResults, /const itemWidth = screenWidth \/ numColumns/);
  assert.match(
    searchResults,
    /<LinearGradient[\s\S]*palette\.mediaGradientMid[\s\S]*palette\.detailImageOverlay/,
  );
  assert.match(searchResults, /<Avatar uri=\{activeSlide\.authorAvatarUrl\}/);
  assert.match(
    searchResults,
    /navigation\.navigate\("DishDetail", \{ dishId: activeItem\.dish\.id \}\)/,
  );
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
  assert.match(quickBites, /function getQuickBiteCycleFrames/);
  assert.match(quickBites, /images=\{cycleFrames\.map\(\(frame\) => frame\.imageUrl\)\}/);
  assert.match(quickBites, /const activeSlide = cycleFrames\[activeIndex\]\?\.item/);
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
  assert.match(quickBites, /const list = collectionBites\s*\.filter/);
  assert.doesNotMatch(
    quickBites,
    /collectionBites\.some\(\(collectionBite\) => collectionBite\.id === bite\.id\)/,
  );
  assert.match(
    quickBites,
    /onOpen=\{\(activeItem\) => navigation\.navigate\("DishDetail", \{ dishId: activeItem\.dishId \}\)\}/,
  );
  assert.match(quickBites, /navigation\.navigate\("DishDetail", \{ dishId: bite\.dishId \}\)/);
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
    /budget: sortBitesByImagePriority\(bitesWithImages\.filter\(\(bite\) => bite\.price < 8\)\)/,
  );
  assert.match(
    discoverBites,
    /editorChoice: sortBitesByImagePriority\(\s*bitesWithImages\.filter\(\(bite\) => bite\.rating >= 4\.4\),?\s*\)/,
  );
  assert.match(
    discoverBites,
    /trending: \[\.\.\.bitesWithImages\]\.sort\(\(a, b\) => \{[\s\S]*hasRealDiscoverBiteImage\(b\)[\s\S]*b\.cravingCount - a\.cravingCount/,
  );
  assert.match(discoverBites, /const lateNight = syncedBites/);
  assert.match(quickBites, /return getDiscoverBiteCollection\(collection, bites\)/);
  assert.match(quickBites, /ListFooterComponent=\{renderFoodCarousel\}/);
  assert.match(quickBites, /key=\{`carousel-\$\{bite\.id\}`\}/);
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
    /\{discoverLoadError \? \(\s*<EmptyState[\s\S]*ctaLabel="Try again"[\s\S]*reloadDiscover\(\)/,
  );
});
