import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
} from "react-native";
import {
  MessageSquare,
  Star,
  Send,
  MoreVertical,
  CheckCircle2,
  Sparkles,
  X,
} from "lucide-react-native";

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
import { trackMerchantEvent } from "@/features/merchant/merchantTracking";
import type { CustomerInteraction, InteractionType } from "@/types/domain";

type InboxFilter = InteractionType | "all" | "unreplied";

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

export function CustomerInboxScreen() {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [interactions, setInteractions] = useState<CustomerInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
        type: filter === "all" || filter === "unreplied" ? undefined : filter,
        unrepliedOnly: filter === "unreplied",
      });
      setInteractions(data);
    } catch (e) {
      console.error("Failed to fetch interactions", e);
      setError(e instanceof Error ? e.message : "Unable to load customer interactions.");
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet, filter]);

  useEffect(() => {
    void fetchInteractions();
  }, [fetchInteractions]);

  const handleReportInteraction = useCallback((interaction: CustomerInteraction) => {
    Alert.alert("Report Interaction", "Flag this interaction for moderation review?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        style: "destructive",
        onPress: async () => {
          try {
            await getHungryService().merchant.reportInteraction(
              interaction.id,
              "Merchant reported from customer inbox",
            );
            Alert.alert("Reported", "Interaction sent for moderation review.");
          } catch (e) {
            Alert.alert("Error", "Failed to report interaction.");
          }
        },
      },
    ]);
  }, []);

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

        {/* Sentiment Summary */}
        <SentimentSummary interactions={interactions} />

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
          ) : interactions.length === 0 ? (
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
            interactions.map((item) => (
              <InteractionCard
                key={item.id}
                interaction={item}
                onReply={setReplyingTo}
                onReport={handleReportInteraction}
              />
            ))
          )}
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
    </Screen>
  );
}

function SentimentSummary({ interactions }: { interactions: CustomerInteraction[] }) {
  const { componentRadii, palette, spacing } = useHungryTheme();

  const stats = useMemo(() => {
    if (interactions.length === 0) return null;
    const total = interactions.length;
    const positive = interactions.filter((i) => (i.rating || 0) >= 4).length;
    const negative = interactions.filter((i) => (i.rating || 0) > 0 && (i.rating || 0) <= 2).length;
    const neutral = total - positive - negative;
    return {
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
  onReport,
}: {
  interaction: CustomerInteraction;
  onReply: (item: CustomerInteraction) => void;
  onReport: (item: CustomerInteraction) => void;
}) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();

  const typeLabel = interaction.type.charAt(0).toUpperCase() + interaction.type.slice(1);
  const showMoreActions = () => {
    Alert.alert("Interaction Actions", interaction.authorName, [
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
              color={s <= interaction.rating! ? palette.amber : palette.border}
              fill={s <= interaction.rating! ? palette.amber : "transparent"}
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
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          <Button
            label="Reply"
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => onReply(interaction)}
            leftIcon={<MessageSquare size={16} color={palette.orange} />}
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
  const { componentRadii, palette, spacing, radii } = useHungryTheme();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  useEffect(() => {
    async function loadSuggestion() {
      try {
        const res = await getHungryService().merchant.generateAIReply(interaction.id);
        setSuggestion(res);
      } catch (e) {}
    }
    void loadSuggestion();
  }, [interaction.id]);

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
      Alert.alert("Error", "Failed to send reply.");
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
              Reply to {interaction.authorName}
            </AppText>
            <IconButton
              accessibilityLabel="Close reply composer"
              icon={<X size={24} color={palette.text} />}
              onPress={onClose}
            />
          </View>

          {suggestion && (
            <Pressable
              onPress={() => setText(suggestion)}
              style={[
                styles.aiChip,
                {
                  backgroundColor: palette.orangeLight,
                  borderColor: palette.orange,
                  borderRadius: componentRadii.card,
                  padding: spacing[3],
                  marginBottom: spacing[4],
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Sparkles size={14} color={palette.orange} />
                <AppText variant="bodySmallBold" style={{ color: palette.orange }}>
                  Suggested reply
                </AppText>
              </View>
              <AppText variant="bodySmall" numberOfLines={2}>
                {suggestion}
              </AppText>
            </Pressable>
          )}

          <Input
            placeholder="Type your message..."
            multiline
            value={text}
            onChangeText={setText}
            autoFocus
            style={{ minHeight: 120, textAlignVertical: "top" }}
          />

          <AppText variant="micro" tone="muted" style={{ marginTop: spacing[2] }}>
            Your reply is public. Diners see it under this review.
          </AppText>

          <Button
            label={isSending ? "Sending..." : "Send Reply"}
            variant="primary"
            fullWidth
            disabled={!text.trim() || isSending}
            onPress={handleSend}
            style={{ marginTop: spacing[4] }}
            rightIcon={<Send size={18} color={palette.white} />}
          />
        </View>
      </KeyboardAvoidingView>
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
  aiChip: {
    borderWidth: 1,
  },
});
