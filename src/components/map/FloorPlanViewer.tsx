/**
 * FloorPlanViewer
 *
 * Renders an interactive SVG-based floor plan with:
 * - Tenant, facility, and corridor polygons
 * - Tap-to-select tenant polygons
 * - Unit and stall labels rendered at polygon center
 * - Bidirectional sync support with the stall directory list
 */

import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { G, Image as SvgImage, Polygon, Rect, Text as SvgText } from "react-native-svg";
import { useHungryTheme } from "@/theme";
import { componentRadii } from "@/theme/tokens";
import type { FloorPlan, StallPolygon } from "@/lib/services/types";
import { AppText } from "@/components/ui";

interface StallVisual {
  fill: string;
  fillOpacity: number;
  stroke: string;
  labelColor: string;
  strokeWidth: number;
}

function stallKind(stall: StallPolygon) {
  return stall.kind ?? "tenant";
}

function getStallVisual(
  stall: StallPolygon,
  isSelected: boolean,
  palette: ReturnType<typeof useHungryTheme>["palette"],
): StallVisual {
  const kind = stallKind(stall);

  if (kind === "corridor") {
    return {
      fill: palette.bgSoft,
      fillOpacity: 1,
      stroke: palette.border,
      labelColor: palette.textMuted,
      strokeWidth: 0.9,
    };
  }

  if (kind === "facility") {
    return {
      fill: palette.surfaceRaised,
      fillOpacity: 1,
      stroke: palette.border,
      labelColor: palette.navy,
      strokeWidth: 1.25,
    };
  }

  if (isSelected) {
    return {
      fill: palette.orangeLight,
      fillOpacity: 1,
      stroke: palette.orange,
      labelColor: palette.orange,
      strokeWidth: 2,
    };
  }

  if (stall.status === "closed") {
    return {
      fill: palette.bgSoft,
      fillOpacity: 1,
      stroke: palette.error,
      labelColor: palette.error,
      strokeWidth: 1,
    };
  }

  return {
    fill: palette.surface,
    fillOpacity: 1,
    stroke: palette.border,
    labelColor: palette.text,
    strokeWidth: 1,
  };
}

// ─── Helper: polygon centroid ─────────────────────────────────────────────────

function centroid(points: [number, number][]): { x: number; y: number } {
  const x = points.reduce((s, p) => s + p[0], 0) / points.length;
  const y = points.reduce((s, p) => s + p[1], 0) / points.length;
  return { x, y };
}

function toSvgPoints(polygon: [number, number][]): string {
  return polygon.map(([x, y]) => `${x},${y}`).join(" ");
}

// ─── Single Stall Polygon ─────────────────────────────────────────────────────

interface StallCellProps {
  stall: StallPolygon;
  isSelected: boolean;
  onPress: (stall: StallPolygon) => void;
  labelMode: "none" | "selected" | "all";
}

function StallCell({ stall, isSelected, onPress, labelMode }: StallCellProps) {
  const { palette } = useHungryTheme();
  const kind = stallKind(stall);
  const visual = getStallVisual(stall, isSelected, palette);
  const isInteractive = kind === "tenant";

  const center = centroid(stall.polygon);
  const svgPoints = toSvgPoints(stall.polygon);

  // Approximate the polygon's bounding box for touch target
  const xs = stall.polygon.map(([x]) => x);
  const ys = stall.polygon.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const boxW = Math.max(...xs) - minX;
  const boxH = Math.max(...ys) - minY;

  const labelFontSize = Math.max(7, Math.min(11, boxH * 0.16));
  const canShowLabel = labelMode === "all" || (labelMode === "selected" && isSelected);
  const showUnitLabel = kind === "tenant" && Boolean(stall.unitNumber) && canShowLabel;
  const showSecondaryLabel = kind === "tenant" && Boolean(stall.label) && canShowLabel;
  const showFacilityLabel = kind === "facility" && Boolean(stall.label) && canShowLabel;
  const corridorLabel = kind === "corridor" && labelMode === "all" ? stall.label : undefined;

  return (
    <G>
      {isInteractive ? (
        <Rect
          x={minX}
          y={minY}
          width={boxW}
          height={boxH}
          fill="transparent"
          onPress={() => onPress(stall)}
        />
      ) : null}
      <Polygon
        points={svgPoints}
        fill={visual.fill}
        fillOpacity={visual.fillOpacity}
        stroke={visual.stroke}
        strokeWidth={visual.strokeWidth}
        strokeLinejoin="round"
        onPress={isInteractive ? () => onPress(stall) : undefined}
      />

      {showUnitLabel ? (
        <SvgText
          x={center.x}
          y={center.y - labelFontSize * 0.55}
          textAnchor="middle"
          fontSize={labelFontSize}
          fill={visual.labelColor}
          fontWeight="700"
        >
          {stall.unitNumber}
        </SvgText>
      ) : null}

      {showSecondaryLabel ? (
        <SvgText
          x={center.x}
          y={center.y + labelFontSize * 0.82}
          textAnchor="middle"
          fontSize={Math.max(6, labelFontSize - 2)}
          fill={visual.labelColor}
          fillOpacity={0.88}
        >
          {stall.label && stall.label.length > 16 ? `${stall.label.slice(0, 15)}…` : stall.label}
        </SvgText>
      ) : null}

      {showFacilityLabel ? (
        <SvgText
          x={center.x}
          y={center.y + labelFontSize * 0.25}
          textAnchor="middle"
          fontSize={Math.max(7, labelFontSize - 1)}
          fill={visual.labelColor}
          fontWeight="600"
        >
          {stall.label}
        </SvgText>
      ) : null}

      {corridorLabel ? (
        <SvgText
          x={center.x}
          y={center.y + labelFontSize * 0.2}
          textAnchor="middle"
          fontSize={Math.max(6, labelFontSize - 3)}
          fill={visual.labelColor}
          fillOpacity={0.74}
        >
          {corridorLabel}
        </SvgText>
      ) : null}
    </G>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function FloorPlanLegend() {
  const { palette } = useHungryTheme();
  const items = [
    { color: palette.success, label: "Open tenant" },
    { color: palette.error, label: "Closed tenant" },
    { color: palette.navy, label: "Facility" },
    { color: palette.border, label: "Corridor" },
    { color: palette.orange, label: "Selected" },
  ];

  return (
    <View style={[styles.legend, { borderTopColor: palette.border }]}>
      {items.map(({ color, label }) => (
        <View key={label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: color }]} />
          <AppText variant="micro" style={{ color: palette.textMuted }}>
            {label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface FloorPlanViewerProps {
  floorPlan: FloorPlan;
  selectedStallId?: string;
  onStallPress?: (stall: StallPolygon) => void;
  style?: ViewStyle;
  /** Render scale — default 1.0 */
  scale?: number;
  showLegend?: boolean;
  showStatsBar?: boolean;
  viewportHeight?: number;
}

export function FloorPlanViewer({
  floorPlan,
  selectedStallId,
  onStallPress,
  style,
  scale = 1.0,
  showLegend = true,
  showStatsBar = true,
  viewportHeight,
}: FloorPlanViewerProps) {
  const { palette } = useHungryTheme();
  const [internalSelected, setInternalSelected] = useState<string | undefined>(selectedStallId);
  const tenantStalls = useMemo(
    () => floorPlan.stalls.filter((stall) => stallKind(stall) === "tenant"),
    [floorPlan.stalls],
  );
  const renderedStalls = useMemo(
    () =>
      floorPlan.stalls.filter((stall) => {
        if (!floorPlan.backgroundImage) {
          return true;
        }

        return stallKind(stall) !== "corridor";
      }),
    [floorPlan.backgroundImage, floorPlan.stalls],
  );
  const labelMode = useMemo<"none" | "selected" | "all">(() => {
    if (scale >= 0.72) {
      return "all";
    }
    if (scale >= 0.4) {
      return "selected";
    }
    return "none";
  }, [scale]);

  const effectiveSelected = selectedStallId ?? internalSelected;

  const handleStallPress = useCallback(
    (stall: StallPolygon) => {
      setInternalSelected(stall.stallId);
      onStallPress?.(stall);
    },
    [onStallPress],
  );

  const svgWidth = floorPlan.canvasWidth * scale;
  const svgHeight = floorPlan.canvasHeight * scale;

  const padding = 12;

  return (
    <View style={[styles.wrapper, style]}>
      {/* Scrollable/zoomable canvas */}
      <ScrollView
        horizontal
        bouncesZoom
        minimumZoomScale={1}
        maximumZoomScale={3}
        pinchGestureEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={[
          styles.scrollView,
          { backgroundColor: palette.bgMuted },
          viewportHeight
            ? {
                minHeight: viewportHeight,
                maxHeight: viewportHeight,
                height: viewportHeight,
              }
            : undefined,
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Svg
            width={svgWidth + padding * 2}
            height={svgHeight + padding * 2}
            viewBox={`${-padding / scale} ${-padding / scale} ${
              floorPlan.canvasWidth + (padding * 2) / scale
            } ${floorPlan.canvasHeight + (padding * 2) / scale}`}
          >
            {/* Background */}
            <Rect
              x={-padding / scale}
              y={-padding / scale}
              width={floorPlan.canvasWidth + (padding * 2) / scale}
              height={floorPlan.canvasHeight + (padding * 2) / scale}
              fill={palette.bgMuted}
            />

            {floorPlan.backgroundImage ? (
              <SvgImage
                x={0}
                y={0}
                width={floorPlan.canvasWidth}
                height={floorPlan.canvasHeight}
                href={{ uri: floorPlan.backgroundImage.uri }}
                opacity={floorPlan.backgroundImage.opacity ?? 1}
                preserveAspectRatio="none"
              />
            ) : null}

            {/* All stalls */}
            {renderedStalls.map((stall) => (
              <StallCell
                key={stall.stallId}
                stall={stall}
                isSelected={stall.stallId === effectiveSelected}
                onPress={handleStallPress}
                labelMode={labelMode}
              />
            ))}
          </Svg>
        </ScrollView>
      </ScrollView>

      {/* Legend */}
      {showLegend && <FloorPlanLegend />}

      {/* Stall count summary */}
      {showStatsBar ? (
        <View
          style={[
            styles.statsBar,
            { backgroundColor: palette.surface, borderTopColor: palette.border },
          ]}
        >
          <StatChip
            color={palette.success}
            count={tenantStalls.filter((stall) => stall.status === "open").length}
            label="Open"
          />
          <StatChip
            color={palette.error}
            count={tenantStalls.filter((stall) => stall.status === "closed").length}
            label="Closed"
          />
          <StatChip
            color={palette.navy}
            count={floorPlan.stalls.filter((stall) => stallKind(stall) === "facility").length}
            label="Facilities"
          />
          <AppText variant="micro" style={{ marginLeft: "auto" }}>
            {tenantStalls.length} tenants
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function StatChip({ color, count, label }: { color: string; count: number; label: string }) {
  const { spacing } = useHungryTheme();
  return (
    <View style={[styles.statChip, { marginRight: spacing[3] }]}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <AppText variant="micro" style={{ color }}>
        {count} {label}
      </AppText>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: componentRadii.card,
    overflow: "hidden",
  },
  scrollView: {
    minHeight: 180,
    maxHeight: 280,
  },
  scrollContent: {
    flexGrow: 1,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  legendDot: {
    borderRadius: 3,
    height: 8,
    width: 8,
  },
  statsBar: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statChip: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  statDot: {
    borderRadius: 3,
    height: 8,
    width: 8,
  },
});
