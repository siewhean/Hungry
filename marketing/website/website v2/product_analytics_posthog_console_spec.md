# Hungry Console — Product Analytics and PostHog Spec

## 1. Purpose

This document expands the Hungry Console plan with a dedicated **Product Analysis** area for viewing product statistics across:

- Hungry mobile app
- Hungry website
- Foodie users
- Merchant users
- Merchant applications
- Stall submissions
- Feedback and issues
- Notifications and campaigns
- PostHog product analytics

The goal is to give the Hungry team one internal place to understand growth, activation, engagement, retention, merchant health, website conversion, app behaviour, and operational issues.

---

## 2. Recommended Console Routes

Add these routes to the private console:

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
/console/product-analytics/data-quality
/console/product-analytics/posthog
```

Recommendation:

- Use `/console/product-analytics` as the main dashboard.
- Use `/console/product-analytics/posthog` for PostHog-specific dashboards, event explorer, cohort links, and embedded/deep-linked PostHog reports.
- Keep `/console/analytics` as a short redirect to `/console/product-analytics` if it already exists in planning.

---

## 3. Product Analysis Page Goals

The Product Analysis page should answer:

1. Are users growing?
2. Are merchants growing?
3. Are people using the app after sign-up?
4. Are users finding dishes and stalls successfully?
5. Are merchants completing applications and verification?
6. Are merchants updating menus and opening hours?
7. Which pages convert on the website?
8. What are users searching for?
9. What issues and reports are increasing?
10. Which features are sticky, broken, or underused?
11. Are app-wide notifications and campaigns working?
12. Which cohorts retain?
13. Where do users drop off?

---

## 4. Product Analysis Overview Dashboard

Route:

```text
/console/product-analytics/overview
```

### Top-level KPI cards

Show these at the top:

```text
New app users today
New app users this week
New app users this month
Website visitors today
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
```

### Audience split

Show all KPIs split by:

- Foodies
- Merchants
- Website visitors
- Anonymous users
- Logged-in users
- Verified merchants
- Unverified merchants

### Time filters

Required date ranges:

```text
Today
Yesterday
Last 7 days
Last 30 days
Month to date
Last 90 days
Custom range
```

### Comparison options

- Compare to previous period
- Compare to same weekday last week
- Compare to same period last month

---

## 5. North Star Metrics

Hungry should define separate north-star metrics for consumer and merchant health.

### Consumer north-star metric

Recommended:

```text
Qualified Food Discovery Sessions
```

Definition:

A session where a user performs at least one meaningful food discovery action, such as:

- submits a search
- views a dish
- views a stall
- taps a map pin
- saves a dish
- starts or submits a review
- uses Decide For Me
- taps directions or delivery link

### Merchant north-star metric

Recommended:

```text
Active Merchant Profiles
```

Definition:

A merchant outlet that has performed at least one meaningful profile-management action in the selected period, such as:

- profile update
- menu update
- dish update
- opening-hours update
- customer reply
- promotion creation
- verification submission

### Marketplace health metric

Recommended:

```text
Discoverable Food Supply
```

Definition:

Number of live stalls/outlets/dishes with enough usable data to appear confidently in discovery.

Minimum fields:

- name
- location or service area
- business type
- at least one dish or menu photo
- opening hours or availability state
- image or visual proof

---

## 6. PostHog Integration

Hungry already has a PostHog analytics sink in the app. The console should make use of PostHog data rather than duplicating all product analytics logic.

### Recommended PostHog usage

Use PostHog for:

- event tracking
- user/person profiles
- cohorts
- funnels
- retention charts
- trends
- path analysis
- session replay, if enabled safely
- feature flags
- experiments
- surveys
- product usage dashboards

Use Hungry’s own database for:

- merchant application state
- verification review status
- stall submission status
- moderation queues
- support issues
- internal admin actions
- sensitive business evidence
- product-specific operational workflow state

### Console integration approach

Use both:

1. **PostHog deep links** for advanced analysis.
2. **PostHog API-backed summary cards** inside Hungry Console.

The console should not try to rebuild all of PostHog. It should pull core metrics, show summaries, and link operators into PostHog for deep analysis.

---

## 7. Current App Events to Surface

The existing analytics event taxonomy already includes these app events and should be represented in Product Analysis:

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

### Dashboard mapping

| Event | Console usage |
|---|---|
| `app_launched` | DAU/WAU/MAU, session activity |
| `sign_up_completed` | new users, acquisition, activation |
| `onboarding_completed` | activation funnel |
| `taste_quiz_completed` | personalisation adoption |
| `location_permission_result` | permission conversion |
| `search_submitted` | discovery demand, search trends |
| `dish_viewed` | dish discovery engagement |
| `dish_favourited` | save intent |
| `review_started` / `review_submitted` | UGC contribution funnel |
| `claim_this_stall_tapped` | merchant intent signal |
| `delivery_link_tapped` | monetisable intent / partner intent |
| `decide_for_me_*` | recommendation feature engagement |

---

## 8. Additional Events to Add

Add these events to properly support the product analysis page.

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

Recommended properties:

```text
page_path
page_name
referrer
utm_source
utm_medium
utm_campaign
utm_content
utm_term
cta_label
cta_location
audience
form_type
scroll_depth
```

---

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

---

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

---

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

## 9. PostHog User, Group, and Property Model

### Person/user properties

Attach these properties to PostHog persons where safe:

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

Do not send raw email, phone, exact address, documents, or precise home-based location.

### Merchant group analytics

Use PostHog Group Analytics if available.

Recommended groups:

```text
merchant_account
merchant_outlet
```

Merchant account properties:

```text
merchant_account_id
merchant_role
outlet_count
created_at
verification_status
has_verified_outlet
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

For anonymous website visitors:

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

When a visitor joins the waitlist, connect anonymous activity to the waitlist record where privacy rules allow.

---

## 10. Product Analysis Page Sections

## 10.1 Executive Overview

Purpose:

Give a founder/operator a single page to check product health.

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
```

Charts:

- New users over time
- Active users over time
- Search volume over time
- Merchant applications over time
- Website conversion funnel
- App activation funnel
- Feedback/report trend

---

## 10.2 Foodie Analytics

Purpose:

Understand user behaviour in the consumer app.

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

Funnels:

```text
App launch → Sign up → Onboarding complete → First search → First dish view → First save/review
Search submitted → Search result clicked → Dish viewed → Stall viewed → Direction/delivery tapped
Review started → Photos added → Review submitted
```

Retention:

```text
Day 1 retention
Day 7 retention
Day 30 retention
Weekly returning users
Cohort retention by signup source
Cohort retention by taste quiz completion
```

---

## 10.3 Merchant Analytics

Purpose:

Understand merchant onboarding, health, and activity.

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

Funnels:

```text
Merchant interest → Application started → Application submitted → In review → Approved → Verified
Merchant mode opened → Profile editor opened → Profile updated → Preview as customer
Merchant mode opened → Menu viewed → Dish created/updated → Menu previewed
Customer inbox viewed → Reply composer opened → Reply sent
```

Merchant health scores:

```text
Profile completion score
Menu completeness score
Photo completeness score
Opening-hours freshness score
Verification status
Reply rate
Review response time
Promotion activity
```

---

## 10.4 Website Analytics

Purpose:

Track public website performance and conversion.

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

Key page breakdown:

```text
/
/for-foodies
/for-merchants
/about
/join-waitlist
/privacy
/terms
```

Funnels:

```text
Landing page view → CTA click → Waitlist form start → Waitlist submitted
For Merchants view → Register Interest click → Merchant form start → Merchant interest submitted
Homepage view → Audience card click → Audience page view → CTA click → Signup
```

---

## 10.5 Acquisition Analytics

Purpose:

Understand where users and merchants come from.

Dimensions:

```text
UTM source
UTM medium
UTM campaign
UTM content
UTM term
Referrer
Landing page
Organic search query, if available
Device type
Platform
Country / region
```

Metrics:

```text
Visitors by channel
Waitlist conversion by channel
Merchant interest conversion by channel
App signup conversion by channel
Cost per signup, if ad cost is imported later
Campaign retention
```

---

## 10.6 Funnel Analysis

Purpose:

Let operators build and inspect product funnels.

Required built-in funnels:

### Foodie activation funnel

```text
app_launched
sign_up_completed
onboarding_completed
taste_quiz_completed
search_submitted
dish_viewed
dish_favourited OR review_submitted OR delivery_link_tapped
```

### Merchant activation funnel

```text
merchant_mode_opened
merchant_application_started
merchant_application_submitted
merchant_verification_submitted
merchant_profile_updated
merchant_menu_viewed
merchant_dish_created OR merchant_dish_updated
```

### Website waitlist funnel

```text
website_page_viewed
website_cta_clicked
website_waitlist_started
website_waitlist_submitted
```

### Merchant website funnel

```text
website_page_viewed with page_path=/for-merchants
website_cta_clicked with audience=merchant
website_merchant_interest_started
website_merchant_interest_submitted
```

---

## 10.7 Retention and Cohorts

Purpose:

Understand if Hungry is becoming a habit.

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
```

Retention views:

- Day 1 / Day 7 / Day 30 retention
- Weekly retention
- Monthly retention
- Retention by acquisition source
- Retention by first action
- Retention by merchant verification status

---

## 10.8 Event Explorer

Purpose:

Let the team debug analytics and inspect raw events.

Features:

- Search event name
- Filter by user type
- Filter by platform
- Filter by app version
- Filter by date range
- Filter by session id
- Filter by user id / merchant id where permission allows
- View event properties
- Link to PostHog event/person
- Flag malformed events
- Export CSV for internal analysis

Recommendation:

Use PostHog as the source of truth for raw event exploration, but surface a simplified event explorer in Hungry Console for common debugging.

---

## 10.9 Notifications Analytics

Purpose:

Measure app-wide and targeted messages.

Metrics:

```text
Notifications drafted
Notifications scheduled
Notifications sent
Delivery rate
Open rate
Click/tap rate
Conversion after notification
Unsubscribe/opt-out rate
App opens after notification
Deep-link completion rate
```

Breakdowns:

- Campaign
- Audience segment
- Platform
- User type
- Location / area
- App version

---

## 10.10 Feedback and Issues Analytics

Purpose:

Track product quality and support burden.

Metrics:

```text
New feedback items
New bug reports
New user reports
New merchant reports
Open issues
Resolved issues
Average first response time
Average resolution time
SLA breach count
Top issue categories
Top affected app versions
Repeated user complaints
Merchant issue volume
```

Charts:

- Issues by category over time
- Bugs by app version
- Feedback sentiment trend
- Merchant issues by verification status
- Reports by content type

---

## 10.11 Data Quality Analytics

Purpose:

Track the health of Hungry’s food database.

Metrics:

```text
Total stalls
Live stalls
Draft stalls
Verified stalls
Total dishes
Dishes with photos
Dishes missing price
Stalls missing opening hours
Stalls with stale opening hours
Duplicate stall candidates
Menu conflict count
Pending data corrections
Approved stall submissions
Rejected stall submissions
Merchant-updated fields
```

Recommended scorecards:

- Stall completeness score
- Dish completeness score
- Menu freshness score
- Location confidence score
- Merchant trust score

---

## 11. Product Analytics Layout

Recommended desktop layout:

```text
Top filter bar:
  Date range | Audience | Platform | Region | App version | Segment

KPI row:
  New users | Active users | Merchant applications | Searches | Dish views | Reports

Main chart area:
  Growth chart | Activation funnel | Retention chart

Breakdown grids:
  Foodies | Merchants | Website | Notifications | Feedback | Data quality

Lower section:
  Top events | Top searches | Top pages | Top issue categories | PostHog links
```

Recommended mobile layout:

```text
Date range filter
Primary KPI cards
Tabbed dashboard sections
Charts as vertical cards
Export/share controls hidden behind menu
```

---

## 12. PostHog Dashboard Links to Add

Hungry Console should have shortcuts to saved PostHog dashboards:

```text
PostHog Overview
PostHog Foodie Activation
PostHog Merchant Activation
PostHog Website Conversion
PostHog Retention
PostHog Search and Discovery
PostHog Reviews and UGC
PostHog Notifications
PostHog Feature Flags
PostHog Experiments
PostHog Session Replay
```

Each card should show:

- dashboard name
- description
- last viewed / updated
- owner
- open in PostHog link
- key metric summary if API integration exists

---

## 13. Data Sources

Hungry Console Product Analysis should combine these data sources:

| Source | Use |
|---|---|
| PostHog | Event analytics, funnels, cohorts, retention, experiments, feature flags |
| Supabase / app database | Users, merchants, applications, stalls, dishes, reports, support states |
| Website database | Waitlist, merchant interest, form submissions |
| Vercel | Website deployment, web performance, traffic if available |
| Sentry | Crashes, errors, performance issues |
| EAS / app release tooling | App versions, update channels, releases |
| Notification provider | Push delivery, opens, failures |
| GitHub | Linked engineering issues, pull requests, releases |

---

## 14. Recommended Data Model Additions

Add these tables or materialized views if the console needs faster dashboard loading:

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
posthog_dashboard_links
posthog_saved_queries
analytics_event_quality_issues
console_saved_views
console_metric_annotations
```

### Metric definition fields

```text
id
key
name
description
source
query_type
owner
refresh_frequency
is_sensitive
created_at
updated_at
```

### Daily metric fields

```text
metric_key
date
audience
platform
region
app_version
value
comparison_value
source
last_refreshed_at
```

---

## 15. Privacy and Analytics Safety

Hungry already has analytics sanitisation logic. Product Analytics must preserve and extend this approach.

Rules:

- Do not send raw email, phone, passwords, tokens, cookies, auth headers, secrets, or private addresses to PostHog.
- Do not send exact home-based business addresses to analytics.
- Do not send raw verification documents or evidence metadata into PostHog.
- Round coordinates or aggregate them by area before analytics use.
- Mark internal staff/test users clearly.
- Allow opt-out where required.
- Separate operational records from analytics events.
- Limit session replay on sensitive screens such as login, profile, verification, payments, and support forms.
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

Build this first:

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
Basic PostHog dashboard links
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
```

### Phase 4 — Advanced PostHog integration

```text
PostHog API-backed charts
PostHog cohort sync
Feature flag analytics
Experiment analysis
Session replay deep links
Saved PostHog query library
Metric annotations
```

---

## 17. Recommended Product Analysis Widgets

### Required widgets

```text
New users
Active users
Website visitors
Waitlist conversion
Merchant interest conversion
Foodie activation funnel
Merchant activation funnel
Search volume
Dish views
Review submissions
Save/favourite actions
Merchant applications
Merchant verification status
Menu updates
Open feedback
Open reports
Notification performance
PostHog dashboard shortcuts
```

### Should-have widgets

```text
Retention cohorts
Top search terms
Top dishes viewed
Top stalls viewed
Top merchant issue categories
Data freshness
Feature flag adoption
Experiment results
Crash/error trend
Session replay links
```

### Later widgets

```text
Revenue / paid promotion metrics
Ad campaign ROI
Merchant subscription health
Marketplace supply-demand balance
Food area heatmap
Churn prediction
Merchant risk score
AI-generated weekly analysis
```

---

## 18. Recommended PostHog Dashboards to Create

Create these in PostHog itself, then link them in Hungry Console:

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

## 19. Recommendation

Add Product Analysis to the first release of Hungry Console, but start with summary metrics and PostHog links rather than recreating all of PostHog.

Best immediate implementation:

1. Instrument missing website and merchant events.
2. Create key PostHog dashboards.
3. Build `/console/product-analytics` with KPI cards, core funnels, and dashboard deep links.
4. Add PostHog API summaries only for metrics the team checks daily.
5. Add deeper event explorer and cohorts later.

This gives Hungry immediate visibility into users, merchants, website conversion, app behaviour, and product quality without overbuilding analytics too early.
