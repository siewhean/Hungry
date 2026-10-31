// Renders the shared components that have logic or states of their own, and presses what a
// person can press. Run with `npm run test:render`.

import assert from "node:assert/strict";
import { act, createElement } from "react";
import { Text, View } from "react-native";
import { makeMutable } from "react-native-reanimated";
import test, { afterEach, beforeEach } from "node:test";

import { cleanup, render } from "@/test/render";
import { DiscoverModeTabs } from "@/components/discover/DiscoverModeTabs";
import { ForYouCard } from "@/components/discover/ForYouCard";
import { MenuLessStallGroup } from "@/components/discover/MenuLessStallGroup";
import { TrendingList } from "@/components/discover/TrendingList";
import { WhatsHerePanel } from "@/components/discover/WhatsHerePanel";
import { DetailActionBar } from "@/components/detail/DetailActionBar";
import { FloatingBackButton } from "@/components/detail/FloatingBackButton";
import { DetailHeroFade } from "@/components/detail/DetailHeroFade";
import {
  TASTE_RATING_LEVELS,
  TasteRatingInput,
  nearestTasteRatingLevel,
} from "@/components/review/TasteRatingInput";
import { DeliveryBrandLogo, hasDeliveryBrandLogo } from "@/components/dish/DeliveryBrandLogo";
import { HeritageStampTile } from "@/components/gamification/HeritageStampTile";
import {
  CollectionAlbumCard,
  NewCollectionTile,
  collectionCountLabel,
} from "@/components/portfolio/CollectionAlbumCard";
import { CaptionPreview, captionNeedsMore } from "@/components/review/CaptionPreview";
import { MenuFilterDropdown, menuFilterSummary } from "@/components/stall/MenuFilterDropdown";
import { TasteRadarChart } from "@/components/taste/TasteRadarChart";
import { AnimatedSwitch } from "@/components/ui/AnimatedSwitch";
import { AchievementsSection } from "@/components/gamification/AchievementsSection";
import { MissionCard } from "@/components/gamification/MissionCard";
import { PassportBook } from "@/components/gamification/PassportBook";
import { PassportCard } from "@/components/gamification/PassportCard";
import { ReportListSheet } from "@/components/portfolio/ReportListSheet";
import { OwnContentEditDialog } from "@/components/social/OwnContentEditDialog";
import { InAppShareCard, ShareQuickActionGroup } from "@/components/social/ShareSettings";
import { FeedStateView } from "@/components/ui/FeedStateView";
import { FloatingToast } from "@/components/ui/FloatingToast";
import { AppBottomTabItem } from "@/components/ui/AppBottomTabItem";
import { StallLogoMark } from "@/components/stall/StallLogoMark";
import { BookOpenText, PenLine } from "lucide-react-native";
import { HungryLogo } from "@/components/ui/HungryLogo";
import { InlineBanner } from "@/components/ui/InlineBanner";
import { MemberAvatarRow } from "@/components/wheel/MemberAvatarRow";
import { TabSwitcher } from "@/features/post/components/TabSwitcher";
import { useComposerStore } from "@/features/post/useComposerStore";
import {
  ALL_PASSPORT_CATEGORIES,
  computePassportProgress,
  getEarnedPassportStamps,
  getNextPassportStamp,
  PASSPORT_BADGE_DEFINITIONS,
} from "@/constants/passportConfig";
import { computeAchievements } from "@/features/achievements/achievements";
import type { HereStall } from "@/features/discover/mallMode";
import type { Bite } from "@/lib/services/types";
import { usePassportStore } from "@/store/usePassportStore";
import { useUIStore } from "@/store/useUIStore";
import type { DishDetail, VenueSummary, WheelMember } from "@/types/domain";

afterEach(cleanup);

test("InlineBanner shows its message for every tone", async () => {
  for (const tone of ["info", "warning", "error", "success"] as const) {
    const view = await render(createElement(InlineBanner, { message: `Heads up (${tone})`, tone }));
    assert.match(view.text(), new RegExp(`Heads up \\(${tone}\\)`));
    await view.unmount();
  }
});

test("HungryLogo is one labelled image and the wordmark is optional", async () => {
  const withWordmark = await render(createElement(HungryLogo, {}));
  assert.ok(withWordmark.findByLabel("Hungry logo"));
  const imagesWith = withWordmark.container.querySelectorAll(
    "img, [data-stub], [role='img']",
  ).length;
  await withWordmark.unmount();

  const iconOnly = await render(createElement(HungryLogo, { showWordmark: false }));
  assert.ok(iconOnly.findByLabel("Hungry logo"));
  const imagesWithout = iconOnly.container.querySelectorAll(
    "img, [data-stub], [role='img']",
  ).length;
  assert.ok(imagesWithout <= imagesWith);
});

test("FeedStateView shows loading text, then the error and empty copy with their defaults", async () => {
  const loading = await render(createElement(FeedStateView, { state: "loading" }));
  assert.match(loading.text(), /Loading feed/);
  await loading.rerender(
    createElement(FeedStateView, { state: "loading", loadingMessage: "Fetching dishes" }),
  );
  assert.match(loading.text(), /Fetching dishes/);

  await loading.rerender(createElement(FeedStateView, { state: "error" }));
  assert.match(loading.text(), /Unable to load feed/);
  assert.match(loading.text(), /Please try again/);

  await loading.rerender(createElement(FeedStateView, { state: "empty" }));
  assert.match(loading.text(), /Nothing to show/);

  await loading.rerender(
    createElement(FeedStateView, {
      state: "empty",
      title: "No dishes yet",
      body: "Add the first one",
    }),
  );
  assert.match(loading.text(), /No dishes yet/);
  assert.match(loading.text(), /Add the first one/);
});

test("FeedStateView calls onPress from its call to action", async () => {
  let pressed = 0;
  const view = await render(
    createElement(FeedStateView, {
      state: "error",
      ctaLabel: "Try again",
      onPress: () => (pressed += 1),
    }),
  );
  await view.press(view.findByText("Try again"));
  assert.equal(pressed, 1);
});

test("FloatingToast renders the current toast and nothing without one", async () => {
  useUIStore.setState({ toast: null });
  const view = await render(createElement(FloatingToast, {}));
  assert.equal(view.text().trim(), "");
  useUIStore
    .getState()
    .showToast({ message: "Saved to your list", tone: "success", duration: 60_000 });
  await view.settle();
  assert.match(view.text(), /Saved to your list/);
  useUIStore.getState().clearToast();
  await view.settle();
  assert.doesNotMatch(view.text(), /Saved to your list/);
});

test("FloatingToast with an action shows a button that runs it and dismisses the toast", async () => {
  const view = await render(createElement(FloatingToast, {}));
  let undone = 0;
  useUIStore.getState().showToast({
    message: "Removed from Saved.",
    tone: "success",
    duration: 60_000,
    action: { label: "Undo", onPress: () => (undone += 1) },
  });
  await view.settle();
  assert.match(view.text(), /Removed from Saved\./);
  const undo = view.findByLabel("Undo");
  assert.ok(undo);
  // The message is not itself a button, so the action is never a button inside a button.
  assert.equal(undo?.parentElement?.closest("button"), null);
  await view.press(undo);
  assert.equal(undone, 1);
  assert.equal(useUIStore.getState().toast, null);
});

test("FloatingToast is a compact borderless pill, not a full-width bar with an orange border", async () => {
  const view = await render(createElement(FloatingToast, {}));
  useUIStore.getState().showToast({ message: "Copied", tone: "success", duration: 60_000 });
  await view.settle();
  const alert = view.container.querySelector('[role="alert"]') as HTMLElement | null;
  assert.ok(alert, "the toast is an alert");
  const style = alert.style;
  assert.ok(
    !style.borderWidth || style.borderWidth === "0px",
    `no border (got ${style.borderWidth})`,
  );
  assert.equal(style.alignSelf, "center", "sized to its text, centred");
  assert.equal(style.borderTopLeftRadius, "999px", "a pill");
  useUIStore.getState().clearToast();
});

test("FloatingToast clears itself after its duration", async () => {
  const view = await render(createElement(FloatingToast, {}));
  useUIStore.getState().showToast({ message: "Gone soon", tone: "info", duration: 20 });
  await view.settle();
  await new Promise((resolve) => setTimeout(resolve, 60));
  await view.settle();
  assert.equal(useUIStore.getState().toast, null);
});

function member(id: string, displayName: string, extra: Partial<WheelMember> = {}): WheelMember {
  return { id, displayName, isPresent: true, isHost: false, ...extra } as WheelMember;
}

test("MemberAvatarRow shows initials of present members once each, host included, and counts the overflow", async () => {
  const members = [
    member("a", "Alice", { isHost: true }),
    member("b", "Ben"),
    member("b", "Ben duplicate"),
    member("c", "Cara", { isPresent: false }),
  ];
  const view = await render(createElement(MemberAvatarRow, { members }));
  assert.match(view.text(), /AL/);
  assert.match(view.text(), /BE/);
  assert.doesNotMatch(view.text(), /CA/, "absent members are hidden");

  const many = Array.from({ length: 11 }, (_, index) => member(`m${index}`, `Name${index}`));
  await view.rerender(createElement(MemberAvatarRow, { members: many, maxVisible: 4 }));
  assert.match(view.text(), /\+7/);
});

test("MissionCard shows progress, then a completed state", async () => {
  const mission = {
    id: "m1",
    title: "Try 3 new stalls",
    description: "Visit three stalls you have not tried",
    missionType: "try_stalls",
    requirementCount: 3,
    rewardType: "food_cred",
    rewardValue: 30,
    weekStart: "2026-10-19",
    weekEnd: "2026-10-25",
    isActive: true,
  } as never;
  const view = await render(
    createElement(MissionCard, {
      mission,
      progress: { userId: "u", missionId: "m1", currentCount: 1 },
    }),
  );
  assert.match(view.text(), /Try 3 new stalls/);
  assert.match(view.text(), /1\s*\/\s*3/);

  await view.rerender(
    createElement(MissionCard, {
      mission,
      progress: {
        userId: "u",
        missionId: "m1",
        currentCount: 3,
        completedAt: "2026-10-20T00:00:00Z",
      },
    }),
  );
  assert.match(view.text(), /Try 3 new stalls/);
  assert.doesNotMatch(view.text(), /1\s*\/\s*3/);
});

test("PassportCard invites a first stamp when empty and lists categories once stalls are tried", async () => {
  usePassportStore.setState({ progressMap: {} });
  let opened = 0;
  const view = await render(createElement(PassportCard, { onPress: () => (opened += 1) }));
  assert.match(view.text(), /Start exploring to earn your first stamp/);
  await view.press(view.findByLabel("View Hungry Passport"));
  assert.equal(opened, 1);

  const hawker = ALL_PASSPORT_CATEGORIES.find((category) => category.id === "cuisine-hawker")!;
  usePassportStore.setState({ progressMap: { [hawker.id]: computePassportProgress(hawker, 3) } });
  await view.settle();
  assert.match(view.text(), /Hawker Food Explorer/);
  assert.match(view.text(), /3\/5/);
  usePassportStore.setState({ progressMap: {} });
});

test("PassportBook renders the cover, the earned stamps and the next target", async () => {
  const hawker = ALL_PASSPORT_CATEGORIES.find((category) => category.id === "cuisine-hawker")!;
  const progressMap = { [hawker.id]: computePassportProgress(hawker, 3) };
  const earnedStamps = getEarnedPassportStamps(progressMap);
  assert.equal(earnedStamps.length, 2);
  const view = await render(
    createElement(PassportBook, {
      earnedStamps,
      badges: PASSPORT_BADGE_DEFINITIONS,
      nextStamp: getNextPassportStamp(progressMap),
    }),
  );
  assert.match(view.text(), /Food Discovery Passport/);
  assert.match(view.text(), /REPUBLIC OF HUNGRY/);

  await view.rerender(
    createElement(PassportBook, {
      earnedStamps: [],
      badges: PASSPORT_BADGE_DEFINITIONS,
      nextStamp: null,
    }),
  );
  assert.match(view.text(), /Food Discovery Passport/);
});

test("ReportListSheet submits the chosen reason and trimmed details, and resets when reopened", async () => {
  const submitted: [string, string | undefined][] = [];
  let closed = 0;
  const props = {
    visible: true,
    onSubmit: (reason: string, details?: string) => submitted.push([reason, details]),
    onClose: () => (closed += 1),
  };
  const view = await render(createElement(ReportListSheet, props as never));
  assert.match(view.text(), /Report this list/);

  await view.press(view.findByText("Send report"));
  assert.deepEqual(submitted, [["inappropriate", undefined]]);

  await view.type(
    view.container.ownerDocument.querySelector("textarea, input"),
    "  looks like spam  ",
  );
  await view.press(view.findByText("Send report"));
  assert.equal(submitted[1][1], "looks like spam");

  await view.press(view.findByText("Cancel"));
  assert.equal(closed, 1);

  // Reopening starts from a clean form.
  await view.rerender(createElement(ReportListSheet, { ...props, visible: false } as never));
  await view.rerender(createElement(ReportListSheet, props as never));
  assert.equal((document.querySelector("textarea, input") as HTMLTextAreaElement).value, "");
});

test("ReportListSheet blocks both buttons while a report is sending", async () => {
  let submitted = 0;
  const view = await render(
    createElement(ReportListSheet, {
      visible: true,
      isSending: true,
      onSubmit: () => (submitted += 1),
      onClose: () => undefined,
    } as never),
  );
  // The send button swaps its label for a spinner, so press every button on the sheet.
  for (const button of Array.from(document.querySelectorAll<HTMLElement>("[role='button']"))) {
    if (button.getAttribute("aria-label") !== "Close") await view.press(button);
  }
  assert.equal(submitted, 0);
});

test("OwnContentEditDialog saves edited text and keeps the draft when saving fails", async () => {
  const saved: unknown[] = [];
  let failNext = true;
  const view = await render(
    createElement(OwnContentEditDialog, {
      visible: true,
      title: "Edit caption",
      textLabel: "Caption",
      maxLength: 100,
      initialText: "Laksa lunch",
      onCancel: () => undefined,
      onSave: async (values: unknown) => {
        if (failNext) {
          failNext = false;
          throw new Error("offline");
        }
        saved.push(values);
      },
    } as never),
  );
  assert.match(view.text(), /Edit caption/);
  assert.match(view.text(), /11\/100/);

  const field = document.querySelector("textarea, input") as HTMLTextAreaElement;
  await view.type(field, "Laksa lunch, again");
  await view.press(view.findByText("Save"));
  assert.deepEqual(saved, [], "first save fails");
  assert.equal(
    (document.querySelector("textarea, input") as HTMLTextAreaElement).value,
    "Laksa lunch, again",
  );

  await view.press(view.findByText("Save"));
  assert.deepEqual(saved, [{ text: "Laksa lunch, again" }]);
});

test("OwnContentEditDialog cannot save an empty caption, and a review needs a rating", async () => {
  let saves = 0;
  const base = {
    visible: true,
    title: "Edit",
    textLabel: "Text",
    maxLength: 100,
    onCancel: () => undefined,
    onSave: async () => {
      saves += 1;
    },
  };
  const caption = await render(
    createElement(OwnContentEditDialog, { ...base, initialText: "" } as never),
  );
  await caption.press(caption.findByText("Save"));
  assert.equal(saves, 0);
  await caption.unmount();

  const review = await render(
    createElement(OwnContentEditDialog, { ...base, initialText: "", initialRating: 0 } as never),
  );
  await review.press(review.findByText("Save"));
  assert.equal(saves, 0, "no rating, no save");
});

test("OwnContentEditDialog renders nothing while closed and Cancel calls onCancel", async () => {
  let cancelled = 0;
  const props = {
    title: "Edit",
    textLabel: "Text",
    maxLength: 10,
    initialText: "x",
    onCancel: () => (cancelled += 1),
    onSave: async () => undefined,
  };
  const view = await render(
    createElement(OwnContentEditDialog, { ...props, visible: false } as never),
  );
  assert.equal(view.text().trim(), "");
  await view.rerender(createElement(OwnContentEditDialog, { ...props, visible: true } as never));
  await view.press(view.findByText("Cancel"));
  assert.equal(cancelled, 1);
});

test("ShareQuickActionGroup renders each action and presses the right one", async () => {
  const pressed: string[] = [];
  const view = await render(
    createElement(ShareQuickActionGroup, {
      actions: ["copy", "whatsapp"].map((key) => ({
        key,
        label: `Label ${key}`,
        accessibilityLabel: `Share via ${key}`,
        icon: () => null,
        onPress: () => pressed.push(key),
      })),
    }),
  );
  assert.match(view.text(), /Label copy/);
  await view.press(view.findByLabel("Share via whatsapp"));
  assert.deepEqual(pressed, ["whatsapp"]);
});

test("InAppShareCard lists recipients and reports which one was toggled", async () => {
  const toggled: string[] = [];
  const view = await render(
    createElement(InAppShareCard, {
      title: "Share Laksa",
      subtitle: "Send to a friend",
      recipients: [
        { id: "r1", avatar: "", name: "Ahmad", lastMessage: "see you" },
        { id: "r2", avatar: "", name: "Mei" },
      ],
      selectedRecipientIds: ["r2"],
      onToggleRecipient: (id: string) => toggled.push(id),
      onSend: () => undefined,
      recipientAccessibilityLabelPrefix: "Send to",
    } as never),
  );
  assert.match(view.text(), /Share Laksa/);
  assert.match(view.text(), /Ahmad/);
  assert.match(view.text(), /Mei/);
  await view.press(view.findByLabel(/Send to Ahmad/));
  assert.deepEqual(toggled, ["r1"]);
});

beforeEach(() => useComposerStore.setState({ activeTab: "post" }));

test("TabSwitcher marks the active tab and switches the composer tab on press", async () => {
  const view = await render(createElement(TabSwitcher, {}));
  assert.ok(view.findByLabel("Post tab"));
  assert.equal(useComposerStore.getState().activeTab, "post");

  await view.press(view.findByLabel("Review tab"));
  assert.equal(useComposerStore.getState().activeTab, "review");
  await view.press(view.findByLabel("Post tab"));
  assert.equal(useComposerStore.getState().activeTab, "post");
});

const NEUTRAL_TASTE = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };

function renderDish(id: string, overrides: Partial<DishDetail> = {}): DishDetail {
  return {
    id,
    venueId: `venue-${id}`,
    buildingId: "building-1",
    venueName: "Ah Heng Stall",
    unitNumber: "#01-12",
    floor: "L1",
    name: `Dish ${id}`,
    imageUrl: "",
    distanceMeters: 120,
    rating: 4.5,
    reviewCount: 12,
    price: 5.5,
    priceRange: "$",
    tasteTags: [],
    tasteVector: NEUTRAL_TASTE,
    dietaryFlags: [],
    gallery: [],
    mustOrder: false,
    availabilityFlags: [],
    reviews: [],
    ...overrides,
  };
}

function renderVenue(id: string): VenueSummary {
  return {
    id,
    buildingId: "building-1",
    name: `Stall ${id}`,
    unitNumber: "#01-01",
    floor: "L1",
    isOpen: true,
    topDishId: "",
    operatingHours: "",
    deliveryLinks: [],
  };
}

test("DetailActionBar presses the right action and marks the active one", async () => {
  const pressed: string[] = [];
  const view = await render(
    createElement(DetailActionBar, {
      testID: "bar",
      actions: [
        { id: "save", label: "Save", icon: () => null, onPress: () => pressed.push("save") },
        {
          id: "tried",
          label: "Tried",
          icon: () => null,
          role: "checkbox" as const,
          active: true,
          onPress: () => pressed.push("tried"),
        },
        {
          id: "busy",
          label: "Busy",
          icon: () => null,
          loading: true,
          onPress: () => pressed.push("busy"),
        },
      ],
    }),
  );
  // Each icon button carries a caption, so the action is not guessed from the glyph alone.
  assert.match(view.text(), /Save/);
  assert.match(view.text(), /Tried/);
  await view.press(view.findByLabel("Save"));
  await view.press(view.findByLabel("Tried"));
  assert.deepEqual(pressed, ["save", "tried"]);
});

async function holdDown(view: Awaited<ReturnType<typeof render>>, target: HTMLElement | null) {
  assert.ok(target, "hold target not found");
  const init = { bubbles: true, cancelable: true, button: 0 };
  const PointerCtor = (window as unknown as { PointerEvent?: typeof MouseEvent }).PointerEvent;
  const down = PointerCtor
    ? new PointerCtor("pointerdown", init)
    : new window.MouseEvent("mousedown", init);
  target.dispatchEvent(down);
  await new Promise((resolve) => setTimeout(resolve, 600));
  const up = PointerCtor
    ? new PointerCtor("pointerup", init)
    : new window.MouseEvent("mouseup", init);
  target.dispatchEvent(up);
  await view.settle();
}

test("DetailActionBar opens a held button's own menu, dims the page, and keeps taps", async () => {
  const pressed: string[] = [];
  const view = await render(
    createElement(DetailActionBar, {
      actions: [
        {
          id: "tried",
          label: "Tried",
          icon: () => null,
          onPress: () => pressed.push("tried"),
          holdTitle: "Have you tried it?",
          holdOptions: [
            { id: "yes", label: "Tried", selected: true, onPress: () => pressed.push("yes") },
            { id: "no", label: "Not tried", onPress: () => pressed.push("no") },
          ],
        },
        { id: "like", label: "Like", icon: () => null, onPress: () => pressed.push("like") },
      ],
      cta: { label: "Write a review", onPress: () => pressed.push("review") },
    }),
  );
  assert.match(view.text(), /Write a review/);
  // No three-dots menu, and nothing extra shows until a button is held.
  assert.equal(view.findByLabel("More actions"), null);
  assert.doesNotMatch(view.text(), /Not tried/);
  await view.press(view.findByLabel("Like"));
  // A button with no hold options opens nothing when held.
  await holdDown(view, view.findByLabel("Like"));
  assert.equal(view.findByLabel("Close menu"), null);

  await holdDown(view, view.findByLabel("Tried"));
  assert.match(view.text(), /Have you tried it\?/);
  assert.ok(view.findByLabel("Close menu"));
  await view.press(view.findByLabel("Not tried"));
  await view.press(view.findByLabel("Write a review"));
  assert.ok(pressed.includes("like"));
  assert.deepEqual(
    pressed.filter((entry) => entry !== "like"),
    ["no", "review"],
  );

  // DISH-8: once closed, the fading menu is hidden from screen readers and its rows do nothing.
  const hiddenRow = view.findByLabel("Not tried");
  if (hiddenRow) {
    assert.ok(hiddenRow.closest('[aria-hidden="true"]'), "a closed menu is hidden from readers");
    await view.press(hiddenRow);
  }
  assert.equal(pressed.filter((entry) => entry === "no").length, 1);
});

test("DeliveryBrandLogo draws Grab and foodpanda marks only", async () => {
  assert.equal(hasDeliveryBrandLogo("grabfood"), true);
  assert.equal(hasDeliveryBrandLogo("foodpanda"), true);
  assert.equal(hasDeliveryBrandLogo("deliveroo"), false);
  assert.equal(DeliveryBrandLogo({ platform: "deliveroo", color: "#000" }), null);
  assert.notEqual(DeliveryBrandLogo({ platform: "grabfood", color: "#000" }), null);
});

test("FloatingBackButton is a labelled back button", async () => {
  let backs = 0;
  const view = await render(createElement(FloatingBackButton, { onPress: () => (backs += 1) }));
  await view.press(view.findByLabel("Go back"));
  assert.equal(backs, 1);
  await view.unmount();

  let shares = 0;
  const share = await render(
    createElement(FloatingBackButton, {
      accessibilityLabel: "Share stall",
      onPress: () => (shares += 1),
      side: "right",
    }),
  );
  await share.press(share.findByLabel("Share stall"));
  assert.equal(shares, 1);
});

test("DetailHeroFade shows the photo it holds", async () => {
  const view = await render(
    createElement(
      DetailHeroFade,
      { scrollY: makeMutable(0), height: 200 },
      createElement(Text, null, "Hero photo"),
    ),
  );
  assert.match(view.text(), /Hero photo/);
});

test("TasteRatingInput picks a level, clears it on a second tap, and marks our guess", async () => {
  const changes: [string, number | undefined][] = [];
  const view = await render(
    createElement(TasteRatingInput, {
      values: { spicy: 7.5 },
      suggestions: { sweet: 2.2 },
      onChange: (key, value) => changes.push([key, value]),
    }),
  );
  await view.press(view.findByLabel("Sour: Medium"));
  await view.press(view.findByLabel("Spicy: Strong"));
  assert.deepEqual(changes, [
    ["sour", 5],
    ["spicy", undefined],
  ]);
  assert.ok(view.findByLabel("Sweet: Light, suggested"));
  assert.equal(nearestTasteRatingLevel(8.9), 10);
});

test("TasteRatingInput's column names are short enough not to break mid-word, while the buttons keep the full names", async () => {
  const view = await render(
    createElement(TasteRatingInput, { values: {}, onChange: () => undefined }),
  );
  for (const short of ["None", "Light", "Med", "Strong", "Very"]) {
    assert.ok(view.findByText(short), `${short} heads its column`);
  }
  assert.equal(view.findByText("Medium"), null, "no six-letter 'Medium' header to wrap");
  for (const step of TASTE_RATING_LEVELS) {
    assert.ok(step.short.length <= 6, `${step.label} header fits its column`);
    assert.ok(view.findByLabel(`Spicy: ${step.label}`), "the radio keeps the full name");
  }
});

test("TasteRadarChart shows the dish's typical taste and adds your taste only with a palette", async () => {
  const axes = [
    { key: "spicy", label: "Spicy", standard: 7, yours: 9 },
    { key: "sweet", label: "Sweet", standard: 2, yours: 1 },
    { key: "rich", label: "Rich", standard: 5, yours: 5 },
  ];
  const withPalette = await render(createElement(TasteRadarChart, { axes }));

  assert.match(withPalette.text(), /How it tastes to you/);
  assert.match(withPalette.text(), /Typical taste \(estimate\)/);
  // The grey shape comes from catalog tags, not from reviews' taste ratings (DISH-2).
  assert.doesNotMatch(withPalette.text(), /from reviews/);
  await withPalette.unmount();
  const plain = await render(
    createElement(TasteRadarChart, {
      axes: axes.map(({ key, label, standard }) => ({ key, label, standard })),
    }),
  );
  assert.doesNotMatch(plain.text(), /How it tastes to you/);
});

test("CaptionPreview folds a long caption to a preview with ...more", async () => {
  const long = "The broth is deep and peppery. ".repeat(6);
  const view = await render(createElement(CaptionPreview, { text: long }));
  assert.match(view.text(), /\.\.\.more/);
  await view.press(view.findByLabel(long.trim()));
  assert.match(view.text(), /Show less/);
  await view.unmount();
  const short = await render(createElement(CaptionPreview, { text: "Great rice." }));
  assert.doesNotMatch(short.text(), /more/);
  assert.equal(captionNeedsMore("Great rice."), false);
  assert.equal(captionNeedsMore(long), true);
});

test("AnimatedSwitch is a switch that flips its value", async () => {
  const values: boolean[] = [];
  const view = await render(
    createElement(AnimatedSwitch, {
      value: false,
      accessibilityLabel: "Push alerts",
      onValueChange: (next: boolean) => values.push(next),
    }),
  );
  await view.press(view.findByLabel("Push alerts"));
  assert.deepEqual(values, [true]);
});

test("Collection album tiles open their collection and the new tile starts one", async () => {
  const opened: string[] = [];
  const view = await render(
    createElement(
      View,
      null,
      createElement(NewCollectionTile, { width: 150, onPress: () => opened.push("new") }),
      createElement(CollectionAlbumCard, {
        name: "Supper spots",
        itemCount: 3,
        coverPhotos: [],
        width: 150,
        onPress: () => opened.push("supper"),
      }),
    ),
  );
  assert.match(view.text(), /3 saved/);
  await view.press(view.findByLabel("New collection"));
  await view.press(view.findByLabel("Open collection Supper spots, 3 saved"));
  assert.deepEqual(opened, ["new", "supper"]);
  assert.equal(collectionCountLabel(1), "1 saved");
});

test("HeritageStampTile shows the detail when earned and Locked otherwise", async () => {
  const earned = await render(
    createElement(HeritageStampTile, {
      title: "Laksa Lover",
      subtitle: "Cuisine",
      detail: "3 tried",
      earned: true,
      width: 110,
    }),
  );
  assert.match(earned.text(), /3 tried/);
  await earned.unmount();
  const locked = await render(
    createElement(HeritageStampTile, {
      title: "Durian King",
      subtitle: "Classic",
      detail: "0 tried",
      earned: false,
      width: 110,
    }),
  );
  assert.match(locked.text(), /Locked/);
});

test("MenuFilterDropdown summarises the filters and clears them", async () => {
  assert.equal(menuFilterSummary("All", "All", []), "All dishes");
  assert.equal(menuFilterSummary("Noodles", "All", ["Vegetarian"]), "Noodles · Vegetarian");
  assert.equal(menuFilterSummary("Noodles", "All", ["Vegetarian", "Halal"]), "Noodles +2");
  const view = await render(
    createElement(MenuFilterDropdown, {
      categories: ["All", "Noodles"],
      activeCategory: "All",
      onCategoryChange: () => undefined,
      allCategory: "All",
      dietaryOptions: [{ flag: "vegetarian", label: "Vegetarian", dishCount: 2 }],
      activeDietaryFlags: [],
      onDietaryFlagsChange: () => undefined,
      resultCount: 4,
    }),
  );
  assert.ok(view.findByLabel("Filter menu, All dishes"));
});

test("DiscoverModeTabs switches between What's here and For you", async () => {
  const chosen: string[] = [];
  const view = await render(
    createElement(DiscoverModeTabs, {
      value: "forYou",
      onChange: (mode: string) => chosen.push(mode),
    }),
  );
  assert.match(view.text(), /What's here/);
  assert.match(view.text(), /For you/);
  // Pressing the tab that is already selected does nothing.
  await view.press(view.findByLabel("For you"));
  assert.deepEqual(chosen, []);
  await view.press(view.findByLabel("What's here"));
  assert.deepEqual(chosen, ["here"]);
});

test("ForYouCard shows the match, the reason and a review, and opens the dish", async () => {
  let opened = 0;
  const dish = renderDish("a", {
    savedCount: 7,
    reviews: [
      {
        id: "r1",
        authorName: "Mei",
        rating: 5,
        createdAt: "2026-10-01T00:00:00Z",
        text: "Smoky and just spicy enough.",
        tags: [],
        wouldRecommend: true,
        photos: [],
      },
    ],
  });
  const view = await render(
    createElement(ForYouCard, {
      pick: { dish, matchPercent: 88, reason: "Spicy, the way you like it" },
      onPress: () => {
        opened += 1;
      },
    }),
  );
  assert.match(view.text(), /Dish a/);
  assert.match(view.text(), /S\$5\.50/);
  assert.match(view.text(), /Spicy, the way you like it/);
  assert.match(view.text(), /Smoky and just spicy enough/);
  assert.match(view.text(), /7 saved/);
  await view.press(view.findByLabel(/Dish a at Ah Heng Stall, 88 percent match/));
  assert.equal(opened, 1);
});

test("ForYouCard shows no match badge without a palate", async () => {
  const view = await render(
    createElement(ForYouCard, {
      pick: { dish: renderDish("b"), reason: "Popular here" },
      onPress: () => undefined,
    }),
  );
  assert.doesNotMatch(view.text(), /% match/);
  assert.match(view.text(), /Popular here/);
});

test("WhatsHerePanel filters stalls by food type and price, and clears the filters", async () => {
  const opened: string[] = [];
  const stalls: HereStall[] = [
    {
      venue: renderVenue("noodle"),
      dishes: [renderDish("n", { foodTypeTag: "Noodles", price: 4 })],
    },
    {
      venue: renderVenue("rice"),
      dishes: [renderDish("r", { foodTypeTag: "Rice", price: 9 })],
    },
  ];
  const view = await render(
    createElement(WhatsHerePanel, {
      placeName: "Maxwell",
      stalls,
      getStallMeta: () => "Open now",
      onOpenStall: (id: string) => opened.push(id),
    }),
  );
  assert.match(view.text(), /All stalls at Maxwell/);
  assert.match(view.text(), /2 stalls/);
  await view.press(view.findByLabel("Noodles filter"));
  assert.match(view.text(), /1 stall/);
  assert.match(view.text(), /Stall noodle/);
  assert.doesNotMatch(view.text(), /Stall rice/);
  await view.press(view.findByLabel("S$8+ filter"));
  assert.match(view.text(), /No stalls match/);
  await view.press(view.findByLabel("Clear filters"));
  assert.match(view.text(), /2 stalls/);
  await view.press(view.findByLabel("Open Stall rice"));
  assert.deepEqual(opened, ["rice"]);
});

test("TrendingList shows rich rows, opens one, and hides when there are none", async () => {
  const opened: string[] = [];
  const bite = {
    id: "b1",
    dishId: "d1",
    dishName: "Laksa",
    venueName: "Sungei Road",
    unitNumber: "#01-01",
    photoUrl: "",
    rating: 4.6,
    price: 5,
    distanceMeters: 350,
  } as unknown as Bite;
  const view = await render(
    createElement(TrendingList, {
      title: "Trending near you",
      bites: [bite],
      onOpen: (item: Bite) => opened.push(item.dishId),
    }),
  );
  assert.match(view.text(), /Trending near you/);
  assert.match(view.text(), /Laksa/);
  assert.match(view.text(), /350 m/);
  assert.match(view.text(), /S\$5\.00/);
  await view.press(view.findByLabel(/^Laksa, Sungei Road, S\$5\.00/));
  assert.deepEqual(opened, ["d1"]);
  await view.rerender(
    createElement(TrendingList, { title: "Trending near you", bites: [], onOpen: () => undefined }),
  );
  assert.doesNotMatch(view.text(), /Trending near you/);
});

test("TrendingList shows the dish icon when a row has no photo or its photo fails", async () => {
  const bite = (photoUrl: string) =>
    ({
      id: "b1",
      dishId: "d1",
      dishName: "Laksa",
      venueName: "Sungei Road",
      photoUrl,
      rating: 0,
      price: 5,
    }) as unknown as Bite;
  const noPhoto = await render(
    createElement(TrendingList, { title: "Most reviewed", bites: [bite("")], onOpen: () => {} }),
  );
  assert.ok(noPhoto.findByLabel("Laksa photo unavailable"), "no photo shows the icon");
  await cleanup();

  const withPhoto = await render(
    createElement(TrendingList, {
      title: "Most reviewed",
      bites: [bite("https://cdn.example.sg/laksa.jpg")],
      onOpen: () => {},
    }),
  );
  assert.equal(withPhoto.findByLabel("Laksa photo unavailable"), null);
  const image = withPhoto.container.querySelector("[data-stub='expo-image.Image']");
  assert.ok(image, "the photo is on screen");
  // The image stub draws nothing, so the load error is raised through the prop it was given.
  const fiberKey = Object.keys(image).find((key) => key.startsWith("__reactFiber$"))!;
  let fiber = (image as unknown as Record<string, unknown>)[fiberKey] as {
    memoizedProps?: { onError?: () => void };
    return: unknown;
  } | null;
  while (fiber && !fiber.memoizedProps?.onError) fiber = fiber.return as typeof fiber;
  assert.ok(fiber?.memoizedProps?.onError, "the photo reports load errors");
  await act(async () => fiber?.memoizedProps?.onError?.());
  assert.ok(withPhoto.findByLabel("Laksa photo unavailable"), "a broken photo falls back");
});

test("MenuLessStallGroup counts the stalls, opens on press and names itself for screen readers", async () => {
  const toggled: boolean[] = [];
  const stalls = [
    { id: "s1", name: "Ah Seng" },
    { id: "s2", name: "Bee Hoon King" },
  ];
  const view = await render(
    createElement(MenuLessStallGroup, {
      stalls,
      expanded: false,
      onToggle: () => toggled.push(true),
    }),
  );
  assert.match(view.text(), /More stalls nearby · menus coming/);
  assert.match(view.text(), /2 stalls/);
  await view.press(view.findByLabel("More stalls nearby, menus coming. 2 stalls"));
  assert.deepEqual(toggled, [true]);
  await view.rerender(
    createElement(MenuLessStallGroup, {
      stalls: stalls.slice(0, 1),
      expanded: true,
      onToggle: () => {},
    }),
  );
  assert.ok(view.findByLabel("More stalls nearby, menus coming. 1 stall"), "singular for one");
  await view.rerender(
    createElement(MenuLessStallGroup, { stalls: [], expanded: false, onToggle: () => {} }),
  );
  assert.doesNotMatch(view.text(), /More stalls nearby/);
});

test("AchievementsSection shows levels, progress and a completed goal", async () => {
  const rows = computeAchievements({
    triedDishes: 12,
    distinctCentres: 0,
    stallsVisited: 0,
    spicyDishes: 0,
    sweetDishes: 0,
    budgetDishes: 0,
    reviewsWritten: 1,
    dishesSaved: 60,
  });
  const view = await render(createElement(AchievementsSection, { rows }));
  assert.match(view.text(), /Dish collector/);
  assert.match(view.text(), /Level 1\/4/);
  assert.match(view.text(), /12 \/ 25/);
  // Curator has all three levels done.
  assert.match(view.text(), /Complete/);
  assert.match(view.text(), /3 of 8 started/);
});

test("the Write button in the bottom bar has the same slot, label colour and weight as other tabs", async () => {
  // Icon glyph size and colour are pinned in nav-activity-contracts; the render shows the
  // slot around it and the label are identical, so nothing about the button stands out.
  const styles = async (props: Record<string, unknown>) => {
    const view = await render(createElement(AppBottomTabItem, props as never));
    const result = {
      slot: view.container.querySelector("[aria-label] > div")?.getAttribute("style"),
      label: view.container.querySelector('[aria-label] > div[dir="auto"]')?.getAttribute("style"),
      labelled: view.findByLabel("Write a review") !== null,
    };
    await view.unmount();
    return result;
  };
  const write = await styles({
    createAction: true,
    icon: PenLine,
    label: "Write",
    accessibilityLabel: "Write a review",
    onPress: () => {},
  });
  const other = await styles({ icon: BookOpenText, label: "Reviews", onPress: () => {} });
  assert.ok(write.slot && write.label, "it has an icon slot and a label like the other tabs");
  assert.equal(write.slot, other.slot);
  assert.equal(write.label, other.label);
  assert.ok(write.labelled);
});

test("StallLogoMark shows no circle backdrop behind a logo, only behind the initials", async () => {
  const withLogo = await render(
    createElement(StallLogoMark, { logoUrl: "https://example.com/logo.png", name: "Ah Seng" }),
  );
  const ring = withLogo.container.querySelector('[style*="border-top-left-radius"]') as HTMLElement;
  assert.match(ring.getAttribute("style") ?? "", /background-color: rgba\(0, 0, 0, 0\)/);
  const initials = await render(createElement(StallLogoMark, { name: "Ah Seng" }));
  assert.ok(initials.findByText("AS"));
  const fallbackRing = initials.container.querySelector(
    '[style*="border-top-left-radius"]',
  ) as HTMLElement;
  assert.doesNotMatch(
    fallbackRing.getAttribute("style") ?? "",
    /background-color: rgba\(0, 0, 0, 0\)/,
  );
});
