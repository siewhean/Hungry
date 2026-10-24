import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, Pressable, KeyboardAvoidingView, Modal, Platform } from "react-native";
import { MessageSquare, Star, Send, MoreVertical, CheckCircle2, X } from "lucide-react-native";

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
  const { showAlert, dialog } = useMerchantDialog();

  const [interactions, setInteractions] = useState<CustomerInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [replyingTo, setReplyingTo] = useState<CustomerInteraction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInteractions = useCallback(async () => {
    if (!activeOutlet) {
      setInteractions([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await getHungryService().merchant.getInbox(activeOutlet.id, {
        type: "review",
        limit: INBOX_PAGE_SIZE,
      });
      setInteractions(data);
      setHasMore(data.length >= INBOX_PAGE_SIZE);
    } catch (e) {
      console.error("Failed to fetch interactions", e);
      setError(e instanceof Error ? e.message : "Unable to load customer interactions.");
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet]);

  useEffect(() => {
    void fetchInteractions();
  }, [fetchInteractions]);

  const loadMore = async () => {
    const oldest = interactions[interactions.length - 1];
    if (!activeOutlet || !oldest || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const data = await getHungryService().merchant.getInbox(activeOutlet.id, {
        type: "review",
        limit: INBOX_PAGE_SIZE,
        before: oldest.createdAt,
      });
      setInteractions((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...data.filter((item) => !known.has(item.id))];
      });
      setHasMore(data.length >= INBOX_PAGE_SIZE);
    } catch (e) {
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
      } catch {
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
              void fetchInteractions();
            } catch {
              showAlert("Error", "Failed to remove the reply.");
            }
          },
        },
      ]);
    },
    [fetchInteractions, showAlert],
  );

  const visibleInteractions = useMemo(
    () => (filter === "unreplied" ? interactions.filter((item) => !item.reply) : interactions),
    [filter, interactions],
  );

  return (
    <Screen title="Customer Inbox">
      <View style={{ gap: spacing[4], width: "100%" }}>
        {/* Filters */}
        <FilterChipRail
          options={INBOX_FILTER_OPTIONS}
          selectedId={filter}
          onSelect={setFilter}
          gap={spacing[2]}
        />

        {/* Sentiment Summary: all the reviews loaded, whatever the filter shows. */}
        <SentimentSummary interactions={interactions} hasMore={hasMore} />

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
          onSent={() => {
            setReplyingTo(null);
            void fetchInteractions();
          }}
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
      <AppText variant="bodyBold">Sentiment Summary</AppText>
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
    showAlert("Interaction Actions", interaction.authorName, [
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
              Your Reply
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
  onSent: () => void;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  // Editing starts from the current reply.
  const [text, setText] = useState(interaction.reply?.text ?? "");
  const [isSending, setIsSending] = useState(false);
  // Its own dialog: the composer is a Modal, and a dialog from the screen would sit behind it.
  const { showAlert, dialog } = useMerchantDialog();

  const handleSend = async () => {
    if (!text.trim()) return;
    setIsSending(true);
    try {
      await getHungryService().merchant.replyToInteraction(interaction.id, text);
      trackMerchantEvent(
        "merchant_customer_reply_sent",
        useMerchantStore.getState().activeOutletId ?? undefined,
        { interaction_type: interaction.type },
      );
      onSent();
    } catch (e) {
      showAlert("Error", e instanceof Error ? e.message : "Failed to send reply.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.composerBackdrop, { backgroundColor: palette.mediaScrim }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
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
              onPress={onClose}
            />
          </View>

          <Input
            placeholder="Type your message..."
            multiline
            value={text}
            onChangeText={setText}
            maxLength={MERCHANT_REPLY_MAX_LENGTH}
            autoFocus
            style={{ minHeight: 120, textAlignVertical: "top" }}
          />

          <AppText variant="micro" tone="muted" style={{ marginTop: spacing[2] }}>
            Your reply is public. Diners see it under this review. {text.length}/
            {MERCHANT_REPLY_MAX_LENGTH}
          </AppText>

          <Button
            label={isSending ? "Sending..." : interaction.reply ? "Save Reply" : "Send Reply"}
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
