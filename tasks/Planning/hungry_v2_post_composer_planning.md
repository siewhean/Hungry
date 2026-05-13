# Hungry V2 Post Composer Planning

## 1. Purpose of This Document

This document consolidates the planning and discussion for the **Hungry V2 Post Composer**. It is intended to help an AI agent understand the desired product direction, user experience, screen structure, feature requirements, interaction logic, and implementation priorities.

The goal is to create a post composer that is polished, production-ready, mobile-first, and aligned with Hungry’s identity as a food discovery and food-sharing application.

---

## 2. Product Context

Hungry is a social food-sharing application similar to Instagram, designed for both normal users and businesses to share food-related content.

The Post Composer should support:

- Casual users posting quick food reviews
- Creators sharing food content
- Businesses publishing promotional posts
- Cross-posting to Instagram
- AI-assisted content creation
- Food-focused metadata such as ratings, food tags, taste tags, locations, and collaborators

The composer should not feel like a basic form. It should feel like a premium creation suite for food content.

---

## 3. High-Level Product Vision

The V2 Post Composer should feel like a hybrid of:

- **Instagram** — social posting and visual sharing
- **TikTok** — music, trends, and fast content creation
- **Canva** — creative editing and polished media tools
- **Later / Buffer** — scheduling and creator/business publishing workflow
- **Hungry** — food-first reviews, ratings, taste tags, and venue/location context

The final experience should be:

- Visually premium
- Easy for average users
- Powerful for creators and businesses
- AI-assisted but not overwhelming
- Mobile-first
- Production-ready
- Fully clickable and functional

---

## 4. Updated UX Direction

Originally, the idea was to ask users to choose between a fast publishing mode and a pro composer mode before entering the composer.

The updated direction is better:

> Users should not be forced to choose before entering the composer.

Instead:

1. User taps **Create Post**
2. User is brought directly into the **Post Composer page**
3. At the top of the page, there is a sticky segmented tab interface:
   - **Post**
   - **Review**
4. Users can switch between the Post and Review tabs at any time
5. At publishing, users choose whether to publish:
   - Post only
   - Review only
   - Both Post and Review

This reduces friction while still supporting both casual and professional workflows.

---

## 5. Screen Structure

### Main Layout

The composer should use a **vertical scrolling layout**.

At the top:

- Header / navigation bar
- Sticky segmented tabs:
  - Post
  - Review

Main body:

- Media upload/editing area
- Caption area
- Food metadata
- AI tools
- Music tools
- Collaboration tools
- Location tools
- Preview/review section
- Scheduling/publishing settings

Bottom:

- Sticky publish action bar
- Publish destination selector:
  - Post only
  - Review only
  - Post both

---

## 6. Tabs

## 6.1 Post Tab

The **Post** tab is the advanced creator/business workflow.

It should support:

- Multiple image/video upload
- Media editing
- Music
- AI enhancements
- Captions
- Hashtags
- Tagging accounts
- Co-authoring
- Location tagging
- Food tags
- Taste tags
- Scheduling
- Drafts
- Instagram cross-posting
- Business CTAs
- Promotions
- Campaign tracking
- Live preview

This tab is for users who want more control and professional publishing tools.

---

## 6.2 Review Tab

The **Review** tab is the food review workflow.

It should support:

- Multiple image/video upload
- Review caption
- 500 character limit
- 5-star rating
- Food tags
- Taste tags
- Collaborators/co-authors
- Location tagging
- AI hashtag suggestions
- AI tag suggestions

The Review tab should feel faster and simpler than the Post tab, but it should still be visually polished.

The Review content should appear in:

- Home feed
- Bite cards
- Review-related cards/feed

---

## 7. Shared Field Syncing

Some fields should be shared between the Post and Review tabs.

Shared fields should sync in real time:

- Uploaded images/videos
- Collaborators/co-authors
- Tagged accounts
- Location
- Food tags
- Taste tags

### Caption Syncing

Caption behavior should be flexible.

Recommended approach:

- Add a **“Use same caption”** toggle
- Toggle is ON by default
- When ON, the caption is shared between Post and Review
- When OFF, users can customize the Post caption and Review caption separately

Important:

- Review caption must always respect the **500 character limit**
- If the shared caption exceeds 500 characters, the Review tab should warn the user and require trimming before publishing the Review

---

## 8. Publishing Logic

At the bottom of the screen, include a sticky publish action bar.

Users should be able to choose:

- Publish Post only
- Publish Review only
- Publish both Post and Review

The composer should validate the selected destinations before publishing.

Example validation:

- If publishing Review, rating is required
- If publishing Review, review caption must be 500 characters or fewer
- If publishing Post, required fields depend on post type
- If Instagram cross-posting is enabled, Instagram-specific validation should run

---

## 9. Media Upload and Editing

The composer should support multiple images and videos.

Media editing should be state-of-the-art but easy for average users.

Include:

- Image/video upload
- Reordering media
- Removing media
- Cropping
- Rotating
- Brightness
- Contrast
- Filters
- AI image enhancement
- AI auto-crop
- AI reframe
- Media preview

The editing tools should not feel too technical. Use simple labels, visual controls, and presets where possible.

---

## 10. Music Features

Music should work as background audio for image posts and image carousels.

Requirements:

- Add background music to image/image carousel posts
- Music clip duration should be 30–45 seconds
- Users can browse a music library
- Users can search music by mood/vibe
- Users can mention what kind of vibe they want
- AI recommends several music options based on:
  - image
  - caption
  - food type
  - selected vibe
- Users can choose the music start point
- Users can trim the selected section
- Users can upload their own music
- Users can choose duration and clip section

Recommended music vibe examples:

- Chill
- Romantic
- Energetic
- Trendy
- Cosy
- Luxury
- Cafe
- Street food
- Late-night supper
- Celebration

---

## 11. AI Features

The composer should integrate AI directly into the workflow without overwhelming users.

Required AI features:

- AI hashtag generator
- AI food recognition from image
- AI recommended food tags
- AI recommended taste tags
- AI best posting time
- AI image enhancement
- AI auto-crop / reframe
- AI music selector based on image, caption, and vibe
- AI caption suggestions
- AI engagement optimization suggestions

Recommended UX:

- Use AI as helpful suggestions, not mandatory steps
- Show AI suggestions as chips/cards
- Allow users to accept, edit, or dismiss suggestions
- Avoid making the composer feel like a chatbot screen

---

## 12. Rating and Food Tagging

The Review tab must include a clear 5-star rating component.

Rating requirements:

- 1 to 5 stars
- Tap/drag interaction if appropriate
- Visual feedback after selection
- Required if publishing Review

Food and taste tags should allow users to describe the food.

Suggested taste tags:

- Spicy
- Sweet
- Salty
- Sour
- Bitter
- Umami
- Smoky
- Crispy
- Creamy
- Savoury
- Refreshing
- Rich
- Light
- Cheesy
- Fragrant

AI should recommend tags from uploaded media and caption.

---

## 13. Collaboration and Tagging

The composer should support co-authoring with another account.

Requirements:

- Search and tag accounts
- Add collaborators/co-authors
- Show pending/confirmed collaboration status if relevant
- Collaborators should sync between Post and Review tabs

Optional future enhancement:

- Collaboration invite flow
- Approval before co-authored post appears on the collaborator’s profile

---

## 14. Location Tagging

Users should be able to add a location to the post or review.

Location can be:

- Stall
- Restaurant
- Hawker centre
- Food court
- Mall
- General location

Recommended behavior:

- Search existing Hungry locations first
- Suggest locations based on user’s current location and uploaded content
- Allow manual search
- Display selected location clearly

---

## 15. Scheduling and Drafts

Both manual and AI-assisted scheduling should be supported.

Requirements:

- Save as draft
- Schedule manually
- AI recommends best posting time
- Publish immediately

AI scheduling should consider:

- Historical engagement if available
- User timezone
- Meal times
- Food category
- Audience behavior

Recommended meal-time suggestions:

- Breakfast window
- Lunch window
- Tea break window
- Dinner window
- Supper window

---

## 16. Instagram Cross-Posting

The app should support publishing to Hungry and optionally cross-posting to Instagram.

Requirements:

- Cross-post toggle
- Instagram preview
- Instagram-specific warnings if content is incompatible
- Caption adaptation if necessary

Important:

- Instagram cross-posting may require external API permissions and platform compliance
- The AI agent should plan this as a scalable integration rather than hardcode fake behavior

---

## 17. Business Features

For business users, the Post tab should include business-focused tools.

Required business tools:

- CTA buttons:
  - Order Now
  - Reserve
  - Visit
- Promo tags
- Sponsored label
- Campaign tracking tools

Recommended additional fields:

- Promo start/end date
- Discount label
- Campaign name
- Tracking link
- Target location/stall

---

## 18. Preview and Review

Live preview should be included.

Requirements:

- Live preview toggle ON by default
- User can disable live preview
- Preview should show how the post/review will look after publishing

Preview tabs:

- Hungry Feed Preview
- Bite Card Preview
- Instagram Preview

The preview does not need to permanently occupy the entire screen. It can be collapsible or placed in a review section to avoid clutter.

---

## 19. Production States

The composer should include all important states.

Required states:

- Empty state
- Uploading state
- Processing state
- Editing state
- AI generating state
- Music loading state
- Draft saved state
- Scheduled state
- Posting state
- Success state
- Error state
- Validation error state
- Instagram connection error state
- Media upload failed state
- Review caption over 500 character state

---

## 20. Additional Recommendations to Add

The following additions are recommended to make the prompt more production-ready.

### 20.1 Autosave Drafts

Add autosave so users do not lose progress if they leave the composer.

Recommended behavior:

- Autosave after major changes
- Show “Saved just now” or similar status
- Restore unfinished composer session when user returns

### 20.2 Content Safety and Copyright Checks

Because users can upload media and music, include safety checks.

Recommended behavior:

- Warn users if uploaded music may not be allowed
- Handle copyrighted audio restrictions
- Validate media type and file size
- Show unsupported media error states

### 20.3 Accessibility

The composer should support accessibility basics.

Requirements:

- Proper tap targets
- Clear labels
- Screen reader friendly controls
- Color contrast for status/errors
- Non-color-only validation indicators

### 20.4 Offline / Poor Network Handling

Food discovery apps are often used outdoors, so network issues should be handled.

Recommended behavior:

- Save draft locally if upload fails
- Retry uploads
- Show upload progress
- Resume interrupted uploads where possible

### 20.5 Field Validation Rules

The prompt should explicitly request validation logic.

Examples:

- Review requires rating
- Review caption max 500 characters
- Media required before publishing
- Location may be required for Review if app rules require it
- Instagram cross-post requires connected account
- Music duration must be 30–45 seconds

### 20.6 Role-Based Business Tools

Business tools should only appear when relevant.

Recommended behavior:

- Normal users see simpler options
- Business accounts see CTA, promo, sponsored, and campaign tools
- Do not clutter the average user experience

### 20.7 Component Reuse

The AI agent should inspect the existing app and reuse components where possible.

Examples:

- Existing cards
- Existing buttons
- Existing typography
- Existing colors
- Existing bottom sheets/modals
- Existing navigation patterns

---

## 21. Final Refined Prompt for AI Agent

Use the following prompt for the AI agent:

```text
Work on the V2 Post Composer page for Hungry.

Hungry is a social food-sharing mobile application similar to Instagram for users and businesses to share food-related content, reviews, and promotional posts.

The V2 Post Composer must be unique, polished, visually premium, mobile-first, and production-ready. It should match the existing Hungry design system. Inspect the existing repository locally and reuse existing colors, components, typography, cards, spacing, navigation patterns, and data models where possible.

Do not create a generic post form. Build a premium food content creation experience.

The composer should feel like a hybrid of Instagram, TikTok, Canva, and Later/Buffer:
- visually immersive and premium
- creator-friendly
- business-friendly
- AI-powered
- easy to use for average users

UX Flow:
- User taps Create Post and is brought directly into the Post Composer page.
- Do not create a separate mode-selection screen.
- At the top of the composer page, create a sticky segmented tab interface with:
  1. Post
  2. Review
- Users can switch between Post and Review anytime.
- The layout should be a vertical scrolling composer.
- Add a sticky bottom publish action bar.

Shared Fields:
The following fields should sync in real time between Post and Review:
- uploaded images/videos
- collaborators/co-authors
- tagged accounts
- location
- food tags
- taste tags

Caption Behavior:
- Add a “Use same caption” toggle.
- The toggle should be ON by default.
- If ON, the caption is shared between Post and Review.
- If OFF, the user can customize separate captions for Post and Review.
- Review caption must have a 500 character limit.
- If the shared caption exceeds 500 characters, show a validation warning on the Review tab and require trimming before publishing the Review.

Review Tab:
The Review tab is optimized for quick food review posting.

Features:
- Upload multiple images/videos
- Caption input with 500 character limit
- 5-star rating section
- Food tags
- Taste tags
- Collaborators/co-author support
- Account tagging
- Location tagging
- Quick AI hashtag suggestions
- AI recommended food tags
- AI recommended taste tags

Review content should appear in:
- Home Feed
- Bite Cards
- Review-related cards/feed

Post Tab:
The Post tab is the advanced creator/business publishing workflow.

Features:
Media Upload & Editing:
- Upload multiple images/videos
- Reorder media
- Remove media
- State-of-the-art but user-friendly editing tools
- Filters
- Crop
- Rotate
- Brightness
- Contrast
- AI image enhancement
- AI auto-crop
- AI reframe

AI Features:
- AI hashtag generator
- AI food recognition from image
- AI recommend food tags
- AI recommend taste tags
- AI best posting time
- AI caption suggestions
- AI engagement optimization suggestions
- AI music selector based on image, caption, food type, and user-selected vibe

Music:
- Add background music to image/image carousel posts
- Music clip duration should be 30–45 seconds
- Browse/search music library
- Search music by vibe/mood
- User can describe the vibe they want
- AI recommends several music options
- User can trim/select music start point
- User can upload own music
- User can choose music duration/clip section

Collaboration:
- Co-authoring with another account
- Search and tag accounts
- Show collaborator selection clearly

Location:
- Add location
- Support stall, restaurant, hawker centre, food court, mall, or general location
- Suggest locations where possible

Publishing:
- Save as draft
- Autosave draft
- Schedule post manually
- AI recommend best posting time automatically
- Publish immediately
- Cross-post to Instagram where supported

Business Features:
Only show business tools when relevant to avoid cluttering normal users.

Business tools:
- CTA buttons: Order Now, Reserve, Visit
- Promo tags
- Sponsored label
- Campaign tracking tools
- Optional campaign name / promo metadata

Preview / Review:
- Live preview toggle should be ON by default
- User can disable live preview
- Include tabbed preview interface:
  - Hungry Feed Preview
  - Bite Card Preview
  - Instagram Preview

Bottom Publish Action Bar:
Allow users to select:
- Publish Post only
- Publish Review only
- Publish both Post and Review

Validation Rules:
- Media is required before publishing.
- Review requires a 5-star rating.
- Review caption must not exceed 500 characters.
- Music duration must be 30–45 seconds if music is added.
- Instagram cross-posting requires a connected Instagram account.
- Show clear validation errors before publishing.

Production States:
Design and implement all important states:
- Empty state
- Uploading state
- Processing state
- Editing state
- AI generating state
- Music loading state
- Draft saved state
- Autosaving state
- Scheduled state
- Posting state
- Success state
- Error state
- Validation error state
- Instagram connection error state
- Media upload failed state
- Review caption over 500 characters state
- Poor network / retry state

Accessibility and Usability:
- Use clear labels and readable hierarchy.
- Ensure proper tap targets.
- Do not rely only on color for errors or status.
- Keep AI suggestions optional and dismissible.
- Avoid overwhelming normal users with business-only controls.

Deliverables:
1. Improve the V2 Post Composer UI.
2. Implement the Post and Review segmented tabs.
3. Implement shared field syncing between tabs.
4. Implement review-specific 500 character limit.
5. Implement media upload and editing flow.
6. Implement AI suggestion sections.
7. Implement music selection and trimming flow.
8. Implement collaborators, tags, location, rating, drafts, scheduling, and publishing options.
9. Implement live preview and publish destination selection.
10. Implement all major loading, error, empty, and success states.
11. Clearly document what is fully implemented now and what needs external API integration, such as Instagram cross-posting, licensed music library, or advanced AI services.

The final result should look and behave like a real polished production mobile app screen, not a wireframe.
```

---

## 22. Implementation Phases

### Phase 1 — Core Composer Foundation

- Create vertical composer layout
- Add Post / Review sticky tabs
- Add shared field state management
- Add media upload placeholder or actual picker
- Add caption fields
- Add Review 500 character validation
- Add rating component
- Add location/tags/collaborators UI
- Add bottom publish action bar

### Phase 2 — Preview and Publishing Logic

- Add Hungry feed preview
- Add Bite Card preview
- Add publish destination selector
- Add validation rules
- Add draft saving
- Add basic schedule UI

### Phase 3 — AI and Editing Tools

- Add AI caption suggestions
- Add AI hashtag suggestions
- Add AI food/taste tag suggestions
- Add AI image enhancement UI
- Add AI crop/reframe UI
- Add AI best posting time UI

### Phase 4 — Music Tools

- Add music picker
- Add vibe selector
- Add AI music recommendation UI
- Add trim/start-point selector
- Add own music upload flow

### Phase 5 — Business and External Integrations

- Add CTA buttons
- Add promo tags
- Add sponsored label
- Add campaign tracking
- Add Instagram cross-posting integration plan
- Add music licensing/external library plan

---

## 23. Key Risks / Things the AI Agent Should Call Out

The AI agent should clearly explain which parts are possible immediately and which require additional services.

Likely external dependencies:

- Instagram cross-posting API and account connection
- Licensed music library
- User-uploaded music rights handling
- AI image enhancement model/service
- AI food recognition model/service
- AI engagement prediction or best-posting-time algorithm
- Backend support for drafts, scheduling, and campaign tracking

The UI can be implemented first, but some features require backend/API integration before they are fully functional.

---

## 24. Final Notes

The most important UX principle is:

> Let users enter the composer immediately, then allow them to switch between Post and Review inside the screen.

Do not force an upfront mode choice.

The second most important principle is:

> Keep the Review tab fast and food-focused, while keeping the Post tab powerful and professional.

The third most important principle is:

> Shared fields should reduce duplicate work, but users should still be able to customize Post and Review separately.
