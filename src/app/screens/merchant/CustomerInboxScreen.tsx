import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  ScrollView,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
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
  Chip,
  Screen,
  Avatar,
  Skeleton,
  EmptyState,
} from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { CustomerInteraction, InteractionType } from "@/types/domain";

export function CustomerInboxScreen() {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [interactions, setInteractions] = useState<CustomerInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<InteractionType | "all" | "unreplied">("all");
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

  const handleViewOriginal = useCallback((interaction: CustomerInteraction) => {
    if (!interaction.sourceId) {
      Alert.alert("Original unavailable", "This interaction is not linked to a source post.");
      return;
    }
    Alert.alert("Original source", `Source ID: ${interaction.sourceId}`);
  }, []);

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2], paddingHorizontal: spacing[1] }}
        >
          <Chip label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
          <Chip
            label="Unreplied"
            selected={filter === "unreplied"}
            onPress={() => setFilter("unreplied")}
          />
          <Chip
            label="Reviews"
            selected={filter === "review"}
            onPress={() => setFilter("review")}
          />
          <Chip
            label="Comments"
            selected={filter === "comment"}
            onPress={() => setFilter("comment")}
          />
          <Chip
            label="Mentions"
            selected={filter === "post_mention"}
            onPress={() => setFilter("post_mention")}
          />
        </ScrollView>

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
                No {filter !== "all" ? filter : ""} interactions to show.
              </AppText>
            </View>
          ) : (
            interactions.map((item) => (
              <InteractionCard
                key={item.id}
                interaction={item}
                onReply={setReplyingTo}
                onViewOriginal={handleViewOriginal}
                onReport={handleReportInteraction}
              />
            ))
          )}
        </View>
      </View>

      {/* Reply Composer Modal (Simulated) */}
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
  onViewOriginal,
  onReport,
}: {
  interaction: CustomerInteraction;
  onReply: (item: CustomerInteraction) => void;
  onViewOriginal: (item: CustomerInteraction) => void;
  onReport: (item: CustomerInteraction) => void;
}) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();

  const typeLabel = interaction.type.charAt(0).toUpperCase() + interaction.type.slice(1);
  const showMoreActions = () => {
    Alert.alert("Interaction Actions", interaction.authorName, [
      ...(interaction.sourceId
        ? [{ text: "View original", onPress: () => onViewOriginal(interaction) }]
        : []),
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

      {interaction.rating && (
        <View style={{ flexDirection: "row", marginBottom: spacing[2], gap: 2 }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              size={14}
              color={s <= interaction.rating! ? palette.amber : palette.border}
              fill={s <= interaction.rating! ? palette.amber : "transparent"}
            />
          ))}
        </View>
      )}

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
          {interaction.sourceId ? (
            <Button
              label="View original"
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => onViewOriginal(interaction)}
            />
          ) : null}
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
      onSent();
    } catch (e) {
      Alert.alert("Error", "Failed to send reply.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
      ]}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View
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
                AI Suggestion
              </AppText>
            </View>
            <AppText variant="bodySmall" numberOfLines={2}>
              {suggestion}
            </AppText>
          </Pressable>
        )}

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: palette.bgSoft,
              borderRadius: componentRadii.input,
              color: palette.text,
              borderColor: palette.border,
              padding: spacing[4],
            },
          ]}
          placeholder="Type your message..."
          placeholderTextColor={palette.textMuted}
          multiline
          value={text}
          onChangeText={setText}
          autoFocus
        />

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
    </View>
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
  input: {
    height: 120,
    borderWidth: 1,
    textAlignVertical: "top",
    fontSize: 16,
  },
  aiChip: {
    borderWidth: 1,
  },
});
