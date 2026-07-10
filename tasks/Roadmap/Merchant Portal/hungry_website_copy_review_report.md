# Hungry Website Copy Review and Rewrite Report

## Executive Summary

The current Hungry website copy does not fully match what the app has become. The public merchant story is still narrower than the Merchant Mode implementation in the app.

The website currently explains Hungry mostly through dishes, menus, opening hours, profile visibility, and merchant interest. However, the app already shows a much broader merchant product: dashboard triage, verification, home-based privacy controls, menu and OCR workflows, customer inbox, performance analytics, promotions, AI assistance, and merchant settings.

The strongest copy-only update is to:

1. Rename public merchant language from **Merchant Portal** to **Merchant Mode**.
2. Rewrite the merchant page around verification, profile control, replies, analytics, promotions, and supported business types.
3. Align homepage merchant references with the broader Merchant Mode promise.
4. Fix waitlist copy so it does not overclaim submission success before the form is connected to a backend.
5. Prepare private Hungry Console copy for future admin/developer routes.
6. Keep PostHog, Sentry, Firebase, Vercel, GitHub, and EAS as specialist tools, while Hungry Console summarises daily operating metrics and links out for deeper analysis.

The most important principle is:

> Make the website sound like the actual product, not like a generic food discovery landing page.

---

## Implementation Status — 2026-06-01

Status: implemented in `marketing/website/web-v2`.

Completed:

- Public navigation and footer terminology now use **Merchant Mode** for the merchant product and **merchant waitlist** for conversion copy.
- Homepage copy now positions Hungry for both diners and food businesses, including accurate menus, photos, hours, and profile details.
- Merchant page copy now covers Merchant Mode, verification, supported business types, menu control, customer replies, analytics, promotions, AI assistance, and staged waitlist access.
- Waitlist copy now uses audience-specific foodie and merchant waitlist messaging and only shows success after `/api/waitlist` accepts the submission.
- SEO metadata now includes Merchant Mode and waitlist route descriptions.
- Hungry Console now has scaffolded copy routes for the recommended operating surfaces and product analytics drill-downs.
- Console summary copy keeps PostHog, Sentry, Firebase, Vercel, GitHub, and EAS as linked specialist tools rather than rebuilding those tools inside Hungry.

Verification:

- `npx tsc --noEmit`
- focused `npx eslint` on touched web-v2 copy, SEO, Console, and scaffold files
- scoped `git diff --check`
- `npm run build:webpack`
- local HTTP checks for `/for-merchants`, `/console/inbox`, and `/console/product-analytics/feature-flags`

Follow-up implementation:

- The new Console scaffold routes now read the existing Console summary and merchant list APIs.
- Scaffold pages show live-aware workflow status, data-source state, merchant rows when available, and links to the closest existing Console workflow or external specialist tool.

Remaining dependency:

- Some scaffold actions still need final workflow ownership, write mutations, and role-specific permissions before they should be treated as full production operating tools.

---

## Scope of This Report

This report reviews:

- Hungry’s public website copy
- Merchant Mode positioning
- Waitlist wording
- Merchant-facing website content
- Planned Hungry Console content
- Product analytics and PostHog console copy
- Industry references from large product/admin platforms
- Practical copy replacements for the website

This is a **copy and content strategy report**. It does not recommend layout changes unless copy depends on the behaviour of a component.

---

## Assumptions

| Assumption | Why it matters |
|---|---|
| `marketing/website/web-v2` is the active website implementation. | This is the folder where user-facing website text should be changed. |
| `marketing/website/website v2` is the planning/spec folder. | This is where strategy, specs, prompts, and reports should live. |
| Merchant Mode is not fully public yet. | Public copy should say “join waitlist” or “register interest”, not “start using now”. |
| The task is copy-only. | Layout, components, and routing should stay the same unless copy becomes misleading. |
| The waitlist form currently behaves like a local UI preview unless backend wiring exists elsewhere. | Success copy should not claim that a submission was recorded unless it really is. |
| Hungry Console is planned but not yet fully implemented. | Console copy should be written as scaffold/placeholder text unless backend features exist. |

---

## Key Product Context

Hungry is a Singapore food discovery app for foodies and merchants.

For foodies, Hungry helps users:

- discover food across Singapore
- search by dish
- view reviews and rankings
- check stall and menu information
- save dishes or stalls
- discover nearby food options
- decide what to eat faster

For merchants, Hungry helps food businesses:

- get discovered by nearby hungry customers
- verify or claim their business
- manage their profile
- update menus and dishes
- manage opening hours
- upload photos
- reply to customer interactions
- view analytics
- create promotions
- use AI assistance for merchant tasks

Supported merchant types include:

- hawker stalls
- food court stalls
- restaurants
- cafes
- mall tenants
- home-based food businesses

---

## Main Finding

The biggest issue is not just tone. It is product mismatch.

The current merchant-facing website copy still sounds like a simple listing or menu visibility product. But the app now presents Merchant Mode as a real merchant operating surface.

The website should therefore explain Merchant Mode as a place where merchants can:

- get discovered
- verify their business
- keep details accurate
- manage dishes and menus
- reply to customers
- track performance
- run promotions
- use AI assistance

This is much stronger and clearer than only saying merchants can “show menus” or “keep stall details visible”.

---

## Copy Principles

### 1. Human first

Avoid stiff phrases such as:

```text
Register merchant interest
Merchant operational proof
Food creator coverage
```

Prefer:

```text
Join the merchant waitlist
Merchant Mode preview
Supported food businesses
```

### 2. Product accurate

Do not describe features as live if they are still gated, previewed, or planned.

Use:

```text
Join the merchant waitlist
Merchant Mode is opening in stages
Preview Merchant Mode
```

Avoid:

```text
Start using Merchant Mode today
Your merchant profile is now live
Your merchant interest has been recorded
```

unless the backend is truly implemented.

### 3. Simple and specific

Good product copy should answer:

- What is this?
- Who is it for?
- What can I do with it?
- Why should I care?

For example:

```text
Get discovered by people deciding what to eat nearby.
```

is clearer than:

```text
Make your food easier to choose before customers arrive.
```

### 4. Merchant Mode, not Merchant Portal

“Merchant Portal” sounds generic and enterprise-like.

“Merchant Mode” sounds like a product feature inside Hungry and matches the app direction better.

Recommended terminology:

| Current | Recommended |
|---|---|
| Merchant Portal | Merchant Mode |
| Merchant Interest | Merchant waitlist |
| Register Interest | Join merchant waitlist |
| Merchant tools | Merchant Mode |
| Food creator coverage | Supported food businesses |

### 5. Warm but not childish

Hungry should feel:

- local
- warm
- trustworthy
- premium
- helpful
- Singapore-aware

It should not feel:

- overly corporate
- too playful
- like a delivery app
- like a generic SaaS dashboard

---

## Public Website Rewrite Map

### Navigation and footer

Current terms:

```text
Merchant Portal
Merchant Interest
Register Interest
```

Recommended terms:

```text
Merchant Mode
Merchant waitlist
Join merchant waitlist
```

Rationale:

- “Merchant Mode” aligns better with the product.
- “Join merchant waitlist” sounds more human than “Register Interest”.
- The product is still staged, so “waitlist” is more honest.

---

### Homepage hero

Current direction:

```text
Hungry brings scattered menus, dish photos, reviews, opening hours, and stall details into one clear local guide for foodies and merchants.
```

Recommended replacement:

```text
Hungry helps people decide what to eat faster and gives food businesses a better way to keep menus, photos, opening hours, and profile details accurate.
```

CTA recommendation:

```text
Join Waitlist
For merchants
```

Rationale:

The homepage should still serve both audiences, but the merchant value should sound more operational and useful.

---

### Homepage merchant card

Recommended copy:

```text
For merchants
Manage how your food appears.

Keep dishes, prices, photos, opening hours, and profile details current while nearby diners decide where to eat.

Explore Merchant Mode
```

Alternative CTA:

```text
See Merchant Mode
```

Rationale:

This copy is clearer, warmer, and more connected to the actual merchant product.

---

### Homepage merchant story cards

Recommended replacements:

#### Card 1

```text
Keep your menu and dishes current.
Update dishes, prices, sold-out status, featured items, and photos from one place.
```

#### Card 2

```text
Keep hours and customer-facing details accurate.
Update opening hours, temporary closures, and profile details before stale information costs a visit.
```

Rationale:

The current copy underplays the app’s menu, sold-out, featured dish, and profile update capabilities.

---

## Merchant Page Full Draft

### Hero

Eyebrow:

```text
For Singapore food businesses
```

Headline:

```text
Get discovered by people deciding what to eat nearby.
```

Supporting copy:

```text
Merchant Mode helps hawker stalls, food court stalls, cafes, restaurants, mall food tenants, and home-based food businesses manage menus, photos, opening hours, verification, customer replies, promotions, and performance in one place.
```

Primary CTA:

```text
Join merchant waitlist
```

Secondary CTA:

```text
Preview Merchant Mode
```

---

### Benefits section

Section title:

```text
Everything customers look for, kept up to date.
```

Section body:

```text
When your public profile is accurate, customers can trust what they see before they make the trip.
```

Benefit cards:

```text
Manage your menu and dishes
Update dishes, prices, photos, sold-out status, featured items, and OCR menu drafts from one place.
```

```text
Keep hours and profile details accurate
Show the right opening hours, closures, contact details, and business info before stale data costs a visit.
```

```text
Reply, promote, and track performance
Stay on top of customer replies, promotions, and the performance numbers that matter.
```

---

### Merchant Mode preview

Eyebrow:

```text
Merchant Mode preview
```

Title:

```text
From stall claim to daily updates.
```

Body:

```text
Claim an existing stall or apply for a new one, verify your business, then keep menus, profile details, and opening hours current.
```

Steps:

```text
Claim or apply for your stall
Start with business details, ownership checks, and the right verification path.
```

```text
Keep your menu current
Edit dishes, prices, photos, sold-out status, featured items, and OCR menu drafts.
```

```text
Stay responsive and visible
Reply to customers, review performance, and run promotions from the same workspace.
```

---

### Verification and stall application

Section title:

```text
Verification builds trust before a customer arrives.
```

Body:

```text
Merchant Mode supports existing stall claims, new stall applications, document or video evidence, and a home-based path with privacy controls. Hungry reviews applications before approval, and verified merchants receive a Hungry verification indicator.
```

Supporting bullets:

```text
Claim an existing stall
Submit a new stall application
Upload evidence such as a licence, document, or video walkaround
Choose exact, approximate, or hidden location privacy if you run a home-based food business
Receive a verification indicator once approved
```

---

### Feature proof

Section title:

```text
Built for the updates customers notice.
```

Body:

```text
Merchant Mode already covers dashboard triage, verification, profile editing, menu control, opening hours, customer replies, promotions, and performance.
```

Cards:

```text
Dashboard and verification
See profile gaps, verification status, and actions that need attention before customers notice them.
```

```text
Menu and dish control
Add new dishes, import menu drafts, update prices and photos, and mark items sold out in minutes.
```

```text
Hours and profile accuracy
Update opening hours, closures, and customer-facing details so people know what to expect.
```

---

### Supported food businesses

Section title:

```text
Supported food businesses
```

Body:

```text
Merchant Mode is being designed for Singapore’s real food landscape — from hawker and food court stalls to cafes, restaurants, mall food tenants, and home-based food businesses.
```

Cards:

```text
Hawker stalls
Show signature dishes clearly so locals can find hawker and food court stalls before they arrive.
```

```text
Cafes and bakeries
Make coffee, bakes, brunch items, and everyday specials easier to discover nearby.
```

```text
Restaurants
Help diners compare full menus, photos, hours, and availability faster.
```

```text
Home-based
Explain what you make, how customers can order, and how much location detail you want to show.
```

---

### Final CTA

Eyebrow:

```text
Join the waitlist
```

Title:

```text
Ready to be easier to find and easier to trust?
```

Body:

```text
Join the merchant waitlist. We’ll invite businesses in stages as Merchant Mode opens.
```

CTA:

```text
Join merchant waitlist
```

---

## Waitlist Page Copy

The waitlist page should avoid claiming success unless backend submission is real.

### Recommended hero

```text
Choose your Hungry updates.
```

Body:

```text
Hungry is launching in stages. Join as a foodie for early access, or as a merchant for Merchant Mode updates.
```

Field helper:

```text
We’ll only email you about the updates you selected.
```

---

### Foodie option

Title:

```text
Join the foodie waitlist
```

Description:

```text
Get early access when Hungry opens for food discovery across Singapore.
```

Button:

```text
Join foodie waitlist
```

---

### Merchant option

Title:

```text
Join the merchant waitlist
```

Description:

```text
Get updates when Merchant Mode opens for Singapore food businesses.
```

Button:

```text
Join merchant waitlist
```

---

### Success copy if backend is connected

Foodie:

```text
You’re on the foodie waitlist. We’ll email you when early access opens.
```

Merchant:

```text
You’re on the merchant waitlist. We’ll email you when Merchant Mode opens.
```

### Preview-safe success copy if backend is not connected

```text
Thanks for trying the waitlist preview.
```

Do not use:

```text
Your merchant interest has been recorded.
```

unless the form truly sends data to a backend.

---

## SEO Copy Updates

### Site description

```text
Hungry is a Singapore food discovery app for diners and food businesses — discover dishes faster and manage menus, photos, hours, and profiles with Merchant Mode.
```

### Merchant page title

```text
Hungry for Merchants | Merchant Mode for Singapore food businesses
```

### Merchant page description

```text
Join the Hungry merchant waitlist for Merchant Mode — manage menus, photos, opening hours, verification, customer replies, promotions, and performance.
```

### Waitlist page title

```text
Hungry waitlist | Foodie early access and Merchant Mode updates
```

### Waitlist page description

```text
Join the Hungry waitlist for foodie early access or Merchant Mode updates for Singapore food businesses.
```

---

## Hungry Console Copy Direction

The private admin/developer website should be called:

```text
Hungry Console
```

It should not be described as only a developer dashboard. It should support product, support, merchant ops, trust and safety, growth, analytics, and engineering.

Positioning:

```text
Hungry Console is the private operations portal for managing the Hungry app, website, merchants, users, reports, feedback, releases, notifications, analytics, and product configuration.
```

---

## Console Shell Copy

| Route | Page title | Intro copy | Primary actions | Empty state |
|---|---|---|---|---|
| `/console/overview` | Hungry Console | Run Hungry from one place: app, website, merchants, trust queues, releases, notifications, and product operations. | Review inbox · Check product analysis · Send test notification | No critical alerts right now. |
| `/console/product-analytics` | Product analysis | Track growth, discovery quality, merchant adoption, website conversion, and release health in one view. | Open PostHog · View release health · Compare audiences | No metrics yet for the selected filters. |
| `/console/inbox` | Unified inbox | One queue for feedback, merchant issues, reports, moderation, crash-linked follow-ups, and application conversations. | Claim item · Add note · Reply · Escalate | No items need action right now. |
| `/console/reports` | Reports and trust | Review incorrect information, abuse, safety concerns, impersonation, duplicate listings, and ownership disputes. | Dismiss · Ask for more info · Hide content · Escalate | No open reports in this view. |
| `/console/merchant-applications` | Merchant applications | Approve claims, review new stall submissions, verify home-based businesses, and resolve ownership disputes before listings go live. | Approve · Reject · Request more info · Merge with existing stall | No pending applications in this view. |

---

## Product Analysis Page Copy

Global filter helper:

```text
All figures reflect the selected environment, audience, platform, app version, and date range.
```

Chart helper:

```text
Use this page for the numbers the team checks every day. Open PostHog, Sentry, or Firebase when you need deeper investigation.
```

Section status line:

```text
Daily operating summaries here. Deep analysis in connected tools.
```

Empty state:

```text
We don’t have enough data for this slice yet. Try a wider date range or broader audience.
```

---

## PostHog Summary Card Copy

Card title:

```text
PostHog deep dive
```

Card body:

```text
Hungry Console surfaces the KPIs the team checks every day. Open PostHog when you need funnels, cohorts, trends, replays, event breakdowns, or feature-flag impact.
```

Primary CTA:

```text
Open PostHog workspace
```

Secondary CTA:

```text
View saved dashboards
```

---

## Suggested PostHog Dashboard Links

| Label | Suggested saved dashboard | Purpose |
|---|---|---|
| Executive overview | Hungry Executive Overview | Daily leadership read on app, website, merchant, issue, and release movement. |
| Foodie activation funnel | Hungry Foodie Activation | Shows whether sign-up, onboarding, and early discovery actions are improving. |
| Merchant activation funnel | Hungry Merchant Activation | Tracks claim/application, verification, profile update, menu update, and first reply. |
| Website conversion | Hungry Website Conversion | Best view for homepage, merchant page, and waitlist CTA performance. |
| Search and discovery | Hungry Search and Discovery | Helps product teams understand demand, discovery friction, and top search patterns. |
| Merchant Mode usage | Hungry Merchant Mode Usage | Best operational lens on profile updates, menu edits, promotions, and AI usage. |
| Retention cohorts | Hungry Retention Cohorts | Needed to compare sticky user and merchant behaviours over time. |
| Notifications and campaigns | Hungry Notifications and Campaigns | Ties messaging activity to opens, taps, and downstream engagement. |
| Feature flags and experiments | Hungry Feature Flags and Experiments | Useful when a rollout or experiment needs product and ops context. |
| Error and issue correlation | Hungry Error and Issue Correlation | Helps correlate spikes in feedback, reports, and errors with releases or flags. |

---

## Industry Patterns Reviewed

The best references consistently separate three layers:

1. A lightweight home screen for daily action
2. Operational queues for real work
3. Deep-linked specialist tools for tracing, analytics, or delivery

### Apple App Store Connect

Pattern:

- one suite for app submission
- testing
- release management
- analytics
- reviews

What Hungry should borrow:

```text
Keep the console plain and task-based: Overview, Merchant applications, Releases, Product analysis, Reviews.
```

### Shopify Admin

Pattern:

- central home
- search from anywhere
- staff permissions
- operational navigation

What Hungry should borrow:

```text
Give Hungry Console a real overview page, keyboard-friendly global search, and role-aware actions.
```

### Stripe Dashboard / Workbench

Pattern:

- debugging
- alerts
- event destinations
- logs
- team roles
- security history

What Hungry should borrow:

```text
Make releases, alerts, linked logs, and audit history easy to reach without leaving the console shell.
```

### PostHog

Pattern:

- dashboards
- funnels
- trends
- feature flags
- session replay
- privacy controls

What Hungry should borrow:

```text
Use summary cards in Hungry Console, then deep-link into PostHog for cohorts, funnels, replays, events, and feature-flag analysis.
```

### Firebase

Pattern:

- remote config
- cloud messaging
- crash reporting
- performance
- A/B testing

What Hungry should borrow:

```text
Show status, key numbers, and drill-down links instead of rebuilding Firebase-style tools too early.
```

### Sentry

Pattern:

- issue states
- affected users
- release health
- regressions

What Hungry should borrow:

```text
Use clear queue statuses such as New, Triaged, Waiting, Escalated, Resolved, and Closed.
```

### LaunchDarkly-style feature flags

Pattern:

- context targeting
- individual overrides
- progressive rollouts
- kill switches
- change history

What Hungry should borrow:

```text
Feature-flag screens should show default rule, audience, rollout percentage, schedule, kill switch, and change history.
```

---

## Console Architecture Recommendation

The console should use this route model:

```text
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

Product analytics routes:

```text
/console/product-analytics/overview
/console/product-analytics/foodies
/console/product-analytics/merchants
/console/product-analytics/website
/console/product-analytics/acquisition
/console/product-analytics/funnels
/console/product-analytics/retention
/console/product-analytics/events
/console/product-analytics/cohorts
/console/product-analytics/notifications
/console/product-analytics/feedback-and-issues
/console/product-analytics/releases
/console/product-analytics/feature-flags
/console/product-analytics/data-quality
/console/product-analytics/posthog
```

---

## Recommended Data Flow

```text
Hungry app
→ sends events to PostHog
→ sends crashes/errors to Sentry or Firebase Crashlytics
→ sends messaging/config state to Firebase or notification provider

Public website
→ sends website analytics to PostHog
→ sends waitlist and merchant interest submissions to the website/backend database

Operational database
→ stores users, merchants, applications, reports, support states, moderation states, and admin actions

Hungry Console
→ reads operational database
→ summarises PostHog/Sentry/Firebase/Vercel/GitHub/EAS status
→ links to specialist tools for deeper analysis
→ controls safe internal workflows
```

---

## Accessibility and Localisation Recommendations

### Brand term

Use:

```text
Merchant Mode
```

for the public merchant product.

Use:

```text
Hungry Console
```

for the private internal tool.

### CTA language

Preferred:

```text
Join merchant waitlist
```

Formal fallback:

```text
Register merchant interest
```

### Singapore wording

Use:

```text
stall
hawker
food court
home-based food business
```

in supporting copy, not every headline.

### International fallback

If Hungry expands beyond Singapore, replace some local phrasing:

| Singapore-first | International-friendly |
|---|---|
| stall | food business / listing |
| hawker stall | local food business |
| kopitiam / hawker centre | food hall / local dining area |
| Merchant Mode for Singapore food businesses | Merchant Mode for food businesses |

### Accessibility

Use:

- sentence case
- specific link labels
- descriptive buttons
- status text that does not rely on colour alone
- honest success/error messages

Avoid:

- vague buttons like “Learn more”
- action labels that do not match destination
- success messages for actions that have not actually completed

---

## Implementation Roadmap

| Priority | Action | Why now | Dependency |
|---|---|---|---|
| P0 | Rewrite merchant-facing copy in `site.ts`, `/for-merchants`, `MerchantStory.tsx`, `JoinWaitlistForm.tsx`, and `seo.ts`. | Fastest way to align public perception with product reality. | None. |
| P0 | Standardise public terminology to **Merchant Mode** and **merchant waitlist**. | Removes mixed labels immediately. | None. |
| P0 | Change or constrain waitlist success copy so it matches actual behaviour. | Current copy may over-promise if the form is local-only. | Either backend wiring or preview-safe wording. |
| P1 | Scaffold `/console/overview`, `/console/product-analytics`, `/console/inbox`, `/console/reports`, and `/console/merchant-applications`. | Gives the internal product a coherent shell quickly. | Auth and RBAC scaffolding. |
| P1 | Add PostHog, Sentry, Firebase, and deployment deep-link cards rather than custom explorers. | Matches the spec and avoids rebuilding specialist tools. | Linked dashboard/project URLs. |
| P2 | Instrument missing website, merchant, and console events. | Required before product analysis can credibly promise those metrics. | Tracking plan and event ownership. |
| P2 | Create the recommended saved PostHog dashboards. | Needed for shell deep links and daily-review workflows. | Event instrumentation. |
| P2 | Add release-health, notification, and feature-flag summary cards. | High-value operating signals once the shell exists. | Sentry/Firebase/feature flag links. |
| P3 | Add localisation tokens for Singapore and international variants. | Prevents hard-coded local terminology from spreading later. | Copy freeze on first pass. |
| P3 | Add role-specific microcopy, audit-log strings, and approval-flow wording. | Important once multiple admin roles start using Console. | RBAC and shell routes in place. |

---

## Final Recommendation

Ship the public merchant rewrite first.

That fixes the biggest user-facing gap immediately: the website will finally sound like the product that exists in the app.

Then prepare Hungry Console shell copy in parallel so engineering can scaffold the private routes without waiting on final backend integrations.

For analytics, stay summary-first:

- show daily operating metrics in Hungry Console
- link to PostHog, Sentry, Firebase, Vercel, GitHub, and EAS for deep analysis
- avoid promising dashboards that do not have event coverage yet
- add missing events before making analytics claims public or operational

The final website copy should make users and merchants feel:

```text
I understand what Hungry does.
I know who it is for.
I know what Merchant Mode gives me.
I trust that Hungry is being honest about what is live and what is coming.
```
