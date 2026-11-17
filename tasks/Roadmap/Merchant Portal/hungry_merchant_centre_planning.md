# Hungry Merchant Centre Planning

## Purpose

The Merchant Centre should be a mobile-first business management area integrated into the existing Hungry mobile app. It should help verified food businesses manage their Hungry presence, understand customer demand, interact with customers, manage menus and dishes, create promotions, and prepare for future QR ordering.

This is not a standalone desktop merchant portal yet. The future desktop/web portal should reuse the same backend contracts and data models, but the first implementation should live inside the current Hungry mobile app.

## Product Direction

The Merchant Centre should feel like a mix of:

- GrabMerchant-style business tooling and merchant operations
- modern SaaS dashboard clarity
- Hungry’s own food-focused, playful brand personality

It should not copy Grab, Google Business Profile, Shopify, or any other product directly. These products should only be used as functional references.

## Core Jobs To Be Done

The Merchant Centre should help merchants:

1. Get verified.
2. Claim and manage their stall or business profile.
3. Understand performance through analytics.
4. Manage menu and dish information.
5. Review OCR-extracted dishes and accept/reject them.
6. Reply to customer reviews and comments.
7. Create promotions and growth campaigns.
8. Prepare for future QR ordering.
9. Manage business settings, staff roles, and notification preferences.

## Supported Business Types

The Merchant Centre should support:

- Hawker stalls
- Food court stalls
- Restaurants
- Cafes
- Mall tenants
- Home-based food businesses

Home-based food businesses need their own flow because they may not have a public storefront, stall unit, or licence. The UI must not force them into a hawker/restaurant-only structure.

## Entry Points

Recommended app entry points:

- Profile tab → Merchant Centre
- Settings → Business tools
- Owned Stall Detail page → Manage this stall

## Merchant Access Model

Only verified merchants should be able to access merchant-level settings and publish merchant actions.

### Unverified / Pending Merchants Can:

- Start verification
- View verification status
- Submit verification evidence
- Resubmit evidence if rejected
- View limited onboarding instructions

### Unverified / Pending Merchants Cannot:

- Edit live stall/business details
- Publish promotions
- Reply publicly as the business
- Access full merchant analytics
- Access advanced merchant settings

### Verified Merchants Can:

- Access full Merchant Centre
- Edit business/stall profile
- Manage menu/dishes
- Accept/reject OCR-extracted dishes
- View analytics
- Reply to customer interactions
- Create promotions
- Access settings
- Join future QR ordering pilot

## Verified Merchant Badge

Verified merchants should have a visible verified badge throughout Hungry.

### Badge Purpose

The badge should communicate that Hungry has verified the business or merchant claim. It should increase user trust and help users distinguish verified businesses from unverified listings.

### Where The Badge Should Appear

The verified badge should appear on:

- Merchant Centre dashboard header
- Stall/business profile inside Merchant Centre
- Public Stall Detail page
- Public business profile card
- Map marker preview card / bottom sheet
- Search result cards
- Review cards where the business is referenced
- Promotions created by the business
- Menu/dish pages where appropriate

### Badge States

Use clear verification states:

- Not verified
- Verification not started
- Verification draft
- Submitted
- In review
- More information needed
- Rejected
- Verified

Only the `Verified` state should show the public verified badge.

### Badge UX Notes

- The badge should be subtle but recognisable.
- Tapping the badge can show a small explanation: “Verified by Hungry”.
- The explanation should mention the verification method where appropriate, such as business verification, licence/document verification, or video walkaround review.
- Do not expose sensitive verification documents or private merchant information to consumers.
- If verification is revoked or expired, remove the public badge and show the merchant a status warning inside Merchant Centre.

## Merchant Account Types

### 1. Single Stall Account

For independent merchants managing one business.

Examples:

- Hawker stall owner
- Home-based food business
- Independent cafe
- Single restaurant

### 2. Organisation / Multi-Stall Account

For businesses managing more than one outlet.

Examples:

- Restaurant chain
- Food court operator
- Multi-outlet brand
- Franchise owner

### Mobile UI Pattern

At the top of Merchant Centre, show an outlet switcher:

```text
Currently managing: Ah Heng Chicken Rice
▼ Switch stall / outlet
```

For multi-stall accounts:

```text
All outlets overview
Outlet 1
Outlet 2
Outlet 3
```

## Main Merchant Centre Navigation

Recommended sections:

1. Dashboard
2. Verification
3. Profile
4. Menu
5. Customer Inbox
6. Promotions
7. AI Assistant
8. Orders / QR Ordering Coming Soon
9. Settings

## 1. Dashboard

The dashboard should be the default landing page after a verified merchant enters Merchant Centre.

It should answer:

- “How is my stall/business performing on Hungry?”
- “What needs my attention today?”
- “What should I improve next?”

### Date Range Selector

Use mobile-friendly ranges:

- Today
- 7 days
- 30 days

### Analytics To Include

- Profile visits
- Menu views
- Dish views
- Direction taps
- Saves
- Shares
- Contact taps
- Social link taps
- Post interactions
- Review count
- Average rating
- Promotion performance
- Customer interactions
- Top dishes
- Most saved dishes
- Most searched keywords
- Peak discovery times
- Customer taste tags
- Comparison to previous period

### Action Cards

Show useful action cards such as:

- Verification pending / verified / rejected
- Profile completion score
- Menu completion score
- Reviews needing replies
- Comments needing replies
- Dishes missing ingredients/allergen info
- Suggested promotion
- Opening hours incomplete
- Top-performing dish insight

## 2. Verification Centre

The Verification Centre should help merchants prove that they own or operate the business.

### Verification Methods

Include:

- Singpass / Myinfo Business login option, where possible
- Video walkaround upload
- Licence/document upload, where available
- Home-based business verification path

### Verification Statuses

- Not started
- Draft
- Submitted
- In review
- Verified
- Rejected
- More information needed

### Video Walkaround Flow

The merchant should be guided to capture:

- Business signage or identity proof
- Menu or product proof
- Operating area
- Preparation area, where appropriate
- Proof of control/ownership

Include:

- Video instructions
- Record/upload action
- Upload progress
- Submitted state
- Review status
- Rejection/resubmission flow

## 3. Home-Based Food Business Verification

Home-based businesses should have a dedicated path.

### Required / Suggested Fields

- Business display name
- Owner/contact verification
- Operating area
- Delivery area
- Pickup area
- Exact address privacy setting
- Menu photos
- Food photos
- Social media proof link
- Optional UEN/business registration
- Food safety acknowledgement
- No catering acknowledgement
- Restricted food warning
- Video walkaround option

### Location Privacy

Home-based merchants need privacy controls.

Options:

- Exact location shown
- Approximate area shown
- Hidden from map, searchable only

Recommended default: approximate area only.

## 4. Business / Stall Profile Manager

Verified merchants can edit their public Hungry profile.

### Editable Fields

- Business/stall name
- Description
- Business type
- Cuisine/category
- Address/building/floor/unit, where applicable
- Operating area for home-based businesses
- Map pin and privacy level
- Opening hours
- Temporary closure
- Profile photo
- Cover photo
- Gallery photos
- Contact info
- Social links
- Delivery/pickup links
- Dietary labels
- Taste/cuisine tags
- Signature/featured dishes
- Verified badge preview
- Preview as customer

### Notes

- Do not force exact address visibility for home-based businesses.
- If sensitive public information changes, consider a “pending review” state before publishing.
- Merchants should be able to preview their public profile as customers see it.

## 5. Menu & Dish Manager

The first version should include a lightweight but useful menu manager.

### Published Menu

Allow merchants to:

- View published menu
- Add dish
- Edit dish
- Delete/archive dish if supported
- Mark dish available / sold out
- Feature dish
- Preview menu as customer

### Dish Fields

- Dish name
- Price
- Description
- Dish photo
- Ingredients
- Allergen information
- Dietary tags
- Taste tags
- Spicy level
- Available / sold out toggle
- Featured dish toggle

### OCR Extracted Dishes

Show OCR-extracted dishes from menu photos as drafts.

Merchants should be able to:

- View extracted dish drafts
- See extraction confidence
- See source menu photo
- Accept extracted dish
- Reject extracted dish
- Edit extracted dish before publishing
- Add accepted dish to published menu

### AI Support

Include AI tools as suggestions only:

- AI dish description generator
- AI ingredient/allergen suggestion
- AI menu cleanup
- AI tag suggestions

Important: AI-generated ingredients and allergens must never auto-publish. Merchant confirmation is required.

## 6. Customer Interaction Inbox

The Customer Inbox should help verified merchants respond to users.

### Include

- Reviews
- Comments
- Post mentions
- User questions
- Low-rating alerts
- Unreplied filter
- Recent filter
- Rating filter
- Reply to review/comment
- AI reply suggestions
- Quick replies
- Report abusive comment/review
- View original post/review
- Sentiment summary

Only verified merchants can publish replies as the business.

## 7. Promotions / Growth Tools

Verified merchants should be able to create and manage promotions.

### Promotion Types

- Promote dish
- Lunch deal
- New item campaign
- Limited-time offer
- Off-peak boost

### Promotion Fields

- Promotion title
- Description
- Dish or business target
- Start date
- End date
- Target audience
- Preview card
- Status

### Target Audiences

- Nearby users
- Users who saved stall
- Users with matching taste profile
- Followers

### Promotion Statuses

- Draft
- Scheduled
- Active
- Ended

### Promotion Analytics

- Impressions
- Clicks
- Saves
- Profile visits
- Dish views

## 8. AI Business Assistant

Include a dedicated AI assistant section or dashboard card.

### AI Features

- AI profile improvement suggestions
- AI menu cleanup
- AI dish description generator
- AI ingredient/allergen suggestion
- AI promotion recommendation
- AI best time to post promotion
- AI customer reply suggestions
- AI photo enhancement suggestions
- AI weekly business summary
- AI demand insight

### AI Demand Insight Examples

- “Your desserts get more saves at night.”
- “Customers searching ‘halal lunch’ are increasing nearby.”
- “Your top dish has no ingredients listed.”
- “Your profile gets more visits after 6pm.”

AI should generate drafts/suggestions only. It should never auto-publish.

## 9. Orders / QR Ordering Coming Soon

Order management should be planned but not implemented for the first Merchant Centre release.

### Include Future-Ready Section

- “Orders coming soon” state
- Join pilot CTA
- QR ordering preview
- Printable QR code preview
- Payment setup checklist
- Order inbox placeholder
- Future order lifecycle preview:
  - placed
  - accepted
  - preparing
  - ready
  - collected

Do not fake real orders in production. If mock data is shown, label it clearly as demo/fallback.

## 10. Settings

Include:

- Business account settings
- Manage staff/team
- Role permissions
- Notification preferences
- Privacy settings
- Location privacy
- Verification documents/status
- Help/support
- Logout

### Suggested Roles

- Owner
- Manager
- Staff

## Future Website Backlog: Ops/Admin Dashboard

Do not build ops/admin approval tools inside the mobile Merchant Centre.

Ops/admin should be a future website-only dashboard.

### Future Ops/Admin Features

- Review merchant verification submissions
- Approve/reject video walkaround
- Review uploaded licences/documents
- Review home-based business declarations
- Review merchant claims
- Approve/reject OCR-extracted dishes
- Moderate suspicious profile edits
- Handle reported comments/reviews
- Manage support tickets
- View merchant claim queue
- Manage feature flags
- Audit logs

## Backend / Data Expectations

Prefer real data and real service contracts. If a backend table/API is missing, use mock fallback only where necessary and clearly label it as fallback/demo.

### Suggested Entities

- merchant_accounts
- merchant_profiles
- merchant_verifications
- merchant_verification_evidence
- merchant_businesses
- merchant_outlets
- merchant_roles
- menu_items
- dishes_draft
- promotions
- merchant_analytics
- merchant_customer_interactions
- merchant_notifications

### Verified Badge Data Fields

Consider adding fields such as:

```text
merchant_verification_status
merchant_verified_at
merchant_verified_method
merchant_verification_expires_at
merchant_verified_badge_visible
merchant_verification_revoked_at
```

## Required Production States

Design and implement:

- Empty state
- Loading state
- Error state
- Permission denied state
- Unverified merchant state
- Verification submitted state
- Verification rejected state
- More information needed state
- Verified state
- No analytics yet state
- No menu items state
- No customer interactions state
- No promotions state
- Coming soon orders state
- Mock fallback state, if real data is unavailable

## UX Requirements

- Mobile-first
- Polished and production-ready
- Not a wireframe
- Clear hierarchy
- Easy for non-technical merchants
- Strong visual dashboard cards
- Sticky key actions where useful
- Accessible labels
- Works in light and dark mode
- Uses existing Hungry design tokens/components
- All buttons/tabs/cards should be clickable and functional
- Future-only features must be clearly labelled as coming soon, not fake-working

## Implementation Phases

### Phase 1: Merchant Centre Shell

- Add Merchant Centre entry points
- Add Merchant Centre navigation
- Add merchant access states
- Add outlet switcher
- Add verified badge UI component

### Phase 2: Verification

- Add verification centre
- Add video walkaround flow
- Add home-based business path
- Add status states
- Add verified badge logic

### Phase 3: Dashboard & Analytics

- Add analytics dashboard
- Add date range selector
- Add action cards
- Add empty/loading/error states

### Phase 4: Profile Management

- Add business profile editor
- Add map pin/privacy controls
- Add customer preview

### Phase 5: Menu & Dish Manager

- Add published menu
- Add dish editor
- Add OCR draft accept/reject flow
- Add sold out and featured toggles
- Add ingredients/allergen fields

### Phase 6: Customer Inbox

- Add reviews/comments inbox
- Add replies
- Add AI reply suggestions
- Add filters

### Phase 7: Promotions

- Add promotion builder
- Add promotion preview
- Add promotion analytics

### Phase 8: AI Assistant

- Add AI business assistant card/section
- Add AI suggestions as draft-only actions

### Phase 9: Orders Coming Soon

- Add future order management section
- Add QR ordering pilot CTA
- Add payment setup preview

## Final AI Agent Prompt

Work on the Hungry mobile app and create a polished, production-ready V1 Merchant Centre experience integrated into the existing app.

This should not be a separate desktop/web merchant portal yet. It should be a mobile-first Merchant Centre inside the existing Hungry app, with future desktop/web expansion kept in mind through reusable backend/service contracts.

Use the existing Hungry design system, app theme, typography, spacing, navigation patterns, cards, bottom sheets, and component style. The design should feel like a modern SaaS dashboard mixed with Hungry’s food-focused brand personality. For feature inspiration, reference GrabMerchant / Grab Merchant Centre, Google Business Profile for restaurants, and Shopify-style business management tools, but do not copy their UI directly.

The Merchant Centre must be polished, production-ready, and all buttons/tabs/cards/interactions should be clickable and functional. Where a feature is future-only, make it a clearly labelled “Coming Soon / Join Pilot” state rather than a fake working feature.

Create the following sections:

1. Dashboard
2. Verification
3. Profile
4. Menu
5. Customer Inbox
6. Promotions
7. AI Assistant
8. Orders / QR Ordering Coming Soon
9. Settings

Only verified merchants can access merchant-level settings and publish merchant actions. Unverified merchants can only access verification submission/status. Add a verified merchant badge that appears on the Merchant Centre dashboard, business profile, public stall detail page, map preview cards, search result cards, promotions, and other relevant customer-facing surfaces. The badge should only appear when the merchant verification status is `verified`.

Support merchant types including hawker stalls, food court stalls, restaurants, cafes, mall tenants, and home-based food businesses. Add a dedicated home-based business verification and privacy flow. Home-based businesses should be able to choose exact location, approximate area, or hidden-from-map visibility, with approximate area as the default.

Implement verification with video walkaround, verification status tracking, home-based business path, and Singpass/Myinfo Business option where possible. Include submitted, in-review, rejected, more-information-needed, and verified states.

Implement a mobile analytics dashboard with Today, 7 Days, and 30 Days ranges. Include profile visits, menu views, dish views, direction taps, saves, shares, contact taps, review count, average rating, promotion performance, customer interactions, top dishes, most searched keywords, peak discovery times, and customer taste tags.

Implement profile management for verified merchants, including name, description, business type, location/map pin/privacy, opening hours, photos, contact info, social links, dietary labels, cuisine/taste tags, featured dishes, and customer preview.

Implement a lightweight menu and dish manager with published menu, edit dish, ingredients, allergens, sold out toggle, featured dish toggle, and OCR-extracted dishes that merchants can accept, reject, or edit before publishing.

Implement customer interaction inbox with reviews, comments, post mentions, filters, replies, AI reply suggestions, quick replies, report abusive content, and view-original-post/review actions.

Implement promotions and growth tools with promotion creation, campaign preview, target audience, schedule/status, and promotion analytics. Only verified merchants can publish promotions.

Implement an AI Business Assistant that provides profile improvement suggestions, menu cleanup, dish descriptions, ingredient/allergen suggestions, promotion recommendations, best time to post, customer reply suggestions, photo enhancement suggestions, weekly summaries, and demand insights. AI must never auto-publish; all AI outputs are drafts for merchant approval.

Implement Orders / QR Ordering as a fully planned but not yet live future section. Show “Coming Soon / Join Pilot”, QR ordering preview, printable QR preview, payment setup checklist, and order lifecycle preview. Do not fake live orders.

Add future website-only backlog notes for Ops/Admin Dashboard features: verification review, video walkaround approval, document review, home-based declaration review, OCR dish approval, reported content moderation, merchant support tickets, merchant claim queue, feature flags, and audit logs.

Prefer real data and real service contracts. If backend support is missing, use clearly labelled mock fallback only where necessary. Document what is real, what is mocked, and what requires backend work.

The final result should feel like a real Merchant Centre inside Hungry, suitable for verified hawkers, stalls, restaurants, cafes, and home-based food businesses.
