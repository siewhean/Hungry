import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { View, StyleSheet, Pressable, KeyboardAvoidingView, Modal, Platform } from "react-native";
import { MessageSquare, Star, Send, MoreVertical, CheckCircle2, X } from "lucide-react-native";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";

import {
  AppText,
  Button,
  IconButton,
  FilterChipRail,
  Input,
  Screen,
  Avatar,
  Skeleton,
  EmptyState,
} from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import { reportError } from "@/lib/monitoring/reportError";
import type { MerchantTabParamList } from "@/app/navigation/navigationTypes";
import { MERCHANT_REPLY_MAX_LENGTH } from "@/features/merchant/merchantReadiness";
import { trackMerchantEvent } from "@/features/merchant/merchantTracking";
import { useMerchantDialog, type ShowMerchantAlert } from "@/features/merchant/useMerchantDialog";
import type { CustomerInteraction, InteractionType } from "@/types/domain";

type InboxFilter = InteractionType | "all" | "unreplied";

/** Reviews loaded per page; "Load more" fetches the next older page. */
const INBOX_PAGE_SIZE = 30;

// The inbox is fed by reviews only; comments and mentions are not collected yet.
const INBOX_FILTER_OPTIONS: { id: InboxFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unreplied", label: "Unreplied" },
  { id: "review", label: "Reviews" },
];

const INBOX_EMPTY_LABELS: Record<InboxFilter, string> = {
  all: "No customer reviews to show yet.",
  unreplied: "No unreplied reviews.",
  review: "No reviews to show yet.",
  comment: "No comments to show.",
  post_mention: "No mentions to show.",
  question: "No questions to show.",
};

const REPORT_REASONS = [
  "Spam or fake review",
  "Abusive or hateful language",
  "Contains personal information",
  "Not about this stall",
];

export function CustomerInboxScreen() {
  const { palette, radii, spacing } = useHungryTheme();
  const activeOutlet = useMerchantStore(getActiveOutlet);
  const activeOutletId = activeOutlet?.id;
  const { showAlert, dialog } = useMerchantDialog();
  const route = useRoute<RouteProp<MerchantTabParamList, "CustomerInbox">>();
  const requestedFilter = route.params?.filter;
  const replyToId = route.params?.replyToId;

  const [interactions, setInteractions] = useState<CustomerInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<InboxFilter>(requestedFilter ?? "all");
  const [replyingTo, setReplyingTo] = useState<CustomerInteraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Only the newest load may write the list: switching filters quickly must not mix pages.
  const latestLoadId = useRef(0);
  // "Unreplied" asks the server for unreplied reviews. Filtering one loaded page could say
  // "All caught up" while older reviews still wait for a reply.
  const unrepliedOnly = filter === "unreplied";

  // A Dashboard link can ask for a filter while the screen is already open.
  useEffect(() => {
    if (requestedFilter) setFilter(requestedFilter);
  }, [requestedFilter]);

  const fetchInteractions = useCallback(async () => {
    const loadId = latestLoadId.current + 1;
    latestLoadId.current = loadId;
    if (!activeOutletId) {
      setInteractions([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await getHungryService().merchant.getInbox(activeOutletId, {
        type: "review",
        limit: INBOX_PAGE_SIZE,
        unrepliedOnly,
      });
      if (loadId !== latestLoadId.current) return;
      setInteractions(data);
      setHasMore(data.length >= INBOX_PAGE_SIZE);
    } catch (e) {
      if (loadId !== latestLoadId.current) return;
      reportError(e, { screen: "CustomerInbox", action: "load_inbox" });
      setError(e instanceof Error ? e.message : "Unable to load customer interactions.");
    } finally {
      if (loadId === latestLoadId.current) setIsLoading(false);
    }
  }, [activeOutletId, unrepliedOnly]);

  useEffect(() => {
    void fetchInteractions();
  }, [fetchInteractions]);

  useFocusEffect(
    useCallback(() => {
      trackMerchantEvent("merchant_customer_inbox_viewed", activeOutletId, { filter });
    }, [activeOutletId, filter]),
  );

  // Opened from a Dashboard review card: start the reply to that review once it has loaded.
  const openedReplyFor = useRef<string | null>(null);
  useEffect(() => {
    if (!replyToId || openedReplyFor.current === replyToId) return;
    const target = interactions.find((item) => item.id === replyToId);
    if (!target) return;
    openedReplyFor.current = replyToId;
    setReplyingTo(target);
  }, [interactions, replyToId]);

  const loadMore = async () => {
    const oldest = interactions[interactions.length - 1];
    if (!activeOutletId || !oldest || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const data = await getHungryService().merchant.getInbox(activeOutletId, {
        type: "review",
        limit: INBOX_PAGE_SIZE,
        unrepliedOnly,
        before: oldest.createdAt,
        beforeId: oldest.id,
      });
      setInteractions((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...data.filter((item) => !known.has(item.id))];
      });
      setHasMore(data.length >= INBOX_PAGE_SIZE);
    } catch (e) {
      reportError(e, { screen: "CustomerInbox", action: "load_more" });
      showAlert("Could not load more", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const reportWithReason = useCallback(
    async (interaction: CustomerInteraction, reason: string) => {
      try {
        await getHungryService().merchant.reportInteraction(interaction.id, reason);
        trackMerchantEvent(
          "merchant_customer_interaction_reported",
          useMerchantStore.getState().activeOutletId ?? undefined,
        );
        showAlert("Reported", "Interaction sent for moderation review.");
      } catch (e) {
        reportError(e, { screen: "CustomerInbox", action: "report_interaction" });
        showAlert("Error", "Failed to report interaction.");
      }
    },
    [showAlert],
  );

  const handleReportInteraction = useCallback(
    (interaction: CustomerInteraction) => {
      showAlert("Why are you reporting this?", "Moderators review every report.", [
        ...REPORT_REASONS.map((reason) => ({
          text: reason,
          onPress: () => void reportWithReason(interaction, reason),
        })),
        { text: "Cancel", style: "cancel" as const },
      ]);
    },
    [reportWithReason, showAlert],
  );

  const handleRemoveReply = useCallback(
    (interaction: CustomerInteraction) => {
      showAlert("Remove your reply?", "Diners will no longer see it under this review.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove reply",
          style: "destructive",
          onPress: async () => {
            try {
              await getHungryService().merchant.removeInteractionReply(interaction.id);
              trackMerchantEvent(
                "merchant_customer_reply_removed",
                useMerchantStore.getState().activeOutletId ?? undefined,
              );
              // Patch in place: a refetch would drop every older page the merchant loaded.
              setInteractions((current) =>
                current.map((item) =>
                  item.id === interaction.id ? { ...item, reply: undefined } : item,
                ),
              );
            } catch (e) {
              reportError(e, { screen: "CustomerInbox", action: "remove_reply" });
              showAlert("Error", "Failed to remove the reply.");
            }
          },
        },
      ]);
    },
    [showAlert],
  );

  const handleReplySent = useCallback((interactionId: string, text: string) => {
    setReplyingTo(null);
    // Patch in place, keeping the scroll position and every page already loaded.
    setInteractions((current) =>
      current.map((item) =>
        item.id === interactionId
          ? { ...item, reply: { text: text.trim(), repliedAt: new Date().toISOString() } }
          : item,
      ),
    );
  }, []);

  const visibleInteractions = useMemo(
    () => (unrepliedOnly ? interactions.filter((item) => !item.reply) : interactions),
    [unrepliedOnly, interactions],
  );

  return (
    <Screen title="Customer inbox">
      <View style={{ gap: spacing[4], width: "100%" }}>
        {/* Filters */}
        <FilterChipRail
          options={INBOX_FILTER_OPTIONS}
          selectedId={filter}
          onSelect={setFilter}
          gap={spacing[2]}
        />

        {/* Sentiment summary of the reviews loaded. The Unreplied list is not all reviews. */}
        {unrepliedOnly ? null : <SentimentSummary interactions={interactions} hasMore={hasMore} />}

        {/* Interaction List */}
        <View style={{ gap: spacing[3], paddingBottom: 100 }}>
          {isLoading && interactions.length === 0 ? (
            <View style={{ gap: spacing[3], marginTop: spacing[4] }}>
              <Skeleton height={150} borderRadius={radii.md} />
              <Skeleton height={150} borderRadius={radii.md} />
              <Skeleton height={150} borderRadius={radii.md} />
            </View>
          ) : error ? (
            <EmptyState
              title="Failed to load inbox"
              body="There was a problem loading your customer interactions."
              icon={<X size={48} color={palette.error} />}
              errorMessage={error}
              sendErrorContext="Customer inbox"
              ctaLabel="Retry"
              onPress={fetchInteractions}
            />
          ) : visibleInteractions.length === 0 ? (
            <View style={[styles.emptyContainer, { padding: 60 }]}>
              <CheckCircle2 size={48} color={palette.success} />
              <AppText variant="bodyBold" style={{ marginTop: spacing[3] }}>
                All caught up!
              </AppText>
              <AppText variant="bodySmall" tone="muted">
                {INBOX_EMPTY_LABELS[filter]}
              </AppText>
            </View>
          ) : (
            visibleInteractions.map((item) => (
              <InteractionCard
                key={item.id}
                interaction={item}
                onReply={setReplyingTo}
                onRemoveReply={handleRemoveReply}
                onReport={handleReportInteraction}
                showAlert={showAlert}
              />
            ))
          )}
          {hasMore && !error && interactions.length > 0 ? (
            <Button
              label={isLoadingMore ? "Loading..." : "Load older reviews"}
              variant="secondary"
              loading={isLoadingMore}
              disabled={isLoadingMore}
              onPress={() => void loadMore()}
            />
          ) : null}
        </View>
      </View>

      {/* Reply composer */}
      {replyingTo && (
        <ReplyComposer
          interaction={replyingTo}
          onClose={() => setReplyingTo(null)}
          onSent={(text) => handleReplySent(replyingTo.id, text)}
        />
      )}
      {dialog}
    </Screen>
  );
}

function SentimentSummary({
  interactions,
  hasMore,
}: {
  interactions: CustomerInteraction[];
  hasMore: boolean;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();

  const stats = useMemo(() => {
    if (interactions.length === 0) return null;
    const total = interactions.length;
    const positive = interactions.filter((i) => (i.rating || 0) >= 4).length;
    const negative = interactions.filter((i) => (i.rating || 0) > 0 && (i.rating || 0) <= 2).length;
    const neutral = total - positive - negative;
    return {
      total,
      positive: Math.round((positive / total) * 100),
      negative: Math.round((negative / total) * 100),
      neutral: Math.round((neutral / total) * 100),
    };
  }, [interactions]);

  if (!stats) return null;

  return (
    <View
      style={[
        styles.summaryCard,
        {
          backgroundColor: palette.surface,
          borderRadius: componentRadii.card,
          padding: spacing[4],
          borderColor: palette.border,
          borderWidth: 1,
        },
      ]}
    >
      <AppText variant="bodyBold">Sentiment summary</AppText>
      <AppText variant="micro" tone="muted">
        {hasMore
          ? `Your ${stats.total} most recent reviews`
          : `All ${stats.total} ${stats.total === 1 ? "review" : "reviews"}`}
      </AppText>
      <View
        style={{
          flexDirection: "row",
          height: 8,
          borderRadius: 4,
          overflow: "hidden",
          marginTop: spacing[3],
          marginBottom: spacing[2],
        }}
      >
        <View style={{ flex: stats.positive, backgroundColor: palette.success }} />
        <View style={{ flex: stats.neutral, backgroundColor: palette.border }} />
        <View style={{ flex: stats.negative, backgroundColor: palette.error }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.success }}
          />
          <AppText variant="micro" tone="muted">
            {stats.positive}% Positive
          </AppText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.border }} />
          <AppText variant="micro" tone="muted">
            {stats.neutral}% Neutral
          </AppText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.error }} />
          <AppText variant="micro" tone="muted">
            {stats.negative}% Negative
          </AppText>
        </View>
      </View>
    </View>
  );
}

function InteractionCard({
  interaction,
  onReply,
  onRemoveReply,
  onReport,
  showAlert,
}: {
  interaction: CustomerInteraction;
  onReply: (item: CustomerInteraction) => void;
  onRemoveReply: (item: CustomerInteraction) => void;
  onReport: (item: CustomerInteraction) => void;
  showAlert: ShowMerchantAlert;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();

  const typeLabel = interaction.type.charAt(0).toUpperCase() + interaction.type.slice(1);
  const showMoreActions = () => {
    showAlert("Review actions", interaction.authorName, [
      { text: "Report", style: "destructive" as const, onPress: () => onReport(interaction) },
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  return (
    <View
      style={[
        styles.interactionCard,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          padding: spacing[4],
        },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: spacing[3],
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
          <Avatar size={32} uri={interaction.authorAvatarUrl} name={interaction.authorName} />
          <View>
            <AppText variant="bodyBold">{interaction.authorName}</AppText>
            <AppText variant="micro" tone="muted">
              {new Date(interaction.createdAt).toLocaleDateString()} • {typeLabel}
            </AppText>
          </View>
        </View>
        <IconButton
          accessibilityLabel="More actions"
          icon={<MoreVertical size={18} color={palette.textSecondary} />}
          onPress={showMoreActions}
        />
      </View>

      {interaction.dishName ? (
        <AppText variant="bodySmallBold" tone="muted" style={{ marginBottom: spacing[1] }}>
          About: {interaction.dishName}
        </AppText>
      ) : null}

      {typeof interaction.rating === "number" && interaction.rating > 0 ? (
        <View
          accessible
          accessibilityLabel={`Rated ${interaction.rating} out of 5`}
          style={{ flexDirection: "row", marginBottom: spacing[2], gap: 2 }}
        >
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              size={14}
              color={s <= interaction.rating! ? palette.starStroke : palette.border}
              fill={s <= interaction.rating! ? palette.starFill : "transparent"}
            />
          ))}
        </View>
      ) : null}

      <AppText variant="body" style={{ marginBottom: spacing[3] }}>
        {interaction.text}
      </AppText>

      {interaction.reply ? (
        <View
          style={[
            styles.replyBox,
            {
              backgroundColor: palette.bgSoft,
              borderRadius: componentRadii.card,
              padding: spacing[3],
              marginTop: spacing[2],
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <CheckCircle2 size={14} color={palette.success} />
            <AppText variant="bodySmallBold" style={{ color: palette.success }}>
              Your reply
            </AppText>
            <AppText variant="micro" tone="muted">
              {" "}
              • {new Date(interaction.reply.repliedAt).toLocaleDateString()}
            </AppText>
          </View>
          <AppText variant="bodySmall">{interaction.reply.text}</AppText>
          <View style={{ flexDirection: "row", gap: spacing[2], marginTop: spacing[3] }}>
            <Button
              label="Edit reply"
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => onReply(interaction)}
            />
            <Button
              label="Remove reply"
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => onRemoveReply(interaction)}
            />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          <Button
            label="Reply"
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => onReply(interaction)}
            leftIcon={<MessageSquare size={16} color={palette.orangeText} />}
          />
        </View>
      )}
    </View>
  );
}

function ReplyComposer({
  interaction,
  onClose,
  onSent,
}: {
  interaction: CustomerInteraction;
  onClose: () => void;
  onSent: (text: string) => void;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  // Editing starts from the current reply.
  const initialText = interaction.reply?.text ?? "";
  const [text, setText] = useState(initialText);
  const [isSending, setIsSending] = useState(false);
  // Its own dialog: the composer is a Modal, and a dialog from the screen would sit behind it.
  const { showAlert, dialog } = useMerchantDialog();

  // A tap on the backdrop or the Android back button must not throw away a typed reply.
  const requestClose = () => {
    if (isSending) return;
    if (!text.trim() || text === initialText) {
      onClose();
      return;
    }
    showAlert("Discard your reply?", "What you typed will be lost.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: onClose },
    ]);
  };

  const handleSend = async () => {
    if (!text.trim() || isSending) return;
    setIsSending(true);
    try {
      await getHungryService().merchant.replyToInteraction(interaction.id, text);
      trackMerchantEvent(
        "merchant_customer_reply_sent",
        useMerchantStore.getState().activeOutletId ?? undefined,
        { interaction_type: interaction.type },
      );
      onSent(text);
    } catch (e) {
      reportError(e, { screen: "CustomerInbox", action: "send_reply" });
      showAlert("Error", e instanceof Error ? e.message : "Failed to send reply.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={requestClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.composerBackdrop, { backgroundColor: palette.mediaScrim }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessibilityRole="button"
          accessibilityLabel="Close reply composer"
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.composer,
            {
              backgroundColor: palette.surface,
              borderTopLeftRadius: componentRadii.card,
              borderTopRightRadius: componentRadii.card,
              padding: spacing[5],
              paddingBottom: 40,
            },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing[4],
            }}
          >
            <AppText variant="h3" style={{ fontWeight: "bold" }}>
              {interaction.reply ? "Edit your reply" : `Reply to ${interaction.authorName}`}
            </AppText>
            <IconButton
              accessibilityLabel="Close reply composer"
              icon={<X size={24} color={palette.text} />}
              onPress={requestClose}
            />
          </View>

          <Input
            accessibilityLabel="Your public reply"
            placeholder="Type your reply..."
            multiline
            value={text}
            onChangeText={setText}
            maxLength={MERCHANT_REPLY_MAX_LENGTH}
            autoFocus
            style={{ minHeight: 120, textAlignVertical: "top" }}
          />

          <AppText
            variant="micro"
            tone="muted"
            accessibilityLiveRegion="polite"
            style={{ marginTop: spacing[2] }}
          >
            Your reply is public. Diners see it under this review. {text.length}/
            {MERCHANT_REPLY_MAX_LENGTH}
          </AppText>

          <Button
            label={isSending ? "Sending..." : interaction.reply ? "Save reply" : "Send reply"}
            variant="primary"
            fullWidth
            disabled={!text.trim() || isSending}
            onPress={handleSend}
            style={{ marginTop: spacing[4] }}
            rightIcon={<Send size={18} color={palette.white} />}
          />
        </View>
      </KeyboardAvoidingView>
      {dialog}
    </Modal>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {},
  interactionCard: {
    borderWidth: 1,
  },
  replyBox: {},
  composer: {},
  composerBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
});
