/**
 * FloorPlanViewer
 *
 * Renders an interactive SVG-based floor plan with:
 * - Color-coded stall polygons (green=open, red=closed, grey=non-food)
 * - Tap to select a stall → orange highlight
 * - Stall labels rendered at polygon center
 * - Pinch/scroll to zoom via ScrollView nesting
 *
 * Uses react-native-svg for all rendering.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import Svg, { G, Polygon, Rect, Text as SvgText } from "react-native-svg";
import { useHungryTheme } from "@/theme";
import type { FloorPlan, StallPolygon } from "@/lib/services/types";
import { AppText } from "@/components/ui";

// ─── Stall Status Colors ──────────────────────────────────────────────────────

const STALL_COLORS = {
  open: {
    fill: "#4F7E17",
    fillOpacity: 0.15,
    stroke: "#4F7E17",
    labelColor: "#4F7E17",
  },
  closed: {
    fill: "#CD0302",
    fillOpacity: 0.1,
    stroke: "#CD0302",
    labelColor: "#CD0302",
  },
  non_food: {
    fill: "#9CA3AF",
    fillOpacity: 0.1,
    stroke: "#9CA3AF",
    labelColor: "#9CA3AF",
  },
  selected: {
    fill: "#E8531E",
    fillOpacity: 0.25,
    stroke: "#E8531E",
    labelColor: "#E8531E",
  },
} as const;

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
  scale: number;
}

function StallCell({ stall, isSelected, onPress, scale }: StallCellProps) {
  const colors = isSelected
    ? STALL_COLORS.selected
    : STALL_COLORS[stall.status];

  const center = centroid(stall.polygon);
  const svgPoints = toSvgPoints(stall.polygon);

  // Approximate the polygon's bounding box for touch target
  const xs = stall.polygon.map(([x]) => x);
  const ys = stall.polygon.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const boxW = Math.max(...xs) - minX;
  const boxH = Math.max(...ys) - minY;

  const labelFontSize = Math.max(7, Math.min(10, boxH * 0.15));

  return (
    <G>
      {/* Invisible touch rect (larger than polygon for easier tapping) */}
      <Rect
        x={minX}
        y={minY}
        width={boxW}
        height={boxH}
        fill="transparent"
        onPress={() => onPress(stall)}
      />
      <Polygon
        points={svgPoints}
        fill={colors.fill}
        fillOpacity={colors.fillOpacity}
        stroke={colors.stroke}
        strokeWidth={isSelected ? 2 : 1}
        strokeLinejoin="round"
        onPress={() => onPress(stall)}
      />
      {/* Unit number label */}
      <SvgText
        x={center.x}
        y={center.y - labelFontSize * 0.6}
        textAnchor="middle"
        fontSize={labelFontSize}
        fill={colors.labelColor}
        fontWeight="700"
      >
        {stall.unitNumber}
      </SvgText>
      {/* Stall name (truncated) */}
      {stall.label && (
        <SvgText
          x={center.x}
          y={center.y + labelFontSize * 0.8}
          textAnchor="middle"
          fontSize={Math.max(6, labelFontSize - 2)}
          fill={colors.labelColor}
          fillOpacity={0.8}
        >
          {stall.label.length > 12
            ? stall.label.slice(0, 11) + "…"
            : stall.label}
        </SvgText>
      )}
    </G>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function FloorPlanLegend() {
  const { palette, spacing } = useHungryTheme();
  const items = [
    { color: "#4F7E17", label: "Open" },
    { color: "#CD0302", label: "Closed" },
    { color: "#9CA3AF", label: "Non-food" },
    { color: "#E8531E", label: "Selected" },
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
}

export function FloorPlanViewer({
  floorPlan,
  selectedStallId,
  onStallPress,
  style,
  scale = 1.0,
  showLegend = true,
}: FloorPlanViewerProps) {
  const { palette } = useHungryTheme();
  const [internalSelected, setInternalSelected] = useState<string | undefined>(
    selectedStallId
  );

  const effectiveSelected = selectedStallId ?? internalSelected;

  const handleStallPress = useCallback(
    (stall: StallPolygon) => {
      setInternalSelected(stall.stallId);
      onStallPress?.(stall);
    },
    [onStallPress]
  );

  const svgWidth = floorPlan.canvasWidth * scale;
  const svgHeight = floorPlan.canvasHeight * scale;

  const padding = 12;

  return (
    <View style={[styles.wrapper, style]}>
      {/* Scrollable/zoomable canvas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={[styles.scrollView, { backgroundColor: palette.bgMuted }]}
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

            {/* All stalls */}
            {floorPlan.stalls.map((stall) => (
              <StallCell
                key={stall.stallId}
                stall={stall}
                isSelected={stall.stallId === effectiveSelected}
                onPress={handleStallPress}
                scale={scale}
              />
            ))}
          </Svg>
        </ScrollView>
      </ScrollView>

      {/* Legend */}
      {showLegend && <FloorPlanLegend />}

      {/* Stall count summary */}
      <View
        style={[
          styles.statsBar,
          { backgroundColor: palette.surface, borderTopColor: palette.border },
        ]}
      >
        <StatChip
          color="#4F7E17"
          count={floorPlan.stalls.filter((s) => s.status === "open").length}
          label="Open"
        />
        <StatChip
          color="#CD0302"
          count={floorPlan.stalls.filter((s) => s.status === "closed").length}
          label="Closed"
        />
        <StatChip
          color="#9CA3AF"
          count={floorPlan.stalls.filter((s) => s.status === "non_food").length}
          label="Other"
        />
        <AppText variant="micro" style={{ marginLeft: "auto" }}>
          {floorPlan.stalls.length} stalls total
        </AppText>
      </View>
    </View>
  );
}

function StatChip({
  color,
  count,
  label,
}: {
  color: string;
  count: number;
  label: string;
}) {
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
    borderRadius: 12,
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
