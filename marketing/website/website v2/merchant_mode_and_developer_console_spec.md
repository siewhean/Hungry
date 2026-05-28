# Hungry Website Update — Merchant Mode + Developer Console Spec

## 1. Purpose

This document updates the Hungry website direction to reflect the current Merchant Mode implementation in the app and defines a new private **Hungry Developer Console** website for managing the app, website, merchants, users, feedback, moderation, operations, and controlled app-wide updates.

The goal is to create two connected web experiences:

1. **Public merchant website updates** — a stronger merchant-facing marketing/product page that accurately explains what Merchant Mode can do.
2. **Private developer/admin console** — an internal web portal for the Hungry team to operate both the mobile app and website safely.

---

## 2. Current Merchant Mode Reference

The current app implementation already supports a much richer merchant mode than the original marketing page explains.

### Merchant Mode areas already reflected in app structure

Merchant Mode should be presented on the website as a business management centre with these areas:

- Merchant dashboard
- Menu management
- Analytics / performance
- Business profile management
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

### Merchant account and business support

Merchant Mode supports multiple food-business types:

- Hawker stalls
- Food court stalls
- Restaurants
- Cafes
- Mall tenants
- Home-based food businesses

### Merchant profile fields to reflect on the website

The merchant website should mention that merchants can eventually manage:

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

### Merchant operations already modelled

The website and developer console should support the following operational concepts:

- Verification status: not started, draft, submitted, in review, verified, rejected, more info needed
- Verification methods: video walkaround, licence upload, Singpass/Myinfo Business, home-based declaration
- Location privacy: exact, approximate, hidden
- Merchant roles: owner, manager, staff
- Merchant analytics: profile visits, menu views, dish views, direction taps, saves, shares, contact taps, social link taps, post interactions, reviews, average rating, top dishes, searched keywords, peak discovery hours, taste tags
- Promotions: draft, scheduled, active, ended
- Customer interactions: reviews, comments, post mentions, questions
- OCR dish drafts from menu photos

---

## 3. Public Merchant Website Update

The `/for-merchants` page should be updated from a simple merchant-interest page into a product-led Merchant Mode page.

### 3.1 New merchant page positioning

Current message:

> Get discovered.

Expanded message:

> Get discovered, keep your menu current, and manage how customers see your food.

### 3.2 Recommended page structure

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

---

## 4. Merchant Website Sections

### Section 1 — Merchant Hero

Headline:

```text
Get discovered by people deciding what to eat nearby.
```

Supporting copy:

```text
Hungry helps hawker stalls, food courts, cafes, restaurants, and home-based food businesses manage their food profile, menu, photos, hours, and customer interactions from Merchant Mode.
```

Primary CTA:

```text
Register Merchant Interest
```

Secondary CTA:

```text
Preview Merchant Mode
```

---

### Section 2 — Merchant Mode Product Preview

Purpose:

Show that Merchant Mode is not just a claim form. It is a business management surface.

Feature cards:

- Dashboard overview
- Menu management
- Analytics
- Profile editor
- Verification centre
- Customer inbox
- Promotions
- AI assistant

---

### Section 3 — Verification and Stall Application

Purpose:

Explain how merchants apply, verify, and claim ownership.

Content:

- Claim an existing stall
- Submit a new stall application
- Upload evidence such as licence, document, or video walkaround
- Home-based businesses can choose privacy settings
- Hungry reviews applications before approval
- Verified merchants receive a Hungry verification indicator

Recommended CTA:

```text
Start Merchant Application
```

---

### Section 4 — Business Profile Management

Purpose:

Explain the editable business profile.

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

---

### Section 5 — Menu and Dish Management

Purpose:

Show menu control as a core value proposition.

Feature list:

- Add and edit dishes
- Upload dish photos
- Set price, ingredients, allergens, dietary tags, taste tags
- Mark dish as sold out
- Feature signature dishes
- Import menu photos with OCR drafts
- Accept, reject, or edit OCR dish suggestions
- Use AI to draft dish descriptions

---

### Section 6 — Customer Inbox

Purpose:

Show merchant-customer communication.

Feature list:

- View reviews, comments, mentions, questions
- Filter unreplied interactions
- Reply to users
- Use quick reply templates
- Use AI reply suggestions, reviewed before sending
- Report abusive content
- View the original review or post
- Sentiment summary

---

### Section 7 — Analytics and Performance

Purpose:

Give merchants a reason to maintain their profile.

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

---

### Section 8 — Promotions and Visibility

Purpose:

Prepare merchants for future paid / featured tools.

Feature list:

- Promotion builder
- Promotion drafts
- Scheduled promotions
- Active and ended promotions
- Target audience: nearby users, users who saved the stall, taste-match users, followers
- Promotion analytics: impressions, clicks, saves, profile visits, dish views

---

### Section 9 — AI Assistant

Purpose:

Position Hungry as useful for busy merchants.

Feature list:

- Profile improvement suggestions
- Menu cleanup suggestions
- Demand insights
- Best time to post
- Photo improvement suggestions
- Weekly summary
- AI output is always draft-only and never auto-published

---

### Section 10 — Supported Business Types

Show that Hungry is not only for hawker stalls.

Business type cards:

- Hawker stalls
- Food court stalls
- Restaurants
- Cafes and bakeries
- Mall tenants
- Home-based food businesses

---

## 5. New Private Developer/Admin Website

The new internal website should be called:

```text
Hungry Console
```

Alternative names:

- Hungry Admin
- Hungry Ops Console
- Hungry Control Centre
- Hungry Developer Portal

Recommendation:

```text
Hungry Console
```

It sounds broader than developer-only and can cover engineering, support, merchant operations, moderation, growth, and product management.

---

## 6. Hungry Console Goals

Hungry Console should allow the team to:

- manage the mobile app and website
- review app feedback
- review merchant stall applications
- review new stall submissions
- manage user reports
- manage merchant issues
- moderate content
- send app-wide notifications
- send targeted messages
- publish app activity / announcements
- manage feature flags and rollouts
- monitor app health
- review analytics
- resolve user and merchant support issues
- audit all admin actions

---

## 7. Hungry Console Navigation

Recommended private route structure:

```text
/console
/console/overview
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
/console/analytics
/console/data-quality
/console/issues
/console/audit-log
/console/team
/console/settings
```

---

## 8. Hungry Console Main Modules

## 8.1 Overview Dashboard

Purpose:

Give developers and operators a live snapshot of Hungry.

Widgets:

- Active users
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

Recommended alerts:

- High severity bug spike
- Surge in user reports
- Merchant application backlog
- Failed notification campaign
- Spike in negative reviews
- Content moderation queue too large

---

## 8.2 Unified Inbox

Purpose:

One queue for all operational work.

Inbox item types:

- User feedback
- Merchant issue
- User report
- Merchant report
- Stall application
- New stall submission
- Review moderation
- Post moderation
- Bug report
- App crash linked to user feedback
- Data correction request

Fields:

- Type
- Priority
- Status
- Assigned team member
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

---

## 8.3 Feedback Management

Purpose:

Capture and resolve feedback from the app and website.

Features:

- Feedback inbox
- Search and filters
- Tags: bug, UX issue, feature request, data issue, menu issue, opening-hours issue, merchant issue, payment issue, account issue
- Attach screenshot / session context
- Link to GitHub issue or internal task
- Assign to developer / support / ops
- Mark as resolved
- Reply to user
- Convert feedback into product roadmap item
- Feedback trend summary

Recommended priority:

High. This should be part of the first Hungry Console release.

---

## 8.4 Reports and Trust & Safety

Purpose:

Handle user, merchant, review, dish, stall, and post reports.

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

---

## 8.5 Merchant Applications

Purpose:

Review merchant registrations, stall claims, and verification submissions.

Application types:

- Existing stall claim
- New stall application
- Home-based business application
- Restaurant / cafe business profile
- Multi-outlet brand request
- Ownership dispute

Review fields:

- Business name
- Business type
- Applicant name
- Applicant email / phone
- Claimed stall or new stall
- Address / area / building / unit
- Menu evidence
- Licence or business evidence
- Video walkaround
- Social proof link
- Home-based location privacy setting
- Verification method
- Risk score
- Reviewer notes

Decision actions:

- Approve
- Reject
- Request more information
- Merge with existing stall
- Flag duplicate
- Escalate ownership dispute
- Grant verified badge
- Create merchant account

---

## 8.6 New Stall Submission Review

Purpose:

Review new stall submissions from users and merchants before they appear in app data.

Submission fields:

- Stall name
- Business type
- Location
- Unit number / floor
- Menu photos
- Dish suggestions
- Opening hours
- Contact details
- Photos
- Submitter identity
- Confidence score
- Duplicate detection
- Map pin confidence

Review actions:

- Approve as new stall
- Reject
- Merge with existing stall
- Request clarification
- Mark as duplicate
- Publish draft listing
- Send correction notice

---

## 8.7 Users Management

Purpose:

Support, moderation, and account control.

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

Recommended admin controls:

- Do not allow casual account impersonation.
- Use support-view mode with sensitive fields masked by default.
- Require elevated permission and audit log for any destructive action.

---

## 8.8 Merchant Management

Purpose:

Manage merchant accounts after approval.

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

---

## 8.9 Content Moderation

Purpose:

Moderate user-generated and merchant-generated content.

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

---

## 8.10 Notifications and Messaging Control

Purpose:

Allow the team to send controlled updates to the app.

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

Targeting options:

- Everyone
- Foodies only
- Merchants only
- Verified merchants
- Users in selected area
- Users who saved a stall
- Users who follow a merchant
- Users with specific taste tags
- Users on app version X
- Test users / internal users

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

Recommendation:

App-wide notifications should require two-step confirmation and audit logging.

---

## 8.11 Activity Feed Management

Purpose:

Control in-app announcements and operational updates.

Activity item types:

- App update
- New feature
- Area spotlight
- Food campaign
- Merchant onboarding update
- Maintenance message
- Safety notice
- Community guideline update

Fields:

- Title
- Body
- Image
- Deep link
- Audience
- Start date
- End date
- Priority
- Publish status

---

## 8.12 Feature Flags and Remote Config

Purpose:

Control app behaviour without redeploying.

Features:

- Feature flags
- Rollout percentages
- User / merchant targeting
- Internal-only features
- Kill switches
- Remote config values
- App maintenance mode
- Minimum supported version
- Experiment assignment
- Change history
- Approvals

Example flags:

- `merchantCentreEnabled`
- `merchantVerificationEnabled`
- `merchantPromotionsEnabled`
- `merchantAIAssistantEnabled`
- `ocrMenuImportEnabled`
- `newStallSubmissionEnabled`
- `reviewsEnabled`
- `notificationsEnabled`
- `homeBasedBusinessesEnabled`

---

## 8.13 Releases and Deployment Management

Purpose:

Track app and website releases.

Features:

- Current production app version
- Current preview app version
- Website deployment status
- Changelog composer
- Release notes
- Rollback checklist
- App store review status
- EAS update channel status
- Vercel deployment links
- Build logs
- Failed deployment alerts

---

## 8.14 Analytics and Product Insights

Purpose:

Understand user, merchant, and product performance.

Dashboards:

- User growth
- Activation funnel
- Search queries
- Dish discovery funnel
- Save / review / visit intent funnel
- Merchant application funnel
- Merchant verification funnel
- Menu update activity
- Report volume
- Feedback trends
- Notification performance
- Retention cohorts

---

## 8.15 Data Quality Management

Purpose:

Keep Hungry’s food database accurate.

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

---

## 8.16 Audit Log

Purpose:

Protect the platform from unsafe internal changes.

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

Fields:

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

## 9. Roles and Permissions

Recommended admin roles:

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
| Read-only | View dashboards only |

Security recommendation:

- Owner/Admin permissions should require 2FA.
- App-wide notifications and production config changes should require approval.
- Sensitive data should be masked by default.

---

## 10. Industry Features to Include

These are common features used by modern app/product operations teams.

### Product and engineering

- Feature flags
- Percentage rollouts
- Kill switches
- A/B experiments
- Remote config
- Release management
- Deployment status
- App version control
- Changelog and release notes
- Crash and error monitoring
- Performance monitoring
- Session replay / screen recording context
- Internal QA tester management

### Support and feedback

- User feedback inbox
- Bug report capture
- Screenshot capture
- Session context
- Issue assignment
- GitHub/Jira issue linking
- Support reply workflow
- SLA tracking
- Feedback categorisation
- AI feedback summaries

### Operations and moderation

- User reports
- Merchant reports
- Review/post/photo moderation
- Spam detection
- Abuse workflows
- User suspension
- Merchant restriction
- Appeals
- Content restoration
- Audit log

### Merchant operations

- Merchant application queue
- Stall claim review
- Verification workflow
- Ownership dispute handling
- Home-based business privacy workflow
- Multi-outlet management
- Merchant support history
- Merchant performance dashboard

### Growth and communication

- Push notifications
- In-app banners
- App-wide announcements
- Scheduled campaigns
- Targeted campaigns
- Deep links
- Notification analytics
- Activity feed management
- Campaign approval flow

### Data operations

- Data import review
- Duplicate detection
- Missing fields dashboard
- Data correction requests
- Opening hours freshness
- Menu price conflicts
- Bulk edits
- Export/import tooling

---

## 11. Recommended Build Priority

### Phase 1 — Must-have admin foundation

Build first:

- `/console` private shell
- Role-based access control
- Overview dashboard
- Unified inbox
- Feedback management
- Reports management
- Merchant applications
- Stall submissions
- Users search
- Merchants search
- Audit log

### Phase 2 — Merchant ops and moderation

Add next:

- Merchant verification workflow
- Home-based business review workflow
- Review/post/photo moderation
- Duplicate stall handling
- Data correction queue
- Merchant issue management
- Support replies

### Phase 3 — App control and growth

Add once the foundation is safe:

- Push notification composer
- In-app announcement composer
- Activity feed composer
- Feature flags
- Remote config
- Release management
- App version control
- Campaign analytics

### Phase 4 — Advanced product ops

Add later:

- Experiments and A/B testing
- Session replay integration
- AI feedback summaries
- AI moderation assist
- Data quality scoring
- Merchant performance benchmarking
- Automated issue routing
- Full observability dashboards

---

## 12. Recommended Data Model

Suggested tables / collections:

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
```

---

## 13. Critical Safety Rules

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
- Home-based businesses should default to approximate or hidden location
- Only elevated roles can see sensitive documents
- Log every access to verification evidence

---

## 14. Recommended Public Website Copy Updates

### Merchant hero

```text
Get discovered by people deciding what to eat nearby.
```

### Merchant subcopy

```text
Hungry helps food businesses manage dishes, menus, photos, hours, customer interactions, and verification from Merchant Mode.
```

### Merchant feature labels

```text
Business profile
Menu manager
Dish editor
Opening hours
Verification centre
Customer inbox
Analytics
Promotions
AI assistant
```

### Developer console positioning

This should not be public-facing marketing copy. In internal documentation, describe it as:

```text
Hungry Console is the private operations portal for managing the Hungry app, website, merchants, users, reports, feedback, releases, notifications, and product configuration.
```

---

## 15. Final Recommendation

Build **Hungry Console** as a private internal web application, separate from the public marketing pages but within the same website workspace if routing and permissions are strict.

Recommended final structure:

```text
marketing/website/web-v2
  public marketing website
  /for-merchants updated to reflect Merchant Mode
  /console private internal admin portal
```

If security or deployment complexity grows, split the console into a separate internal app later:

```text
admin.usehungry.com
```

or

```text
console.usehungry.com
```

Best immediate path:

1. Update `/for-merchants` with Merchant Mode features.
2. Add `/console` private shell.
3. Build overview, inbox, feedback, reports, merchant applications, and stall submission review first.
4. Add notifications and feature flags only after RBAC and audit logging are complete.
