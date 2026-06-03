"use client";

import React, { useState, useRef } from "react";
import { ExternalLink } from "lucide-react";
import styles from "../console.module.css";

function InteractiveLineChart({ points, labels, yLabel = "Value" }: { points: number[]; labels: string[]; yLabel?: string }) {
  const max = Math.max(...points) || 1;
  const w = 600; const h = 120;
  const step = w / (points.length - 1);
  const coords = points.map((v, i) => `${i * step},${h - (v / max) * h * 0.8 - 10}`).join(" ");

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; val: number; label: string } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const pctX = relativeX / rect.width;
    const viewBoxX = pctX * w;
    
    const idx = Math.min(points.length - 1, Math.max(0, Math.round(viewBoxX / step)));
    
    const activeX = idx * step;
    const activeY = h - (points[idx] / max) * h * 0.8 - 10;
    
    const tooltipX = (activeX / w) * rect.width;
    const tooltipY = (activeY / h) * rect.height - 38;

    setHoveredIdx(idx);
    setTooltipPos({ x: tooltipX, y: tooltipY, val: points[idx], label: labels[idx] });
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
    setTooltipPos(null);
  };

  const activeX = hoveredIdx !== null ? hoveredIdx * step : 0;
  const activeY = hoveredIdx !== null ? h - (points[hoveredIdx] / max) * h * 0.8 - 10 : 0;

  return (
    <div style={{ position: "relative", width: "100%", margin: "var(--space-4) 0" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        style={{ width: "100%", height: "140px", overflow: "visible", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <polyline fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinejoin="round" points={coords} />
        <polyline
          fill="url(#lineGrad)"
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

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "8px", fontFamily: "var(--font-mono)" }}>
        {labels.map((lbl) => <span key={lbl}>{lbl}</span>)}
      </div>

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
          <span style={{ color: "var(--color-primary)", fontWeight: 800 }}>{tooltipPos.label}:</span>
          <span>{tooltipPos.val.toLocaleString()}</span>
          <span style={{ opacity: 0.7 }}>{yLabel}</span>
        </div>
      )}
    </div>
  );
}

function InteractiveBarChart({ data, yLabel = "Count" }: { data: { label: string; value: number; displayValue?: string }[]; yLabel?: string }) {
  const max = Math.max(...data.map(d => d.value)) || 1;
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; val: number; label: string } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>, idx: number, val: number, label: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgEl = e.currentTarget.ownerSVGElement;
    if (!svgEl) return;
    const svgRect = svgEl.getBoundingClientRect();
    
    const x = rect.left - svgRect.left + rect.width;
    const y = rect.top - svgRect.top + rect.height / 2 - 16;
    
    setHoveredIdx(idx);
    setTooltipPos({ x, y, val, label });
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
    setTooltipPos(null);
  };

  return (
    <div style={{ position: "relative", width: "100%", margin: "var(--space-4) 0" }}>
      <svg viewBox="0 0 400 160" style={{ width: "100%", height: "200px" }}>
        {data.map((item, idx) => {
          const barWidth = Math.round((item.value / max) * 260);
          const y = idx * 36 + 10;
          const isHovered = hoveredIdx === idx;
          return (
            <g key={item.label}>
              <text
                x="10"
                y={y + 16}
                fill="var(--color-text-primary)"
                fontSize="10"
                fontWeight="700"
                fontFamily="var(--font-nunito)"
              >
                {item.label}
              </text>
              <rect
                x="120"
                y={y}
                width="260"
                height="22"
                fill="var(--color-bg-soft)"
                rx="4"
              />
              <rect
                x="120"
                y={y}
                width={barWidth}
                height="22"
                fill={isHovered ? "var(--color-primary-dark)" : "var(--color-primary)"}
                opacity={isHovered ? "1" : "0.85"}
                rx="4"
                style={{ cursor: "pointer", transition: "all var(--duration-fast) var(--ease-out)" }}
                onMouseMove={(e) => handleMouseMove(e, idx, item.value, item.label)}
                onMouseLeave={handleMouseLeave}
              />
              <text
                x={125 + barWidth}
                y={y + 15}
                fill="var(--color-text-muted)"
                fontSize="9"
                fontFamily="var(--font-mono)"
                fontWeight="bold"
              >
                {item.displayValue || item.value.toLocaleString()}
              </text>
            </g>
          );
        })}
      </svg>

      {tooltipPos && (
        <div
          style={{
            position: "absolute",
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: "translateY(-50%)",
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
          <span style={{ fontWeight: 800, color: "var(--color-primary)" }}>{tooltipPos.val.toLocaleString()}</span>
          <span>{yLabel}</span>
        </div>
      )}
    </div>
  );
}

function InteractiveStackedBar({ segments }: { segments: { name: string; pct: number; value: number }[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; name: string; val: number; pct: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>, idx: number, name: string, val: number, pct: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgEl = e.currentTarget.ownerSVGElement;
    if (!svgEl) return;
    const svgRect = svgEl.getBoundingClientRect();
    
    const x = rect.left - svgRect.left + rect.width / 2;
    const y = rect.top - svgRect.top - 36;
    
    setHoveredIdx(idx);
    setTooltipPos({ x, y, name, val, pct });
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
    setTooltipPos(null);
  };

  const segmentsWithOffsets = segments.map((segment, index) => ({
    ...segment,
    width: segment.pct * 6,
    x: segments.slice(0, index).reduce((total, item) => total + item.pct, 0) * 6,
  }));

  return (
    <div style={{ position: "relative", width: "100%", margin: "var(--space-4) 0" }}>
      <svg viewBox="0 0 600 40" style={{ width: "100%", height: "50px", overflow: "visible" }}>
        {segmentsWithOffsets.map((s, idx) => {
          const isHovered = hoveredIdx === idx;
          
          const colors = ["var(--color-primary)", "var(--color-accent)", "var(--color-success)", "var(--color-border-strong)"];
          const hoverColors = ["var(--color-primary-dark)", "#E09315", "#3E6411", "#BCAF9F"];
          const fill = isHovered ? hoverColors[idx % colors.length] : colors[idx % colors.length];

          return (
            <rect
              key={s.name}
              x={s.x}
              y="5"
              width={s.width}
              height="30"
              fill={fill}
              style={{ cursor: "pointer", transition: "all var(--duration-fast) var(--ease-out)" }}
              onMouseMove={(e) => handleMouseMove(e, idx, s.name, s.value, s.pct)}
              onMouseLeave={handleMouseLeave}
              rx="4"
            />
          );
        })}
      </svg>

      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", marginTop: "var(--space-2)" }}>
        {segments.map((s, idx) => {
          const colors = ["var(--color-primary)", "var(--color-accent)", "var(--color-success)", "var(--color-border-strong)"];
          return (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--font-size-xs)" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: colors[idx % colors.length] }} />
              <span style={{ fontWeight: 700 }}>{s.name}</span>
              <span style={{ color: "var(--color-text-muted)" }}>({s.pct}%)</span>
            </div>
          );
        })}
      </div>

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
          <span style={{ fontWeight: 800, color: "var(--color-primary)" }}>{tooltipPos.name}:</span>
          <span>{tooltipPos.val.toLocaleString()} sessions</span>
          <span style={{ opacity: 0.7 }}>({tooltipPos.pct}%)</span>
        </div>
      )}
    </div>
  );
}

type TabName = "overview" | "foodies" | "merchants" | "website" | "releases" | "flags";

export default function ProductAnalytics() {
  const [activeTab, setActiveTab] = useState<TabName>("overview");

  // Mock metric aggregates
  const mockOverviewMetrics = [
    { label: "Total App Signups", value: "32,842", change: "+14.8%", isPositive: true },
    { label: "Weekly Active Users", value: "8,924", change: "+8.2%", isPositive: true },
    { label: "Merchant Accounts", value: "342", change: "+12.1%", isPositive: true },
    { label: "Website Conversion", value: "4.82%", change: "-0.15%", isPositive: false },
    { label: "Waitlist Submissions", value: "1,204", change: "+24.0%", isPositive: true },
    { label: "Stall Submissions", value: "148", change: "+5.4%", isPositive: true },
    { label: "Weekly Search Volume", value: "48,300", change: "+18.9%", isPositive: true },
    { label: "Dish Detail Views", value: "124,000", change: "+22.4%", isPositive: true },
  ];

  return (
    <div>
      {/* HEADER SECTION */}
      <div className={styles.headerTitleArea}>
        <div>
          <h1>Product analysis</h1>
          <p>Track growth, discovery quality, merchant adoption, website conversion, and release health in one view.</p>
          <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-1)", fontFamily: "var(--font-mono)" }}>
            Daily operating summaries here. Deep analysis in connected tools.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <a href="https://posthog.com" target="_blank" rel="noopener noreferrer" className={styles.actionButtonSecondary}>
            <ExternalLink size={16} />
            Open PostHog workspace
          </a>
        </div>
      </div>

      <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-4)", padding: "var(--space-2) var(--space-4)", background: "var(--color-bg-soft)", borderRadius: "var(--radius-full)", border: "1px solid var(--color-border)", display: "inline-block" }}>
        All figures reflect the selected environment, audience, platform, app version, and date range.
      </div>

      {/* METRIC SUBNAVIGATION TABS */}
      <div className={styles.analyticsTabs}>
        <button 
          className={`${styles.analyticsTab} ${activeTab === "overview" ? styles.analyticsTabActive : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Executive Overview
        </button>
        <button 
          className={`${styles.analyticsTab} ${activeTab === "foodies" ? styles.analyticsTabActive : ""}`}
          onClick={() => setActiveTab("foodies")}
        >
          Foodie Analytics
        </button>
        <button 
          className={`${styles.analyticsTab} ${activeTab === "merchants" ? styles.analyticsTabActive : ""}`}
          onClick={() => setActiveTab("merchants")}
        >
          Merchant Analytics
        </button>
        <button 
          className={`${styles.analyticsTab} ${activeTab === "website" ? styles.analyticsTabActive : ""}`}
          onClick={() => setActiveTab("website")}
        >
          Website Traffic
        </button>
        <button 
          className={`${styles.analyticsTab} ${activeTab === "releases" ? styles.analyticsTabActive : ""}`}
          onClick={() => setActiveTab("releases")}
        >
          Releases & Stability
        </button>
        <button 
          className={`${styles.analyticsTab} ${activeTab === "flags" ? styles.analyticsTabActive : ""}`}
          onClick={() => setActiveTab("flags")}
        >
          Feature Flag Rollouts
        </button>
      </div>

      {/* RENDER ACTIVE TAB VIEW */}
      {activeTab === "overview" && (
        <div>
          {/* North Star KPI Card */}
          <div className={styles.dashboardSectionCard} style={{ background: "linear-gradient(135deg, var(--color-ink-deep), var(--color-plum-shadow))", color: "white", border: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <span className={styles.eyebrow} style={{ color: "var(--color-primary)" }}>App North Star Metric</span>
                <h2 style={{ color: "white", fontSize: "2.2rem", margin: "8px 0" }}>Qualified Food Discovery Sessions</h2>
                <p style={{ color: "rgba(255,255,255,0.72)", maxWidth: "800px", fontSize: "var(--font-size-md)" }}>
                  A session is marked as &quot;Qualified&quot; when a diner submits a search, views a dish/stall, taps a map pin, or interacts with Decide For Me.
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "var(--font-size-xs)", fontFamily: "var(--font-mono)", opacity: 0.6 }}>Weekly Average</span>
                <div style={{ fontSize: "2.8rem", fontWeight: "800", color: "var(--color-primary)" }}>42,800</div>
                <span style={{ color: "var(--color-success)", fontWeight: "700" }}>+14.2% Growth</span>
              </div>
            </div>
            <div style={{ marginTop: "24px" }}>
              <InteractiveLineChart 
                points={[34200, 36800, 35900, 38400, 40100, 41500, 42800]} 
                labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"]} 
                yLabel="Sessions" 
              />
            </div>
          </div>
 
          {/* Metric Overview Grid */}
          <div className={styles.metricsOverviewGrid}>
            {mockOverviewMetrics.map((metric) => (
              <div className={styles.kpiCard} key={metric.label}>
                <span className={styles.kpiLabel}>{metric.label}</span>
                <span className={styles.kpiValue}>{metric.value}</span>
                <span className={`${styles.kpiTrend} ${metric.isPositive ? styles.trendUp : styles.trendDown}`}>
                  {metric.change}
                </span>
              </div>
            ))}
          </div>
 
          {/* Website Waitlist Funnel */}
          <div className={styles.dashboardSectionCard}>
            <div className={styles.sectionHeaderRow}>
              <h2>Acquisition & Activation Funnels</h2>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-sm)", fontWeight: "700", marginBottom: "12px" }}>
                  <span>Website Conversion (Waitlist Signup Flow)</span>
                  <span>Conversion Rate: 12.0%</span>
                </div>
                <InteractiveStackedBar segments={[
                  { name: "Completed Signup", pct: 12, value: 1200 },
                  { name: "Started But Bounced", pct: 18, value: 1800 },
                  { name: "Bounced Directly", pct: 70, value: 7000 }
                ]} />
              </div>
            </div>
          </div>
        </div>
      )}
 
      {activeTab === "foodies" && (
        <div className={styles.dashboardSectionCard}>
          <div className={styles.sectionHeaderRow}>
            <h2>Foodie Cravings & Discovery Actions</h2>
          </div>
          <div style={{ marginBottom: "24px" }}>
            <InteractiveBarChart data={[
              { label: "Laksa Cravings", value: 12400 },
              { label: "Chicken Rice Cravings", value: 9800 },
              { label: "Char Kway Teow", value: 8500 },
              { label: "Hokkien Mee", value: 6200 },
              { label: "Lor Mee", value: 4100 }
            ]} yLabel="Searches" />
          </div>
          <div className={styles.queueTableWrapper}>
            <table className={styles.queueTable}>
              <thead>
                <tr>
                  <th>Action Event</th>
                  <th>Weekly Volume</th>
                  <th>Conversion rate</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: "700" }}>search_submitted</td>
                  <td>28,400</td>
                  <td style={{ color: "var(--color-success)", fontWeight: "700" }}>82%</td>
                  <td>Dinners submitting exact key phrases or location radius selections.</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: "700" }}>dish_viewed</td>
                  <td>124,000</td>
                  <td style={{ color: "var(--color-success)", fontWeight: "700" }}>94%</td>
                  <td>Detailed dish cards opened to compare pricing, reviews, or photo proof.</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: "700" }}>decide_for_me_triggered</td>
                  <td>4,200</td>
                  <td style={{ color: "var(--color-success)", fontWeight: "700" }}>38%</td>
                  <td>Randomized 6-axis taste vectors triggered for dining suggestions.</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: "700" }}>delivery_link_tapped</td>
                  <td>1,842</td>
                  <td style={{ color: "var(--color-primary)", fontWeight: "700" }}>6.4%</td>
                  <td>Outbound referral clicks to GrabFood, Foodpanda, or payment channels.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
 
      {activeTab === "merchants" && (
        <div className={styles.dashboardSectionCard}>
          <div className={styles.sectionHeaderRow}>
            <h2>Merchant Mode Funnel Metrics</h2>
          </div>
          <div style={{ marginBottom: "24px" }}>
            <InteractiveBarChart data={[
              { label: "Interest Submitted", value: 342 },
              { label: "Application Opened", value: 182 },
              { label: "Evidence Uploaded", value: 124 },
              { label: "Badge Awarded", value: 98 }
            ]} yLabel="Outlets" />
          </div>
          <div className={styles.queueTableWrapper}>
            <table className={styles.queueTable}>
              <thead>
                <tr>
                  <th>Funnels Stage</th>
                  <th>Outlets Count</th>
                  <th>Adoption Ratio</th>
                  <th>Operational Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Merchant waitlist submitted</td>
                  <td>342</td>
                  <td>100%</td>
                  <td>Waitlist registrations on the public site.</td>
                </tr>
                <tr>
                  <td>Merchant Application Opened</td>
                  <td>182</td>
                  <td>53.2%</td>
                  <td>Draft claims created or new outlet details loaded in App.</td>
                </tr>
                <tr>
                  <td>Verification Evidence Submitted</td>
                  <td>124</td>
                  <td>36.2%</td>
                  <td>Video walkaround, SFA food license, or MyInfo business details uploaded.</td>
                </tr>
                <tr>
                  <td>Verified Outlet Badges Awarded</td>
                  <td>98</td>
                  <td>28.6%</td>
                  <td>Approved by Hungry Operations (Console review).</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PostHog Deep-Dive Card */}
      {activeTab === "overview" && (
        <div className={styles.dashboardSectionCard} style={{ borderLeft: "4px solid var(--color-primary)" }}>
          <div className={styles.sectionHeaderRow}>
            <div>
              <h2 style={{ marginBottom: "var(--space-1)" }}>PostHog deep dive</h2>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-sm)", maxWidth: "640px" }}>
                Hungry Console surfaces the KPIs the team checks every day. Open PostHog when you need funnels, cohorts, trends, replays, event breakdowns, or feature-flag impact.
              </p>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
              <a href="https://posthog.com" target="_blank" rel="noopener noreferrer" className={styles.actionButton} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <ExternalLink size={14} /> Open PostHog workspace
              </a>
              <a href="https://posthog.com/dashboard" target="_blank" rel="noopener noreferrer" className={styles.actionButtonSecondary} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <ExternalLink size={14} /> View saved dashboards
              </a>
            </div>
          </div>
          <div className={styles.queueTableWrapper} style={{ marginTop: "var(--space-4)" }}>
            <table className={styles.queueTable}>
              <thead>
                <tr>
                  <th>Dashboard</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Executive overview", "Daily leadership read on app, website, merchant, issue, and release movement."],
                  ["Foodie activation funnel", "Shows whether sign-up, onboarding, and early discovery actions are improving."],
                  ["Merchant activation funnel", "Tracks claim/application, verification, profile update, menu update, and first reply."],
                  ["Website conversion", "Best view for homepage, merchant page, and waitlist CTA performance."],
                  ["Search and discovery", "Helps product teams understand demand, discovery friction, and top search patterns."],
                  ["Merchant Mode usage", "Best operational lens on profile updates, menu edits, promotions, and AI usage."],
                  ["Retention cohorts", "Needed to compare sticky user and merchant behaviours over time."],
                  ["Notifications and campaigns", "Ties messaging activity to opens, taps, and downstream engagement."],
                  ["Feature flags and experiments", "Useful when a rollout or experiment needs product and ops context."],
                  ["Error and issue correlation", "Helps correlate spikes in feedback, reports, and errors with releases or flags."],
                ].map(([label, purpose]) => (
                  <tr key={label}>
                    <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{label}</td>
                    <td style={{ color: "var(--color-text-secondary)" }}>{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "website" && (
        <div className={styles.dashboardSectionCard}>
          <div className={styles.sectionHeaderRow}>
            <h2>Traffic Sources & Page Performance</h2>
          </div>
          <div style={{ marginBottom: "24px" }}>
            <InteractiveStackedBar segments={[
              { name: "Google Organic", pct: 50, value: 4200 },
              { name: "Instagram Referral", pct: 33, value: 2800 },
              { name: "Direct / Word of Mouth", pct: 17, value: 1400 }
            ]} />
          </div>
          <div className={styles.queueTableWrapper}>
            <table className={styles.queueTable}>
              <thead>
                <tr>
                  <th>Acquisition Source (UTM)</th>
                  <th>Sessions</th>
                  <th>Waitlist Conversion</th>
                  <th>Engagement (Bounce Rate)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Google Search / Organic</td>
                  <td>4,200</td>
                  <td style={{ fontWeight: "700" }}>14.2%</td>
                  <td>28.4%</td>
                </tr>
                <tr>
                  <td>Instagram / Social Referrals</td>
                  <td>2,800</td>
                  <td style={{ fontWeight: "700" }}>9.8%</td>
                  <td>42.1%</td>
                </tr>
                <tr>
                  <td>Direct / Word of mouth</td>
                  <td>1,400</td>
                  <td style={{ fontWeight: "700" }}>22.4%</td>
                  <td>12.0%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
 
      {activeTab === "releases" && (
        <div className={styles.dashboardSectionCard}>
          <div className={styles.sectionHeaderRow}>
            <h2>Releases Health & Stability Board</h2>
          </div>
          <div style={{ marginBottom: "24px" }}>
            <span style={{ fontSize: "var(--font-size-xs)", fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>Crash-Free Users Trend (Last 7 Days)</span>
            <InteractiveLineChart 
              points={[99.95, 99.97, 99.98, 99.99, 99.92, 99.94, 99.98]} 
              labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"]} 
              yLabel="%" 
            />
          </div>
          <div className={styles.queueTableWrapper}>
            <table className={styles.queueTable}>
              <thead>
                <tr>
                  <th>App Version</th>
                  <th>Platform</th>
                  <th>Adoption Rate</th>
                  <th>Crash-Free Users</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: "700" }}>v1.10.4-production</td>
                  <td>iOS</td>
                  <td>84%</td>
                  <td style={{ color: "var(--color-primary)", fontWeight: "700" }}>99.24% (Elevated)</td>
                  <td><span className={`${styles.badge} ${styles.badgeCritical}`}>Triage</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "700" }}>v1.10.3-production</td>
                  <td>iOS + Android</td>
                  <td>16%</td>
                  <td style={{ color: "var(--color-success)", fontWeight: "700" }}>99.98%</td>
                  <td><span className={`${styles.badge} ${styles.badgeResolved}`}>Stable</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "700" }}>v1.10.2-production</td>
                  <td>Android</td>
                  <td>0.2%</td>
                  <td style={{ color: "var(--color-success)", fontWeight: "700" }}>99.99%</td>
                  <td><span className={`${styles.badge} ${styles.badgeResolved}`}>Deprecating</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "flags" && (
        <div className={styles.dashboardSectionCard}>
          <div className={styles.sectionHeaderRow}>
            <h2>Feature Flag Exposure & Conversions</h2>
          </div>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "20px" }}>
            Below are active percentage rollouts synced from LaunchDarkly/PostHog flags. Toggle values in the Feature Flags console.
          </p>
          <div className={styles.queueTableWrapper}>
            <table className={styles.queueTable}>
              <thead>
                <tr>
                  <th>Flag Key</th>
                  <th>Rollout %</th>
                  <th>Exposed Users</th>
                  <th>Impact (Avg Rating change)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: "700" }}>merchantCentreEnabled</td>
                  <td>100%</td>
                  <td>14,842</td>
                  <td>+0.12 avg rating</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: "700" }}>directMessagesEnabled</td>
                  <td>25%</td>
                  <td>3,710</td>
                  <td style={{ color: "var(--color-success)", fontWeight: "700" }}>+0.35 (Positive signal)</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: "700" }}>gamificationEnabled</td>
                  <td>50%</td>
                  <td>7,421</td>
                  <td>Neutral</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
