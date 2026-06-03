import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Platform, Pressable, ScrollView, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  CheckCircle2,
  Clock,
  GripVertical,
  ImagePlus,
  Plus,
  Store,
  Trophy,
  X,
} from "lucide-react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import {
  AccessibleImage,
  AppText,
  BottomSheet,
  Button,
  Card,
  Input,
  SelectField,
} from "@/components/ui";
import { useFoodCredStore } from "@/store/useFoodCredStore";
import { useActivityStore } from "@/store/useActivityStore";
import { useMissionStore } from "@/store/useMissionStore";
import { usePassportStore } from "@/store/usePassportStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useStallSubmissionStore } from "@/store/useStallSubmissionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { SubmitUserStallSubmissionInput, UserStallSubmission } from "@/types/domain";
import { confirmGalleryAccess, isGalleryPermissionGranted } from "@/lib/permissions/gallery";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = NativeStackScreenProps<ProfileStackParamList, "AddStall">;

type FormErrors = Partial<Record<"stallName" | "imageUri" | "openingHours", string>>;
type MenuItemDraft = { id: string; name: string; priceRange: string };
type SelectedStallImage = {
  id: string;
  uri: string;
  mimeType?: string;
};

const SINGAPORE_AREA_OPTIONS = [
  { label: "Select area", value: "" },
  { label: "Pioneer", value: "Pioneer" },
  { label: "Jurong West", value: "Jurong West" },
  { label: "Jurong East", value: "Jurong East" },
  { label: "Tampines", value: "Tampines" },
  { label: "Bedok", value: "Bedok" },
  { label: "Pasir Ris", value: "Pasir Ris" },
  { label: "Woodlands", value: "Woodlands" },
  { label: "Yishun", value: "Yishun" },
  { label: "Ang Mo Kio", value: "Ang Mo Kio" },
  { label: "Hougang", value: "Hougang" },
  { label: "Punggol", value: "Punggol" },
  { label: "Serangoon", value: "Serangoon" },
  { label: "Toa Payoh", value: "Toa Payoh" },
  { label: "Clementi", value: "Clementi" },
  { label: "Bukit Timah", value: "Bukit Timah" },
  { label: "Queenstown", value: "Queenstown" },
  { label: "Tiong Bahru", value: "Tiong Bahru" },
  { label: "Chinatown", value: "Chinatown" },
  { label: "Orchard", value: "Orchard" },
  { label: "Marina Bay", value: "Marina Bay" },
  { label: "Geylang", value: "Geylang" },
] as const;

type SingaporeAreaValue = (typeof SINGAPORE_AREA_OPTIONS)[number]["value"];
type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
type TimeRange = {
  id: string;
  days: Weekday[];
  startMinutes: number;
  endMinutes: number;
};

const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MINUTES_IN_DAY = 24 * 60;
const DEFAULT_START_MINUTES = 10 * 60;
const DEFAULT_END_MINUTES = 22 * 60;
const MAX_STALL_IMAGES = 6;
const PHOTO_CARD_WIDTH = 168;
const PHOTO_SPACING = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveSubmitErrorMessage(error: unknown): string {
  const asText = findErrorMessage(error);

  if (
    asText &&
    asText.toLowerCase().includes("could not find the function public.submit_user_stall_submission")
  ) {
    return "Unable to submit stall right now. Please retry after syncing the latest backend migration.";
  }

  if (
    asText &&
    asText.toLowerCase().includes("could not find the") &&
    asText.toLowerCase().includes("column") &&
    asText.toLowerCase().includes("schema cache")
  ) {
    return "Unable to submit stall right now. Please retry after syncing the latest backend migration.";
  }

  if (
    asText &&
    asText.toLowerCase().includes("permission denied") &&
    asText.toLowerCase().includes("user_stall_submissions")
  ) {
    return "Unable to submit stall right now. Please retry shortly.";
  }

  if (asText) return asText;
  return "Unable to submit stall right now.";
}

function findErrorMessage(value: unknown, depth = 0): string | null {
  if (depth > 2) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (value instanceof Error) {
    return findErrorMessage(value.message, depth + 1);
  }
  if (!value || typeof value !== "object") return null;

  const errorObject = value as Record<string, unknown>;

  const directCandidates = [
    errorObject.message,
    errorObject.error,
    errorObject.details,
    errorObject.hint,
    errorObject.code,
    errorObject.description,
    errorObject.error_description,
    errorObject.msg,
  ];

  for (const candidate of directCandidates) {
    const found = findErrorMessage(candidate, depth + 1);
    if (found) return found;
  }

  if (Array.isArray(errorObject.errors)) {
    for (const candidate of errorObject.errors) {
      const found = findErrorMessage(candidate, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function minutesToTimeLabel(minutes: number) {
  const clamped = ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours24 = Math.floor(clamped / 60);
  const mins = clamped % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  return `${String(hours12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${period}`;
}

function dateFromMinutes(minutes: number) {
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function createImageId(uri: string) {
  return `${uri}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatSlotsForSubmission(slots: TimeRange[]) {
  const sorted = slots.slice().map((slot) => ({
    ...slot,
    days: slot.days.slice().sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)),
  }));

  const lines: string[] = [];
  for (const slot of sorted) {
    const openingText = `${minutesToTimeLabel(slot.startMinutes)} - ${minutesToTimeLabel(slot.endMinutes)}`;
    for (const day of slot.days) {
      lines.push(`${day} ${openingText}`);
    }
  }
  return lines.join("; ");
}

function getDuplicateSlotsByDays(slots: TimeRange[]) {
  const used = new Map<Weekday, string>();
  const duplicateSlotIds = new Set<string>();
  for (const slot of slots) {
    for (const day of slot.days) {
      if (used.has(day)) {
        duplicateSlotIds.add(slot.id);
      } else {
        used.set(day, slot.id);
      }
    }
  }
  return duplicateSlotIds;
}

function buildSubmissionAchievements(submissions: UserStallSubmission[]) {
  const submittedCount = submissions.length;
  const withMenuCount = submissions.filter((submission) => submission.menuItems.length > 0).length;
  return [
    {
      id: "first-find",
      title: "First Find",
      body: "Submit your first new stall.",
      progress: Math.min(submittedCount, 1),
      target: 1,
    },
    {
      id: "menu-mapper",
      title: "Menu Mapper",
      body: "Add menu details for 3 discovered stalls.",
      progress: Math.min(withMenuCount, 3),
      target: 3,
    },
    {
      id: "local-scout",
      title: "Local Scout",
      body: "Submit 5 useful stall leads.",
      progress: Math.min(submittedCount, 5),
      target: 5,
    },
  ];
}

export function AddStallScreen({ navigation }: Props) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const submissions = useStallSubmissionStore((state) => state.submissions);
  const isLoaded = useStallSubmissionStore((state) => state.isLoaded);
  const loadSubmissions = useStallSubmissionStore((state) => state.loadSubmissions);
  const submitStall = useStallSubmissionStore((state) => state.submitStall);
  const isSubmitting = useStallSubmissionStore((state) => state.isSubmitting);
  const showToast = useUIStore((state) => state.showToast);
  const awardFoodCred = useFoodCredStore((state) => state.awardPoints);
  const addActivityUpdate = useActivityStore((state) => state.addActivityUpdate);
  const incrementMission = useMissionStore((state) => state.incrementProgress);
  const recordPassportContribution = usePassportStore((state) => state.recordContribution);
  const timePickerSheetRef = useRef<BottomSheetModal>(null);

  const [stallName, setStallName] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedStallImage[]>([]);
  const [buildingName, setBuildingName] = useState("");
  const [area, setArea] = useState<SingaporeAreaValue>("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [timeSlots, setTimeSlots] = useState<TimeRange[]>([
    {
      id: "slot-1",
      days: ["Mon"],
      startMinutes: DEFAULT_START_MINUTES,
      endMinutes: DEFAULT_END_MINUTES,
    },
  ]);
  const [activeTimePicker, setActiveTimePicker] = useState<{
    slotId: string;
    type: "start" | "end";
    isOpen: boolean;
  } | null>(null);
  const [timePickerDraftDate, setTimePickerDraftDate] = useState<Date | null>(null);
  const shouldApplyTimePickerDraftOnDismissRef = useRef(true);
  const [menuItemDrafts, setMenuItemDrafts] = useState<MenuItemDraft[]>([
    { id: "menu-item-1", name: "", priceRange: "" },
  ]);
  const [deliveryLink, setDeliveryLink] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);

  const achievements = useMemo(() => buildSubmissionAchievements(submissions), [submissions]);
  const coverImage = selectedImages[0];
  const selectedImagesRef = useRef<SelectedStallImage[]>(selectedImages);
  const hasRequestedGalleryDialog = useRef(false);
  const dragSourceIndexRef = useRef<number>(-1);
  const dragTargetIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (!isLoaded) {
      void loadSubmissions();
    }
  }, [isLoaded, loadSubmissions]);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  const moveSelectedImage = (fromIndex: number, toIndex: number) => {
    setSelectedImages((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return current;
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const pickImages = async () => {
    let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!isGalleryPermissionGranted(permission)) {
      if (!hasRequestedGalleryDialog.current) {
        const shouldRequestPermission = await confirmGalleryAccess({
          title: "Allow gallery access",
          message: "Hungry needs access to your gallery to let you add stall photos.",
          confirmLabel: "Allow",
          cancelLabel: "Not now",
        });
        hasRequestedGalleryDialog.current = true;
        if (!shouldRequestPermission) {
          return;
        }
      }

      permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!isGalleryPermissionGranted(permission)) {
        showToast({ message: "Allow photo access to add stall photos.", tone: "warning" });
        return;
      }
    }

    if (!isGalleryPermissionGranted(permission)) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_STALL_IMAGES,
      quality: 0.9,
    });

    if (result.canceled || !result.assets.length) return;
    setSelectedImages((current) => {
      const knownUris = new Set(current.map((image) => image.uri));
      const pickedImages = result.assets
        .filter((asset) => asset.uri && !knownUris.has(asset.uri))
        .map((asset) => ({
          id: asset.assetId ?? createImageId(asset.uri),
          uri: asset.uri,
          mimeType: asset.mimeType,
        }));
      return [...current, ...pickedImages].slice(0, MAX_STALL_IMAGES);
    });
    setErrors((current) => ({ ...current, imageUri: undefined }));
  };

  const removeSelectedImage = (imageId: string) => {
    setSelectedImages((current) => current.filter((image) => image.id !== imageId));
  };

  const makeCoverImage = (imageId: string) => {
    setSelectedImages((current) => {
      const target = current.find((image) => image.id === imageId);
      if (!target) return current;
      return [target, ...current.filter((image) => image.id !== imageId)];
    });
  };

  const addTimeSlot = () => {
    const usedDays = new Set(timeSlots.flatMap((slot) => slot.days));
    const nextAvailableDay = WEEKDAYS.find((day) => !usedDays.has(day));
    setTimeSlots((current) => [
      ...current,
      {
        id: `slot-${Date.now()}`,
        days: nextAvailableDay ? [nextAvailableDay] : [],
        startMinutes: DEFAULT_START_MINUTES,
        endMinutes: DEFAULT_END_MINUTES,
      },
    ]);
    setErrors((current) => ({ ...current, openingHours: undefined }));
  };

  const removeTimeSlot = (slotId: string) => {
    setTimeSlots((current) => current.filter((slot) => slot.id !== slotId));
    setErrors((current) => ({ ...current, openingHours: undefined }));
  };

  const updateTimeSlotDays = (slotId: string, day: Weekday) => {
    setTimeSlots((current) =>
      current.map((slot) => {
        if (slot.id !== slotId) {
          return slot;
        }
        const alreadySelected = slot.days.includes(day);
        const otherSlots = current.filter((candidate) => candidate.id !== slotId);
        const isUsedElsewhere = otherSlots.some((candidate) => candidate.days.includes(day));

        if (!alreadySelected && isUsedElsewhere) {
          return slot;
        }

        return {
          ...slot,
          days: alreadySelected
            ? slot.days.length > 1
              ? slot.days.filter((candidate) => candidate !== day)
              : slot.days
            : [...slot.days, day],
        };
      }),
    );
    setErrors((current) => ({ ...current, openingHours: undefined }));
  };

  const applyDayPreset = (slotId: string, days: Weekday[]) => {
    setTimeSlots((current) =>
      current.map((slot) => {
        if (slot.id !== slotId) {
          return slot;
        }

        const otherSlots = current.filter((candidate) => candidate.id !== slotId);
        const usedDays = new Set(otherSlots.flatMap((candidate) => candidate.days));
        const dedupedDays = days.filter((day) => !usedDays.has(day));
        return { ...slot, days: dedupedDays.length > 0 ? dedupedDays : slot.days };
      }),
    );
    setErrors((current) => ({ ...current, openingHours: undefined }));
  };

  const parsePickerDateForSlot = (slotId: string, type: "start" | "end") => {
    const slot = timeSlots.find((item) => item.id === slotId);
    const minutes =
      type === "start"
        ? (slot?.startMinutes ?? DEFAULT_START_MINUTES)
        : (slot?.endMinutes ?? DEFAULT_END_MINUTES);
    return dateFromMinutes(minutes);
  };

  const openTimePicker = (slotId: string, type: "start" | "end") => {
    setActiveTimePicker({ slotId, type, isOpen: true });
    setTimePickerDraftDate(parsePickerDateForSlot(slotId, type));
    shouldApplyTimePickerDraftOnDismissRef.current = true;
    if (Platform.OS !== "android") {
      requestAnimationFrame(() => timePickerSheetRef.current?.present());
    }
  };

  const applyTimePickerDraft = () => {
    if (!activeTimePicker || !timePickerDraftDate) return;
    setTimeForSlot(activeTimePicker.slotId, activeTimePicker.type, timePickerDraftDate);
  };

  const setTimeForSlot = (slotId: string, type: "start" | "end", date: Date) => {
    const minutes = date.getHours() * 60 + date.getMinutes();
    setTimeSlots((current) =>
      current.map((slot) =>
        slot.id === slotId
          ? { ...slot, [type === "start" ? "startMinutes" : "endMinutes"]: minutes }
          : slot,
      ),
    );
  };

  const applySelectedTime = (event: DateTimePickerEvent, date?: Date) => {
    if (!activeTimePicker || !date) {
      setActiveTimePicker((current) => (current ? { ...current, isOpen: false } : null));
      return;
    }

    const { slotId, type } = activeTimePicker;
    if (Platform.OS === "android") {
      if (event.type === "dismissed") {
        setActiveTimePicker(null);
        return;
      }
      setTimeForSlot(slotId, type, date);
      setActiveTimePicker(null);
      return;
    }

    setTimePickerDraftDate(date);
  };

  const applyIosTimeSelection = () => {
    if (!activeTimePicker || !timePickerDraftDate) return;
    setTimeForSlot(activeTimePicker.slotId, activeTimePicker.type, timePickerDraftDate);
    shouldApplyTimePickerDraftOnDismissRef.current = false;
    setActiveTimePicker((current) => (current ? { ...current, isOpen: false } : null));
    timePickerSheetRef.current?.dismiss();
  };

  const submit = async () => {
    const nextErrors: FormErrors = {};
    if (!stallName.trim()) nextErrors.stallName = "Stall name is required.";
    if (!coverImage?.uri.trim()) nextErrors.imageUri = "At least one stall photo is required.";
    const filledSlots = timeSlots.filter((slot) => slot.days.length > 0);
    if (getDuplicateSlotsByDays(filledSlots).size > 0) {
      nextErrors.openingHours = "Each weekday can only be used once.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const menuItems = menuItemDrafts
      .map((item) => ({
        name: item.name.trim(),
        priceRange: item.priceRange.trim() || undefined,
      }))
      .filter((item) => item.name.length > 0);
    const deliveryLinks = deliveryLink.trim()
      ? [{ label: "Online ordering", url: deliveryLink.trim() }]
      : [];

    const input: SubmitUserStallSubmissionInput = {
      stallName: stallName.trim(),
      imageUri: coverImage?.uri ?? "",
      imageMimeType: coverImage?.mimeType,
      imageUris: selectedImages.map((image) => image.uri),
      imageMimeTypes: selectedImages.map((image) => image.mimeType ?? ""),
      buildingName: buildingName.trim() || undefined,
      area: area.trim() || undefined,
      address: address.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      unitNumber: unitNumber.trim() || undefined,
      floor: floor.trim() || undefined,
      operatingHours:
        formatSlotsForSubmission(
          timeSlots.filter((slot) => slot.days.length > 0 && slot.startMinutes !== slot.endMinutes),
        ) || undefined,
      menuItems,
      deliveryLinks,
    };

    try {
      const submission = await submitStall(input);
      await Promise.allSettled([
        awardFoodCred("stall_submitted", submission.id),
        incrementMission(profile.id, "add_stall"),
        recordPassportContribution(profile.id, "stall_submitted", submission.id),
      ]);
      addActivityUpdate({
        kind: "submission",
        postId: submission.id,
        actorName: profile.displayName ?? "You",
        recipientUserId: profile.id,
        text: "submitted a stall to be reviewed",
        target: `${submission.stallName}`,
        time: "now",
      });
      showToast({
        message: "Stall details submitted. Update added to Activities.",
        tone: "success",
      });
      navigation.goBack();
    } catch (error) {
      showToast({
        message: resolveSubmitErrorMessage(error),
        tone: "error",
      });
    }
  };

  return (
    <ProfileScreenShell
      title="Add a stall"
      subtitle="Submit a real stall lead for review."
      testID="add-stall-screen"
    >
      <Card style={{ gap: spacing[4], padding: spacing[4] }}>
        <View style={{ gap: spacing[1] }}>
          <AppText variant="h3">Photos</AppText>
          <AppText variant="bodySmall" tone="muted">
            Add up to {MAX_STALL_IMAGES} clear storefront, menu, or dish photos. The first photo is
            used as the cover.
          </AppText>
        </View>
        {selectedImages.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose stall photos"
            accessibilityHint="Opens your photo library"
            onPress={pickImages}
            style={{
              alignItems: "center",
              backgroundColor: palette.bgSoft,
              borderColor: errors.imageUri ? palette.error : palette.border,
              borderRadius: componentRadii.card,
              borderWidth: 1,
              borderStyle: "dashed",
              gap: spacing[2],
              minHeight: 190,
              justifyContent: "center",
              padding: spacing[5],
            }}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: palette.orangeLight,
                borderRadius: radii.pill,
                height: 54,
                justifyContent: "center",
                width: 54,
              }}
            >
              <ImagePlus color={palette.orange} size={28} />
            </View>
            <AppText variant="bodyBold">Add stall photos</AppText>
            <AppText variant="bodySmall" tone="muted" style={{ textAlign: "center" }}>
              Storefront, menu board, stall sign, or signature dish.
            </AppText>
          </Pressable>
        ) : (
          <ScrollView
            horizontal
            scrollEnabled={!isPhotoDragging}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[3], paddingRight: spacing[1] }}
          >
            {selectedImages.map((image, index) => (
              <View
                key={image.id}
                style={{
                  borderColor: index === 0 ? palette.orange : palette.border,
                  borderRadius: componentRadii.card,
                  borderWidth: 1,
                  overflow: "hidden",
                  width: PHOTO_CARD_WIDTH,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    index === 0 ? "Cover stall photo" : `Make photo ${index + 1} the cover`
                  }
                  accessibilityHint={index === 0 ? undefined : "Moves this photo to the front"}
                  onPress={() => makeCoverImage(image.id)}
                  style={{ height: 132, width: "100%" }}
                >
                  <AccessibleImage
                    source={{ uri: image.uri }}
                    style={{ height: "100%", width: "100%" }}
                    contentFit="cover"
                    accessibilityLabel={`Selected stall photo ${index + 1}`}
                  />
                </Pressable>
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: palette.surface,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    minHeight: 42,
                    paddingHorizontal: spacing[2],
                  }}
                >
                  <AppText variant="micro" tone={index === 0 ? "accent" : "secondary"}>
                    {index === 0 ? "Cover" : `Photo ${index + 1}`}
                  </AppText>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                    {selectedImages.length > 1 ? (
                      <View
                        accessibilityLabel={`Drag photo ${index + 1}`}
                        accessibilityHint="Hold and drag to reorder"
                        style={{
                          alignItems: "center",
                          justifyContent: "center",
                          borderColor: palette.border,
                          borderRadius: radii.pill,
                          borderWidth: 1,
                          height: 28,
                          width: 28,
                        }}
                        {...PanResponder.create({
                          onStartShouldSetPanResponder: () => true,
                          onMoveShouldSetPanResponder: () => true,
                          onPanResponderGrant: () => {
                            dragSourceIndexRef.current = index;
                            dragTargetIndexRef.current = index;
                            setIsPhotoDragging(true);
                          },
                          onPanResponderMove: (_event, gestureState) => {
                            const currentLength = selectedImagesRef.current.length;
                            if (currentLength <= 1) {
                              return;
                            }
                            const slotSize = PHOTO_CARD_WIDTH + PHOTO_SPACING;
                            const offset = Math.round(gestureState.dx / slotSize);
                            const nextIndex = clamp(
                              dragSourceIndexRef.current + offset,
                              0,
                              currentLength - 1,
                            );
                            if (nextIndex !== dragTargetIndexRef.current) {
                              dragTargetIndexRef.current = nextIndex;
                            }
                          },
                          onPanResponderRelease: () => {
                            const sourceIndex = dragSourceIndexRef.current;
                            const targetIndex = dragTargetIndexRef.current;
                            if (
                              sourceIndex >= 0 &&
                              targetIndex >= 0 &&
                              sourceIndex !== targetIndex
                            ) {
                              moveSelectedImage(sourceIndex, targetIndex);
                            }
                            setIsPhotoDragging(false);
                            dragSourceIndexRef.current = -1;
                            dragTargetIndexRef.current = -1;
                          },
                          onPanResponderTerminate: () => {
                            setIsPhotoDragging(false);
                            dragSourceIndexRef.current = -1;
                            dragTargetIndexRef.current = -1;
                          },
                        }).panHandlers}
                      >
                        <GripVertical size={16} color={palette.textMuted} />
                      </View>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${index + 1}`}
                      onPress={() => removeSelectedImage(image.id)}
                      hitSlop={8}
                      style={{
                        alignItems: "center",
                        borderRadius: radii.pill,
                        height: 28,
                        justifyContent: "center",
                        width: 28,
                      }}
                    >
                      <X size={15} color={palette.textMuted} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
            {selectedImages.length < MAX_STALL_IMAGES ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add more stall photos"
                accessibilityHint="Opens your photo library"
                onPress={pickImages}
                style={{
                  alignItems: "center",
                  backgroundColor: palette.bgSoft,
                  borderColor: palette.border,
                  borderRadius: componentRadii.card,
                  borderStyle: "dashed",
                  borderWidth: 1,
                  height: 176,
                  justifyContent: "center",
                  width: 132,
                }}
              >
                <Plus color={palette.orange} size={22} />
                <AppText variant="micro" tone="accent">
                  Add photo
                </AppText>
              </Pressable>
            ) : null}
          </ScrollView>
        )}
        {errors.imageUri ? (
          <AppText variant="micro" style={{ color: palette.error }}>
            {errors.imageUri}
          </AppText>
        ) : null}

        <Input
          label="Stall name"
          placeholder="Enter stall name"
          value={stallName}
          onChangeText={(value) => {
            setStallName(value);
            setErrors((current) => ({ ...current, stallName: undefined }));
          }}
          error={Boolean(errors.stallName)}
          errorText={errors.stallName}
        />

        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <View style={{ flex: 1 }}>
            <SelectField
              label="Area"
              value={area}
              options={SINGAPORE_AREA_OPTIONS}
              onChange={setArea}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Unit"
              placeholder="#02-15"
              value={unitNumber}
              onChangeText={setUnitNumber}
            />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Building"
              placeholder="Enter building name"
              value={buildingName}
              onChangeText={setBuildingName}
            />
          </View>
          <View style={{ flex: 0.55 }}>
            <Input label="Floor" placeholder="1" value={floor} onChangeText={setFloor} />
          </View>
        </View>
        <Input
          label="Address"
          placeholder="30 Seng Poh Road"
          value={address}
          onChangeText={setAddress}
        />
        <Input
          label="Postal code"
          placeholder="Enter postal code"
          value={postalCode}
          onChangeText={setPostalCode}
          keyboardType="number-pad"
        />
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3">Opening hours</AppText>
          {errors.openingHours ? (
            <AppText variant="micro" style={{ color: palette.error }}>
              {errors.openingHours}
            </AppText>
          ) : (
            <AppText variant="bodySmall" tone="muted">
              Add the day groups you know. You can leave this blank if the hours are not visible.
            </AppText>
          )}
          <View style={{ gap: spacing[3] }}>
            {timeSlots.map((slot, index) => (
              <View
                key={slot.id}
                style={{
                  gap: spacing[2],
                  borderRadius: componentRadii.card,
                  borderWidth: 1,
                  borderColor: palette.border,
                  padding: spacing[3],
                }}
              >
                <View
                  style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[1] }}
                >
                  <View style={{ flex: 1, gap: spacing[0.5] }}>
                    <AppText variant="bodyBold">Hours set {index + 1}</AppText>
                    <AppText variant="micro" tone="muted">
                      {slot.days.join(", ")} · {minutesToTimeLabel(slot.startMinutes)} to{" "}
                      {minutesToTimeLabel(slot.endMinutes)}
                    </AppText>
                  </View>
                  {timeSlots.length > 1 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove opening hours option"
                      accessibilityHint="Removes this opening hour option"
                      onPress={() => removeTimeSlot(slot.id)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: radii.pill,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: palette.bgSoft,
                      }}
                    >
                      <X size={16} color={palette.error} />
                    </Pressable>
                  ) : null}
                </View>
                <View
                  style={{
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    borderColor: palette.border,
                    flexDirection: "row",
                    overflow: "hidden",
                    backgroundColor: palette.bgSoft,
                  }}
                >
                  {[
                    { label: "Daily", days: WEEKDAYS },
                    { label: "Weekdays", days: WEEKDAYS.slice(0, 5) },
                    { label: "Weekend", days: WEEKDAYS.slice(5) },
                  ].map((preset, presetIndex, presetOptions) => {
                    const isActive =
                      preset.days.every((day) => slot.days.includes(day)) &&
                      slot.days.every((day) => preset.days.includes(day));
                    return (
                      <Pressable
                        key={preset.label}
                        accessibilityRole="button"
                        accessibilityLabel={`Use ${preset.label.toLowerCase()} opening days`}
                        onPress={() => applyDayPreset(slot.id, preset.days)}
                        style={{
                          flex: 1,
                          borderRightWidth: presetIndex === presetOptions.length - 1 ? 0 : 1,
                          borderRightColor: palette.border,
                          backgroundColor: isActive ? palette.orangeLight : "transparent",
                          justifyContent: "center",
                          alignItems: "center",
                          paddingHorizontal: spacing[1.5],
                          paddingVertical: spacing[1.5],
                        }}
                      >
                        <AppText
                          variant={isActive ? "bodySmallBold" : "micro"}
                          tone={isActive ? "accent" : "secondary"}
                        >
                          {preset.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
                <View
                  style={{
                    backgroundColor: palette.bgSoft,
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    borderColor: palette.border,
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing[1],
                    padding: spacing[1],
                  }}
                >
                  {WEEKDAYS.map((day) => {
                    const selected = slot.days.includes(day);
                    const isDisabledByOtherSlot = timeSlots.some(
                      (candidate) => candidate.id !== slot.id && candidate.days.includes(day),
                    );
                    return (
                      <Pressable
                        key={day}
                        disabled={isDisabledByOtherSlot && !selected}
                        onPress={() => updateTimeSlotDays(slot.id, day)}
                        accessibilityRole="button"
                        accessibilityLabel={`${selected ? "Unselect" : "Select"} ${day}`}
                        accessibilityState={{ disabled: isDisabledByOtherSlot && !selected }}
                        style={{
                          flexBasis: "13.5%",
                          minWidth: 40,
                          alignItems: "center",
                          borderRadius: radii.pill,
                          borderWidth: 1,
                          borderColor: selected ? palette.orange : palette.border,
                          backgroundColor: selected
                            ? palette.orangeLight
                            : isDisabledByOtherSlot
                              ? palette.bgSoft
                              : palette.surface,
                          paddingVertical: spacing[1.5],
                          opacity: isDisabledByOtherSlot && !selected ? 0.65 : 1,
                        }}
                      >
                        <AppText
                          variant="micro"
                          style={{
                            color: selected
                              ? palette.orange
                              : isDisabledByOtherSlot
                                ? palette.textMuted
                                : palette.text,
                            fontWeight: selected ? "700" : "500",
                          }}
                        >
                          {day}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>

                <View
                  style={{
                    borderRadius: componentRadii.input,
                    borderWidth: 1,
                    borderColor: palette.border,
                    overflow: "hidden",
                    flexDirection: "row",
                    alignItems: "stretch",
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Opening time"
                    accessibilityHint="Opens time picker"
                    onPress={() => openTimePicker(slot.id, "start")}
                    style={{
                      flex: 1,
                      backgroundColor: palette.surface,
                      borderRightWidth: 1,
                      borderRightColor: palette.border,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: spacing[2],
                      paddingVertical: spacing[2],
                    }}
                  >
                    <Clock size={16} color={palette.orange} />
                    <View style={{ alignItems: "center" }}>
                      <AppText variant="micro" tone="secondary">
                        Open
                      </AppText>
                      <AppText variant="bodyBold">{minutesToTimeLabel(slot.startMinutes)}</AppText>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Closing time"
                    accessibilityHint="Opens time picker"
                    onPress={() => openTimePicker(slot.id, "end")}
                    style={{
                      flex: 1,
                      backgroundColor: palette.surface,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: spacing[2],
                      paddingVertical: spacing[2],
                    }}
                  >
                    <Clock size={16} color={palette.orange} />
                    <View style={{ alignItems: "center" }}>
                      <AppText variant="micro" tone="secondary">
                        Close
                      </AppText>
                      <AppText variant="bodyBold">{minutesToTimeLabel(slot.endMinutes)}</AppText>
                    </View>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
          {Platform.OS === "android" && activeTimePicker ? (
            <DateTimePicker
              value={parsePickerDateForSlot(activeTimePicker.slotId, activeTimePicker.type)}
              mode="time"
              display="default"
              is24Hour={false}
              onChange={applySelectedTime}
            />
          ) : null}
          <Button
            label="Add hours option"
            variant="ghost"
            size="sm"
            onPress={addTimeSlot}
            leftIcon={<Plus color={palette.orange} size={16} />}
          />
        </View>
      </Card>

      <Card style={{ gap: spacing[4], padding: spacing[4] }}>
        <View style={{ gap: spacing[1] }}>
          <AppText variant="h3">Menu details</AppText>
          <AppText variant="bodySmall" tone="muted">
            Optional, but useful when the stall detail page is reviewed.
          </AppText>
        </View>
        {menuItemDrafts.map((item, index) => (
          <View key={item.id} style={{ flexDirection: "row", gap: spacing[3] }}>
            <View style={{ flex: 1 }}>
              <Input
                label={`Menu item ${index + 1}`}
                placeholder="Enter menu item"
                value={item.name}
                onChangeText={(value) =>
                  setMenuItemDrafts((current) =>
                    current.map((candidate) =>
                      candidate.id === item.id ? { ...candidate, name: value } : candidate,
                    ),
                  )
                }
              />
            </View>
            <View style={{ width: 112 }}>
              <Input
                label="Price"
                placeholder="Enter price range"
                value={item.priceRange}
                onChangeText={(value) =>
                  setMenuItemDrafts((current) =>
                    current.map((candidate) =>
                      candidate.id === item.id ? { ...candidate, priceRange: value } : candidate,
                    ),
                  )
                }
              />
            </View>
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add another menu item"
          accessibilityHint="Adds another menu item row"
          onPress={() =>
            setMenuItemDrafts((current) => [
              ...current,
              { id: `menu-item-${current.length + 1}`, name: "", priceRange: "" },
            ])
          }
          style={{
            alignItems: "center",
            alignSelf: "center",
            backgroundColor: palette.orangeLight,
            borderRadius: radii.pill,
            height: 44,
            justifyContent: "center",
            width: 44,
          }}
        >
          <Plus color={palette.orange} size={22} />
        </Pressable>
        <Input
          label="Ordering or delivery link"
          placeholder="https://"
          value={deliveryLink}
          onChangeText={setDeliveryLink}
          autoCapitalize="none"
          keyboardType="url"
        />
      </Card>

      <Card style={{ gap: spacing[4], padding: spacing[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
          <Trophy color={palette.orange} size={20} />
          <AppText variant="h3">Scout achievements</AppText>
        </View>
        <View style={{ gap: spacing[2] }}>
          {achievements.map((achievement) => {
            const complete = achievement.progress >= achievement.target;
            return (
              <View
                key={achievement.id}
                style={{
                  alignItems: "center",
                  borderColor: complete ? palette.orange : palette.border,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: spacing[3],
                  padding: spacing[3],
                }}
              >
                {complete ? (
                  <CheckCircle2 color={palette.orange} size={20} />
                ) : (
                  <Store color={palette.textMuted} size={20} />
                )}
                <View style={{ flex: 1, gap: spacing[0.5] }}>
                  <AppText variant="bodySmallBold">{achievement.title}</AppText>
                  <AppText variant="micro" tone="muted">
                    {achievement.body}
                  </AppText>
                </View>
                <AppText variant="micro" tone={complete ? "accent" : "muted"}>
                  {achievement.progress}/{achievement.target}
                </AppText>
              </View>
            );
          })}
        </View>
      </Card>

      <Button
        label={isSubmitting ? "Submitting stall..." : "Submit stall"}
        loading={isSubmitting}
        onPress={submit}
        leftIcon={<Store color={palette.textOnOrange} size={18} />}
      />
      <BottomSheet
        ref={timePickerSheetRef}
        accessibilityLabel="Choose opening time"
        snapPoints={["52%"]}
        onDismiss={() => {
          if (shouldApplyTimePickerDraftOnDismissRef.current) {
            applyTimePickerDraft();
          }
          setActiveTimePicker(null);
          setTimePickerDraftDate(null);
          shouldApplyTimePickerDraftOnDismissRef.current = true;
        }}
      >
        <View style={{ gap: spacing[4], padding: spacing[4] }}>
          <View style={{ gap: spacing[1] }}>
            <AppText variant="h2">
              {activeTimePicker?.type === "end" ? "Closing time" : "Opening time"}
            </AppText>
            <AppText variant="bodySmall" tone="muted">
              Confirm your exact time and tap Done to save.
            </AppText>
          </View>
          {activeTimePicker ? (
            <>
              <View
                style={{
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: palette.border,
                  borderRadius: componentRadii.card,
                  backgroundColor: palette.bgSoft,
                  padding: spacing[3],
                  gap: spacing[1],
                }}
              >
                <AppText variant="micro" tone="muted">
                  {activeTimePicker.type === "start" ? "Opening time" : "Closing time"}
                </AppText>
                <AppText variant="h2">
                  {minutesToTimeLabel(
                    ((
                      timePickerDraftDate ??
                      parsePickerDateForSlot(activeTimePicker.slotId, activeTimePicker.type)
                    ).getHours() *
                      60 +
                      (
                        timePickerDraftDate ??
                        parsePickerDateForSlot(activeTimePicker.slotId, activeTimePicker.type)
                      ).getMinutes()) %
                      MINUTES_IN_DAY,
                  )}
                </AppText>
              </View>
              <DateTimePicker
                value={
                  timePickerDraftDate ??
                  parsePickerDateForSlot(activeTimePicker.slotId, activeTimePicker.type)
                }
                mode="time"
                display="spinner"
                is24Hour={false}
                onChange={applySelectedTime}
                style={{ alignSelf: "stretch" }}
              />
            </>
          ) : null}
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <Button
              label="Cancel"
              variant="secondary"
              fullWidth={false}
              style={{ flex: 1 }}
              onPress={() => {
                shouldApplyTimePickerDraftOnDismissRef.current = false;
                timePickerSheetRef.current?.dismiss();
              }}
            />
            <Button
              label="Done"
              fullWidth={false}
              style={{ flex: 1 }}
              onPress={applyIosTimeSelection}
            />
          </View>
        </View>
      </BottomSheet>
    </ProfileScreenShell>
  );
}
