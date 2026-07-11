# Hungry Console — Product Analytics and PostHog Spec v2

## 1. Purpose

This document updates the Product Analytics and PostHog Console plan with research from mature product operations tools including PostHog, Firebase, Sentry, LaunchDarkly-style feature flag systems, Shopify Admin, Stripe Dashboard, and Retool-style internal tools.

Hungry Console should give the team one private place to view statistics for:

- Hungry mobile app
- Hungry marketing website
- Foodie users
- Merchant users
- Merchant applications
- Stall submissions
- Feedback and issues
- Notifications and campaigns
- Feature rollouts
- App releases and stability
- PostHog product analytics

---

## 2. Industry Research Summary

### PostHog-inspired product analytics

PostHog positions product analytics around understanding users and provides dashboard templates for active users, feature flags, growth accounting, traffic sources, website traffic, realtime analytics, and retention-oriented use cases.

Apply to Hungry:

- Product analytics dashboards
- Active user tracking
- Website traffic dashboard
- Traffic source analysis
- Funnel tracking
- Retention cohorts
- Feature flag impact
- Session replay links where safe
- Experiment results

### Firebase-inspired app operations

Firebase groups app operations around analytics, Cloud Messaging, In-App Messaging, Crashlytics, Performance Monitoring, Remote Config, A/B Testing, and App Distribution.

Apply to Hungry:

- Push notification metrics
- In-app message metrics
- Remote configuration tracking
- A/B test result views
- Crash-free users and sessions
- Performance issue summaries
- Tester/build distribution context

### Sentry-inspired issue and release analysis

Sentry groups similar events into issues, lets teams filter by device, browser, affected users, handled/unhandled status, and triage issue states such as unresolved, for review, regressed, archived, and escalating. Sentry Releases also surfaces release adoption, crash-free users, crash-free sessions, regressions, and commits.

Apply to Hungry:

- Issue grouping
- Affected user count
- Issue trend and escalation view
- Release adoption
- Crash-free users and sessions
- Regression detection
- App version filtering
- Links from issue to release and suspected change

### Shopify / Stripe-inspired admin dashboard patterns

Mature business dashboards usually provide a home screen, global search, operational queues, recent activity, alerts, reports, and drill-down views into business objects.

Apply to Hungry:

- Global search for users, merchants, stalls, dishes, reports, feedback, applications, and campaigns
- Dashboard cards that link into operational queues
- Role-based views
- Exportable reports
- Recent activity and alert feed

### Retool-style internal tool pattern

Internal tools should connect operational data with safe actions. For Hungry, this means analytics charts should not be read-only when action is needed. A spike in reports should link to Reports. A merchant application backlog should link to Merchant Applications. A notification failure should link to Notifications.

---

## 3. Recommended Console Routes

```text
/console/product-analytics
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

Recommendation:

- Use `/console/product-analytics` as the main dashboard.
- Use `/console/product-analytics/posthog` for PostHog dashboard shortcuts and event exploration.
- Use `/console/product-analytics/releases` for release health and crash trend analysis.
- Redirect `/console/analytics` to `/console/product-analytics`.

---

## 4. Product Analysis Page Goals

The Product Analysis page should answer:

1. Are app users growing?
2. Are website visitors converting?
3. Are foodies using the app after signup?
4. Are merchants completing applications and verification?
5. Are users finding food successfully?
6. Are merchants updating menus and opening hours?
7. Which website pages convert best?
8. Which features are sticky, broken, or underused?
9. Which cohorts retain?
10. Where do users drop off?
11. What issues and reports are increasing?
12. Are notifications and campaigns working?
13. Did a release introduce regressions?
14. Are feature rollouts healthy?

---

## 5. Overview Dashboard

Route:

```text
/console/product-analytics/overview
```

### Top KPI cards

```text
New app users today
New app users this week
New app users this month
Website visitors today
Website visitors this week
Website waitlist signups
Merchant interest submissions
Active foodie users
Active merchant users
Pending merchant applications
Pending stall submissions
Open feedback items
Open reports
Notification open rate
App crash/error count
Crash-free users
Crash-free sessions
Latest production app version
Latest website deployment
```

### Audience split

Show KPIs by:

- Foodies
- Merchants
- Website visitors
- Anonymous users
- Logged-in users
- Verified merchants
- Unverified merchants
- Internal/test users

### Global filters

```text
Date range
Audience
Platform
Region
App version
Acquisition source
User type
Merchant status
Environment: production / staging / preview
```

---

## 6. North Star Metrics

### Consumer north-star metric

```text
Qualified Food Discovery Sessions
```

A session where a user performs at least one meaningful food discovery action:

- submits a search
- views a dish
- views a stall
- taps a map pin
- saves a dish
- starts or submits a review
- uses Decide For Me
- taps directions or delivery link

### Merchant north-star metric

```text
Active Merchant Profiles
```

A merchant outlet that performs at least one meaningful profile-management action:

- profile update
- menu update
- dish update
- opening-hours update
- customer reply
- promotion creation
- verification submission

### Marketplace health metric

```text
Discoverable Food Supply
```

Number of live stalls, outlets, or dishes with enough usable data to appear confidently in discovery.

---

## 7. PostHog Integration Strategy

Hungry already has a PostHog analytics sink. Hungry Console should use PostHog for product analytics rather than duplicating the entire analytics stack.

### Use PostHog for

- Event tracking
- Person/user profiles
- Cohorts
- Funnels
- Retention charts
- Trends
- Path analysis
- Session replay links where safe
- Feature flags
- Experiments
- Surveys
- Website traffic and source analytics

### Use Hungry database for

- Merchant application workflow state
- Verification review status
- Stall submission status
- Moderation queues
- Support issues
- Internal admin actions
- Business evidence and review notes
- User reports and appeals

### Console approach

Use both:

1. PostHog dashboard deep links for deep analysis.
2. Hungry Console summary cards for daily operating metrics.

Do not rebuild the whole PostHog UI.

---

## 8. Current App Events to Surface

Existing Hungry app events to include:

```text
app_launched
sign_up_completed
sign_in_completed
sign_out
onboarding_completed
taste_quiz_completed
dietary_preferences_set
location_permission_result
search_submitted
category_chip_tapped
dietary_chip_tapped
taste_filter_applied
map_pin_tapped
floor_switched
dish_viewed
decide_for_me_triggered
decide_for_me_result_shown
decide_for_me_no_match
decide_for_me_radius_expanded
delivery_link_tapped
dish_favourited
dish_unfavourited
review_started
review_submitted
claim_this_stall_tapped
```

### Event mapping

| Event | Console usage |
|---|---|
| `app_launched` | DAU/WAU/MAU, session activity |
| `sign_up_completed` | New users, acquisition, activation |
| `onboarding_completed` | Activation funnel |
| `taste_quiz_completed` | Personalisation adoption |
| `location_permission_result` | Permission conversion |
| `search_submitted` | Discovery demand, search trends |
| `dish_viewed` | Dish discovery engagement |
| `dish_favourited` | Save intent |
| `review_started` / `review_submitted` | UGC contribution funnel |
| `claim_this_stall_tapped` | Merchant intent signal |
| `delivery_link_tapped` | Partner/delivery intent |
| `decide_for_me_*` | Recommendation feature engagement |

---

## 9. Additional Events to Add

### Website events

```text
website_page_viewed
website_cta_clicked
website_waitlist_started
website_waitlist_submitted
website_merchant_interest_started
website_merchant_interest_submitted
website_scroll_depth_reached
website_outbound_link_clicked
website_form_error_shown
```

### Foodie app events

```text
session_started
home_feed_viewed
foodie_search_result_clicked
stall_detail_viewed
menu_viewed
opening_hours_viewed
directions_tapped
share_tapped
save_collection_created
post_created
post_published
review_photo_added
review_video_added
report_submitted
feedback_submitted
```

### Merchant app events

```text
merchant_mode_opened
merchant_dashboard_viewed
merchant_application_started
merchant_application_submitted
merchant_verification_started
merchant_verification_submitted
merchant_verification_status_viewed
merchant_profile_editor_opened
merchant_profile_updated
merchant_profile_previewed_as_customer
merchant_menu_viewed
merchant_dish_created
merchant_dish_updated
merchant_dish_deleted
merchant_dish_sold_out_toggled
merchant_dish_featured_toggled
merchant_ocr_import_started
merchant_ocr_draft_accepted
merchant_ocr_draft_rejected
merchant_customer_inbox_viewed
merchant_customer_reply_sent
merchant_customer_interaction_reported
merchant_promotion_created
merchant_promotion_published
merchant_ai_assistant_opened
merchant_ai_suggestion_used
merchant_settings_updated
```

### Console/admin events

```text
console_login_completed
console_dashboard_viewed
console_feedback_opened
console_feedback_resolved
console_report_opened
console_report_action_taken
console_merchant_application_opened
console_merchant_application_approved
console_merchant_application_rejected
console_stall_submission_opened
console_stall_submission_approved
console_stall_submission_rejected
console_notification_drafted
console_notification_test_sent
console_notification_scheduled
console_notification_sent
console_feature_flag_created
console_feature_flag_updated
console_remote_config_updated
console_admin_action_audited
```

---

## 10. User, Merchant, and Group Analytics Model

### User properties

```text
user_id
user_type: foodie | merchant | both | admin
signup_date
signup_source
onboarding_completed
taste_quiz_completed
location_permission_status
notification_permission_status
app_version
platform: ios | android | web
device_type
country
region
is_internal_user
```

### Merchant group analytics

Recommended groups:

```text
merchant_account
merchant_outlet
```

Merchant outlet properties:

```text
outlet_id
business_type
verification_status
profile_completion_score
menu_item_count
photo_count
has_opening_hours
has_contact_info
has_delivery_links
has_active_promotion
location_privacy
is_live
```

### Website visitor properties

```text
anonymous_id
first_seen_at
landing_page
utm_source
utm_medium
utm_campaign
initial_referrer
last_seen_at
waitlist_audience
```

---

## 11. Product Analysis Page Sections

## 11.1 Executive Overview

Cards:

```text
New users
Active users
Website visitors
Waitlist conversions
Merchant interest conversions
Merchant applications pending
Stall submissions pending
Searches submitted
Dish views
Reviews submitted
Reports submitted
Open issues
Crash/error count
Crash-free users
Crash-free sessions
```

Charts:

- New users over time
- Active users over time
- Search volume over time
- Merchant applications over time
- Website conversion funnel
- App activation funnel
- Feedback/report trend
- Release health trend

## 11.2 Foodie Analytics

Metrics:

```text
New foodie users
Active foodie users
DAU / WAU / MAU
Average sessions per user
Searches per user
Dish views per user
Stall detail views
Menu views
Map pin taps
Direction taps
Saves / favourites
Reviews started
Reviews submitted
Review completion rate
Posts created
Decide For Me usage
Delivery link taps
```

## 11.3 Merchant Analytics

Metrics:

```text
New merchant interest submissions
Merchant applications started
Merchant applications submitted
Merchant applications approved
Merchant applications rejected
Merchant applications needing more info
Verification submissions
Verified merchants
Active merchant outlets
Profile updates
Menu updates
Dish creates/edits
Opening-hours updates
Customer replies sent
Promotions created
AI assistant usage
```

## 11.4 Website Analytics

Metrics:

```text
Total visitors
Unique visitors
New visitors
Returning visitors
Page views
Sessions
Bounce rate
Average session duration
Scroll depth
CTA clicks
Waitlist starts
Waitlist submissions
Merchant interest submissions
Form error rate
Conversion rate by page
Conversion rate by UTM source
```

## 11.5 Retention and Cohorts

Cohorts:

```text
New foodies this week
New merchants this week
Users who completed taste quiz
Users who skipped taste quiz
Users who allowed location
Users who denied location
Users who saved a dish
Users who submitted a review
Merchants who updated menu
Merchants who completed verification
Merchants who replied to customers
Users exposed to feature flag X
Users who received notification campaign Y
```

## 11.6 Release and App Health Analytics

Metrics:

```text
Current production app version
Current preview app version
Release adoption
Crash-free users
Crash-free sessions
New issues by release
Regressions by release
Users affected by issue
Performance issues
App start time
Screen render time
API/network error rate
Build/deployment failures
```

## 11.7 Feature Flag and Experiment Analytics

Metrics:

```text
Active flags
Flags changed in last 7 days
Users exposed by flag
Conversion by flag variant
Crash/error rate by flag variant
Retention by flag variant
Experiment winner / inconclusive status
Rollout percentage
Kill switch status
```

---

## 12. Product Analytics Layout

Desktop layout:

```text
Top filter bar:
  Date range | Audience | Platform | Region | App version | Segment | Environment

KPI row:
  New users | Active users | Website visitors | Merchant applications | Searches | Dish views | Reports

Main chart area:
  Growth chart | Activation funnel | Retention chart | Release health

Breakdown grids:
  Foodies | Merchants | Website | Notifications | Feedback | Data quality | Feature flags

Lower section:
  Top events | Top searches | Top pages | Top issue categories | PostHog links | Sentry/Firebase links
```

---

## 13. Data Sources

| Source | Use |
|---|---|
| PostHog | Event analytics, funnels, cohorts, retention, experiments, feature flags |
| Supabase / app database | Users, merchants, applications, stalls, dishes, reports, support states |
| Website database | Waitlist, merchant interest, form submissions |
| Vercel | Website deployment, web performance, traffic if available |
| Sentry | Crashes, issues, affected users, releases, performance issues |
| Firebase | Cloud Messaging, Crashlytics, Remote Config, A/B Testing, App Distribution if used |
| EAS / app release tooling | App versions, update channels, releases |
| Notification provider | Push delivery, opens, failures |
| GitHub | Linked engineering issues, pull requests, releases |

---

## 14. Data Model Additions

```text
product_metric_definitions
product_metrics_daily
product_metrics_hourly
website_metrics_daily
foodie_metrics_daily
merchant_metrics_daily
merchant_funnel_daily
feedback_metrics_daily
report_metrics_daily
notification_metrics_daily
data_quality_metrics_daily
release_health_daily
feature_flag_exposures_daily
experiment_results_daily
posthog_dashboard_links
posthog_saved_queries
sentry_project_links
firebase_project_links
analytics_event_quality_issues
console_saved_views
console_metric_annotations
```

---

## 15. Privacy and Analytics Safety

Rules:

- Do not send private identifiers, home addresses, verification documents, or sensitive admin fields to product analytics tools.
- Aggregate or round location data before analytics use.
- Mark internal staff/test users clearly.
- Allow opt-out where required.
- Separate operational records from analytics events.
- Limit replay tooling on sensitive screens.
- Mask input fields in replay tools.

Sensitive screens where recording should be disabled or masked:

```text
Login
Signup
Account settings
Merchant verification evidence
Home-based address fields
Payment setup
Support messages with private data
Admin console user detail pages
```

---

## 16. Product Analysis MVP

### Phase 1 — Product analytics foundation

```text
/console/product-analytics shell
Date range filter
Audience filter: all / foodies / merchants / website
New users card
Active users card
Website visitors card
Waitlist submissions card
Merchant interest submissions card
Searches submitted card
Dish views card
Open feedback/reports card
Crash-free users/sessions card
Basic PostHog dashboard links
Basic Sentry/Firebase links
```

### Phase 2 — Core funnels

```text
Foodie activation funnel
Merchant activation funnel
Website waitlist funnel
Merchant website funnel
Retention chart
Top events table
Top pages table
Top searches table
Release health trend
```

### Phase 3 — Merchant and operations analytics

```text
Merchant application funnel
Verification funnel
Menu update activity
Profile completion metrics
Customer inbox reply metrics
Feedback issue trends
Report trends
Data quality dashboard
Feature flag impact summary
```

### Phase 4 — Advanced analytics integration

```text
PostHog API-backed charts
PostHog cohort sync
Feature flag analytics
Experiment analysis
Session replay deep links
Saved PostHog query library
Metric annotations
Sentry release health sync
Firebase messaging metrics sync
```

---

## 17. Recommended PostHog Dashboards to Create

```text
Hungry Executive Overview
Hungry Foodie Activation
Hungry Merchant Activation
Hungry Website Conversion
Hungry Search and Discovery
Hungry Reviews and UGC
Hungry Retention Cohorts
Hungry Notifications and Campaigns
Hungry Merchant Mode Usage
Hungry Feature Flags and Experiments
Hungry Error and Issue Correlation
```

---

## 18. Recommendation

Add Product Analysis to the first release of Hungry Console, but start with summary metrics and PostHog/Sentry/Firebase links rather than recreating those products.

Best immediate implementation:

1. Instrument missing website and merchant events.
2. Create key PostHog dashboards.
3. Build `/console/product-analytics` with KPI cards, core funnels, release health, and dashboard deep links.
4. Add API summaries only for metrics the team checks daily.
5. Add deeper event explorer, cohorts, replay links, and feature flag impact later.
