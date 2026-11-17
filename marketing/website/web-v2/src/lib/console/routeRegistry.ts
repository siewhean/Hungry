import {
  Activity,
  BarChart2,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  Search,
  ShieldAlert,
  Sliders,
  Store,
  UserCheck,
  Users,
  Users2,
  type LucideIcon,
} from "lucide-react";

export type ConsoleRole = "admin" | "ops" | "viewer";
export type ConsoleRouteStatus = "ready" | "partial" | "hidden";
export type ConsoleRouteGroup = "Operations" | "Platform";

export type ConsoleRouteDefinition = {
  dataSources: string[];
  group: ConsoleRouteGroup;
  href: string;
  icon: LucideIcon;
  label: string;
  minRole: ConsoleRole;
  purpose: string;
  section: string;
  status: ConsoleRouteStatus;
};

const roleRank: Record<ConsoleRole, number> = {
  viewer: 0,
  ops: 1,
  admin: 2,
};

export const CONSOLE_ROUTES: ConsoleRouteDefinition[] = [
  {
    dataSources: [
      "website_waitlist_entries",
      "merchant_accounts",
      "merchant_verifications",
      "content_reports",
      "website_console_audit_events",
    ],
    group: "Operations",
    href: "/console",
    icon: LayoutDashboard,
    label: "Overview",
    minRole: "viewer",
    purpose: "Live operational health, queue counts, recent events, and links to actionable console pages.",
    section: "overview",
    status: "ready",
  },
  {
    dataSources: [
      "user_profiles",
      "merchant_accounts",
      "merchant_outlets",
      "website_waitlist_entries",
      "content_reports",
      "website_console_audit_events",
    ],
    group: "Operations",
    href: "/console/search",
    icon: Search,
    label: "Search",
    minRole: "viewer",
    purpose: "Read-only cross-console lookup for users, merchants, waitlist entries, reports, and audit records.",
    section: "search",
    status: "partial",
  },
  {
    dataSources: [
      "merchant_claim_interests",
      "merchant_change_requests",
      "menu_photo_submissions",
      "content_reports",
      "console_feedback_threads",
    ],
    group: "Operations",
    href: "/console/inbox",
    icon: Inbox,
    label: "Unified Inbox",
    minRole: "ops",
    purpose: "One triage queue for claims, submissions, reports, feedback, and data-quality work.",
    section: "inbox",
    status: "partial",
  },
  {
    dataSources: ["merchant_accounts", "merchant_outlets", "venues", "dishes", "merchant_verifications"],
    group: "Operations",
    href: "/console/merchants",
    icon: Store,
    label: "Merchants",
    minRole: "viewer",
    purpose: "Merchant and outlet registry with verification, linked venue, dish count, and profile completeness.",
    section: "merchants",
    status: "ready",
  },
  {
    dataSources: ["merchant_change_requests", "merchant_change_request_events", "menu_photo_submissions", "dishes_draft"],
    group: "Operations",
    href: "/console/stall-submissions",
    icon: ClipboardList,
    label: "Stall Submissions",
    minRole: "ops",
    purpose: "Review merchant edits, menu photo submissions, and draft dish workflows.",
    section: "stall-submissions",
    status: "partial",
  },
  {
    dataSources: ["auth.users", "user_profiles", "content_reports", "website_console_audit_events"],
    group: "Operations",
    href: "/console/users",
    icon: Users,
    label: "Users",
    minRole: "viewer",
    purpose: "User lookup with account state, profile details, activity summary, and moderation history.",
    section: "users",
    status: "ready",
  },
  {
    dataSources: ["website_waitlist_entries", "website_console_audit_events"],
    group: "Operations",
    href: "/console/waitlist",
    icon: Users2,
    label: "Waitlist",
    minRole: "viewer",
    purpose: "Production waitlist review with filters, export-ready data, and audited destructive actions.",
    section: "waitlist",
    status: "ready",
  },
  {
    dataSources: ["merchant_verifications", "merchant_claim_interests", "merchant_accounts", "merchant_outlets"],
    group: "Operations",
    href: "/console/merchant-applications",
    icon: UserCheck,
    label: "Merchant Claims",
    minRole: "ops",
    purpose: "Approve, reject, or request information for merchant verifications and claim interests.",
    section: "merchant-applications",
    status: "ready",
  },
  {
    dataSources: ["console_feedback_threads", "website_waitlist_entries"],
    group: "Operations",
    href: "/console/feedback",
    icon: Inbox,
    label: "User Feedback",
    minRole: "ops",
    purpose: "Production feedback queue with status, assignment, notes, and reply/contact metadata.",
    section: "feedback",
    status: "partial",
  },
  {
    dataSources: ["content_reports"],
    group: "Operations",
    href: "/console/reports",
    icon: ShieldAlert,
    label: "Moderation Queue",
    minRole: "ops",
    purpose: "Review content reports and moderation actions with resolve, dismiss, or escalate outcomes.",
    section: "reports",
    status: "ready",
  },
  {
    dataSources: ["menu_photo_submissions", "dishes_draft", "merchant_change_requests"],
    group: "Operations",
    href: "/console/content",
    icon: ClipboardList,
    label: "Content Review",
    minRole: "ops",
    purpose: "Review menu photos, dish drafts, profile edits, and published content changes.",
    section: "content",
    status: "partial",
  },
  {
    dataSources: ["website_console_audit_events"],
    group: "Operations",
    href: "/console/activity",
    icon: Activity,
    label: "Activity",
    minRole: "viewer",
    purpose: "Immutable operational stream from console audit events and app activity tables.",
    section: "activity",
    status: "ready",
  },
  {
    dataSources: ["console_issue_links"],
    group: "Operations",
    href: "/console/releases",
    icon: ClipboardList,
    label: "Releases",
    minRole: "viewer",
    purpose: "Release evidence dashboard linking GitHub, Vercel, EAS, and Supabase checks.",
    section: "releases",
    status: "partial",
  },
  {
    dataSources: ["website_console_audit_events"],
    group: "Platform",
    href: "/console/product-analytics",
    icon: BarChart2,
    label: "Product Analytics",
    minRole: "viewer",
    purpose: "Real Supabase analytics and rollups only; unsupported charts stay hidden.",
    section: "product-analytics",
    status: "partial",
  },
  {
    dataSources: ["console_feature_flags", "website_console_audit_events"],
    group: "Platform",
    href: "/console/feature-flags",
    icon: Sliders,
    label: "Feature Flags",
    minRole: "admin",
    purpose: "Environment-scoped feature flags with rollout state, validation, and audit trail.",
    section: "feature-flags",
    status: "partial",
  },
  {
    dataSources: ["console_app_config", "website_console_audit_events"],
    group: "Platform",
    href: "/console/app-config",
    icon: Sliders,
    label: "App Config",
    minRole: "admin",
    purpose: "Typed remote app configuration with validation, environment targeting, and audit history.",
    section: "app-config",
    status: "partial",
  },
  {
    dataSources: ["venues", "dishes", "merchant_outlets", "merchant_change_requests", "console_issue_links"],
    group: "Platform",
    href: "/console/data-quality",
    icon: ClipboardList,
    label: "Data Quality",
    minRole: "ops",
    purpose: "Actionable queue for missing photos, menu gaps, stale hours, duplicates, and bad coordinates.",
    section: "data-quality",
    status: "partial",
  },
  {
    dataSources: ["console_issue_links", "content_reports", "console_feedback_threads"],
    group: "Platform",
    href: "/console/issues",
    icon: ShieldAlert,
    label: "Issues",
    minRole: "ops",
    purpose: "Ops issue tracker fed by reports, feedback, releases, and data-quality problems.",
    section: "issues",
    status: "partial",
  },
  {
    dataSources: ["website_console_audit_events"],
    group: "Platform",
    href: "/console/audit-log",
    icon: ClipboardList,
    label: "Audit Log",
    minRole: "viewer",
    purpose: "Searchable read-only audit log for console reads, mutations, and app audit sources.",
    section: "audit-log",
    status: "ready",
  },
  {
    dataSources: ["website_console_admins", "auth.users", "website_console_audit_events"],
    group: "Platform",
    href: "/console/team",
    icon: Users,
    label: "Team",
    minRole: "admin",
    purpose: "Invite or add Supabase Auth users, assign console roles, suspend access, and audit changes.",
    section: "team",
    status: "ready",
  },
  {
    dataSources: ["website_console_admins"],
    group: "Platform",
    href: "/console/settings",
    icon: Sliders,
    label: "Settings",
    minRole: "viewer",
    purpose: "Operator profile, session/security status, and integration readiness.",
    section: "settings",
    status: "partial",
  },
  {
    dataSources: ["console_notifications"],
    group: "Platform",
    href: "/console/notifications",
    icon: Sliders,
    label: "Notifications",
    minRole: "admin",
    purpose: "Hidden until the notification outbox is production-backed.",
    section: "notifications",
    status: "hidden",
  },
  {
    dataSources: [],
    group: "Operations",
    href: "/console/messages",
    icon: Inbox,
    label: "Messages",
    minRole: "ops",
    purpose: "Hidden until real conversation or support tables exist; support work lives in Unified Inbox.",
    section: "messages",
    status: "hidden",
  },
  {
    dataSources: [],
    group: "Platform",
    href: "/console/experiments",
    icon: Sliders,
    label: "Experiments",
    minRole: "admin",
    purpose: "Hidden until experiment assignment and event tables exist.",
    section: "experiments",
    status: "hidden",
  },
];

export function isConsoleRole(value: unknown): value is ConsoleRole {
  return value === "admin" || value === "ops" || value === "viewer";
}

export function roleCanAccess(role: ConsoleRole, minRole: ConsoleRole) {
  return roleRank[role] >= roleRank[minRole];
}

export function getConsoleRouteBySection(section: string) {
  const normalized = section === "overview" ? "overview" : section;
  return CONSOLE_ROUTES.find((route) => route.section === normalized);
}

export function getVisibleConsoleRoutes(role?: ConsoleRole) {
  return CONSOLE_ROUTES.filter((route) => {
    if (route.status === "hidden") return false;
    return role ? roleCanAccess(role, route.minRole) : true;
  });
}

export function getConsoleRouteGroups(role?: ConsoleRole) {
  return getVisibleConsoleRoutes(role).reduce<Record<ConsoleRouteGroup, ConsoleRouteDefinition[]>>(
    (groups, route) => {
      groups[route.group].push(route);
      return groups;
    },
    { Operations: [], Platform: [] },
  );
}
