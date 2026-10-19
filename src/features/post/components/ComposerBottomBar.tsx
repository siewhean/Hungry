import React, { useState } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ChevronUp, Send, Save, Check, Calendar, Clock } from "lucide-react-native";
import { AppText, Button, Card } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useComposerStore } from "../useComposerStore";
import { publishComposerPost } from "../publishing";

interface ComposerBottomBarProps {
  routeDishId?: string;
  routeVenueId?: string;
}

export function ComposerBottomBar({ routeDishId, routeVenueId }: ComposerBottomBarProps) {
  const { componentRadii, palette, spacing, semanticSpacing, shadows, radii } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const [showOptions, setShowOptions] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftScheduleTime, setDraftScheduleTime] = useState<Date>(new Date());
  const [draftDate, setDraftDate] = useState<Date>(new Date());
  const [draftHour, setDraftHour] = useState(12);
  const [draftMinute, setDraftMinute] = useState(0);
  const [publishMode, setPublishMode] = useState<"both" | "post" | "review">("both");
  const showInlineSchedulePickerHeader = Platform.OS === "ios" || Platform.OS === "web";

  const publishingState = useComposerStore((state) => state.publishingState);
  const setPublishingState = useComposerStore((state) => state.setPublishingState);
  const setPublishingError = useComposerStore((state) => state.setPublishingError);
  const setLastPublishRequest = useComposerStore((state) => state.setLastPublishRequest);
  const scheduledTime = useComposerStore((state) => state.scheduledTime);
  const setScheduledTime = useComposerStore((state) => state.setScheduledTime);
  const reset = useComposerStore((state) => state.reset);

  const handlePublish = async () => {
    const request = { publishMode, routeDishId, routeVenueId };
    setLastPublishRequest(request);
    setPublishingError(null);
    setPublishingState("posting");
    try {
      await publishComposerPost(request);
      setPublishingState("success");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while publishing your post. Please try again.";
      setPublishingError(errorMessage);
      setPublishingState("error");
    }
  };

  const handleSchedule = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowOptions(false);
    // Open on next tick to avoid the options-dismiss touch cycle swallowing picker visibility.
    const base = scheduledTime ?? new Date(Date.now() + 60 * 60 * 1000);
    setDraftScheduleTime(base);
    setDraftDate(base);
    setDraftHour(base.getHours());
    setDraftMinute(base.getMinutes() >= 30 ? 30 : 0);
    setTimeout(() => setShowDatePicker(true), 0);
  };

  const confirmIOSDate = () => {
    const now = new Date();
    const composed = new Date(draftDate);
    composed.setHours(draftHour, draftMinute, 0, 0);
    if (composed <= now) {
      composed.setDate(composed.getDate() + 1);
    }
    setDraftScheduleTime(composed);
    setScheduledTime(composed);
    setShowDatePicker(false);
    setPublishingState("scheduled");
  };

  const getLabel = () => {
    if (publishMode === "both") return "Publish Both";
    if (publishMode === "post") return "Post Only";
    return "Review Only";
  };

  const bottomPadding = Math.max(insets.bottom, semanticSpacing.screenEdge);
  const calendarBase = new Date();
  const currentMonth = calendarBase.getMonth();
  const currentYear = calendarBase.getFullYear();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const calendarDays = Array.from({ length: firstDayOfMonth + daysInMonth }, (_, index) => {
    const day = index - firstDayOfMonth + 1;
    if (day < 1) return null;
    const date = new Date(currentYear, currentMonth, day);
    if (date < new Date(new Date().setHours(0, 0, 0, 0))) return null;
    return date;
  });
  const hourOptions = [8, 10, 12, 14, 16, 18, 20, 22];
  const minuteOptions = [0, 30];

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {showOptions && (
        <Pressable
          accessibilityLabel="Dismiss publish options"
          accessibilityRole="button"
          onPress={() => {
            setShowOptions(false);
          }}
          style={[styles.overlay, { backgroundColor: "transparent" }]}
        />
      )}

      <View
        style={[
          styles.container,
          shadows.floating,
          {
            backgroundColor: palette.surface,
            borderTopColor: palette.border,
            paddingHorizontal: semanticSpacing.screenEdge,
            paddingTop: semanticSpacing.inlineGaps,
            paddingBottom: bottomPadding,
          },
        ]}
      >
        {showOptions && (
          <Card
            style={[
              styles.optionsPopup,
              {
                bottom: 56 + bottomPadding,
                backgroundColor: palette.surface,
                borderColor: palette.border,
                ...shadows.card,
                padding: semanticSpacing.componentGap,
              },
            ]}
          >
            {(["both", "post", "review"] as const).map((mode) => (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityLabel={
                  mode === "both"
                    ? "Select Post and Review publish mode"
                    : mode === "post"
                      ? "Select Post Only publish mode"
                      : "Select Review Only publish mode"
                }
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPublishMode(mode);
                  setShowOptions(false);
                }}
                style={styles.optionItem}
              >
                <AppText
                  variant="bodySmallBold"
                  style={{ color: publishMode === mode ? palette.orange : palette.text }}
                >
                  {mode === "both"
                    ? "Post & Review"
                    : mode === "post"
                      ? "Post Only"
                      : "Review Only"}
                </AppText>
                {publishMode === mode && <Check size={16} color={palette.orange} />}
              </Pressable>
            ))}

            <View
              style={{
                height: 1,
                backgroundColor: palette.border,
                marginVertical: semanticSpacing.textStack,
              }}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Schedule Post"
              onPress={handleSchedule}
              style={styles.optionItem}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: semanticSpacing.componentGap,
                }}
              >
                <Calendar size={18} color={palette.text} />
                <AppText variant="bodySmallBold">Schedule Post</AppText>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: semanticSpacing.textStack,
                }}
              >
                {scheduledTime && (
                  <AppText variant="micro" tone="accent">
                    {scheduledTime.toLocaleDateString([], { month: "short", day: "numeric" })}
                  </AppText>
                )}
                <Clock size={16} color={palette.textMuted} />
              </View>
            </Pressable>
          </Card>
        )}

        <View style={[styles.row, { gap: semanticSpacing.componentGap }]}>
          <View style={{ flex: 1 }}>
            <Button
              label="Save Draft"
              variant="secondary"
              size="sm"
              onPress={() => {
                setPublishingState("draft");
                setTimeout(() => setPublishingState("editing"), 3000);
              }}
              leftIcon={<Save size={18} color={palette.text} />}
            />
          </View>

          <View style={{ flex: 2, flexDirection: "row", gap: 0 }}>
            <Button
              label={getLabel()}
              onPress={handlePublish}
              size="sm"
              style={{
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
                flex: 1,
                minHeight: 40,
              }}
              leftIcon={<Send size={16} color={palette.textOnPrimary} />}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open publish options"
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowOptions(!showOptions);
              }}
              style={{
                backgroundColor: palette.orange,
                width: 40,
                height: 40,
                borderTopRightRadius: componentRadii.button,
                borderBottomRightRadius: componentRadii.button,
                alignItems: "center",
                justifyContent: "center",
                borderLeftWidth: 1,
                borderLeftColor: palette.inverseSurfaceSubtle,
              }}
            >
              <ChevronUp size={18} color={palette.white} />
            </Pressable>
          </View>
        </View>
      </View>

      {showDatePicker && (
        <View
          style={
            showInlineSchedulePickerHeader
              ? [
                  styles.iosPickerContainer,
                  {
                    backgroundColor: palette.surface,
                    paddingBottom: insets.bottom,
                    shadowColor: palette.mediaBackdrop,
                  },
                ]
              : null
          }
        >
          {showInlineSchedulePickerHeader && (
            <View style={[styles.iosPickerHeader, { borderBottomColor: palette.border }]}>
              <Button
                label="Cancel"
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => setShowDatePicker(false)}
              />
              <AppText variant="bodyBold">Schedule</AppText>
              <Button
                label="Confirm"
                variant="primary"
                size="sm"
                fullWidth={false}
                onPress={confirmIOSDate}
              />
            </View>
          )}
          <View style={{ padding: 12, minHeight: 280, gap: 12 }}>
            <AppText variant="bodySmallBold">Choose day</AppText>
            <View style={{ gap: 8 }}>
              <AppText variant="micro" tone="secondary">
                {calendarBase.toLocaleDateString([], { month: "long", year: "numeric" })}
              </AppText>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <AppText
                    key={d}
                    variant="micro"
                    tone="muted"
                    style={{ width: 32, textAlign: "center" }}
                  >
                    {d}
                  </AppText>
                ))}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {calendarDays.map((date, idx) => {
                  if (!date) {
                    return <View key={`empty-${idx}`} style={{ width: 32, height: 32 }} />;
                  }
                  const isSelected =
                    date.getDate() === draftDate.getDate() &&
                    date.getMonth() === draftDate.getMonth() &&
                    date.getFullYear() === draftDate.getFullYear();
                  return (
                    <Pressable
                      key={date.toISOString()}
                      accessibilityRole="button"
                      accessibilityLabel={`Choose ${date.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}`}
                      onPress={() => setDraftDate(date)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: componentRadii.iconButton,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isSelected ? palette.orange : palette.bgSoft,
                      }}
                    >
                      <AppText
                        variant="micro"
                        style={{ color: isSelected ? palette.white : palette.text }}
                      >
                        {date.getDate()}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <AppText variant="bodySmallBold" style={{ marginTop: 8 }}>
              Choose time
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {hourOptions.map((hour) => (
                <Pressable
                  key={hour}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${String(hour).padStart(2, "0")} hour`}
                  onPress={() => setDraftHour(hour)}
                  style={{
                    width: 56,
                    alignItems: "center",
                    paddingVertical: 8,
                    borderRadius: componentRadii.card,
                    backgroundColor: draftHour === hour ? palette.orangeLight : palette.bgSoft,
                    borderWidth: 1,
                    borderColor: draftHour === hour ? palette.orange : palette.border,
                  }}
                >
                  <AppText
                    variant="micro"
                    style={{ color: draftHour === hour ? palette.orange : palette.text }}
                  >
                    {String(hour).padStart(2, "0")}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {minuteOptions.map((minute) => (
                <Pressable
                  key={minute}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${String(minute).padStart(2, "0")} minutes`}
                  onPress={() => setDraftMinute(minute)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: componentRadii.card,
                    backgroundColor: draftMinute === minute ? palette.orangeLight : palette.bgSoft,
                    borderWidth: 1,
                    borderColor: draftMinute === minute ? palette.orange : palette.border,
                  }}
                >
                  <AppText
                    variant="micro"
                    style={{ color: draftMinute === minute ? palette.orange : palette.text }}
                  >
                    :{String(minute).padStart(2, "0")}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
  },
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionsPopup: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 101,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  iosPickerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  iosPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
});
