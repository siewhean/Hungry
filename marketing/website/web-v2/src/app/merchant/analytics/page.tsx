"use client";

import React, { useState, useRef } from "react";
import { TrendingUp } from "lucide-react";
import styles from "../../console/console.module.css";

type Range = "7d" | "30d" | "90d";

const DATA: Record<Range, {
  views: number; search: number; menuClicks: number; favs: number;
  chartPoints: number[]; topDishes: { name: string; views: number; favs: number; reviews: number }[];
  sources: { name: string; pct: number }[];
}> = {
  "7d": {
    views: 712, search: 1041, menuClicks: 238, favs: 17,
    chartPoints: [88, 102, 95, 118, 124, 110, 124],
    topDishes: [
      { name: "Fuzhou Oyster Cake", views: 189, favs: 24, reviews: 8 },
      { name: "Lor Mee", views: 142, favs: 18, reviews: 5 },
      { name: "Char Kway Teow", views: 118, favs: 14, reviews: 7 },
      { name: "Chicken Rice", views: 98, favs: 11, reviews: 4 },
      { name: "Roast Pork Rice", views: 74, favs: 9, reviews: 3 },
    ],
    sources: [
      { name: "Nearby Search", pct: 44 },
      { name: "For You Feed", pct: 31 },
      { name: "Direct Profile", pct: 18 },
      { name: "Collections", pct: 7 },
    ],
  },
  "30d": {
    views: 2890, search: 4210, menuClicks: 967, favs: 73,
    chartPoints: [72, 81, 95, 103, 88, 99, 111, 124, 108, 115, 120, 99, 102, 88, 107, 119, 114, 103, 98, 112, 124, 117, 109, 103, 98, 118, 121, 110, 115, 124],
    topDishes: [
      { name: "Fuzhou Oyster Cake", views: 810, favs: 98, reviews: 31 },
      { name: "Lor Mee", views: 602, favs: 71, reviews: 22 },
      { name: "Char Kway Teow", views: 501, favs: 58, reviews: 19 },
      { name: "Chicken Rice", views: 412, favs: 44, reviews: 14 },
      { name: "Roast Pork Rice", views: 311, favs: 37, reviews: 11 },
    ],
    sources: [
      { name: "Nearby Search", pct: 47 },
      { name: "For You Feed", pct: 29 },
      { name: "Direct Profile", pct: 16 },
      { name: "Collections", pct: 8 },
    ],
  },
  "90d": {
    views: 8120, search: 11430, menuClicks: 2840, favs: 204,
    chartPoints: [60, 68, 72, 81, 88, 95, 103, 99, 107, 112, 118, 124, 119, 114, 109, 103, 111, 117, 121, 115, 108, 113, 118, 124, 120, 116, 110, 115, 121, 124],
    topDishes: [
      { name: "Fuzhou Oyster Cake", views: 2310, favs: 287, reviews: 88 },
      { name: "Lor Mee", views: 1721, favs: 204, reviews: 63 },
      { name: "Char Kway Teow", views: 1418, favs: 171, reviews: 54 },
      { name: "Chicken Rice", views: 1092, favs: 128, reviews: 41 },
      { name: "Roast Pork Rice", views: 841, favs: 102, reviews: 33 },
    ],
    sources: [
      { name: "Nearby Search", pct: 46 },
      { name: "For You Feed", pct: 30 },
      { name: "Direct Profile", pct: 17 },
      { name: "Collections", pct: 7 },
    ],
  },
};

function LineChart({ points }: { points: number[] }) {
  const max = Math.max(...points);
  const w = 600; const h = 100;
  const step = w / (points.length - 1);
  const coords = points.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; val: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const pctX = relativeX / rect.width;
    const viewBoxX = pctX * w;
    
    const idx = Math.min(points.length - 1, Math.max(0, Math.round(viewBoxX / step)));
    
    const activeX = idx * step;
    const activeY = h - (points[idx] / max) * h;
    
    const tooltipX = (activeX / w) * rect.width;
    const tooltipY = (activeY / h) * rect.height - 38;

    setHoveredIdx(idx);
    setTooltipPos({ x: tooltipX, y: tooltipY, val: points[idx] });
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
    setTooltipPos(null);
  };

  const activeX = hoveredIdx !== null ? hoveredIdx * step : 0;
  const activeY = hoveredIdx !== null ? h - (points[hoveredIdx] / max) * h : 0;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        style={{ width: "100%", height: "100px", overflow: "visible", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <polyline fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinejoin="round" points={coords} />
        <polyline
          fill="url(#grad)"
          stroke="none"
          points={`0,${h} ${coords} ${(points.length - 1) * step},${h}`}
        />

        {hoveredIdx !== null && (
          <>
            <line
              x1={activeX}
              y1={0}
              x2={activeX}
              y2={h}
              stroke="var(--color-border-strong)"
              strokeDasharray="3"
              strokeWidth="1.5"
            />
            <circle
              cx={activeX}
              cy={activeY}
              r={6}
              fill="var(--color-primary)"
              stroke="white"
              strokeWidth={2}
            />
          </>
        )}
      </svg>

      {tooltipPos && (
        <div
          style={{
            position: "absolute",
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: "translateX(-50%)",
            backgroundColor: "rgba(26, 46, 68, 0.9)",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            padding: "4px 8px",
            borderRadius: "var(--radius-full)",
            color: "white",
            fontSize: "10px",
            fontFamily: "var(--font-mono)",
            pointerEvents: "none",
            boxShadow: "var(--shadow-md)",
            zIndex: 10,
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            transition: "left 0.08s ease-out, top 0.08s ease-out"
          }}
        >
          <span style={{ fontWeight: 800, color: "var(--color-primary)" }}>{tooltipPos.val}</span>
          <span style={{ opacity: 0.8 }}>Views</span>
        </div>
      )}
    </div>
  );
}

export default function MerchantAnalyticsPage() {
  const [range, setRange] = useState<Range>("7d");
  const d = DATA[range];

  return (
    <div>
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Analytics</h1>
          <p>How customers are discovering and engaging with your stall.</p>
        </div>
        <div className={styles.chartRangeGroup}>
          {(["7d", "30d", "90d"] as Range[]).map((r) => (
            <button key={r} className={`${styles.chartRangeBtn} ${range === r ? styles.chartRangeBtnActive : ""}`} onClick={() => setRange(r)}>
              {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "90 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className={styles.kpiGrid}>
        {[
          { label: "Profile Views", value: d.views.toLocaleString(), up: true },
          { label: "Search Appearances", value: d.search.toLocaleString(), up: true },
          { label: "Menu Clicks", value: d.menuClicks.toLocaleString(), up: true },
          { label: "New Favourites", value: d.favs.toString(), up: true },
        ].map((k) => (
          <div key={k.label} className={styles.kpiCard}>
            <span className={styles.kpiLabel}>{k.label}</span>
            <div className={styles.kpiValue}>{k.value}</div>
            <div className={`${styles.kpiTrend} ${styles.trendUp}`}>
              <TrendingUp size={12} /> vs previous period
            </div>
          </div>
        ))}
      </div>

      {/* Profile views chart */}
      <div className={styles.chartWrapper}>
        <div className={styles.chartHeader}>
          <span className={styles.chartTitle}>Profile Views Trend</span>
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>{range}</span>
        </div>
        <LineChart points={d.chartPoints} />
      </div>

      <div className={styles.dashboardSplitGrid}>
        {/* Top dishes table */}
        <div className={styles.dashboardSectionCard}>
          <div className={styles.sectionHeaderRow}><h2>Top Dishes by Engagement</h2></div>
          <div className={styles.queueTableWrapper}>
            <table className={styles.queueTable}>
              <thead>
                <tr>
                  <th>Dish</th>
                  <th>Views</th>
                  <th>Favourites</th>
                  <th>Reviews</th>
                </tr>
              </thead>
              <tbody>
                {d.topDishes.map((dish, i) => (
                  <tr key={dish.name}>
                    <td>
                      <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", marginRight: "8px" }}>#{i + 1}</span>
                      {dish.name}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{dish.views.toLocaleString()}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{dish.favs}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{dish.reviews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Discovery sources */}
        <div className={styles.dashboardSectionCard}>
          <div className={styles.sectionHeaderRow}><h2>Customer Discovery Sources</h2></div>
          {d.sources.map((s) => (
            <div key={s.name} style={{ marginBottom: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-1)" }}>
                <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>{s.name}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-primary)" }}>{s.pct}%</span>
              </div>
              <div style={{ height: "8px", background: "var(--color-bg-soft)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${s.pct}%`, background: "var(--color-primary)", borderRadius: "var(--radius-full)", transition: "width 0.4s var(--ease-out)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
