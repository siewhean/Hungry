import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Story viewer contract: gestures map taps and swipes to the expected story navigation", () => {
  const source = read("src/app/screens/home/StoryViewerScreen.tsx");

  assert.match(source, /PanResponder\.create/);
  assert.match(source, /onStartShouldSetPanResponder:\s*\(\) => false/);
  assert.match(source, /onMoveShouldSetPanResponder/);
  assert.match(source, /gestureState\.dx < 0[\s\S]*handleNext\(\)/);
  assert.match(source, /gestureState\.dx < 0[\s\S]*handlePrevious\(\)/);
  assert.match(source, /gestureState\.dy > SWIPE_THRESHOLD[\s\S]*handleCloseStory\(\)/);
  assert.match(source, /accessibilityLabel="Previous story"/);
  assert.match(source, /accessibilityLabel="Next story"/);
  assert.doesNotMatch(source, /onResponderRelease/);
});

test("Story viewer contract: progress pauses without resetting the current story", () => {
  const source = read("src/app/screens/home/StoryViewerScreen.tsx");

  assert.match(source, /cancelAnimation\(progressAnim\)/);
  assert.match(source, /startProgress\(progressAnim\.value\)/);
  assert.match(source, /progressAnim\.value = withTiming\(1,/);
  assert.doesNotMatch(source, /isPaused[\s\S]{0,180}progressAnim\.value = 0/);
});

test("Story viewer contract: progress bar is a smooth linear UI-thread animation", () => {
  const source = read("src/app/screens/home/StoryViewerScreen.tsx");

  assert.match(source, /react-native-reanimated/);
  assert.match(source, /const progressAnim = useSharedValue\(0\)/);
  assert.match(source, /const progressTrackWidth = useSharedValue\(0\)/);
  assert.match(source, /isActiveProgressTrackMeasured/);
  assert.match(source, /const startProgress = useCallback/);
  assert.match(source, /const handleNextRef = useRef<\(\) => void>/);
  assert.match(source, /useAnimatedReaction/);
  assert.match(source, /runOnJS\(handleProgressComplete\)\(\)/);
  assert.match(source, /easing: ReanimatedEasing\.linear/);
  assert.match(source, /<Reanimated\.View/);
  assert.match(source, /activeProgressStyle/);
  assert.match(source, /const handleActiveProgressTrackLayout = useCallback/);
  assert.match(source, /type LayoutChangeEvent/);
  assert.match(source, /progressTrackWidth\.value = event\.nativeEvent\.layout\.width/);
  assert.match(source, /setIsActiveProgressTrackMeasured\(event\.nativeEvent\.layout\.width > 0\)/);
  assert.match(
    source,
    /onLayout=\{idx === subIndex \? handleActiveProgressTrackLayout : undefined\}/,
  );
  assert.match(source, /width: trackWidth \* progress/);
  assert.match(source, /styles\.progressBarFill/);
  assert.match(source, /progressTrackWidth\.value = 0/);
  assert.match(source, /setIsActiveProgressTrackMeasured\(false\)/);
  assert.doesNotMatch(source, /translateX: trackWidth > 0/);
  assert.doesNotMatch(source, /transformOrigin/);
  assert.doesNotMatch(source, /transform: \[\{ scaleX: progress \}\]/);
  assert.doesNotMatch(
    source,
    /transform: \[\{ scaleX: Math\.min\(Math\.max\(progressAnim\.value, 0\), 1\) \}\]/,
  );
  assert.doesNotMatch(source, /trackWidthsRef/);
  assert.doesNotMatch(source, /outputRange: \["0%", "100%"\]/);
});

test("Story viewer contract: story seen state is deferred until the viewer is open", () => {
  const source = read("src/app/screens/home/StoryViewerScreen.tsx");
  const homeSource = read("src/app/screens/home/HomeFeedScreen.tsx");

  assert.match(source, /const STORY_OPEN_READY_FALLBACK_MS = 850/);
  assert.match(source, /const STORY_SEEN_OPEN_FALLBACK_MS = 1400/);
  assert.match(source, /const STORY_MEDIA_READY_FALLBACK_MS = 1200/);
  assert.match(source, /const STORY_SEEN_COMMIT_DELAY_MS = 650/);
  assert.match(source, /hasViewerOpened/);
  assert.match(source, /hasViewerSettled/);
  assert.match(source, /isCurrentMediaReady/);
  assert.match(source, /isActiveProgressTrackMeasured/);
  assert.match(source, /isStoryTransitioning/);
  assert.match(source, /canCommitSeen/);
  assert.match(source, /isStoryPlaybackReady/);
  assert.match(
    source,
    /hasViewerOpened &&[\s\S]*isCurrentMediaReady &&[\s\S]*isActiveProgressTrackMeasured &&[\s\S]*!isStoryTransitioning/,
  );
  assert.match(source, /navigation\.addListener\("transitionEnd"/);
  assert.match(source, /data\?\.closing/);
  assert.match(source, /setHasViewerOpened\(true\)/);
  assert.match(source, /setHasViewerSettled\(true\)/);
  assert.match(source, /setIsCurrentMediaReady\(false\)/);
  assert.match(source, /setIsCurrentMediaReady\(true\)/);
  assert.match(source, /onLoadEnd=\{\(\) => onReady\(storyId\)\}/);
  assert.match(source, /STORY_OPEN_READY_FALLBACK_MS/);
  assert.match(source, /STORY_SEEN_OPEN_FALLBACK_MS/);
  assert.match(source, /STORY_MEDIA_READY_FALLBACK_MS/);
  assert.match(source, /STORY_SEEN_COMMIT_DELAY_MS/);
  assert.match(source, /!hasViewerSettled/);
  assert.match(source, /!isStoryPlaybackReady/);
  assert.match(source, /if \(isStoryPlaybackReady\) \{/);
  assert.match(source, /!canCommitSeen/);
  assert.match(source, /requestAnimationFrame\(\(\) => \{/);
  assert.match(source, /InteractionManager\.runAfterInteractions/);
  assert.match(source, /setCanCommitSeen\(true\)/);
  assert.match(source, /markSeenForDisplayName\(displayName\)/);
  assert.match(source, /currentStory\.hasUnseen/);
  assert.match(source, /markSeenForDisplayName\(storyAuthorKey\(currentStory\)\)/);
  assert.match(source, /const handleCloseStory = useCallback/);
  assert.match(source, /unsubscribeTransitionEnd\(\)/);
  assert.match(source, /cancelAnimationFrame\(animationFrame\)/);
  assert.match(homeSource, /const STORY_OPENING_RING_HOLD_MS = 2200/);
  assert.match(homeSource, /openingUnseenStoryId/);
  assert.match(homeSource, /openingUnseenStoryDisplayName/);
  assert.match(homeSource, /holdOpeningStoryRing\(story\)/);
  assert.match(homeSource, /story\.hasUnseen/);
  assert.match(homeSource, /openingUnseenStoryId=\{openingUnseenStoryId\}/);
  assert.match(homeSource, /openingUnseenStoryDisplayName=\{openingUnseenStoryDisplayName\}/);
  assert.doesNotMatch(source, /hasViewerOpenedRef/);
  assert.doesNotMatch(homeSource, /markSeenForDisplayName/);
  assert.doesNotMatch(
    source,
    /currentStory\?\.hasUnseen \|\| currentStory\.isOwn \|\| !canCommitSeen/,
  );
});

test("Story viewer contract: cross-user transitions and footer actions are standardized", () => {
  const source = read("src/app/screens/home/StoryViewerScreen.tsx");

  assert.match(source, /runRotateTransition/);
  assert.doesNotMatch(source, /Viewing \{/);
  assert.doesNotMatch(source, /userTransitionBadge/);
  assert.match(source, /loadStories/);
  assert.match(source, /ActivityIndicator/);
  assert.match(source, /const handleStoryMessage = async \(\) => \{/);
  assert.match(source, /navigation\.navigate\("ChatDetail", \{/);
  assert.match(source, /navigation\.navigate\("AddStory"\)/);
  assert.match(
    source,
    /accessibilityLabel=\{\s*currentStory\.isOwn \? "Add another story" : `Message \$\{currentStory\.displayName\}`\s*\}/,
  );
  assert.match(
    source,
    /accessibilityLabel=\{currentStory\.interaction\.liked \? "Unlike story" : "Like story"\}/,
  );
  assert.match(source, /accessibilityLabel="Share story"/);
  assert.doesNotMatch(source, /Share feature coming soon/);
  assert.doesNotMatch(source, /accessibilityLabel="Save story"/);
  assert.match(source, /styles\.actionButtonStack/);
  assert.match(source, /styles\.actionCountText/);
  assert.doesNotMatch(source, /actionIcon/);
});

test("Story viewer contract: swipe-out fades before closing", () => {
  const source = read("src/app/screens/home/StoryViewerScreen.tsx");

  assert.match(source, /const closeOpacity = useRef\(new RNAnimated\.Value\(1\)\)\.current/);
  assert.match(source, /const closeWithFade = useCallback/);
  assert.match(
    source,
    /RNAnimated\.timing\(closeOpacity,\s*\{[\s\S]*toValue: 0[\s\S]*duration: 180/,
  );
  assert.match(
    source,
    /<RNAnimated\.View[\s\S]*backgroundColor: palette\.storyViewerBackground[\s\S]*opacity: closeOpacity/,
  );
  assert.match(source, /gestureState\.dy > SWIPE_THRESHOLD[\s\S]*handleCloseStory\(\)/);
});

test("Story viewer contract: dark overlay colors come from semantic story tokens", () => {
  const source = read("src/app/screens/home/StoryViewerScreen.tsx");
  const tokenSource = read("src/theme/tokens.ts");

  assert.match(tokenSource, /storyViewerBackground/);
  assert.match(tokenSource, /storyProgressTrack/);
  assert.match(tokenSource, /storyMetaText/);
  assert.match(tokenSource, /storyControlBorder/);
  assert.match(source, /palette\.storyViewerBackground/);
  assert.match(source, /palette\.storyProgressTrack/);
  assert.match(source, /palette\.storyMetaText/);
  assert.match(source, /palette\.storyControlBorder/);
  assert.doesNotMatch(source, /#[0-9A-Fa-f]{3,8}|rgba?\(/);
});

test("Story viewer contract: unseen and replayed stories play through a stable in-viewer queue", () => {
  const source = read("src/app/screens/home/StoryViewerScreen.tsx");

  assert.match(source, /playbackStoryIdsRef/);
  assert.match(source, /orderedStoriesFrom/);
  assert.match(source, /story\.hasUnseen && !story\.isOwn/);
  assert.match(source, /orderedFromSelection\.map\(\(story\) => story\.id\)/);
  assert.match(source, /playbackIndex < playbackStoryIdsRef\.current\.length - 1/);
  assert.match(source, /navigation\.goBack\(\)/);
});

test("Story viewer contract: cross-user transition is a visible rotating block", () => {
  const source = read("src/app/screens/home/StoryViewerScreen.tsx");

  assert.match(source, /const STORY_ROTATE_ANGLE = 105/);
  assert.match(source, /const StoryMedia = React\.memo/);
  assert.match(source, /isStoryTransitioningRef/);
  assert.match(source, /if \(isStoryTransitioningRef\.current\)/);
  assert.match(source, /isStoryTransitioningRef\.current = true/);
  assert.match(source, /setIsStoryTransitioning\(true\)/);
  assert.match(source, /cancelAnimation\(progressAnim\)/);
  assert.match(source, /isStoryTransitioningRef\.current = false/);
  assert.match(source, /setIsStoryTransitioning\(false\)/);
  assert.match(source, /if \(!currentStory \|\| isStoryTransitioningRef\.current\) return/);
  assert.match(source, /const commitSeenIfReady = useCallback/);
  const handleNextStart = source.indexOf("const handleNext = useCallback");
  const handleNextEnd = source.indexOf(
    "useEffect(() => {\n    handleNextRef.current",
    handleNextStart,
  );
  const handleNextSource = source.slice(handleNextStart, handleNextEnd);
  assert.match(handleNextSource, /commitSeenIfReady\(storyAuthorKey\(currentStory\)\)/);
  assert.doesNotMatch(handleNextSource, /markSeenForDisplayName/);
  assert.match(
    source,
    /<StoryMedia[\s\S]*uri=\{currentStory\.content\.url\}[\s\S]*rotateY=\{rotateY\}[\s\S]*onReady=\{handleCurrentMediaReady\}/,
  );
  assert.match(source, /duration: 320/);
  assert.match(source, /\{ perspective: 520 \}/);
  assert.match(source, /scale: rotateY\.interpolate/);
  assert.match(source, /outputRange: \[0\.9, 1, 0\.9\]/);
});

test("Home feed contract: story carousel opens existing own story and separates create", () => {
  const source = read("src/app/screens/home/HomeFeedScreen.tsx");
  const carouselSource = read("src/components/social/CircleStoryCarousel.tsx");
  const addStorySource = read("src/app/screens/home/AddStoryScreen.tsx");

  assert.match(source, /useStoryStore/);
  assert.match(source, /loadStories/);
  assert.match(source, /const storiesEnabled = FEATURE_FLAGS\.storiesEnabled/);
  assert.match(source, /storyCarouselItems/);
  assert.match(source, /if \(!storiesEnabled\) \{\s*return \[\];\s*\}/);
  assert.match(source, /const styles = useMemo\(\(\) => createStyles\(theme\), \[theme\]\)/);
  assert.match(source, /const listHeader = useMemo\(\(\) => renderHeader\(\), \[renderHeader\]\)/);
  assert.match(source, /ListHeaderComponent=\{listHeader\}/);
  assert.match(source, /const ownStory = stories\.find\(\(candidate\) => candidate\.isOwn\)/);
  assert.match(source, /navigation\.navigate\("StoryViewer", \{ initialStoryId: story\.id \}\)/);
  assert.match(source, /navigation\.navigate\("StoryViewer", \{ initialStoryId: ownStory\.id \}\)/);
  assert.match(source, /navigation\.navigate\("AddStory"\)/);
  assert.match(source, /storiesEnabled \? \([\s\S]*<CircleStoryCarousel/);
  assert.match(source, /onAddStoryPress=\{handleAddStoryPress\}/);
  assert.match(carouselSource, /onAddStoryPress/);
  assert.match(carouselSource, /openingUnseenStoryId/);
  assert.match(carouselSource, /openingUnseenStoryDisplayName/);
  assert.match(carouselSource, /onStoryPressIn/);
  assert.match(carouselSource, /const shouldShowUnseenRing/);
  assert.match(carouselSource, /accessibilityLabel="Stories"/);
  assert.match(carouselSource, /accessible/);
  assert.match(carouselSource, /accessibilityRole="button"/);
  assert.match(carouselSource, /Opens this unseen story/);
  assert.match(carouselSource, /Replays this story/);
  assert.match(
    carouselSource,
    /accessibilityState=\{\{ selected: Boolean\(shouldShowUnseenRing\) \}\}/,
  );
  assert.match(
    carouselSource,
    /story\.isOwn \? onAddStoryPress\?\.\(\) : onStoryPress\?\.\(story\)/,
  );
  assert.match(carouselSource, /pointerEvents="none"/);
  assert.match(carouselSource, /importantForAccessibility="no"/);
  assert.match(carouselSource, /story\.hasUnseen \|\|[\s\S]*story\.id === openingUnseenStoryId/);
  assert.match(carouselSource, /onPressIn=\{\(\) => onStoryPressIn\?\.\(story\)\}/);
  assert.match(carouselSource, /export const CircleStoryCarousel = memo/);
  assert.doesNotMatch(carouselSource, /event\.stopPropagation\(\)/);
  assert.match(addStorySource, /getHungryService\(\)\s*\.social\.listStoryGalleryAssets\(\)/);
  assert.doesNotMatch(addStorySource, /@\/lib\/services\/mock\/storyGalleryFixtures/);
  assert.doesNotMatch(addStorySource, /mockGalleryAssets/);
  assert.doesNotMatch(addStorySource, /const GALLERY_ASSETS/);
  assert.match(addStorySource, /type GalleryFilter = "all" \| StoryContent\["type"\]/);
  assert.match(addStorySource, /asset\.type === "video"/);
  assert.match(
    addStorySource,
    /await addStory\(\{ type: selectedAsset\.type, url: selectedAsset\.url \}\)/,
  );
  assert.doesNotMatch(addStorySource, /handleUploadMock/);
  assert.doesNotMatch(addStorySource, /Select Photo/);
});

test("Story demo contract: viewed memory state expires after 24 hours and never fakes live publication", () => {
  const storeSource = read("src/store/useStoryStore.ts");
  const mockServiceSource = read("src/lib/services/mock/mockService.ts");
  const carouselSource = read("src/components/social/CircleStoryCarousel.tsx");

  assert.match(storeSource, /seenStoryIds: Record<string, string>/);
  assert.doesNotMatch(storeSource, /persist\(/);
  assert.match(storeSource, /getServiceProvider\(\)\.mode !== "mock"/);
  assert.match(storeSource, /clearAccountScopedState/);
  const liveService = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(liveService, /Stories are local demos only/);
  assert.doesNotMatch(liveService, /supabaseStoryCache|buildStorySeed/);
  assert.match(storeSource, /const STORY_TTL_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(storeSource, /pruneExpiredStories\(stories\)/);
  assert.match(storeSource, /function pruneExpiredSeenStoryIds/);
  assert.match(storeSource, /Date\.now\(\) - seenTime < STORY_TTL_MS/);
  assert.match(
    storeSource,
    /freshSeenStoryIds\[story\.id\] \? \{ \.\.\.story, hasUnseen: false \} : story/,
  );
  assert.match(storeSource, /nextSeenStoryIds\[story\.id\] = seenAt/);
  assert.match(mockServiceSource, /const STORY_TTL_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(mockServiceSource, /pruneMockStories\(\)/);
  assert.match(carouselSource, /borderColor: palette\.textMuted/);
});
