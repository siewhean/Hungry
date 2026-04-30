/**
 * CustomerInboxScreen
 * Central hub for merchant-customer interactions.
 * Allows reading and replying to reviews, comments, and mentions.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MessageSquare,
  Star,
  ChevronLeft,
  Send,
  Sparkles,
  CheckCircle2,
  MoreVertical,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Button, Avatar, Badge, Chip, Screen, IconButton } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useMerchantStore, getActiveOutlet } from "@/store/useMerchantStore";
import { hungryService } from "@/lib/services/mock/mockService";
import type { CustomerInteraction, InteractionType } from "@/types/domain";

// ─── Sentiment Summary Card ──────────────────────────────────────────────────

function SentimentSummary({ interactions }: { interactions: CustomerInteraction[] }) {
  const { palette, spacing, radii } = useHungryTheme();

  const stats = useMemo(() => {
    const total = interactions.length;
    if (total === 0) return null;

    const positive = interactions.filter((i) => i.sentiment === "positive").length;
    const negative = interactions.filter((i) => i.sentiment === "negative").length;
    const neutral = interactions.filter((i) => i.sentiment === "neutral").length;

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
          borderRadius: radii.xl,
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

// ─── Interaction Card ────────────────────────────────────────────────────────

interface InteractionCardProps {
  interaction: CustomerInteraction;
  onReply: (interaction: CustomerInteraction) => void;
}

function InteractionCard({ interaction, onReply }: InteractionCardProps) {
  const { palette, spacing, radii } = useHungryTheme();

  const typeLabel = useMemo(() => {
    switch (interaction.type) {
      case "review":
        return "Review";
      case "comment":
        return "Comment";
      case "post_mention":
        return "Mention";
      case "question":
        return "Question";
      default:
        return "Interaction";
    }
  }, [interaction.type]);

  const handleReport = () => {
    Alert.alert(
      "Report Interaction",
      "Are you sure you want to report this interaction as abusive or spam?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          onPress: async () => {
            try {
              await hungryService.merchant.reportInteraction(interaction.id, "abusive");
              Alert.alert("Reported", "Thank you for reporting. Our team will review this.");
            } catch (e) {
              Alert.alert("Error", "Failed to report interaction.");
            }
          },
        },
      ],
    );
  };

  return (
    <View
      style={[
        styles.interactionCard,
        {
          backgroundColor: palette.surface,
          borderRadius: radii.lg,
          padding: spacing[4],
          borderColor: palette.border,
          borderWidth: 1,
        },
      ]}
    >
      <View
        style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing[2] }}
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
          icon={<MoreVertical size={18} color={palette.textSecondary} />}
          accessibilityLabel="More actions"
          onPress={() => {
            Alert.alert("Actions", undefined, [
              { text: "Report Abusive", onPress: handleReport, style: "destructive" },
              { text: "Cancel", style: "cancel" },
            ]);
          }}
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

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing[3],
        }}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1] }}>
          {interaction.tags &&
            interaction.tags.map((tag) => <Badge key={tag} label={tag} tone="neutral" />)}
        </View>

        {interaction.sourceId && (
          <Pressable onPress={() => {}}>
            <AppText
              variant="micro"
              style={{ color: palette.orange, textDecorationLine: "underline" }}
            >
              View original
            </AppText>
          </Pressable>
        )}
      </View>

      {interaction.reply ? (
        <View
          style={[
            styles.replyBox,
            { backgroundColor: palette.bgSoft, borderRadius: radii.md, padding: spacing[3] },
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
        <Button
          label="Reply"
          variant="secondary"
          size="sm"
          fullWidth={false}
          onPress={() => onReply(interaction)}
          leftIcon={<MessageSquare size={16} color={palette.orange} />}
        />
      )}
    </View>
  );
}

// ─── Reply Composer ──────────────────────────────────────────────────────────

interface ReplyComposerProps {
  interaction: CustomerInteraction;
  onClose: () => void;
  onSent: () => void;
}

function ReplyComposer({ interaction, onClose, onSent }: ReplyComposerProps) {
  const { palette, spacing, radii } = useHungryTheme();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const quickReplies = [
    "Thank you for the feedback!",
    "We're glad you enjoyed it!",
    "Sorry for the wait, we'll improve.",
    "Hope to see you again soon!",
  ];

  useEffect(() => {
    async function loadSuggestions() {
      setIsLoadingSuggestions(true);
      try {
        const suggestion = await hungryService.merchant.generateAIReply(interaction.id);
        setSuggestions([suggestion]);
      } catch (e) {
        console.error("Failed to load suggestions", e);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }
    loadSuggestions();
  }, [interaction.id]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setIsSending(true);
    try {
      await hungryService.merchant.replyToInteraction(interaction.id, text);
      onSent();
    } catch (e) {
      console.error("Failed to send reply", e);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View
      style={[
        styles.composerContainer,
        { backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: spacing[3],
        }}
      >
        <AppText variant="bodyBold">Replying to {interaction.authorName}</AppText>
        <IconButton
          icon={
            <ChevronLeft
              size={24}
              color={palette.textSecondary}
              style={{ transform: [{ rotate: "-90deg" }] }}
            />
          }
          accessibilityLabel="Close composer"
          onPress={onClose}
        />
      </View>

      <View style={{ gap: spacing[2], marginBottom: spacing[2] }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing[3], gap: spacing[2] }}
        >
          {isLoadingSuggestions ? (
            <ActivityIndicator
              size="small"
              color={palette.orange}
              style={{ marginHorizontal: spacing[4] }}
            />
          ) : (
            suggestions.map((suggestion, idx) => (
              <Pressable
                key={`suggest-${idx}`}
                onPress={() => setText(suggestion)}
                style={[
                  styles.suggestionChip,
                  {
                    backgroundColor: palette.orangeLight,
                    borderRadius: radii.pill,
                    borderColor: palette.orange,
                  },
                ]}
              >
                <Sparkles size={12} color={palette.orange} />
                <AppText variant="micro" style={{ color: palette.orange }}>
                  {suggestion.slice(0, 40)}...
                </AppText>
              </Pressable>
            ))
          )}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing[3], gap: spacing[2] }}
        >
          {quickReplies.map((reply, idx) => (
            <Pressable
              key={`quick-${idx}`}
              onPress={() => setText(reply)}
              style={[
                styles.suggestionChip,
                {
                  backgroundColor: palette.bgSoft,
                  borderRadius: radii.pill,
                  borderColor: palette.border,
                },
              ]}
            >
              <AppText variant="micro" tone="muted">
                {reply}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View
        style={{
          padding: spacing[3],
          flexDirection: "row",
          gap: spacing[2],
          alignItems: "flex-end",
        }}
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: palette.bgSoft,
              borderRadius: radii.lg,
              color: palette.text,
              borderColor: palette.border,
              borderWidth: 1,
            },
          ]}
          placeholder="Type your reply..."
          placeholderTextColor={palette.textMuted}
          multiline
          value={text}
          onChangeText={setText}
        />
        <IconButton
          icon={<Send size={24} color={text.trim() ? palette.orange : palette.textMuted} />}
          accessibilityLabel="Send reply"
          onPress={handleSend}
          disabled={!text.trim() || isSending}
        />
      </View>
      <View style={{ paddingHorizontal: spacing[3], paddingBottom: spacing[3] }}>
        <AppText variant="micro" tone="muted">
          AI-generated suggestion — review before sending
        </AppText>
      </View>
    </View>
  );
}

// ─── CustomerInboxScreen ──────────────────────────────────────────────────────

export function CustomerInboxScreen() {
  const { palette, spacing } = useHungryTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const activeOutlet = useMerchantStore(getActiveOutlet);

  const [interactions, setInteractions] = useState<CustomerInteraction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<InteractionType | "all" | "unreplied">("all");
  const [replyingTo, setReplyingTo] = useState<CustomerInteraction | null>(null);

  const fetchInteractions = useCallback(async () => {
    if (!activeOutlet) return;
    setIsLoading(true);
    try {
      const data = await hungryService.merchant.getInbox(activeOutlet.id, {
        type: filter === "all" || filter === "unreplied" ? undefined : filter,
        unrepliedOnly: filter === "unreplied",
      });
      setInteractions(data);
    } catch (e) {
      console.error("Failed to fetch interactions", e);
    } finally {
      setIsLoading(false);
    }
  }, [activeOutlet, filter]);

  useEffect(() => {
    fetchInteractions();
  }, [fetchInteractions]);

  const renderFilter = (id: typeof filter, label: string) => (
    <View style={{ marginRight: spacing[2] }}>
      <Chip label={label} selected={filter === id} onPress={() => setFilter(id)} />
    </View>
  );

  return (
    <Screen style={{ backgroundColor: palette.bg }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        <IconButton
          icon={<ChevronLeft size={24} color={palette.text} />}
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
        />
        <AppText variant="h3" style={{ fontWeight: "800" }}>
          Customer Inbox
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing[4], gap: spacing[4], paddingBottom: 100 }}
        stickyHeaderIndices={[1]}
      >
        <SentimentSummary interactions={interactions} />

        <View style={{ backgroundColor: palette.bg, paddingVertical: spacing[2] }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderFilter("all", "All")}
            {renderFilter("unreplied", "Unreplied")}
            {renderFilter("review", "Reviews")}
            {renderFilter("comment", "Comments")}
            {renderFilter("post_mention", "Mentions")}
          </ScrollView>
        </View>

        {isLoading ? (
          <View style={{ marginTop: 100 }}>
            <ActivityIndicator size="large" color={palette.orange} />
          </View>
        ) : interactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: palette.bgSoft }]}>
              <MessageSquare size={40} color={palette.textMuted} />
            </View>
            <AppText variant="bodyBold" style={{ marginTop: spacing[4] }}>
              No messages found
            </AppText>
            <AppText
              variant="bodySmall"
              tone="muted"
              style={{ textAlign: "center", marginTop: spacing[1] }}
            >
              When customers review or comment on your stall, they will appear here.
            </AppText>
          </View>
        ) : (
          interactions.map((item) => (
            <InteractionCard key={item.id} interaction={item} onReply={setReplyingTo} />
          ))
        )}
      </ScrollView>

      {replyingTo && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.composerWrapper}
        >
          <ReplyComposer
            interaction={replyingTo}
            onClose={() => setReplyingTo(null)}
            onSent={() => {
              setReplyingTo(null);
              fetchInteractions();
            }}
          />
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  summaryCard: {
    // styles moved inline for palette access
  },
  interactionCard: {
    // styles moved inline for palette access
  },
  replyBox: {
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  composerWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  composerContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    maxHeight: 120,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
  },
});
