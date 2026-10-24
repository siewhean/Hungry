import { Check, Send } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleProp, View, type ViewStyle } from "react-native";

import { AppText, Avatar, Button } from "@/components/ui";
import { useHungryTheme } from "@/theme";

type ShareActionRenderer = (params: { color: string; size: number }) => ReactNode;

type ShareActionDefinition = {
  key: string;
  label: string;
  accessibilityLabel: string;
  icon: ShareActionRenderer;
  onPress: () => void;
};

type ShareQuickActionGroupProps = {
  actions: ShareActionDefinition[];
};

export function ShareQuickActionGroup({ actions }: ShareQuickActionGroupProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();

  return (
    <View style={{ flexDirection: "row", gap: spacing[2] }}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
          onPress={action.onPress}
          style={{
            alignItems: "center",
            width: 84,
            alignSelf: "center",
          }}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor: palette.bgSoft,
              borderRadius: componentRadii.iconButton,
              justifyContent: "center",
              padding: spacing[3],
              width: 56,
              height: 56,
            }}
          >
            {action.icon({ color: palette.text, size: 28 })}
          </View>
          <AppText
            variant="micro"
            style={{ color: palette.textMuted, marginTop: spacing[1], textAlign: "center" }}
          >
            {action.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

type ShareTarget = {
  id: string;
  avatar: string;
  name: string;
  lastMessage?: string;
};

type ShareCardAction = {
  key: string;
  label: string;
  accessibilityLabel: string;
  icon: ShareActionRenderer;
  onPress: () => void;
};

type InAppShareCardProps = {
  title: string;
  subtitle?: string;
  quickActions?: ShareCardAction[];
  recipients: ShareTarget[];
  selectedRecipientIds: string[];
  onToggleRecipient: (id: string) => void;
  onSend: () => void;
  sendActionLabel?: string;
  recipientSectionLabel?: string;
  recipientAccessibilityLabelPrefix?: string;
  lastRecipientId?: string;
  showRecipientLastMessage?: boolean;
};

type ShareRecipientRowsProps = {
  targets: ShareTarget[];
  selectedTargetIds?: string[];
  selectable?: boolean;
  showAction?: "send" | "check";
  onToggleTarget: (id: string) => void;
  lastTargetId?: string;
  actionLabel?: string;
  accessibilityLabelPrefix: string;
  showLastMessage?: boolean;
};

type ShareCardActionButton = {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  position?: "top" | "bottom" | "floating";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

type FloatingShareSendButtonProps = {
  selectedCount: number;
  onPress: () => void;
  bottomInset?: number;
  accessibilityLabel: string;
  placement?: "absolute" | "inline";
};

type ShareCardProps = {
  title: string;
  subtitle?: string;
  quickActions?: ShareCardAction[];
  recipients?: ShareTarget[];
  onRecipientPress?: (recipientId: string) => void;
  selectedRecipientIds?: string[];
  selectableRecipients?: boolean;
  recipientShowAction?: "send" | "check";
  recipientActionLabel?: string;
  lastRecipientId?: string;
  recipientAccessibilityLabelPrefix?: string;
  showRecipientLastMessage?: boolean;
  recipientSectionLabel?: string;
  actionButton?: ShareCardActionButton | null;
};

export type DishShareCardProps = Omit<ShareCardProps, "showRecipientLastMessage"> & {
  showRecipientLastMessage?: boolean;
};

export function InAppShareCard({
  title,
  subtitle,
  quickActions = [],
  recipients,
  selectedRecipientIds,
  onToggleRecipient,
  sendActionLabel = "Send",
  recipientSectionLabel,
  recipientAccessibilityLabelPrefix,
  lastRecipientId,
  showRecipientLastMessage = false,
}: InAppShareCardProps) {
  return (
    <ShareCard
      title={title}
      subtitle={subtitle}
      quickActions={quickActions}
      recipients={recipients}
      selectableRecipients
      selectedRecipientIds={selectedRecipientIds}
      recipientShowAction="check"
      recipientActionLabel={sendActionLabel}
      onRecipientPress={onToggleRecipient}
      recipientSectionLabel={recipientSectionLabel}
      recipientAccessibilityLabelPrefix={recipientAccessibilityLabelPrefix}
      lastRecipientId={lastRecipientId}
      showRecipientLastMessage={showRecipientLastMessage}
      actionButton={null}
    />
  );
}

export function FloatingShareSendButton({
  selectedCount,
  onPress,
  bottomInset = 0,
  accessibilityLabel,
  placement = "absolute",
}: FloatingShareSendButtonProps) {
  const { palette, radii, spacing, shadows } = useHungryTheme();

  return (
    <View
      pointerEvents="box-none"
      style={
        placement === "absolute"
          ? {
              position: "absolute",
              right: spacing[4],
              bottom: Math.max(bottomInset, spacing[4]),
              zIndex: 1000,
              elevation: 1000,
            }
          : {
              alignItems: "flex-end",
              paddingBottom: Math.max(bottomInset, spacing[4]),
              paddingHorizontal: spacing[4],
            }
      }
    >
      <Button
        label={selectedCount > 0 ? `Send (${selectedCount})` : "Send"}
        disabled={selectedCount === 0}
        leftIcon={<Send color={palette.white} size={16} />}
        onPress={onPress}
        size="sm"
        fullWidth={false}
        accessibilityLabel={accessibilityLabel}
        style={[
          shadows.floating,
          {
            alignSelf: "flex-end",
            borderRadius: radii.pill,
            minWidth: 96,
          },
        ]}
      />
    </View>
  );
}

export function ShareCard({
  title,
  subtitle,
  quickActions = [],
  recipients = [],
  onRecipientPress,
  selectedRecipientIds = [],
  selectableRecipients = false,
  recipientShowAction = "send",
  recipientActionLabel = "Send",
  lastRecipientId,
  recipientAccessibilityLabelPrefix = "Share with",
  showRecipientLastMessage = true,
  recipientSectionLabel,
  actionButton,
}: ShareCardProps) {
  const { spacing, palette } = useHungryTheme();

  return (
    <View style={{ gap: spacing[2] }}>
      <ShareSettingsHeader title={title} subtitle={subtitle} />

      {quickActions.length > 0 ? <ShareQuickActionGroup actions={quickActions} /> : null}
      {quickActions.length > 0 && recipients.length > 0 ? (
        <View
          style={{
            backgroundColor: palette.border,
            height: 1,
            marginTop: spacing[2],
            marginBottom: spacing[2],
            opacity: 0.5,
          }}
        />
      ) : null}

      <View style={{ gap: spacing[1.5] }}>
        {actionButton && actionButton.position === "top" ? (
          <Button
            label={actionButton.label}
            disabled={actionButton.disabled}
            leftIcon={actionButton.icon as ReactNode | undefined}
            onPress={actionButton.onPress}
            size={actionButton.size ?? "md"}
            fullWidth={actionButton.fullWidth ?? true}
            style={[
              actionButton.position === "top" ? { marginBottom: spacing[1] } : null,
              actionButton.style,
            ]}
          />
        ) : null}

        {recipientSectionLabel ? (
          <AppText variant="bodySmallBold">{recipientSectionLabel}</AppText>
        ) : null}
        {recipients.length > 0 && onRecipientPress ? (
          <ShareRecipientRows
            targets={recipients}
            selectable={selectableRecipients}
            selectedTargetIds={selectedRecipientIds}
            showAction={recipientShowAction}
            onToggleTarget={onRecipientPress}
            actionLabel={recipientActionLabel}
            lastTargetId={lastRecipientId}
            accessibilityLabelPrefix={recipientAccessibilityLabelPrefix}
            showLastMessage={showRecipientLastMessage}
          />
        ) : null}

        {actionButton && actionButton.position !== "top" ? (
          <Button
            label={actionButton.label}
            disabled={actionButton.disabled}
            leftIcon={actionButton.icon as ReactNode | undefined}
            onPress={actionButton.onPress}
            size={actionButton.size ?? "md"}
            fullWidth={actionButton.fullWidth ?? true}
            style={[
              actionButton.position === "floating"
                ? {
                    position: "absolute",
                    right: spacing[2],
                    bottom: spacing[2],
                    zIndex: 10,
                  }
                : null,
              actionButton.style,
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

export function DishShareCard({ showRecipientLastMessage = false, ...props }: DishShareCardProps) {
  return <ShareCard {...props} showRecipientLastMessage={showRecipientLastMessage} />;
}

export function ShareSettingsHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { palette, spacing } = useHungryTheme();

  return (
    <View
      style={{
        borderBottomColor: palette.border,
        borderBottomWidth: 1,
        gap: spacing[1],
        paddingBottom: spacing[3],
        paddingHorizontal: spacing[4],
      }}
    >
      <AppText variant="h3">{title}</AppText>
      {subtitle ? (
        <AppText variant="bodySmall" tone="secondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

export function ShareRecipientRows({
  targets,
  selectedTargetIds = [],
  selectable = false,
  showAction = "send",
  onToggleTarget,
  lastTargetId,
  actionLabel = "Send",
  accessibilityLabelPrefix,
  showLastMessage = true,
}: ShareRecipientRowsProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();

  return (
    <>
      {targets.map((chat) => {
        const selected = selectedTargetIds.includes(chat.id);
        const isLastTarget = lastTargetId === chat.id;

        if (showAction === "check" || selectable) {
          return (
            <Pressable
              key={chat.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${accessibilityLabelPrefix} ${chat.name}`}
              onPress={() => onToggleTarget(chat.id)}
              style={{
                alignItems: "center",
                borderColor: selected ? palette.orange : palette.border,
                borderRadius: componentRadii.card,
                borderWidth: 1,
                flexDirection: "row",
                gap: spacing[3],
                padding: spacing[3],
              }}
            >
              <Avatar uri={chat.avatar} name={chat.name} size={44} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodySmallBold">{chat.name}</AppText>
                {showLastMessage && chat.lastMessage ? (
                  <AppText variant="micro" tone="secondary" numberOfLines={1}>
                    {chat.lastMessage}
                  </AppText>
                ) : null}
              </View>
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: selected ? palette.orange : palette.bgSoft,
                  borderRadius: radii.pill,
                  height: 28,
                  justifyContent: "center",
                  width: 28,
                }}
              >
                {selected ? <Check color={palette.white} size={16} /> : null}
              </View>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={chat.id}
            accessibilityRole="button"
            accessibilityLabel={`${accessibilityLabelPrefix} ${chat.name}`}
            onPress={() => onToggleTarget(chat.id)}
            style={{
              alignItems: "center",
              borderBottomColor: palette.border,
              borderBottomWidth: isLastTarget ? 0 : 1,
              flexDirection: "row",
              gap: spacing[3],
              paddingBottom: spacing[3],
              paddingTop: spacing[2],
            }}
          >
            <Avatar uri={chat.avatar} name={chat.name} size={44} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodySmallBold">{chat.name}</AppText>
              {showLastMessage && chat.lastMessage ? (
                <AppText variant="micro" tone="secondary" numberOfLines={1}>
                  {chat.lastMessage}
                </AppText>
              ) : null}
            </View>
            <View
              style={{
                backgroundColor: palette.orange,
                borderRadius: radii.pill,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[1.5],
              }}
            >
              <AppText variant="micro" style={{ color: palette.textOnOrange, fontWeight: "900" }}>
                {actionLabel}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </>
  );
}
