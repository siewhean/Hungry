# Hungry App Performance Optimisation Plan

**Project:** Hungry mobile app
**Focus:** Faster discovery filtering, bottom navigation responsiveness, Popular Right Now navigation, back-button responsiveness, skeleton loading, prefetching, and perceived performance.

---

## 1. Problem Summary

The app currently feels slow in several user-facing interactions:

1. **Discovery filter chips**
   - When toggling a filter chip on the Discovery page, the `Popular right now` image buttons take time to update.
   - Toggling a chip on/off has a noticeable delay before the UI reflects the change.

2. **Bottom navigation bar**
   - Tapping a bottom navigation tab sometimes takes a while before the page updates.
   - The user expects tab switching to feel immediate.

3. **Popular right now button navigation**
   - Tapping a Popular Right Now food button takes too long to open the next page.
   - The back button from that page can also feel delayed.

4. **Loading feedback**
   - Some delays feel like the app is frozen because nothing changes immediately.
   - Skeleton loading should be used more often than spinners.
   - Skeleton loading should match the shape of the content that is loading.

---

## 2. Main Diagnosis

The app already has several good performance tools installed and partially used:

- React Native / Expo
- React Navigation native stack and material tabs
- `expo-image`
- `@shopify/flash-list`
- Zustand stores
- Existing custom prefetch helpers
- Existing skeleton components

The problem is likely not the absence of prefetching or loading components. The main issue is that expensive synchronous work is still happening before the UI can respond.

The app should prioritise this rule:

> For every tap, update the UI or navigate first. Do analytics, persistence, filtering, sorting, and prefetching after the first frame or after interactions.

---

## 3. Likely Root Causes

### 3.1 Too much JS work before the UI responds

React Native has a limited frame budget. If the JS thread is busy recalculating arrays, filtering lists, running analytics, or preparing screen data, touches and screen transitions can feel delayed.

In `DiscoverHomeScreen.tsx`, toggling one chip can cause many derived values to recompute:

- all discover venues
- area venues
- all discover dishes
- area dishes
- quick bite cards
- trending cards
- editor choice cards
- budget cards
- late night cards
- popular food style items
- area stall cards

This means a small chip toggle can accidentally trigger large screen-level work.

### 3.2 Popular Right Now navigation performs work before navigation

The current Popular Right Now press flow does multiple things before or during navigation:

- records taste interaction
- updates the search query store
- remembers the search
- navigates to `SearchResults`

For perceived speed, navigation should happen first. Analytics and persistence can run after the transition starts.

### 3.3 Bottom tabs are lazy-mounted

The bottom navigation currently uses a material top tab navigator positioned at the bottom. It uses lazy rendering and a null placeholder.

This means the first time a tab is opened, React Navigation may need to mount that tab screen from scratch. A null placeholder makes the delay feel like nothing happened.

### 3.4 SearchResults / BrowseGridScreen builds too much data synchronously

The Popular Right Now flow navigates to `SearchResults` with `browseMode: "stalls"`, which mounts `BrowseGridScreen`.

`BrowseGridScreen` currently builds several indexes and derived lists inside render-time hooks:

- all venues
- area venues
- all dishes
- browse dishes
- browse venues
- stall post indexes
- feed items
- filtered feed items

This can slow down both forward navigation and back navigation.

### 3.5 Skeleton loading is delayed in moments where feedback should be instant

The existing `useDelayedLoadingSkeleton` waits before showing skeletons. This is useful for avoiding flicker in background loading, but it is not ideal after direct user taps.

For direct navigation and direct filter changes, feedback should be instant.

---

## 4. Performance Principles To Apply

### 4.1 Immediate UI feedback

When the user taps a chip or button, the selected/pressed state should update immediately.

Do not wait for:

- data filtering
- image prefetching
- analytics
- search history writes
- large memo recomputation
- API responses

### 4.2 Navigate first, then do non-critical work

For navigation actions:

1. Navigate immediately.
2. Show the target screen or a skeleton immediately.
3. After the first frame or after interactions, do analytics, search-history writes, persistence, and prefetching.

### 4.3 Precompute expensive indexes

Large derived data should not be rebuilt every time a screen renders or a chip changes.

Precompute and cache:

- venue indexes
- dish indexes
- post-by-dish maps
- post-by-venue maps
- popular food style data
- browse grid feed items

### 4.4 Use skeletons instead of blank placeholders

Skeletons should match the final content shape:

- circular food buttons for Popular Right Now
- two-column image grid for BrowseGridScreen
- row skeletons for SearchResultsView
- tab screen skeletons for lazy-loaded tabs

### 4.5 Use prefetching earlier than `onPressIn`

`onPressIn` gives only a tiny head start. For predictable destinations, prefetch while the current screen is idle.

Examples:

- prefetch Popular Right Now target screens when Discovery becomes idle
- prefetch first-screen grid images
- preload `SearchResults` with common queries
- preload adjacent bottom tabs after app startup

---

## 5. Priority Implementation Plan

---

# Priority 1: Make Popular Right Now Navigation Immediate

## Problem

The Popular Right Now button currently performs analytics and store updates before or during navigation.

## Goal

Tapping a Popular Right Now button should open the next screen immediately.

## Recommended change

In `src/app/screens/discover/DiscoverHomeScreen.tsx`, update the handler so navigation happens first.

```tsx
import { InteractionManager } from "react-native";

const handleFoodStylePress = useCallback(
  (item: PopularFoodStyle & { dish?: DishDetail }) => {
    navigation.navigate("SearchResults", {
      browseMode: "stalls",
      initialQuery: item.query,
    });

    InteractionManager.runAfterInteractions(() => {
      recordTasteInteraction({
        type: "search_query",
        surface: "discover",
        dish: item.dish,
        dishId: item.dishId,
        query: item.query,
        chipId: item.id,
        buttonId: "popular_right_now",
      });

      updateSearchQuery(item.query);
      rememberSearch(item.query);
    });
  },
  [navigation, recordTasteInteraction, rememberSearch, updateSearchQuery],
);
```

## Why this helps

- The user sees the next page immediately.
- Analytics and persistence no longer block the tap.
- The app feels faster even if the actual work still happens.

## Apply the same pattern to

- result card taps
- dish detail taps
- stall detail taps
- browse grid taps
- back-button flows that trigger extra work

---

# Priority 2: Make Filter Chips Feel Instant

## Problem

The chip selected state and expensive filtered content update together. This can make the chip feel delayed.

## Goal

The chip should visually toggle instantly. The expensive filtered content can update slightly after.

## Recommended change

Use immediate state for chip UI and deferred state for expensive filtering.

```tsx
import { useDeferredValue } from "react";

const [activeDiscoverChipIds, setActiveDiscoverChipIds] = useState<DiscoverChipId[]>([]);
const deferredDiscoverChipIds = useDeferredValue(activeDiscoverChipIds);
const isDiscoverFilterPending = deferredDiscoverChipIds !== activeDiscoverChipIds;
```

Use `activeDiscoverChipIds` for the chip selected UI:

```tsx
const isActive = activeDiscoverChipIds.includes(chip.id);
```

Use `deferredDiscoverChipIds` for expensive filtering:

```tsx
const matchesDiscoverChipSelection = useCallback(
  (dish?: DishDetail, textParts: string[] = []) => {
    if (!deferredDiscoverChipIds.length) {
      return true;
    }

    return deferredDiscoverChipIds.every((chipId) => {
      // existing chip matching logic here
    });
  },
  [deferredDiscoverChipIds, discoverDietaryFlags],
);
```

## Optional loading feedback

If `isDiscoverFilterPending` is true, keep the current content visible but show a small subtle updating state, not a full-screen spinner.

Example:

```tsx
{isDiscoverFilterPending ? (
  <AppText variant="micro" tone="secondary">
    Updating results…
  </AppText>
) : null}
```

Or show a skeleton only for the section being updated.

---

# Priority 3: Memoise Popular Right Now Buttons

## Problem

Every filter change can rerender all Popular Right Now button components.

## Goal

Popular Right Now buttons should rerender only when their own props change.

## Recommended change

Wrap the button component in `React.memo`.

```tsx
const MemoFoodStyleButton = React.memo(FoodStyleButton);
```

Use it in the list:

```tsx
{popularFoodStyleItems.map((item) => (
  <MemoFoodStyleButton
    key={item.id}
    imageSource={item.imageSource}
    label={item.label}
    trending={item.trending}
    onPressIn={() => prefetchFoodStyle(item)}
    onPress={() => handleFoodStylePress(item)}
  />
))}
```

For further optimisation, avoid inline functions by creating a child component that owns its handlers.

```tsx
const PopularFoodStyleItem = React.memo(function PopularFoodStyleItem({
  item,
  onPrefetch,
  onPress,
}: {
  item: PopularFoodStyle & { imageSource: string | number; dish?: DishDetail };
  onPrefetch: (item: PopularFoodStyle) => void;
  onPress: (item: PopularFoodStyle & { dish?: DishDetail }) => void;
}) {
  const handlePressIn = useCallback(() => onPrefetch(item), [item, onPrefetch]);
  const handlePress = useCallback(() => onPress(item), [item, onPress]);

  return (
    <FoodStyleButton
      imageSource={item.imageSource}
      label={item.label}
      trending={item.trending}
      onPressIn={handlePressIn}
      onPress={handlePress}
    />
  );
});
```

---

# Priority 4: Precompute Browse/Search Indexes

## Problem

`BrowseGridScreen` builds large derived lists and maps during render.

## Goal

The screen should render from precomputed data instead of building everything on every mount.

## Recommended architecture

Create a browse index builder.

Suggested file:

```txt
src/features/search/browseIndex.ts
```

Example:

```ts
import { getDataRepository } from "@/lib/services/serviceProvider";
import type { DishDetail, StallPost, VenueSummary } from "@/types/domain";

type BrowseIndex = {
  allVenues: VenueSummary[];
  allDishes: DishDetail[];
  stallPosts: StallPost[];
  postByDishId: Map<string, StallPost>;
  postByVenueId: Map<string, StallPost>;
};

let cachedBrowseIndex: BrowseIndex | null = null;

export function getBrowseIndex(): BrowseIndex {
  if (cachedBrowseIndex) {
    return cachedBrowseIndex;
  }

  const repository = getDataRepository();
  const allVenues = repository
    .listBuildings()
    .flatMap((building) => repository.listVenuesByBuilding(building.id));

  const allDishes = allVenues.flatMap((venue) => repository.listDishesByVenue(venue.id));
  const stallPosts = repository.listStallPosts();

  const postByDishId = new Map<string, StallPost>();
  const postByVenueId = new Map<string, StallPost>();

  stallPosts.forEach((post) => {
    if (!postByVenueId.has(post.venueId)) {
      postByVenueId.set(post.venueId, post);
    }

    post.dishIds.forEach((dishId) => {
      if (!postByDishId.has(dishId)) {
        postByDishId.set(dishId, post);
      }
    });
  });

  cachedBrowseIndex = {
    allVenues,
    allDishes,
    stallPosts,
    postByDishId,
    postByVenueId,
  };

  return cachedBrowseIndex;
}

export function clearBrowseIndexCache() {
  cachedBrowseIndex = null;
}
```

## Use it inside `BrowseGridScreen`

Replace repeated index creation with:

```tsx
const browseIndex = useMemo(() => getBrowseIndex(), []);
```

Then use:

```tsx
const { allVenues, allDishes, postByDishId, postByVenueId } = browseIndex;
```

## Important

If live Supabase data changes, invalidate the cache when:

- merchant updates menu
- location source changes significantly
- user logs out
- data source switches
- app refreshes remote data

---

# Priority 5: Preload Popular Right Now Destinations Earlier

## Problem

`onPressIn` prefetching happens too late.

## Goal

Popular Right Now target routes and first images should already be warm before the user taps.

## Recommended change

In `DiscoverHomeScreen.tsx`, add idle prefetching.

```tsx
import { InteractionManager } from "react-native";

useEffect(() => {
  const task = InteractionManager.runAfterInteractions(() => {
    popularFoodStyleItems.forEach((item) => {
      prefetchFoodStyle(item);
    });

    preloadRoute(navigation, "SearchResults", {
      browseMode: "stalls",
      initialQuery: popularFoodStyleItems[0]?.query ?? "",
    });
  });

  return () => {
    task.cancel();
  };
}, [navigation, popularFoodStyleItems, prefetchFoodStyle]);
```

## Improve the existing prefetch helper

Current helper prefetches images and route components. Extend it to also precompute data indexes.

Example:

```ts
export function prefetchBrowseResults(query: string) {
  getBrowseIndex();

  const repository = getDataRepository();
  const matchingDishes = repository
    .searchDishes({
      query,
      categories: [],
      dietaryFlags: [],
      tasteValues: undefined,
      radius: 500,
    })
    .slice(0, 8);

  prefetchImages(
    matchingDishes.map((dish) => dish.imageUrl),
    8,
  );
}
```

Then call:

```tsx
prefetchBrowseResults(item.query);
```

---

# Priority 6: Improve Bottom Navigation Responsiveness

## Problem

The bottom tabs are lazy-mounted and use a blank placeholder.

## Goal

Tab switching should show the next screen immediately.

## Option A: Best perceived speed

Use eager mounting for the main tabs.

In `src/app/navigation/SwipeableTabNavigator.tsx`, change:

```tsx
screenOptions={{
  swipeEnabled: true,
  animationEnabled: false,
  lazy: true,
  lazyPlaceholder: () => null,
  lazyPreloadDistance: tabPreloadEnabled ? 1 : 0,
}}
```

To:

```tsx
screenOptions={{
  swipeEnabled: true,
  animationEnabled: false,
  lazy: false,
  freezeOnBlur: true,
}}
```

## Option B: Balanced startup and tab speed

If eager mounting makes startup slower, keep lazy loading for heavy tabs but use skeleton placeholders.

```tsx
screenOptions={{
  swipeEnabled: true,
  animationEnabled: false,
  lazy: true,
  lazyPlaceholder: () => <TabScreenSkeleton />,
  lazyPreloadDistance: 1,
  freezeOnBlur: true,
}}
```

## Suggested TabScreenSkeleton

```tsx
function TabScreenSkeleton() {
  const { spacing, radii } = useHungryTheme();

  return (
    <View style={{ flex: 1, padding: spacing[4], gap: spacing[4] }}>
      <Skeleton width="50%" height={28} />
      <Skeleton width="100%" height={48} borderRadius={radii.lg} />
      <View style={{ flexDirection: "row", gap: spacing[3] }}>
        <Skeleton width="48%" height={140} borderRadius={radii.lg} />
        <Skeleton width="48%" height={140} borderRadius={radii.lg} />
      </View>
      <Skeleton width="70%" height={24} />
      <Skeleton width="100%" height={220} borderRadius={radii.xl} />
    </View>
  );
}
```

---

# Priority 7: Use Instant Skeletons For Direct User Actions

## Problem

The skeleton hook delays showing skeletons. This can make direct user taps feel like nothing happened.

## Goal

Use delayed skeletons only for background loading. Use instant skeletons for direct taps and navigation.

## Recommended approach

Keep the existing hook, but use different delays depending on context.

```tsx
const showBackgroundSkeleton = useDelayedLoadingSkeleton(isBackgroundLoading, 300);
const showNavigationSkeleton = useDelayedLoadingSkeleton(isNavigatingOrColdRoute, 0);
```

## Suggested skeleton policy

| Situation | Skeleton delay |
|---|---:|
| Background refresh | 300ms |
| Direct navigation after tap | 0ms |
| Filter chip changes | 0-100ms for affected section only |
| Image loading inside an existing card | 0ms placeholder shape |
| Pull-to-refresh | 150-300ms |

---

# Priority 8: Add Browse Grid Skeleton

## Problem

The BrowseGrid screen can feel blank or delayed while data is prepared.

## Goal

Show a two-column grid skeleton matching the final content.

```tsx
function BrowseGridSkeleton() {
  const { spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  const itemWidth = width / 2;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {Array.from({ length: 8 }).map((_, index) => (
        <View
          key={`browse-grid-skeleton-${index}`}
          style={{
            width: itemWidth,
            height: itemWidth * 1.35,
            padding: spacing[1],
          }}
        >
          <Skeleton width="100%" height="100%" borderRadius={0} />
        </View>
      ))}
    </View>
  );
}
```

Use it when:

- browse index is not ready
- route was cold-mounted
- data is being prepared after navigation

---

# Priority 9: Add Search Row Skeleton

## Problem

Search results should not show a generic spinner or blank screen.

## Goal

Skeleton rows should match the real result rows.

```tsx
function SearchResultRowSkeleton() {
  const { spacing, radii } = useHungryTheme();

  return (
    <View style={{ flexDirection: "row", gap: spacing[3], padding: spacing[4] }}>
      <Skeleton width={80} height={80} borderRadius={radii.md} />
      <View style={{ flex: 1, justifyContent: "center", gap: spacing[2] }}>
        <Skeleton width="70%" height={18} />
        <Skeleton width="40%" height={14} />
        <Skeleton width="25%" height={16} />
      </View>
    </View>
  );
}
```

Example usage:

```tsx
function SearchResultsSkeletonList() {
  return (
    <View>
      {Array.from({ length: 8 }).map((_, index) => (
        <SearchResultRowSkeleton key={`search-row-skeleton-${index}`} />
      ))}
    </View>
  );
}
```

---

# Priority 10: Use Expo Image Cache Policy Consistently

## Problem

Some images may still appear late even when prefetching exists.

## Goal

Use Expo Image memory/disk cache consistently for images used in lists and cards.

Example:

```tsx
<Image
  source={{ uri: item.imageUrl }}
  style={StyleSheet.absoluteFill}
  contentFit="cover"
  cachePolicy="memory-disk"
  transition={120}
/>
```

For small circular popular-food images:

```tsx
<Image
  source={typeof imageSource === "string" ? { uri: imageSource } : imageSource}
  style={{ width: "100%", height: "100%", borderRadius: radii.pill }}
  contentFit="cover"
  cachePolicy="memory-disk"
  transition={100}
/>
```

---

## 6. Files To Prioritise

### 6.1 `src/app/screens/discover/DiscoverHomeScreen.tsx`

Recommended work:

- Make Popular Right Now navigation happen first.
- Defer analytics/store writes with `InteractionManager.runAfterInteractions`.
- Use `useDeferredValue` for chip filtering.
- Keep chip selected state instant.
- Memoise Popular Right Now item components.
- Preload popular destinations when the screen is idle.
- Keep Popular Right Now skeleton height stable.

### 6.2 `src/app/navigation/SwipeableTabNavigator.tsx`

Recommended work:

- Consider `lazy: false` for main tabs.
- Add `freezeOnBlur: true`.
- Replace `lazyPlaceholder: () => null` with a real skeleton.
- Preload adjacent tabs earlier.

### 6.3 `src/app/screens/search/SearchResultsScreen.tsx`

Recommended work:

- Move browse-grid index building out of render.
- Add `BrowseGridSkeleton`.
- Defer analytics on item press.
- Make back navigation immediate.
- Avoid rebuilding feed item maps on every mount.

### 6.4 `src/components/discover/SearchResultsView.tsx`

Recommended work:

- Add search row skeletons.
- Memoise result rows.
- Add `cachePolicy="memory-disk"` to images.
- Avoid unnecessary rerenders of list items.

### 6.5 `src/features/navigation/prefetch.ts`

Recommended work:

- Keep existing image and route prefetching.
- Add browse/search data precomputation.
- Trigger prefetch earlier than `onPressIn`.
- Keep prefetch non-blocking and failure-safe.

### 6.6 New suggested file: `src/features/search/browseIndex.ts`

Recommended work:

- Create cached browse indexes.
- Export `getBrowseIndex()`.
- Export `clearBrowseIndexCache()`.
- Reuse in `BrowseGridScreen`, SearchResults, and prefetch helpers.

---

## 7. Concrete Code Patterns

### 7.1 Navigate-first press handler

```tsx
const handlePress = useCallback(() => {
  navigation.navigate("TargetScreen", params);

  InteractionManager.runAfterInteractions(() => {
    trackAnalyticsEvent("button_pressed", metadata);
    persistSomething();
    prefetchSomethingElse();
  });
}, [navigation, params]);
```

### 7.2 Immediate selected state, deferred expensive filtering

```tsx
const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
const deferredSelectedFilters = useDeferredValue(selectedFilters);

const filteredItems = useMemo(() => {
  return expensiveFilter(items, deferredSelectedFilters);
}, [items, deferredSelectedFilters]);
```

### 7.3 Keep previous content while new content filters

```tsx
const isPending = selectedFilters !== deferredSelectedFilters;

return (
  <View>
    {isPending ? <SmallUpdatingIndicator /> : null}
    <ResultsList data={filteredItems} />
  </View>
);
```

### 7.4 Idle prefetch

```tsx
useEffect(() => {
  const task = InteractionManager.runAfterInteractions(() => {
    prefetchImages(imageUrls, 8);
    preloadRoute(navigation, "SearchResults", params);
  });

  return () => task.cancel();
}, [navigation, imageUrls]);
```

### 7.5 Stable image loading

```tsx
<Image
  source={{ uri: imageUrl }}
  style={styles.image}
  contentFit="cover"
  cachePolicy="memory-disk"
  transition={120}
/>
```

---

## 8. Suggested Acceptance Criteria

### Discovery filter chips

- Chip selected state updates immediately on tap.
- Popular Right Now section updates without a visible freeze.
- If filtering takes time, only the affected section shows a shaped skeleton or subtle updating indicator.
- No full-screen spinner appears for chip filtering.

### Bottom navigation

- First tap to any main tab shows content or a skeleton immediately.
- No blank placeholder is shown during tab loading.
- Returning to a previously opened tab is instant.
- Inactive tabs do not rerender unnecessarily.

### Popular Right Now navigation

- Tapping a food button navigates immediately.
- Analytics and search history do not block navigation.
- Target page shows either content or a grid-shaped skeleton immediately.
- First-screen images are already prefetched when possible.

### Back button

- Back navigation happens immediately.
- No cleanup, analytics, or heavy state update blocks the back action.
- Any cleanup runs after navigation.

### Skeleton loading

- Skeletons match the final layout shape.
- Grid screens use grid skeletons.
- Row lists use row skeletons.
- Circular food buttons use circular skeletons.
- Spinners are avoided except for small inline actions where layout is unknown.

---

## 9. Testing Checklist

### Manual performance testing

Test on a real device, not only simulator.

Check the following flows:

1. Open app → tap Discover tab.
2. Tap each bottom navigation tab for the first time.
3. Return to each bottom navigation tab after it has already mounted.
4. On Discovery, toggle each filter chip on and off quickly.
5. On Discovery, tap Popular Right Now → Laksa.
6. Navigate back from the BrowseGrid/SearchResults screen.
7. Tap Popular Right Now buttons repeatedly with different food types.
8. Open Browse Stalls and Browse Dishes.
9. Scroll SearchResults/BrowseGrid quickly.
10. Test on slower Android hardware if available.

### What to measure

- Time from tap to visible UI response.
- Time from tap to target screen visible.
- JS frame drops.
- UI frame drops.
- Whether blank screens appear.
- Whether skeletons match final content shape.
- Whether back button responds immediately.

### Tools to use

- React Native Dev Menu performance monitor.
- Flipper / React DevTools profiler if available.
- Sentry performance traces if configured.
- Manual screen recording for before/after comparison.

---

## 10. Implementation Order

### Phase 1: Fast perceived-performance wins

1. Change Popular Right Now handler to navigate first.
2. Defer analytics/search-history writes.
3. Add instant skeletons for browse/search cold routes.
4. Replace tab lazy placeholder with skeleton.
5. Add `cachePolicy="memory-disk"` to important list/card images.

### Phase 2: Remove expensive render-time work

1. Create `browseIndex.ts`.
2. Move browse grid indexes out of `BrowseGridScreen` render.
3. Move repeated discovery indexes out of `DiscoverHomeScreen` render.
4. Memoise Popular Right Now components.
5. Use `useDeferredValue` for chip filtering.

### Phase 3: Better prefetching

1. Prefetch Popular Right Now routes during idle.
2. Prefetch first-screen BrowseGrid images.
3. Precompute browse/search indexes during idle.
4. Add prefetch helpers for likely next screens.

### Phase 4: Validate and tune

1. Compare before/after tap response.
2. Check startup impact if `lazy: false` is used.
3. Keep eager mounting for high-use tabs only if startup becomes too heavy.
4. Tune skeleton delays by context.
5. Remove remaining blank placeholders.

---

## 11. Codex Prompt To Implement This

Use this prompt if asking Codex to make the changes:

```txt
I want to optimise the Hungry React Native / Expo app for perceived performance.

Focus on these files first:
- src/app/screens/discover/DiscoverHomeScreen.tsx
- src/app/navigation/SwipeableTabNavigator.tsx
- src/app/screens/search/SearchResultsScreen.tsx
- src/components/discover/SearchResultsView.tsx
- src/features/navigation/prefetch.ts

Goals:
1. Make Discovery filter chips visually toggle immediately.
2. Use deferred filtering so expensive list recomputation does not block chip UI feedback.
3. Make Popular Right Now navigation happen immediately before analytics, search-history writes, or other non-critical work.
4. Defer analytics/store persistence with InteractionManager.runAfterInteractions where appropriate.
5. Improve bottom tab responsiveness by avoiding blank lazy placeholders. Use eager mounting or a shaped skeleton placeholder. Add freezeOnBlur where appropriate.
6. Add content-shaped skeletons: circular food button skeletons, two-column browse grid skeletons, and search result row skeletons.
7. Move expensive browse/search index building out of render into a cached feature-level helper such as src/features/search/browseIndex.ts.
8. Extend prefetching so it happens during idle time, not only onPressIn. Prefetch popular destination routes, first-screen images, and browse/search indexes.
9. Use expo-image cachePolicy="memory-disk" for important list/card images.
10. Preserve existing UI design and behaviour. Do not change route names or remove analytics; only defer non-critical work so navigation and touch feedback happen first.

Acceptance criteria:
- Filter chips show selected/unselected state immediately.
- Popular Right Now button tap navigates immediately.
- Bottom navigation never shows a blank screen while mounting a tab.
- BrowseGrid/SearchResults show shaped skeletons if data is not ready.
- Back button responds immediately.
- No spinner is used where a content-shaped skeleton is possible.
- TypeScript passes with npm run typecheck.
- Existing tests still pass.
```

---

## 12. Final Recommendation

The most important changes are:

1. **Navigate first. Defer everything else.**
2. **Make chip UI state immediate and filtering deferred.**
3. **Do not cold-mount heavy tabs behind a blank placeholder.**
4. **Move browse/search indexing out of render.**
5. **Use shaped skeletons for direct user actions.**
6. **Prefetch predictable destinations earlier, during idle time.**

These changes should make the app feel significantly faster even before deeper backend or data-source optimisation.
