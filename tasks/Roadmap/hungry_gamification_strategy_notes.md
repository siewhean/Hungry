# Hungry Gamification Strategy Notes

## 1. Purpose of This Document

This document summarises the gamification strategy discussion for **Hungry**, a food discovery and social media app focused on Singapore food discovery.

It is intended to be used as context for Claude or another AI coding/product assistant when planning, designing, or implementing Hungry's gamification system.

The key strategic correction is that Hungry should **not** be treated like a food delivery or ordering app. Hungry is a **food discovery + social media platform**, so gamification should focus on:

- Food discovery
- User retention
- App visit frequency
- User-generated content
- Saves and collections
- Reviews and recommendations
- Social sharing
- Community contribution
- Singapore-local food exploration

Hungry should avoid gamification that depends on food orders, checkout, AOV, vouchers, delivery, basket-building, or merchant-funded discounts unless those features are added in the future.

---

## 2. Current Understanding of Hungry

### 2.1 Product Type

Hungry is a **food discovery and social media app**, not a food ordering or delivery app.

The app helps users discover food stalls, restaurants, hawker food, cuisines, hero dishes, and social food content.

### 2.2 Current Development Stage

Hungry is still in development.

Current status:

- Frontend is mostly developed.
- Backend is still in development.
- There are currently no users.
- There is no CRM system yet.
- There is no wallet, points, coupon, credit, subscription, or loyalty system yet.
- There are no current promotions, referrals, vouchers, or merchant-funded campaigns.

### 2.3 Primary Business Objectives for the Next Two Quarters

The main goals are:

1. **Retention**
2. **Frequency**
3. **Growth of the user base**

Because there are no users yet, Hungry does not have baseline metrics such as:

- 30-day repeat rate
- Average monthly sessions per active user
- Average posts per user
- Average saves per user
- Average reviews per user
- User invite rate

These should be measured after launch.

### 2.4 Important Product Constraints

Hungry should not depend on monetary rewards at launch.

The baseline requirement is:

> Be generous in perceived value, but do not spend money.

This means launch gamification should use **internal, non-monetary rewards**, such as:

- Profile achievements
- Titles
- Badges
- Recognition
- Featured contributor status
- Food discovery progress
- Collection completion
- Profile customisation
- Early access to features
- Public credibility indicators

### 2.5 Target User Segments

The most important user segments are:

1. Students
2. Office workers
3. Families

Possible minors may use the app, so the gamification system should avoid manipulative or gambling-like mechanics.

### 2.6 Brand Tone

Hungry should feel **professional**, not childish.

Important brand constraints:

- No mascots.
- Avoid cartoonish gamification.
- Avoid overly playful game-world language.
- Use clean, modern, professional UI language.
- Gamification should feel like a food discovery system, not a game for children.

### 2.7 Existing Catalogue Metadata

Hungry already has or plans to support rich food metadata, including:

- Local cuisines in Singapore
- Western food
- Japanese food
- Korean food
- Chinese food
- Malay food
- Indian food
- Other cuisine varieties
- Dietary tags
- Wait time
- Hero dishes

This metadata is highly valuable for gamification because it allows Hungry to create discovery-based missions, collections, user taste profiles, and food exploration progress.

---

## 3. Strategic Principle

The core strategy is:

> Hungry should use discovery-first, social, professional, local, and contribution-driven gamification.

Hungry should **not** use:

- Order-first gamification
- Delivery-style points
- Cashback systems
- Discount-heavy loyalty
- Childish mascots
- Gambling-like rewards
- Public global leaderboards
- Hard streak pressure
- Paid random rewards

The goal is to make Hungry feel like a **structured food discovery companion for Singapore**, not a delivery loyalty programme.

---

## 4. Main Recommended Gamification System

The strongest recommended system is:

# Hungry Passport + Food Cred + Collections + Weekly Missions

These four systems work together to support retention, frequency, and growth without requiring monetary rewards.

---

## 5. Hungry Passport

### 5.1 Concept

**Hungry Passport** is the core gamification layer.

Users collect food discovery progress by exploring cuisines, neighbourhoods, food types, dietary categories, and social food experiences.

This should feel like a professional food exploration record, not a childish badge book.

### 5.2 Core User Actions That Can Progress the Passport

Users can progress their Hungry Passport by:

- Saving a stall
- Marking a stall as tried
- Posting about a dish
- Uploading a food photo
- Reviewing a stall or dish
- Adding a stall to a collection
- Contributing missing metadata
- Receiving helpful votes on posts or reviews
- Exploring new cuisines
- Exploring new neighbourhoods

### 5.3 Passport Categories

Possible Hungry Passport categories:

#### Cuisine Passport

Examples:

- Japanese Explorer
- Korean Explorer
- Western Food Explorer
- Chinese Food Explorer
- Malay Food Explorer
- Indian Food Explorer
- Thai Food Explorer
- Dessert Explorer
- Cafe Explorer
- Hawker Food Explorer

#### Singapore Classics Passport

Examples:

- Chicken rice
- Laksa
- Char kway teow
- Nasi lemak
- Hokkien mee
- Satay
- Bak kut teh
- Roti prata
- Kaya toast
- Carrot cake

#### Neighbourhood Passport

Examples:

- Tampines Food Explorer
- Jurong Hidden Gems
- Bugis Food Trail
- Chinatown Classics
- Serangoon Supper Route
- Orchard Food Finds
- CBD Lunch Explorer
- Tiong Bahru Cafe Trail
- Bedok Hawker Trail
- Punggol Family Eats

#### User Segment Passport

Examples:

- Student Budget Eats
- Office Lunch Pro
- Family Weekend Food
- Cafe Study Spots
- Quick Lunch Finder
- Group Meal Planner

#### Dietary Passport

Examples:

- Halal Food Explorer
- Vegetarian Explorer
- Healthy Eats Explorer
- Low-Spice Friendly Finds
- High-Protein Meals
- Budget-Friendly Meals

### 5.4 Why Hungry Passport Is Useful

Hungry Passport is useful because it gives users a reason to return even when they are not immediately deciding what to eat.

It supports:

- Retention
- Repeat visits
- Discovery breadth
- Profile identity
- Social sharing
- User-generated content
- Singapore-local differentiation

Hungry Passport also makes Hungry more defensible against generic platforms such as Google Maps, Instagram, TikTok, and food blogs because it creates structured food discovery rather than passive scrolling.

### 5.5 MVP Version

A simple MVP version of Hungry Passport can include:

- Cuisine progress
- Neighbourhood progress
- Food type progress
- Dietary category progress
- Basic profile display
- Simple achievement cards
- Progress percentages
- Recently earned stamps

Example:

```text
Hungry Passport

Cuisine Explorer
Japanese: 3 / 10
Korean: 2 / 10
Western: 5 / 10
Hawker Food: 8 / 15

Neighbourhood Explorer
Tampines: 4 / 10
Bugis: 2 / 10
CBD: 6 / 10
```

---

## 6. Food Cred

### 6.1 Concept

**Food Cred** is Hungry's contribution score.

It rewards users for improving the app's food discovery ecosystem.

Food Cred should not be positioned as money, credits, or redeemable points. It should be a credibility and contribution indicator.

### 6.2 Actions That Earn Food Cred

Users can earn Food Cred for:

- Posting food photos
- Writing reviews
- Saving stalls
- Creating useful collections
- Adding dietary tags
- Adding or correcting stall information
- Reporting incorrect opening hours
- Sharing wait time information
- Tagging hero dishes
- Receiving helpful votes
- Creating high-quality posts
- Helping other users decide what to eat

### 6.3 Why Food Cred Is Useful

Food Cred helps Hungry solve one of the hardest problems in food discovery: **data quality and trust**.

Hungry will need accurate and useful information on:

- Stall names
- Menus
- Opening hours
- Locations
- Wait times
- Hero dishes
- Dietary suitability
- Food quality
- Recent user sentiment

Instead of paying users to contribute, Hungry can motivate helpful contribution through identity and recognition.

### 6.4 Food Cred Should Reward Quality, Not Quantity Alone

Food Cred should not simply reward spammy activity.

For example, a user should not get high Food Cred just by posting many low-quality photos.

Food Cred should consider:

- Helpfulness votes
- Saves generated by a user's post
- Accuracy of submitted edits
- Completeness of reviews
- Variety of places covered
- Community trust signals
- Spam reports
- Duplicate content detection

### 6.5 Suggested Food Cred Levels

Possible levels:

1. New Explorer
2. Food Contributor
3. Trusted Reviewer
4. Local Guide
5. Cuisine Specialist
6. Hungry Insider

Alternative naming:

1. Explorer
2. Regular
3. Reviewer
4. Specialist
5. Curator
6. Insider

The naming should remain professional.

---

## 7. Collections

### 7.1 Concept

Collections are curated sets of stalls, dishes, or food places.

They can be created by Hungry officially, and later by users.

Collections turn open-ended browsing into goal-based food discovery.

### 7.2 Official Hungry Collections

Hungry should create official collections for launch.

Examples:

- Best Student Meals
- Office Lunch Picks
- Family Weekend Eats
- Singapore Classics
- Hidden Gems
- Halal Food Finds
- Vegetarian Food Finds
- Japanese Food Starter Pack
- Korean Food Picks
- Affordable Meals Under $6
- Best Hawker Dishes to Try
- Cafe Study Spots
- Quick Lunch Near MRT
- Date Night Food Ideas
- Supper Spots
- Dessert Trail

### 7.3 User-Created Collections

Later, users can create and share their own collections.

Examples:

- My Favourite Chicken Rice Spots
- Cheap Lunch Near School
- Places to Try With Family
- Best Cafes for Studying
- Hidden Gems in Tampines
- My Weekend Food Plan

### 7.4 Collection Completion

Users can complete collections by:

- Saving all places in a collection
- Marking some as tried
- Posting reviews for selected places
- Adding their own notes
- Inviting friends to follow the list

Completion can unlock:

- Profile badge
- Collection completion record
- Food Cred
- Public recognition
- Ability to create similar public collections

### 7.5 Why Collections Are Useful

Collections are useful because they:

- Reduce decision fatigue
- Give users reasons to return
- Support planning
- Support social sharing
- Encourage saves
- Encourage food exploration
- Give Hungry editorial control
- Make the app feel useful immediately at launch

---

## 8. Weekly Discovery Missions

### 8.1 Concept

Weekly discovery missions give users lightweight reasons to return to Hungry regularly.

These missions should be based on discovery and contribution, not orders.

### 8.2 Example Missions

General missions:

- Save 3 new food places this week.
- Post 1 food photo.
- Review 1 place you have tried.
- Try exploring a cuisine you have not saved before.
- Add 2 stalls to a collection.
- Mark 1 place as tried.
- Recommend 1 hidden gem.
- Complete one step in your Hungry Passport.

Student missions:

- Find 3 meals under $6.
- Save 2 study-friendly cafes.
- Create a lunch list near school.
- Share a budget food recommendation.

Office worker missions:

- Save 3 lunch places near the office.
- Create a quick lunch list.
- Recommend a place with short wait time.
- Share a weekday lunch review.

Family missions:

- Save 3 family-friendly food places.
- Create a weekend family dinner list.
- Review a place suitable for groups.
- Find a place with child-friendly options.

### 8.3 Rewards for Weekly Missions

Non-monetary rewards can include:

- Food Cred
- Passport progress
- Profile titles
- Collection completion marks
- Featured contributor slots
- Special profile sections
- Achievement cards

### 8.4 Why Weekly Missions Are Useful

Weekly missions create frequency without needing purchases.

They help users form a habit around:

- Browsing Hungry
- Saving places
- Posting content
- Creating collections
- Sharing recommendations
- Returning to complete progress

---

## 9. Taste Profile

### 9.1 Concept

A user's Taste Profile summarises their food preferences, contribution style, and discovery identity.

It can be shown on the user's profile page and used for personalisation.

### 9.2 Example Taste Profile Labels

Examples:

- Hawker Regular
- Japanese Food Explorer
- Korean Food Fan
- Budget Food Finder
- Family Food Planner
- Cafe Discoverer
- Dessert Hunter
- Spicy Food Specialist
- Halal Food Explorer
- Hidden Gem Hunter
- Office Lunch Pro
- Student Eats Curator

### 9.3 Why Taste Profile Is Useful

Taste Profile is useful because Hungry is a social app.

People like to express identity through taste.

A good Taste Profile can:

- Make profiles more interesting
- Encourage users to post more
- Help users discover similar people
- Improve trust in recommendations
- Support personalised content feeds
- Help Hungry recommend relevant collections

### 9.4 Privacy Consideration

Taste Profile should be transparent and editable.

Users should be able to:

- See why they received a Taste Profile label
- Hide labels from their public profile
- Remove incorrect labels
- Keep their Taste Profile private if desired

---

## 10. Trust Levels for Reviewers

### 10.1 Concept

Hungry should distinguish between casual users and trusted contributors.

Trust levels should be based on helpfulness and accuracy, not follower count alone.

### 10.2 Example Trust Levels

Possible levels:

1. New Explorer
2. Active Reviewer
3. Trusted Reviewer
4. Local Guide
5. Cuisine Specialist
6. Hungry Insider

### 10.3 Signals for Trust Levels

Signals can include:

- Helpful votes
- Saves generated
- Accuracy of corrections
- Number of unique places reviewed
- Number of unique cuisines explored
- Quality of photos
- Completeness of reviews
- Low spam report rate
- Consistency over time

### 10.4 Why Trust Levels Are Useful

Food discovery platforms struggle with trust.

Users often wonder:

- Is this recommendation genuine?
- Is this stall still open?
- Is the food actually good?
- Is this place suitable for families?
- Is this halal/vegetarian tag accurate?

Trust levels help Hungry highlight reliable contributors and improve user confidence.

---

## 11. Social Food Challenges

### 11.1 Concept

Social food challenges allow friends, classmates, colleagues, or family members to participate in lightweight food discovery activities together.

This should support organic growth without using cash referral rewards.

### 11.2 Example Challenges

Students:

- Student Budget Hunt: find 5 meals under $6.
- Campus Lunch List: create a shared list near school.
- Cafe Study Trail: save 3 study-friendly cafes.

Office workers:

- Office Lunch Club: everyone saves one lunch spot.
- CBD Quick Lunch Challenge: find meals with short wait times.
- Team Lunch List: create a shared list for the office.

Families:

- Family Weekend Picks: create a weekend food list.
- Kid-Friendly Food Hunt: save family-friendly places.
- Group Dinner Ideas: collect places suitable for larger groups.

Friends:

- Cuisine Week: each friend recommends one place from a cuisine.
- Hidden Gem Swap: share one underrated place.
- Dessert Trail: build a shared dessert collection.

### 11.3 Why Social Challenges Are Useful

Social challenges support growth because they create natural invite loops:

- Invite friends to build a shared food list.
- Compare Hungry Passport progress.
- Share collections.
- Collaborate on food discovery.
- Follow trusted friends' recommendations.

This is more suitable than a paid referral system because Hungry currently wants zero-cost growth mechanics.

---

## 12. Save-to-Plan Loops

### 12.1 Concept

Hungry should gamify planning, not just posting.

Many food decisions happen before the meal. Users may save places for later even when they are not currently hungry.

### 12.2 Example Planning Lists

Users can create:

- Places to try this week
- Lunch near office
- Weekend family food
- Date ideas
- Cheap eats
- Supper list
- Cafes to study at
- Halal places to try
- Japanese food list
- Hidden gems nearby

### 12.3 Gamified Planning Progress

Examples:

```text
You saved 4 / 5 places for your weekend food plan.
```

```text
Your office lunch list is ready: 6 places saved.
```

```text
You have 3 new Japanese places to try.
```

### 12.4 Why Save-to-Plan Is Useful

Save-to-plan loops increase retention because users build personal value inside the app.

The more lists, saves, and collections a user creates, the more reason they have to return.

---

## 13. Neighbourhood Exploration

### 13.1 Concept

Singapore is ideal for neighbourhood-based food discovery.

Hungry can let users explore and complete neighbourhood food trails.

### 13.2 Example Neighbourhood Trails

Examples:

- Tampines Food Explorer
- Jurong Hidden Gems
- Bugis Cafe Trail
- CBD Lunch Pro
- Serangoon Supper Route
- Chinatown Classics
- Tiong Bahru Cafe Finds
- Bedok Hawker Trail
- Punggol Family Eats
- Orchard Food Picks
- Kampong Glam Food Trail
- Little India Food Trail

### 13.3 Why Neighbourhood Exploration Is Useful

Neighbourhood exploration makes Hungry feel uniquely local.

It also helps distribute attention beyond already-famous places.

This can help Hungry become known as a Singapore-specific food discovery platform rather than a generic food app.

---

## 14. Internal Rewards That Cost No Money

### 14.1 Recommended Internal Rewards

Since Hungry should avoid spending money at launch, rewards should be internal.

Recommended internal rewards:

- Profile titles
- Achievement badges
- Food Cred
- Hungry Passport stamps
- Featured reviewer slots
- Featured post slots
- Featured collection slots
- Ability to create public collections
- Ability to pin more collections
- Early access to new features
- Custom profile sections
- Verified Food Explorer status
- Trusted Reviewer status
- Special profile frames
- Search/filter priority for high-quality public collections

### 14.2 Why Internal Rewards Work for Hungry

Internal rewards work because Hungry is a social/discovery app.

In social products, recognition can be valuable because it gives users:

- Identity
- Credibility
- Visibility
- Community status
- Motivation to contribute

The most valuable reward inside Hungry is not money. It is **recognition and influence**.

---

## 15. Mechanics to Avoid

### 15.1 Avoid Order-Style Points

Hungry should not use mechanics such as:

```text
Earn 100 points per order.
```

This does not fit Hungry because Hungry is not an ordering app.

### 15.2 Avoid Coupons and Vouchers at Launch

Avoid:

- Cashback
- Vouchers
- Discounts
- Merchant-funded promotions
- Platform-funded promotions
- Referral cash credits

These create operational and financial complexity.

### 15.3 Avoid Public Global Leaderboards

Public global leaderboards often reward spam, quantity, and extreme users.

They may discourage normal users.

Better alternatives:

- Friend-only ranking
- Category-specific recognition
- Weekly helpful contributors
- Neighbourhood contributors
- Collection curators

### 15.4 Avoid Hard Streaks

Avoid copy such as:

```text
Post today or lose your streak.
```

Better copy:

```text
Your food journey is waiting.
```

```text
Continue your Passport this week.
```

```text
Pick up where you left off.
```

### 15.5 Avoid Randomised Paid Rewards

Because minors may use Hungry, avoid anything resembling gambling, loot boxes, or paid random rewards.

Free surprise badges are acceptable.

Paid random rewards are not recommended.

### 15.6 Avoid Mascots

No mascots should be used.

Hungry should feel professional.

---

## 16. Recommended Product Roadmap

## Phase 1: Launch MVP Gamification

Build these first:

1. Hungry Passport v1
2. Food Cred v1
3. Official Hungry Collections
4. Weekly Discovery Missions
5. Profile achievements
6. Helpful review voting
7. Basic analytics events

### Phase 1 Goal

Create a complete retention and contribution loop without requiring payments, vouchers, or CRM.

### Phase 1 Example User Loop

```text
User opens Hungry
→ sees weekly mission
→ saves a stall
→ adds it to a collection
→ posts a review/photo
→ earns Food Cred
→ progresses Hungry Passport
→ profile shows achievement
→ user returns to continue progress
```

---

## Phase 2: Social Growth Layer

Add:

1. Friend activity feed
2. Shared food lists
3. Group challenges
4. Followable user collections
5. User-created food trails
6. Trusted Reviewer levels
7. Invite-to-collaborate mechanics

### Phase 2 Goal

Use social discovery to grow the user base organically.

---

## Phase 3: Local Discovery Layer

Add:

1. Neighbourhood trails
2. Cuisine mastery
3. Hidden gem challenges
4. Seasonal food collections
5. Featured community curators
6. Merchant/stall contribution tools
7. More advanced personalisation

### Phase 3 Goal

Make Hungry feel uniquely Singaporean and more defensible as a food discovery platform.

---

## 17. Top 10 Recommendations

| Rank | Recommendation | Why It Matters |
|---:|---|---|
| 1 | Hungry Passport | Best core gamification system for food discovery |
| 2 | Food Cred | Encourages users to improve Hungry's content and database |
| 3 | Collections | Makes food discovery structured and repeatable |
| 4 | Weekly Missions | Creates return frequency without requiring purchases |
| 5 | Taste Profile | Builds social identity and personalisation |
| 6 | Trusted Reviewer Levels | Improves content quality and trust |
| 7 | Shared Food Lists | Supports students, office workers, and families |
| 8 | Neighbourhood Trails | Makes Hungry feel local to Singapore |
| 9 | Helpful Review Voting | Rewards quality over spam |
| 10 | Non-Monetary Rewards | Keeps cost low while still motivating users |

---

## 18. Recommended Launch Version

For the first public launch, Hungry should ship the following:

### 18.1 Hungry Passport v1

Users collect progress across:

- Cuisine
- Neighbourhood
- Food type
- Dietary category
- Budget category
- Hawker/cafe/restaurant type

### 18.2 Food Cred v1

Users earn Food Cred for:

- Posting
- Reviewing
- Saving
- Adding tags
- Correcting stall info
- Receiving helpful votes

### 18.3 Collections v1

Hungry-created collections:

- Best Student Meals
- Office Lunch Picks
- Family Weekend Eats
- Singapore Classics
- Hidden Gems
- Halal Food Finds
- Vegetarian Food Finds
- Japanese Food Starter Pack
- Affordable Meals Under $6

### 18.4 Profile v1

User profiles should show:

- Hungry Passport progress
- Food Cred
- Top cuisine interests
- Badges/titles
- Saved collections
- User posts
- Helpful reviews

---

## 19. Suggested Analytics Events

Hungry should instrument gamification from the start.

Suggested analytics events:

| Event Name | When It Fires | Useful Properties |
|---|---|---|
| `passport_viewed` | User opens Hungry Passport | user_id, source_surface |
| `passport_stamp_earned` | User earns a stamp | stamp_id, category, trigger_action |
| `passport_category_progressed` | Progress changes | category_id, old_progress, new_progress |
| `food_cred_earned` | User earns Food Cred | amount, source_action, content_id |
| `food_cred_level_changed` | User levels up | old_level, new_level |
| `collection_viewed` | User views a collection | collection_id, collection_type |
| `collection_saved` | User saves a collection | collection_id, source_surface |
| `collection_completed` | User completes a collection | collection_id, completion_method |
| `weekly_mission_viewed` | User sees mission | mission_id, placement |
| `weekly_mission_started` | User starts mission | mission_id, mission_type |
| `weekly_mission_progressed` | Mission progress changes | mission_id, old_progress, new_progress |
| `weekly_mission_completed` | Mission completed | mission_id, time_to_complete |
| `review_marked_helpful` | User marks review helpful | review_id, reviewer_id |
| `stall_saved` | User saves stall | stall_id, cuisine, neighbourhood |
| `stall_marked_tried` | User marks stall as tried | stall_id, cuisine, neighbourhood |
| `user_collection_created` | User creates collection | collection_id, visibility |
| `shared_list_invite_sent` | User invites someone to list | list_id, invite_channel |
| `shared_list_joined` | Invitee joins list | list_id, inviter_id |
| `taste_profile_viewed` | User views profile taste summary | profile_user_id |
| `achievement_shared` | User shares achievement | achievement_id, share_channel |
| `notification_opt_out` | User changes notification preference | notification_category |

---

## 20. Suggested Data Models

### 20.1 Passport Category

```ts
type PassportCategory = {
  id: string;
  name: string;
  description: string;
  categoryType: 'cuisine' | 'neighbourhood' | 'dish' | 'dietary' | 'budget' | 'venue_type';
  requiredActions: PassportRequirement[];
  totalSteps: number;
  isActive: boolean;
};
```

### 20.2 Passport Progress

```ts
type UserPassportProgress = {
  userId: string;
  categoryId: string;
  progress: number;
  totalSteps: number;
  completedAt?: Date;
  lastProgressedAt: Date;
};
```

### 20.3 Food Cred Event

```ts
type FoodCredEvent = {
  id: string;
  userId: string;
  sourceAction:
    | 'post_created'
    | 'review_created'
    | 'photo_uploaded'
    | 'stall_saved'
    | 'stall_marked_tried'
    | 'helpful_vote_received'
    | 'stall_info_corrected'
    | 'tag_added'
    | 'collection_created';
  points: number;
  relatedEntityId?: string;
  createdAt: Date;
};
```

### 20.4 Collection

```ts
type FoodCollection = {
  id: string;
  title: string;
  description: string;
  createdBy: 'hungry' | 'user';
  creatorUserId?: string;
  visibility: 'public' | 'friends' | 'private';
  targetSegment?: 'students' | 'office_workers' | 'families' | 'general';
  tags: string[];
  stallIds: string[];
  createdAt: Date;
  updatedAt: Date;
};
```

### 20.5 Weekly Mission

```ts
type WeeklyMission = {
  id: string;
  title: string;
  description: string;
  targetSegment: 'students' | 'office_workers' | 'families' | 'general';
  missionType:
    | 'save_stalls'
    | 'create_post'
    | 'write_review'
    | 'create_collection'
    | 'mark_tried'
    | 'add_tag'
    | 'invite_collaborator';
  requirementCount: number;
  rewardType: 'food_cred' | 'passport_progress' | 'badge' | 'profile_title';
  rewardValue: string | number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
};
```

---

## 21. UI Surface Recommendations

### 21.1 Home Feed

Show:

- Weekly mission card
- Passport progress card
- Recommended collections
- Trending food lists
- Suggested stalls to save
- Friend/social activity if available

### 21.2 Profile Page

Show:

- Food Cred level
- Hungry Passport progress
- Taste Profile labels
- Public collections
- Reviews
- Posts
- Badges/titles
- Helpful contribution count

### 21.3 Stall Detail Page

Show:

- Save button
- Mark as tried
- Add to collection
- User reviews
- Helpful votes
- Related Passport progress
- Similar stalls for collection completion

### 21.4 Collection Page

Show:

- Collection title
- Description
- Progress
- Stalls included
- Save collection
- Mark stalls as tried
- Invite friends/collaborators
- Completion reward

### 21.5 Gamification Hub

Create a dedicated tab or profile section for:

- Hungry Passport
- Weekly missions
- Food Cred
- Achievements
- Collections in progress
- Neighbourhood progress

---

## 22. Copywriting Guidelines

### 22.1 Tone

Hungry should use professional, clean, motivating language.

Avoid childish copy.

### 22.2 Good Copy Examples

```text
Continue your Hungry Passport this week.
```

```text
You are 2 saves away from completing Japanese Explorer.
```

```text
Your review helped 12 people decide what to eat.
```

```text
You earned Food Cred for improving stall information.
```

```text
Build your Office Lunch list with your colleagues.
```

```text
You completed Singapore Classics: Chicken Rice Starter Pack.
```

### 22.3 Copy to Avoid

Avoid:

```text
Don't break your streak!
```

```text
You are falling behind everyone else!
```

```text
Spin to win!
```

```text
Open a mystery box!
```

```text
Beat everyone on the leaderboard!
```

---

## 23. Safety, Privacy, and Ethics

Because minors may use Hungry, the app should avoid:

- Paid random rewards
- Gambling-like mechanics
- Loot boxes
- Manipulative streaks
- Excessive push notifications
- Public shame mechanics
- Dark patterns
- Hidden profiling

Users should have control over:

- Public profile visibility
- Taste Profile visibility
- Notification preferences
- Social challenge invitations
- Public collection visibility
- Whether achievements are shared publicly

Gamification should motivate discovery, not pressure users.

---

## 24. Open Product Questions

These questions still need to be resolved before final implementation:

1. Should Hungry Passport be a dedicated tab or part of the profile page?
2. Should Food Cred be visible publicly or only partially visible?
3. Should users be allowed to hide badges and titles?
4. How should Hungry prevent spammy posts created only to earn Food Cred?
5. Should official Hungry collections be manually curated or generated from database tags?
6. Should Hungry allow user-created public collections at launch or later?
7. Should weekly missions be the same for everyone or personalised by segment?
8. Should minors have a restricted gamification experience?
9. Should social challenges be friend-only or public?
10. Should Hungry support school/office/family group lists?
11. Should there be a separate gamification hub in the navigation?
12. How should Hungry handle inaccurate user-submitted stall edits?
13. Should Food Cred decay if a user becomes inactive?
14. Should Hungry use friend-only leaderboards or avoid leaderboards entirely at launch?
15. What is the minimum backend scope needed to support Hungry Passport v1?

---

## 25. Implementation Priority

The recommended build order is:

### Priority 1

- Analytics events
- Save stall tracking
- Mark as tried tracking
- Basic review/helpful vote tracking
- Food Cred ledger
- Passport category model
- User passport progress model

### Priority 2

- Hungry Passport UI
- Food Cred display
- Official collections
- Collection progress
- Weekly mission engine

### Priority 3

- Taste Profile
- Trusted Reviewer levels
- User-created collections
- Shared lists
- Friend/collaborative challenges

### Priority 4

- Neighbourhood trails
- Advanced personalisation
- Featured curators
- Public collection discovery
- Moderation tooling

---

## 26. Final Strategic Recommendation

Hungry's gamification system should be built around this principle:

> Make users feel like they are building their personal map of Singapore food culture.

The best first version is:

1. Hungry Passport
2. Food Cred
3. Collections
4. Weekly Discovery Missions
5. Taste Profile
6. Trusted Reviewer levels
7. Shared food lists
8. Neighbourhood trails

This direction supports Hungry's goals of retention, frequency, and user growth while matching the current product reality:

- No users yet
- No ordering
- No wallet
- No coupons
- No CRM
- No monetary reward budget
- Professional brand tone
- Singapore food discovery focus
- Social media functionality

The goal is not to make Hungry feel like a game.

The goal is to make food discovery feel structured, rewarding, social, and worth returning to.
