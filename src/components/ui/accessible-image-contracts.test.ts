import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function collectSourceFiles(relativePath: string): string[] {
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
      files.push(currentPath);
    }
  }

  collect(base);
  return files;
}

test("AccessibleImage requires every image to be meaningful or decorative", () => {
  const source = read("src/components/ui/AccessibleImage.tsx");

  assert.match(source, /type MeaningfulImageProps/);
  assert.match(source, /accessibilityLabel: string/);
  assert.match(source, /type DecorativeImageProps/);
  assert.match(source, /decorative: true/);
  assert.match(source, /importantForAccessibility="no"/);
  assert.match(source, /accessibilityRole="image"/);
});

test("app and component images go through AccessibleImage instead of raw expo-image", () => {
  const offenders = collectSourceFiles("src")
    .filter((filePath) => !filePath.endsWith("src/components/ui/AccessibleImage.tsx"))
    .filter((filePath) => !filePath.endsWith("src/features/navigation/prefetch.ts"))
    .filter((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return /from ["']expo-image["']/.test(source);
    })
    .map((filePath) => path.relative(root, filePath));

  assert.deepEqual(offenders, []);
});

test("production surfaces do not import raw React Native Image", () => {
  const offenders = collectSourceFiles("src")
    .filter((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return /import\s*\{[\s\S]*?\bImage\b[\s\S]*?\}\s*from ["']react-native["']/.test(source);
    })
    .map((filePath) => path.relative(root, filePath));

  assert.deepEqual(offenders, []);
});

test("animated brand imagery keeps explicit image semantics", () => {
  const splash = read("src/app/screens/SplashScreen.tsx");

  assert.match(splash, /<Animated\.Image/);
  assert.match(splash, /accessibilityLabel="Hungry logo"/);
  assert.match(splash, /accessibilityRole="image"/);
});

test("zoomable social media exposes actionable media and video controls to assistive tech", () => {
  const zoomableMedia = read("src/components/social/ZoomableMedia.tsx");
  const zoomableVideo = read("src/components/social/ZoomableVideo.tsx");
  const home = read("src/components/social/FeedPostCard.tsx");
  const activityDetail = read("src/app/screens/home/ActivityPostDetailScreen.tsx");
  const socialDetail = read("src/app/screens/profile/SocialPostDetailScreen.tsx");

  assert.match(zoomableMedia, /accessibilityLabel\?: string/);
  assert.match(zoomableMedia, /accessibilityHint\?: string/);
  assert.match(zoomableMedia, /accessibilityRole=\{onPress \? "button" : undefined\}/);
  assert.match(
    zoomableMedia,
    /accessibilityLabel=\{onPress \? `Open \$\{resolvedAccessibilityLabel\}`/,
  );
  assert.match(zoomableMedia, /decorative/);
  assert.match(zoomableMedia, /accessibilityLabel=\{resolvedAccessibilityLabel\}/);

  assert.match(zoomableVideo, /accessibilityRole="button"/);
  assert.match(zoomableVideo, /accessibilityLabel=\{accessibilityLabel \?\? "Post video"\}/);
  assert.match(zoomableVideo, /onAccessibilityTap=\{handleTogglePlay\}/);
  assert.match(zoomableVideo, /player\.addListener\("playToEnd"/);
  assert.match(zoomableVideo, /player\.currentTime = 0/);
  assert.match(zoomableVideo, /accessibilityLabel=\{isMuted \? "Unmute video" : "Mute video"\}/);
  assert.match(zoomableVideo, /accessibilityState=\{\{ selected: !isMuted \}\}/);

  assert.match(home, /accessibilityLabel=\{`\$\{actionTargetName\} post image/);
  assert.match(home, /accessibilityHint=\{mediaHint\}/);
  // The detail screen renders the shared FeedPostCard, which labels the media.
  assert.match(activityDetail, /<FeedPostCard/);
  assert.match(
    socialDetail,
    /accessibilityHint="Opens the linked customer detail page for this post"/,
  );
});
