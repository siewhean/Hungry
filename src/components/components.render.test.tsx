// Renders the shared components that have logic or states of their own, and presses what a
// person can press. Run with `npm run test:render`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { cleanup, render } from "@/test/render";
import { MissionCard } from "@/components/gamification/MissionCard";
import { PassportBook } from "@/components/gamification/PassportBook";
import { PassportCard } from "@/components/gamification/PassportCard";
import { ReportListSheet } from "@/components/portfolio/ReportListSheet";
import { OwnContentEditDialog } from "@/components/social/OwnContentEditDialog";
import { InAppShareCard, ShareQuickActionGroup } from "@/components/social/ShareSettings";
import { FeedStateView } from "@/components/ui/FeedStateView";
import { FloatingToast } from "@/components/ui/FloatingToast";
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
import { usePassportStore } from "@/store/usePassportStore";
import { useUIStore } from "@/store/useUIStore";
import type { WheelMember } from "@/types/domain";

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
