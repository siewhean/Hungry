import { Modal, Pressable, ScrollView, View } from "react-native";
import { X } from "lucide-react-native";

import { AppText } from "@/components/ui";
import type { CatalogDiagnosticEvent } from "@/lib/services/catalog/diagnostics";
import { getAppEnvironment, isSupabaseConfigured } from "@/lib/services/supabase/client";
import { useLocationStore } from "@/store/useLocationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  const { palette, spacing } = useHungryTheme();
  return (
    <View
      style={{
        alignItems: "flex-start",
        borderBottomColor: palette.border,
        borderBottomWidth: 1,
        flexDirection: "row",
        gap: spacing[3],
        justifyContent: "space-between",
        paddingVertical: spacing[2],
      }}
    >
      <AppText tone="secondary" variant="micro">
        {label}
      </AppText>
      <AppText style={{ flex: 1, textAlign: "right" }} variant="micro">
        {value}
      </AppText>
    </View>
  );
}

export function CatalogDiagnosticsModal({
  events,
  onClear,
  onClose,
  releaseId,
  totals,
  visible,
}: {
  events: CatalogDiagnosticEvent[];
  onClear: () => void;
  onClose: () => void;
  releaseId?: string;
  totals: { dishes: number; venues: number };
  visible: boolean;
}) {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const authDataSource = useSessionStore((state) => state.authDataSource);
  const locationPermission = useLocationStore((state) => state.permission);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const { palette, radii, spacing } = useHungryTheme();
  const latest = events[0];
  const source = releaseId?.startsWith("excel-fallback")
    ? "Excel fallback"
    : releaseId
      ? "Supabase"
      : "Unknown";

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <View style={{ backgroundColor: palette.bg, flex: 1 }}>
        <View
          style={{
            alignItems: "center",
            borderBottomColor: palette.border,
            borderBottomWidth: 1,
            flexDirection: "row",
            justifyContent: "space-between",
            padding: spacing[4],
          }}
        >
          <View style={{ gap: spacing[1] }}>
            <AppText variant="h3">Catalog diagnostics</AppText>
            <AppText tone="secondary" variant="micro">
              Internal alpha · no account data or raw search text
            </AppText>
          </View>
          <Pressable
            accessibilityLabel="Close catalog diagnostics"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onClose}
            style={{
              alignItems: "center",
              backgroundColor: palette.bgSoft,
              borderRadius: radii.pill,
              height: 42,
              justifyContent: "center",
              width: 42,
            }}
          >
            <X color={palette.text} size={20} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ gap: spacing[5], padding: spacing[4], paddingBottom: spacing[12] }}
        >
          <View
            style={{
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: radii.lg,
              borderWidth: 1,
              paddingHorizontal: spacing[3],
            }}
          >
            <DiagnosticRow label="Environment" value={getAppEnvironment()} />
            <DiagnosticRow label="Authenticated" value={isAuthenticated ? "yes" : "no"} />
            <DiagnosticRow label="Auth source" value={authDataSource ?? "none"} />
            <DiagnosticRow
              label="Supabase configured"
              value={isSupabaseConfigured() ? "yes" : "no"}
            />
            <DiagnosticRow label="Catalog source" value={source} />
            <DiagnosticRow label="Release ID" value={releaseId ?? "none"} />
            <DiagnosticRow
              label="Catalog totals"
              value={`${totals.dishes.toLocaleString()} dishes · ${totals.venues.toLocaleString()} stalls`}
            />
            <DiagnosticRow
              label="Location mode"
              value={manualLocation ? `manual (${manualLocation})` : locationPermission}
            />
            <DiagnosticRow
              label="Latest duration"
              value={latest ? `${latest.durationMs} ms` : "not recorded"}
            />
            <DiagnosticRow label="Latest error" value={latest?.errorKind ?? "none"} />
          </View>

          <View style={{ gap: spacing[2] }}>
            <View
              style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}
            >
              <AppText variant="bodyBold">Recent catalog requests</AppText>
              <Pressable accessibilityRole="button" onPress={onClear}>
                <AppText style={{ color: palette.orange }} variant="bodySmallBold">
                  Clear
                </AppText>
              </Pressable>
            </View>
            {events.length ? (
              events.map((event) => (
                <View
                  key={event.id}
                  style={{
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    gap: spacing[1],
                    padding: spacing[3],
                  }}
                >
                  <View
                    style={{
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <AppText variant="bodySmallBold">{event.operation}</AppText>
                    <AppText
                      style={{ color: event.succeeded ? palette.success : palette.error }}
                      variant="micro"
                    >
                      {event.succeeded ? "success" : "failed"}
                    </AppText>
                  </View>
                  <AppText tone="secondary" variant="micro">
                    {event.source} · {event.resultCount} results · {event.durationMs} ms
                    {event.fallbackUsed ? " · fallback" : ""}
                  </AppText>
                  <AppText tone="muted" variant="micro">
                    query={event.request.queryPresent ? "yes" : "no"} · cursor=
                    {event.request.cursorPresent ? "yes" : "no"} · cuisine=
                    {event.request.cuisineFilterCount} · dietary=
                    {event.request.dietaryFilterCount}
                  </AppText>
                </View>
              ))
            ) : (
              <AppText tone="secondary">No catalog requests recorded in this session.</AppText>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
