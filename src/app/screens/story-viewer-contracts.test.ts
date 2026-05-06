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
  assert.match(source, /gestureState\.dy > SWIPE_THRESHOLD[\s\S]*closeWithFade\(\)/);
  assert.match(source, /accessibilityLabel="Previous story"/);
  assert.match(source, /accessibilityLabel="Next story"/);
  assert.doesNotMatch(source, /onResponderRelease/);
});

test("Story viewer contract: progress pauses without resetting the current story", () => {
  const source = read("src/app/screens/home/StoryViewerScreen.tsx");

  assert.match(source, /progressValueRef/);
  assert.match(source, /remainingDuration = Math\.max\(0, \(1 - progressValueRef\.current\)/);
  assert.match(source, /progressAnim\.stopAnimation\(\)/);
  assert.doesNotMatch(source, /isPaused[\s\S]{0,180}progressAnim\.setValue\(0\)/);
});

test("Story viewer contract: cross-user transitions and footer actions are standardized", () => {
  const source = read("src/app/screens/home/StoryViewerScreen.tsx");

  assert.match(source, /runRotateTransition/);
  assert.doesNotMatch(source, /Viewing \{/);
  assert.doesNotMatch(source, /userTransitionBadge/);
  assert.match(source, /loadStories/);
  assert.match(source, /ActivityIndicator/);
  assert.match(source, /const handleStoryMessage = \(\) => \{/);
  assert.match(source, /navigation\.navigate\("ChatDetail", \{/);
  assert.match(source, /navigation\.navigate\("AddStory"\)/);
  assert.match(
    source,
    /accessibilityLabel=\{\s*currentStory\.isOwn \? "Add another story" : `Message \$\{currentStory\.displayName\}`\s*\}/,
  );
  assert.match(source, /accessibilityLabel="Like story"/);
  assert.match(source, /accessibilityLabel="Save story"/);
  assert.doesNotMatch(source, /Share feature coming soon/);
  assert.doesNotMatch(source, /accessibilityLabel="Share story"/);
  assert.match(source, /styles\.actionButtonStack/);
  assert.match(source, /styles\.actionCountText/);
  assert.doesNotMatch(source, /actionIcon/);
});

test("Story viewer contract: swipe-out fades before closing", () => {
  const source = read("src/app/screens/home/StoryViewerScreen.tsx");

  assert.match(source, /const closeOpacity = useRef\(new Animated\.Value\(1\)\)\.current/);
  assert.match(source, /const closeWithFade = useCallback/);
  assert.match(source, /Animated\.timing\(closeOpacity,\s*\{[\s\S]*toValue: 0[\s\S]*duration: 180/);
  assert.match(
    source,
    /<Animated\.View style=\{\[styles\.container, \{ backgroundColor: "#000", opacity: closeOpacity \}\]\}/,
  );
  assert.match(source, /onPress=\{closeWithFade\}/);
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
  assert.match(source, /<StoryMedia uri=\{currentStory\.content\.url\} rotateY=\{rotateY\} \/>/);
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
  assert.match(source, /storyCarouselItems/);
  assert.match(source, /const styles = useMemo\(\(\) => createStyles\(theme\), \[theme\]\)/);
  assert.match(source, /const listHeader = useMemo\(\(\) => renderHeader\(\), \[renderHeader\]\)/);
  assert.match(source, /ListHeaderComponent=\{listHeader\}/);
  assert.match(source, /const ownStory = stories\.find\(\(candidate\) => candidate\.isOwn\)/);
  assert.match(source, /navigation\.navigate\("StoryViewer", \{ initialStoryId: story\.id \}\)/);
  assert.match(source, /navigation\.navigate\("StoryViewer", \{ initialStoryId: ownStory\.id \}\)/);
  assert.match(source, /navigation\.navigate\("AddStory"\)/);
  assert.match(source, /onAddStoryPress=\{handleAddStoryPress\}/);
  assert.match(carouselSource, /onAddStoryPress/);
  assert.match(carouselSource, /export const CircleStoryCarousel = memo/);
  assert.match(carouselSource, /event\.stopPropagation\(\)/);
  assert.match(addStorySource, /const GALLERY_ASSETS: GalleryAsset\[\]/);
  assert.match(addStorySource, /type GalleryFilter = "all" \| StoryContent\["type"\]/);
  assert.match(addStorySource, /asset\.type === "video"/);
  assert.match(
    addStorySource,
    /await addStory\(\{ type: selectedAsset\.type, url: selectedAsset\.url \}\)/,
  );
  assert.doesNotMatch(addStorySource, /handleUploadMock/);
  assert.doesNotMatch(addStorySource, /Select Photo/);
});

test("Story persistence contract: viewed stories persist and expire after 24 hours", () => {
  const storeSource = read("src/store/useStoryStore.ts");
  const mockServiceSource = read("src/lib/services/mock/mockService.ts");
  const carouselSource = read("src/components/social/CircleStoryCarousel.tsx");

  assert.match(storeSource, /seenStoryIds: Record<string, string>/);
  assert.match(storeSource, /const STORY_TTL_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(storeSource, /pruneExpiredStories\(stories\)/);
  assert.match(
    storeSource,
    /seenStoryIds\[story\.id\] \? \{ \.\.\.story, hasUnseen: false \} : story/,
  );
  assert.match(storeSource, /nextSeenStoryIds\[story\.id\] = seenAt/);
  assert.match(mockServiceSource, /const STORY_TTL_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(mockServiceSource, /pruneMockStories\(\)/);
  assert.match(carouselSource, /borderColor: palette\.textMuted/);
});
