import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";
import { colors } from "@/theme/tokens";
import { BANNER_VARIANTS, getBannerToneStyles, isAlertBannerVariant } from "./bannerTones";

const banner = readRepoFile("src/components/ui/Banner.tsx");
const inlineBanner = readRepoFile("src/components/ui/InlineBanner.tsx");
const toast = readRepoFile("src/components/ui/FloatingToast.tsx");
const uiIndex = readRepoFile("src/components/ui/index.ts");

test("banner variants map to semantic tone tokens", () => {
  assert.deepEqual([...BANNER_VARIANTS], ["info", "success", "warning", "error", "offline"]);
  for (const mode of ["light", "dark"] as const) {
    const palette = colors[mode];
    assert.deepEqual(getBannerToneStyles(palette, "info"), {
      bg: palette.infoSoft,
      accent: palette.infoText,
      message: palette.text,
    });
    assert.deepEqual(getBannerToneStyles(palette, "success"), {
      bg: palette.successSoft,
      accent: palette.successText,
      message: palette.text,
    });
    assert.deepEqual(getBannerToneStyles(palette, "warning"), {
      bg: palette.warningSoft,
      accent: palette.warningText,
      message: palette.text,
    });
    assert.deepEqual(getBannerToneStyles(palette, "error"), {
      bg: palette.errorSoft,
      accent: palette.errorText,
      message: palette.text,
    });
    assert.deepEqual(getBannerToneStyles(palette, "offline"), {
      bg: palette.navy,
      accent: palette.textOnDark,
      message: palette.textOnDark,
    });
  }
});

test("warning, error and offline banners announce as polite alerts", () => {
  assert.equal(isAlertBannerVariant("warning"), true);
  assert.equal(isAlertBannerVariant("error"), true);
  assert.equal(isAlertBannerVariant("offline"), true);
  assert.equal(isAlertBannerVariant("info"), false);
  assert.equal(isAlertBannerVariant("success"), false);
  assert.match(banner, /accessibilityRole=\{isAlert \? "alert" : undefined\}/);
  assert.match(banner, /accessibilityLiveRegion=\{isAlert \? "polite" : undefined\}/);
});

test("banner action and dismiss controls are 44pt buttons", () => {
  assert.match(banner, /accessibilityLabel=\{action\.accessibilityLabel \?\? action\.label\}/);
  assert.match(banner, /accessibilityLabel=\{dismissLabel\}/);
  assert.equal((banner.match(/accessibilityRole="button"/g) ?? []).length, 2);
  assert.match(
    banner,
    /minHeight: componentSizes\.touchTarget,\s*minWidth: componentSizes\.touchTarget/,
  );
  assert.match(
    banner,
    /height: componentSizes\.touchTarget,[\s\S]*width: componentSizes\.touchTarget/,
  );
});

test("banner layout uses theme tokens: icon left, typography, radius, padding", () => {
  assert.match(banner, /<Icon color=\{tone\.accent\} size=\{BANNER_ICON_SIZE\} \/>/);
  assert.match(banner, /variant="bodySmallBold" style=\{\{ color: tone\.accent \}\}/);
  assert.match(banner, /variant="bodySmall" style=\{\{ color: tone\.message \}\}/);
  assert.match(banner, /borderRadius: componentRadii\.card/);
  assert.match(banner, /borderCurve: componentCornerCurve\.borderCurve/);
  assert.doesNotMatch(banner, /#[0-9a-fA-F]{3,8}\b/, "no raw hex colours");
  assert.doesNotMatch(banner, /position:\s*"absolute"/);
});

test("strip placement owns the top inset and stays in layout flow", () => {
  assert.match(banner, /placement\?: "inline" \| "strip"/);
  assert.match(banner, /paddingTop: topInset \+/);
});

test("InlineBanner is a thin alias and toasts share banner tokens", () => {
  assert.match(inlineBanner, /return <Banner message=\{message\} variant=\{tone\} \/>/);
  assert.doesNotMatch(inlineBanner, /backgroundColor|palette\./);
  assert.match(toast, /getBannerToneStyles\(palette, tone\)\.accent/);
  assert.match(toast, /BANNER_ICONS\[tone\]/);
  assert.doesNotMatch(toast, /lucide-react-native/);
  assert.match(uiIndex, /export \* from "\.\/Banner";/);
});

const MIGRATED = [
  "src/app/navigation/RootNavigator.tsx",
  "src/app/screens/search/SearchResultsScreen.tsx",
  "src/app/screens/catalog/CatalogRawDetailScreen.tsx",
  "src/app/screens/wheel/WheelHomeScreen.tsx",
  "src/app/screens/merchant/VerificationCentreScreen.tsx",
  "src/app/screens/merchant/OCRDraftScreen.tsx",
  "src/components/map/MapSurface.tsx",
] as const;

test("migrated surfaces render the shared Banner with no bespoke banner styles left", () => {
  for (const file of MIGRATED) {
    const source = readRepoFile(file);
    assert.match(source, /<Banner\b/, `${file} should render <Banner>`);
    assert.doesNotMatch(source, /palette\.(info|success|warning|error)Soft/, `${file} soft fill`);
    assert.doesNotMatch(source, /`\$\{palette\.error\}10`/, `${file} ad-hoc error tint`);
    assert.doesNotMatch(source, /offlineBanner:|tokenNotice:[^}]*borderWidth/, file);
    assert.doesNotMatch(source, /Couldn't load more[^"]*"\}\s*<\/AppText>/, file);
  }
});
