# Hungry Website Update — Merchant Mode + Developer Console Spec

## 1. Purpose

This document defines the updated Hungry merchant website direction and the private **Hungry Console** for managing the Hungry app, website, merchants, users, feedback, moderation, product operations, analytics, and controlled app-wide updates.

It now incorporates research from public documentation for mature operational consoles and admin products including Shopify Admin, Stripe Dashboard, Sentry, Firebase, LaunchDarkly, PostHog, and Retool.

The goal is to create two connected web experiences:

1. **Public merchant website updates** — a stronger merchant-facing marketing/product page that accurately explains current and planned Merchant Mode capabilities.
2. **Private Hungry Console** — an internal admin/developer/ops portal for safely operating the mobile app, website, merchant mode, user trust workflows, feedback, releases, notifications, feature flags, and data quality.

---

## 2. Research Sources and Industry Patterns

The following public product docs were used as benchmarks:

| Company / product | Relevant pattern for Hungry |
|---|---|
| Shopify Admin | Central back-office for store operations, sidebar navigation, search, alerts feed, analytics, staff permissions, multi-store switching |
| Stripe Dashboard | Business home dashboard, configurable widgets, resource search, customers/products/transactions, team roles, Workbench logs, review queues, risk review assignment |
| Sentry | Issue grouping, issue triage states, filters, dashboards with global filters, release health, crash-free sessions/users, regressions |
| Firebase Console | Analytics, Crashlytics, Performance Monitoring, Cloud Messaging, In-App Messaging, Remote Config, A/B Testing, App Distribution |
| LaunchDarkly | Feature flag targeting, contexts, segments, rules, percentage/progressive rollouts, guarded rollouts, release pipelines, change history |
| PostHog | Product analytics, dashboards, active users, traffic sources, feature flags, cohorts, session replay, feature impact analysis |
| Retool | Internal apps that interact with operational data, permission management, organization/user governance, internal app development model |

### Key lessons to adopt

1. **Central hub model** — like Shopify and Stripe, Hungry Console should start from an overview dashboard with urgent tasks, alerts, growth metrics, and operational queues.
2. **Global search** — like Shopify and Stripe, the console should support searching users, merchants, stalls, dishes, reports, feedback, applications, and internal issues from anywhere.
3. **Queue-first operations** — like Stripe Radar and Sentry Issues, trust, feedback, application, and moderation work should appear in prioritized queues with ownership, status, risk, and next actions.
4. **Global filters and drill-downs** — like Sentry dashboards, analytics pages should have global filters for date range, audience, platform, app version, region, and user/merchant type.
5. **Role-based access control** — like Shopify staff permissions and Retool permissions, console capabilities must be controlled by roles, teams, and permission groups.
6. **Auditability** — every admin action that affects users, merchants, content, notifications, feature flags, or app configuration must be logged.
7. **Safe rollout controls** — like LaunchDarkly and PostHog, feature flags should support targeting, percentage rollout, kill switches, internal-only testing, and change history.
8. **Operational observability** — like Sentry and Firebase, Hungry should link crashes, releases, app versions, feedback, reports, and affected users.
9. **Do not rebuild specialist tools too early** — Hungry Console should summarize and deep-link into tools like PostHog, Sentry, Vercel, GitHub, EAS, and Firebase where those tools are stronger.

---

## 3. Current Merchant Mode Reference

Merchant Mode in the Hungry app already supports a much richer business management surface than the original marketing website described.

### App Merchant Mode areas to reflect publicly

- Merchant dashboard
- Menu management
- Analytics / performance
- Business profile editor
- Verification centre
- Home-based verification
- Customer inbox
- Featured visitors
- Dish editor
- OCR menu drafts
- Promotions list
- Promotion builder
- AI assistant
- Orders coming soon
- Merchant settings

### Supported business types

- Hawker stalls
- Food court stalls
- Restaurants
- Cafes
- Mall tenants
- Home-based food businesses

### Merchant profile fields

The public merchant page should communicate that Merchant Mode can support these profile areas:

- Business name
- Business description
- Business type
- Cuisine categories
- Unit number and floor
- Location privacy
- Operating hours
- Temporary closure
- Profile photo
- Cover photo
- Gallery photos
- Contact phone
- Contact email
- Social links
- Delivery links
- Dietary labels
- Taste tags
- Signature dishes
- Verification status

### Merchant operational states

- Verification status: not started, draft, submitted, in review, verified, rejected, more info needed
- Verification methods: video walkaround, licence upload, Singpass/Myinfo Business, home-based declaration
- Location privacy: exact, approximate, hidden
- Merchant roles: owner, manager, staff
- Promotions: draft, scheduled, active, ended
- Customer interactions: reviews, comments, post mentions, questions
- OCR dish drafts from menu photos

---

## 4. Public Merchant Website Update

The `/for-merchants` page should be updated from a simple interest page into a product-led Merchant Mode page.

### New merchant page positioning

```text
Get discovered, keep your menu current, and manage how customers see your food.
```

### Recommended page structure

```text
/for-merchants
  Hero: Get discovered by hungry customers
  Merchant Mode preview
  Verification and stall application
  Business profile management
  Menu and dish management
  Customer inbox and reviews
  Analytics and performance
  Promotions and featured visibility
  AI assistant for merchant tasks
  Supported business types
  Final CTA: Register Merchant Interest
```

### Section 1 — Merchant Hero

Headline:

```text
Get discovered by people deciding what to eat nearby.
```

Supporting copy:

```text
Hungry helps hawker stalls, food courts, cafes, restaurants, and home-based food businesses manage their food profile, menu, photos, hours, customer interactions, and verification from Merchant Mode.
```

Primary CTA:

```text
Register Merchant Interest
```

Secondary CTA:

```text
Preview Merchant Mode
```

### Section 2 — Merchant Mode Product Preview

Show that Merchant Mode is a business management surface, not just a claim form.

Feature cards:

- Dashboard overview
- Menu management
- Analytics
- Profile editor
- Verification centre
- Customer inbox
- Promotions
- AI assistant

### Section 3 — Verification and Stall Application

Explain how merchants apply, verify, and claim ownership.

Content:

- Claim an existing stall
- Submit a new stall application
- Upload evidence such as licence, document, or video walkaround
- Home-based businesses can choose privacy settings
- Hungry reviews applications before approval
- Verified merchants receive a Hungry verification indicator

### Section 4 — Business Profile Management

Feature list:

- Business name and description
- Cuisine and category tags
- Address, floor, unit number, map pin
- Location privacy for home-based businesses
- Profile, cover, and gallery photos
- Contact and social links
- Dietary and taste tags
- Signature dishes
- Preview as customer

### Section 5 — Menu and Dish Management

Feature list:

- Add and edit dishes
- Upload dish photos
- Set price, ingredients, allergens, dietary tags, taste tags
- Mark dish as sold out
- Feature signature dishes
- Import menu photos with OCR drafts
- Accept, reject, or edit OCR dish suggestions
- Use AI to draft dish descriptions

### Section 6 — Customer Inbox

Feature list:

- View reviews, comments, mentions, questions
- Filter unreplied interactions
- Reply to users
- Use quick reply templates
- Use AI reply suggestions, reviewed before sending
- Report abusive content
- View the original review or post
- Sentiment summary

### Section 7 — Analytics and Performance

Feature list:

- Profile visits
- Menu views
- Dish views
- Direction taps
- Saves and shares
- Contact taps
- Review count and average rating
- Top dishes
- Most searched keywords
- Peak discovery hours
- Customer taste tag distribution
- Period comparison

### Section 8 — Promotions and Visibility

Feature list:

- Promotion builder
- Promotion drafts
- Scheduled promotions
- Active and ended promotions
- Target audience: nearby users, users who saved the stall, taste-match users, followers
- Promotion analytics: impressions, clicks, saves, profile visits, dish views

### Section 9 — AI Assistant

Feature list:

- Profile improvement suggestions
- Menu cleanup suggestions
- Demand insights
- Best time to post
- Photo improvement suggestions
- Weekly summary
- AI output is always draft-only and never auto-published

---

## 5. Hungry Console Definition

Recommended name:

```text
Hungry Console
```

Positioning:

```text
Hungry Console is the private operations portal for managing the Hungry app, website, merchants, users, reports, feedback, releases, notifications, analytics, and product configuration.
```

It should be broader than a developer-only dashboard. It should support engineering, support, merchant operations, trust and safety, growth, analytics, data quality, and product management.

---

## 6. Hungry Console Navigation

```text
/console
/console/overview
/console/search
/console/inbox
/console/feedback
/console/reports
/console/merchant-applications
/console/stall-submissions
/console/merchants
/console/users
/console/content
/console/reviews
/console/posts
/console/notifications
/console/activity
/console/messages
/console/releases
/console/feature-flags
/console/experiments
/console/app-config
/console/product-analytics
/console/data-quality
/console/issues
/console/audit-log
/console/team
/console/settings
```

### Global console shell

Every console page should include:

- Left sidebar navigation
- Global search bar
- Environment switcher: production / staging / preview
- Date range selector on analytics pages
- Active outlet / merchant quick search
- Internal user profile and role indicator
- Alerts feed
- Recent actions shortcut
- Help / docs link

---

## 7. Console Modules

## 7.1 Overview Dashboard

Purpose:

Provide a live operational snapshot, like Shopify Home and Stripe Dashboard Home.

Widgets:

- New app users
- New website users / visitors
- Active foodie users
- Active merchant users
- New signups
- New waitlist entries
- New merchant applications
- New stall submissions
- Open feedback count
- Open reports count
- Open merchant issues
- App crash/error count
- Notification campaign status
- Feature flag status
- Deployment status
- Recent admin actions

Alerts:

- High severity bug spike
- Surge in user reports
- Merchant application backlog
- Failed notification campaign
- Spike in negative reviews
- Content moderation queue too large
- App version with elevated crash rate
- Critical feature flag changed in production

## 7.2 Global Search

Inspired by Shopify Admin and Stripe Dashboard.

Search across:

- Users
- Merchants
- Outlets
- Stalls
- Dishes
- Reviews
- Posts
- Reports
- Feedback
- Merchant applications
- Stall submissions
- Notifications
- Feature flags
- Releases
- Admin actions

Search result categories should be filterable and keyboard-friendly.

## 7.3 Unified Inbox

Queue item types:

- User feedback
- Merchant issue
- User report
- Merchant report
- Stall application
- New stall submission
- Review moderation
- Post moderation
- Bug report
- App crash linked to feedback
- Data correction request

Fields:

- Type
- Priority
- Status
- Assigned owner
- Related user
- Related merchant
- Related stall / dish / post
- Source: app, website, email, system, crash report
- Created date
- SLA timer
- Internal notes
- Public reply status

Statuses:

- New
- Triaged
- Waiting for user
- Waiting for merchant
- In review
- Approved
- Rejected
- Resolved
- Escalated
- Closed

## 7.4 Feedback Management

Features:

- Feedback inbox
- Search and filters
- Tags: bug, UX issue, feature request, data issue, menu issue, opening-hours issue, merchant issue, account issue
- Attach screenshot / session context
- Link to GitHub issue or internal task
- Assign to developer / support / ops
- Mark as resolved
- Reply to user
- Convert feedback into product roadmap item
- Feedback trend summary

## 7.5 Reports and Trust & Safety

Report categories:

- Incorrect information
- Closed / wrong opening hours
- Wrong menu
- Wrong price
- Duplicate stall
- Fake review
- Abusive content
- Harassment
- Spam
- Inappropriate photo
- Safety / hygiene concern
- Impersonation
- Merchant ownership dispute

Actions:

- Dismiss report
- Request more information
- Hide content
- Restore content
- Warn user
- Suspend user
- Restrict merchant account
- Escalate to admin
- Link to merchant application
- Create data correction task

## 7.6 Merchant Applications

Application types:

- Existing stall claim
- New stall application
- Home-based business application
- Restaurant / cafe business profile
- Multi-outlet brand request
- Ownership dispute

Decision actions:

- Approve
- Reject
- Request more information
- Merge with existing stall
- Flag duplicate
- Escalate ownership dispute
- Grant verified badge
- Create merchant account

## 7.7 New Stall Submission Review

Review actions:

- Approve as new stall
- Reject
- Merge with existing stall
- Request clarification
- Mark as duplicate
- Publish draft listing
- Send correction notice

## 7.8 Users Management

Features:

- Search users
- View user profile
- Taste profile overview
- Reviews and posts
- Reports made by user
- Reports against user
- Favourites and saved places summary
- Support history
- Device / app version
- Notification opt-in status
- Account status: active, warned, suspended, deleted
- Manual account actions with audit log

## 7.9 Merchant Management

Features:

- Merchant search
- Account status
- Verification status
- Outlet list
- Team members and roles
- Business profile details
- Menu status
- Gallery/photos
- Promotions
- Customer inbox summary
- Reports involving merchant
- Support notes
- Suspend / restrict merchant
- Transfer ownership
- Revoke verification
- Merge / split outlets

## 7.10 Content Moderation

Content types:

- Reviews
- Review photos
- Posts
- Videos
- Comments
- Merchant replies
- Merchant photos
- Dish photos
- Menu photos
- AI-generated drafts

Moderation tools:

- Content queue
- AI/moderation confidence score
- Image preview
- Text risk labels
- Bulk actions
- Policy reason selection
- Appeal handling
- Audit log

## 7.11 Notifications and Messaging Control

Notification types:

- App-wide push notification
- Targeted push notification
- In-app banner
- In-app modal
- Activity feed item
- Merchant announcement
- Foodie announcement
- Maintenance notice
- New feature announcement
- Incident notice
- Promotion / campaign message

Required controls:

- Draft mode
- Preview notification
- Send test to internal device
- Schedule send
- Rate limit
- Cancel scheduled send
- Segment estimate
- Approval requirement for app-wide sends
- Delivery stats
- Open / tap-through stats
- Rollback / disable in-app message

App-wide notifications should require two-step confirmation, role approval, and audit logging.

## 7.12 Activity Feed Management

Activity item types:

- App update
- New feature
- Area spotlight
- Food campaign
- Merchant onboarding update
- Maintenance message
- Safety notice
- Community guideline update

## 7.13 Feature Flags and Remote Config

Feature flag controls:

- Boolean flags
- Multivariate flags
- Targeting by user, merchant, outlet, app version, platform, region, or internal status
- Percentage rollouts
- Progressive rollout plan
- Scheduled changes
- Kill switches
- Dependencies
- Remote config payloads
- Change history
- Approval requirement for production changes

Example flags:

```text
merchantCentreEnabled
merchantVerificationEnabled
merchantPromotionsEnabled
merchantAIAssistantEnabled
ocrMenuImportEnabled
newStallSubmissionEnabled
reviewsEnabled
notificationsEnabled
homeBasedBusinessesEnabled
```

## 7.14 Releases and App Health

Inspired by Sentry Releases, Firebase Crashlytics, Firebase Performance Monitoring, and Stripe Workbench.

Features:

- Current production app version
- Current preview app version
- Website deployment status
- EAS update channel status
- Vercel deployment links
- Release notes
- Changelog composer
- Crash-free users
- Crash-free sessions
- Release adoption
- Regressions introduced by release
- API errors
- Webhook/log events
- Failed deployment alerts

## 7.15 Product Analytics

This module is expanded in `product_analytics_posthog_console_spec.md`.

Top-level metrics should include:

- New users
- App active users
- Website visitors
- Merchant users
- Foodie users
- Waitlist conversions
- Merchant interest conversions
- Search volume
- Dish views
- Reviews
- Saves
- Merchant applications
- Merchant verification funnel
- Feedback volume
- Reports volume
- Notification performance
- Data quality

## 7.16 Data Quality Management

Features:

- Duplicate stall detector
- Missing menu detector
- Opening hours confidence
- Map pin confidence
- Old photo warning
- Menu price conflict detector
- User-submitted correction queue
- Merchant-updated field audit
- Scraped data import review
- Bulk edit tools

## 7.17 Audit Log

Log every admin action:

- User edited
- Merchant approved / rejected
- Stall approved / rejected
- Notification sent
- Feature flag changed
- Remote config changed
- Content hidden / restored
- Report dismissed
- Account suspended
- Data exported
- Admin permission changed

Audit fields:

- Actor
- Role
- Action
- Target entity
- Before state
- After state
- Timestamp
- IP / session
- Reason note

---

## 8. Roles and Permissions

| Role | Access |
|---|---|
| Owner | Full access, billing, admin permissions, production controls |
| Admin | Most operations, merchant approval, user moderation |
| Developer | Releases, logs, feature flags, config, issues, limited user visibility |
| Merchant Ops | Merchant applications, verification, business profiles, stall submissions |
| Support | Feedback, inbox, user issues, merchant issues, reply workflows |
| Trust & Safety | Reports, moderation, suspensions, appeals |
| Content Moderator | Reviews, posts, photos, dish/stall content |
| Growth | Notifications, campaigns, activity feed, analytics, no destructive access |
| Data Analyst | Product analytics, exports, PostHog links, no destructive access |
| Read-only | View dashboards only |

Security rules:

- Owner/Admin permissions require 2FA.
- App-wide notifications and production config changes require approval.
- Sensitive data is masked by default.
- Support-view mode is the default for user detail pages.
- Elevated access is needed to view verification documents or exact home-based addresses.

---

## 9. Recommended Build Priority

### Phase 1 — Must-have admin foundation

- `/console` private shell
- RBAC
- Overview dashboard
- Global search
- Unified inbox
- Feedback management
- Reports management
- Merchant applications
- Stall submissions
- Users search
- Merchants search
- Audit log
- Product Analytics MVP shell

### Phase 2 — Merchant ops and moderation

- Merchant verification workflow
- Home-based business review workflow
- Review/post/photo moderation
- Duplicate stall handling
- Data correction queue
- Merchant issue management
- Support replies
- Data quality dashboard

### Phase 3 — App control and growth

- Push notification composer
- In-app announcement composer
- Activity feed composer
- Feature flags
- Remote config
- Release management
- App version control
- Campaign analytics

### Phase 4 — Advanced product ops

- Experiments and A/B testing
- Session replay integration
- AI feedback summaries
- AI moderation assist
- Data quality scoring
- Merchant performance benchmarking
- Automated issue routing
- Full observability dashboards

---

## 10. Recommended Data Model

```text
admin_users
admin_roles
admin_permissions
admin_audit_logs
feedback_items
support_threads
report_items
moderation_actions
merchant_applications
merchant_application_evidence
merchant_verification_reviews
stall_submissions
stall_submission_reviews
user_account_actions
merchant_account_actions
notification_campaigns
notification_deliveries
in_app_messages
activity_feed_items
feature_flags
remote_config_values
release_notes
app_versions
data_quality_issues
internal_notes
product_metric_definitions
product_metrics_daily
posthog_dashboard_links
```

---

## 11. Critical Safety Rules

### App-wide notification safety

- Draft first
- Preview on web
- Send test to internal device
- Require confirmation
- Require approval for broad audience
- Record audit log
- Show delivery estimates
- Support cancellation before scheduled send

### Feature flag safety

- Default off
- Internal-only first
- 5% rollout next
- Monitor metrics
- Gradually increase
- Keep kill switch visible
- Record all changes

### Moderation safety

- Never permanently delete user-generated content immediately
- Soft-hide first
- Store reason and moderator
- Allow appeal / review if needed
- Preserve evidence for abuse reports

### Data privacy

- Mask emails, phone numbers, and private addresses by default
- Home-based businesses default to approximate or hidden location
- Only elevated roles can see sensitive documents
- Log every access to verification evidence
- Do not pipe verification evidence, exact home addresses, raw support messages, or sensitive identifiers into analytics tools

---

## 12. Final Recommendation

Build **Hungry Console** as a private internal web app within the website workspace only if routing, auth, RBAC, and audit logging are strict.

Recommended immediate structure:

```text
marketing/website/web-v2
  public marketing website
  /for-merchants updated to reflect Merchant Mode
  /console private internal admin portal
  /console/product-analytics private product analysis dashboard
```

If security or deployment complexity grows, split the console into a separate internal app later:

```text
console.usehungry.com
```

Best immediate path:

1. Update `/for-merchants` with Merchant Mode features.
2. Add `/console` private shell.
3. Build overview, global search, inbox, feedback, reports, merchant applications, stall submissions, audit log, and Product Analytics MVP first.
4. Add notifications and feature flags only after RBAC, approvals, and audit logging are complete.
