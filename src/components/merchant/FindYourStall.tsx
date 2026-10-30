import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { AppText, InlineSearchField } from "@/components/ui";
import { buildBrowseRequest, roundCoordinate } from "@/features/search/browseGrid";
import { reportError } from "@/lib/monitoring/reportError";
import type { CatalogRawVenueCard } from "@/lib/services/catalog";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme } from "@/theme";

const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 6;
const DEBOUNCE_MS = 350;

/**
 * Search for the stall to claim. A result opens its page in customer mode, where the claim
 * button is; the claim then shows up in the gate. Results are kept with the text they answer, so
 * a slow reply for old text never shows under new text.
 */
export function FindYourStall({ onOpenStall }: { onOpenStall: (venueId: string) => void }) {
  const { palette, spacing, componentRadii } = useHungryTheme();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<{
    query: string;
    stalls: CatalogRawVenueCard[];
    failed: boolean;
  } | null>(null);
  const permission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const { coordinate } = getEffectiveLocation({ permission, currentLocation, manualCoordinate });
  const latitude = roundCoordinate(coordinate.latitude);
  const longitude = roundCoordinate(coordinate.longitude);
  const text = query.trim();
  const enabled = text.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timer = setTimeout(() => {
      const request = buildBrowseRequest({
        query: text,
        filters: [],
        sort: "relevance",
        coordinate: { latitude, longitude },
      });
      getCatalogRawService()
        .listVenues({ ...request, limit: RESULT_LIMIT })
        .then((page) => {
          if (active)
            setAnswer({ query: text, stalls: page.items.slice(0, RESULT_LIMIT), failed: false });
        })
        .catch((error) => {
          reportError(error, { screen: "MerchantGate", action: "find_stall" });
          if (active) setAnswer({ query: text, stalls: [], failed: true });
        });
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [enabled, text, latitude, longitude]);

  const current = enabled && answer?.query === text ? answer : null;

  return (
    <View style={{ gap: spacing[3], width: "100%" }}>
      <AppText variant="bodyBold">Find your stall</AppText>
      <AppText variant="bodySmall" tone="muted">
        Search for your stall, open it and tap Claim. Hungry checks your claim by hand.
      </AppText>
      <InlineSearchField
        accessibilityLabel="Search for your stall"
        placeholder="Stall name"
        value={query}
        onChangeText={setQuery}
      />
      {current?.failed ? (
        <AppText variant="bodySmall" tone="muted">
          Could not search just now. Check your connection and try again.
        </AppText>
      ) : null}
      {enabled && current && !current.failed && current.stalls.length === 0 ? (
        <AppText variant="bodySmall" tone="muted">
          No stalls found for &ldquo;{text}&rdquo;. Try another spelling, or email
          usehungrysingapore@gmail.com to add your stall.
        </AppText>
      ) : null}
      {current?.stalls.map((stall) => (
        <Pressable
          key={stall.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${stall.name}${stall.buildingName ? `, ${stall.buildingName}` : ""}`}
          onPress={() => onOpenStall(stall.id)}
          style={({ pressed }) => ({
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: componentRadii.card,
            borderWidth: 1,
            gap: spacing[0.5],
            opacity: pressed ? 0.78 : 1,
            padding: spacing[3],
          })}
        >
          <AppText variant="bodyBold">{stall.name}</AppText>
          <AppText variant="bodySmall" tone="muted">
            {[stall.unitNumber, stall.buildingName].filter(Boolean).join(" • ")}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
