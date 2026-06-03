export type ConsoleScaffoldCopy = {
  slug: string;
  title: string;
  intro: string;
  primaryActions: string[];
  emptyState: string;
  sections?: { title: string; body: string }[];
};

export const consoleScaffoldPages: Record<string, ConsoleScaffoldCopy> = {
  overview: {
    slug: "overview",
    title: "Hungry Console",
    intro:
      "Run Hungry from one place: app, website, merchants, trust queues, releases, notifications, and product operations.",
    primaryActions: ["Review inbox", "Check product analysis", "Send test notification"],
    emptyState: "No critical alerts right now.",
  },
  search: {
    slug: "search",
    title: "Console search",
    intro:
      "Search users, stalls, dishes, claims, feedback, reports, releases, and audit history from one operator surface.",
    primaryActions: ["Search all records", "Open recent result", "Filter by source"],
    emptyState: "No matching console records yet.",
  },
  inbox: {
    slug: "inbox",
    title: "Unified inbox",
    intro:
      "One queue for feedback, merchant issues, reports, moderation, crash-linked follow-ups, and application conversations.",
    primaryActions: ["Claim item", "Add note", "Reply", "Escalate"],
    emptyState: "No items need action right now.",
  },
  "stall-submissions": {
    slug: "stall-submissions",
    title: "Stall submissions",
    intro:
      "Review new stall suggestions, location corrections, evidence uploads, duplicate listings, and data-quality notes before publishing.",
    primaryActions: ["Approve submission", "Request more info", "Merge duplicate", "Reject"],
    emptyState: "No new stall submissions in this view.",
  },
  content: {
    slug: "content",
    title: "Content review",
    intro:
      "Review public-facing dish photos, profile copy, review media, reads, and featured content before they affect discovery.",
    primaryActions: ["Approve content", "Hide content", "Request edit", "Escalate"],
    emptyState: "No content items need review right now.",
  },
  activity: {
    slug: "activity",
    title: "Activity stream",
    intro:
      "Track cross-surface actions from users, merchants, console operators, campaigns, and system jobs.",
    primaryActions: ["Filter activity", "Open linked record", "Export slice"],
    emptyState: "No activity exists for the selected filters.",
  },
  messages: {
    slug: "messages",
    title: "Messages",
    intro:
      "Monitor support conversations, merchant replies, escalation threads, and delivery status for operational messages.",
    primaryActions: ["Open thread", "Assign owner", "Escalate"],
    emptyState: "No message threads need action right now.",
  },
  releases: {
    slug: "releases",
    title: "Release health",
    intro:
      "Summarise app builds, website deploys, rollout health, crash signals, and linked GitHub, Vercel, EAS, and Sentry evidence.",
    primaryActions: ["Open release notes", "Check Sentry", "Open Vercel", "Open EAS"],
    emptyState: "No release blockers are active right now.",
    sections: [
      {
        title: "Specialist tools stay linked",
        body:
          "Use Hungry Console for daily release status. Open GitHub, Vercel, EAS, or Sentry when you need logs, traces, builds, or ownership history.",
      },
    ],
  },
  experiments: {
    slug: "experiments",
    title: "Experiments",
    intro:
      "Track active tests, audience rules, rollout percentages, guardrail metrics, and experiment decisions.",
    primaryActions: ["Review experiment", "Pause rollout", "Open PostHog"],
    emptyState: "No experiments are running for the selected environment.",
  },
  "app-config": {
    slug: "app-config",
    title: "App configuration",
    intro:
      "Review remote configuration, kill switches, public copy toggles, onboarding defaults, and operational app settings.",
    primaryActions: ["Review config", "Compare environments", "Open change history"],
    emptyState: "No configuration changes need approval.",
  },
  "data-quality": {
    slug: "data-quality",
    title: "Data quality",
    intro:
      "Find duplicate stalls, stale hours, missing menus, broken media, suspicious submissions, and low-confidence location data.",
    primaryActions: ["Open duplicate queue", "Review stale records", "Export issues"],
    emptyState: "No data-quality findings for this slice.",
  },
  issues: {
    slug: "issues",
    title: "Issues",
    intro:
      "Connect support feedback, reports, release regressions, Sentry issues, and operational follow-ups in one triage view.",
    primaryActions: ["Triage issue", "Assign owner", "Link evidence"],
    emptyState: "No open issues in this view.",
  },
  team: {
    slug: "team",
    title: "Team and roles",
    intro:
      "Manage operator access, role-aware actions, staff permissions, and audit visibility for Hungry Console.",
    primaryActions: ["Invite teammate", "Review roles", "Open audit log"],
    emptyState: "No pending team invitations.",
  },
  settings: {
    slug: "settings",
    title: "Console settings",
    intro:
      "Manage environment defaults, notification preferences, linked tools, role scopes, and console safety controls.",
    primaryActions: ["Update settings", "Review integrations", "Open audit log"],
    emptyState: "No settings need attention right now.",
  },
};

export const productAnalyticsScaffoldPages: Record<string, ConsoleScaffoldCopy> = {
  overview: {
    slug: "overview",
    title: "Product analysis overview",
    intro:
      "Track growth, discovery quality, merchant adoption, website conversion, and release health in one view.",
    primaryActions: ["Open PostHog workspace", "View release health", "Compare audiences"],
    emptyState: "No metrics yet for the selected filters.",
  },
  foodies: {
    slug: "foodies",
    title: "Foodie analytics",
    intro: "Review sign-up, onboarding, discovery, search, save, review, and retention behaviour for foodies.",
    primaryActions: ["Open activation funnel", "Compare cohorts", "View saved dashboards"],
    emptyState: "No foodie metrics yet for this slice.",
  },
  merchants: {
    slug: "merchants",
    title: "Merchant analytics",
    intro:
      "Track claim, application, verification, profile update, menu update, promotion, and reply activity for Merchant Mode.",
    primaryActions: ["Open merchant funnel", "Review verification", "Compare cohorts"],
    emptyState: "No merchant metrics yet for this slice.",
  },
  website: {
    slug: "website",
    title: "Website conversion",
    intro:
      "Track homepage, Merchant Mode page, waitlist submissions, CTA paths, and content performance.",
    primaryActions: ["Open website dashboard", "Compare pages", "Review CTA paths"],
    emptyState: "No website metrics yet for this slice.",
  },
  acquisition: {
    slug: "acquisition",
    title: "Acquisition",
    intro: "Summarise acquisition source, campaign, landing page, referral, and waitlist quality signals.",
    primaryActions: ["Compare channels", "Open campaign dashboard", "Export source mix"],
    emptyState: "No acquisition data for the selected filters.",
  },
  funnels: {
    slug: "funnels",
    title: "Funnels",
    intro: "Review foodie activation, merchant activation, website conversion, and key action funnels.",
    primaryActions: ["Open PostHog funnels", "Compare audiences", "Save view"],
    emptyState: "No funnel data for the selected filters.",
  },
  retention: {
    slug: "retention",
    title: "Retention cohorts",
    intro: "Compare sticky user and merchant behaviours over time by cohort, audience, and platform.",
    primaryActions: ["Open retention cohorts", "Compare cohorts", "Widen date range"],
    emptyState: "No retention data for this slice yet.",
  },
  events: {
    slug: "events",
    title: "Events",
    intro: "Inspect event volume, naming quality, source health, and high-value product actions.",
    primaryActions: ["Open event explorer", "Review schema", "Export event list"],
    emptyState: "No events match this filter.",
  },
  cohorts: {
    slug: "cohorts",
    title: "Cohorts",
    intro: "Review saved audiences for foodies, merchants, waitlist users, and rollout targets.",
    primaryActions: ["Open cohorts", "Compare cohort", "Create audience note"],
    emptyState: "No cohorts are configured for this view.",
  },
  notifications: {
    slug: "notifications",
    title: "Notifications and campaigns",
    intro: "Tie messaging activity to opens, taps, downstream engagement, unsubscribes, and operational sends.",
    primaryActions: ["Open campaign dashboard", "Compare sends", "Review delivery"],
    emptyState: "No notification metrics for this slice.",
  },
  "feedback-and-issues": {
    slug: "feedback-and-issues",
    title: "Feedback and issue correlation",
    intro: "Correlate feedback, reports, crashes, release changes, and feature-flag movement.",
    primaryActions: ["Open Sentry", "Review feedback", "Compare release"],
    emptyState: "No correlated issues for this slice.",
  },
  releases: {
    slug: "releases",
    title: "Release analytics",
    intro: "Summarise release health, adoption, regressions, and linked evidence from Vercel, GitHub, EAS, and Sentry.",
    primaryActions: ["Open release health", "Open Sentry", "Open Vercel"],
    emptyState: "No release metrics for this slice.",
  },
  "feature-flags": {
    slug: "feature-flags",
    title: "Feature flags and experiments",
    intro: "Review rollout percentage, audience rules, impact, holdbacks, and experiment guardrails.",
    primaryActions: ["Open feature flags", "Open PostHog experiments", "Pause rollout"],
    emptyState: "No feature-flag metrics for this slice.",
  },
  "data-quality": {
    slug: "data-quality",
    title: "Data-quality analytics",
    intro: "Track missing menus, stale hours, duplicate stalls, broken media, and low-confidence merchant records.",
    primaryActions: ["Open data-quality queue", "Compare areas", "Export findings"],
    emptyState: "No data-quality metrics for this slice.",
  },
  posthog: {
    slug: "posthog",
    title: "PostHog deep dive",
    intro:
      "Hungry Console surfaces the KPIs the team checks every day. Open PostHog when you need funnels, cohorts, trends, replays, event breakdowns, or feature-flag impact.",
    primaryActions: ["Open PostHog workspace", "View saved dashboards"],
    emptyState: "No PostHog dashboard has been linked for this environment.",
  },
};
