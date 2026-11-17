# Hungry Checklist, Hungry Portfolio, and Hungry Passport — Product + Implementation Plan

## 1. Product context

Hungry is a Singapore-focused food discovery and social media app. It is **not** a food delivery or ordering app.

The new feature should make the app feel like a food explorer/discovery platform where users can:

- Discover dishes and stalls.
- Save foods/stalls into multiple checklists.
- Plan future food visits with reminders.
- Confirm what they have tried.
- Curate tried foods/stalls into **Hungry Portfolios**.
- Follow users and follow individual portfolios.
- Search and view portfolios from global search and user profile pages.
- Progress through **Hungry Passport** only from confirmed discovery actions.

The feature should be integrated throughout Hungry, not implemented as a standalone saved-list module.

---

## 2. Final product decisions

| Area | Decision |
|---|---|
| Checklist count | Users can create multiple checklists |
| Portfolio name | **Hungry Portfolio** |
| Custom items | Users can add dishes/stalls not yet in Hungry’s database |
| Existing items | Existing dishes/stalls deep-link to their detail pages |
| Portfolio visibility | Owner can choose private, followers-only, or public |
| Public portfolios | Allowed immediately, but global search exposure goes through lightweight moderation |
| Following | Users can follow both users and portfolios |
| Ranking | Ranking portfolios support numeric scores |
| Notes | Portfolio items support public notes and private notes |
| Reminders | Checklist items support custom reminders and notifications |
| Public ranking requirement | Item must be marked tried/visited before being added to a public ranking portfolio |
| Collaboration | Collaborative portfolios are included in MVP |
| Passport progress | Only confirmed actions count |
| Search moderation | Pending/new portfolios can appear in a separate search section |
| Portfolio item limit | No maximum number of items |
| Duplicate across portfolios | Allowed |
| Map view | Not in MVP; later iteration |
| Profile integration | Users can search and view portfolios from user profile pages |

---

## 3. Core product architecture

```text
Dish/Stall Detail
  ├── Add to Checklist
  ├── Add to Hungry Portfolio
  ├── Mark as Tried / Visited
  └── Featured in Hungry Portfolios

Search
  ├── Foods
  ├── Stalls
  ├── Users
  └── Hungry Portfolios
       ├── Approved public portfolios
       ├── New Community Portfolios
       └── Accessible followers-only portfolios

Profile
  ├── Posts
  ├── Hungry Portfolios
  ├── Search within this user's portfolios
  ├── Reviews
  ├── Passport highlights
  └── Checklists, owner-only

Checklist
  ├── Multiple checklists
  ├── Existing dishes/stalls
  ├── Custom dishes/stalls
  ├── Planned dates
  ├── Reminders
  ├── Mark tried/visited
  └── Add to Hungry Portfolio

Hungry Portfolio
  ├── Private / followers-only / public
  ├── Recommendation / ranking / trail / collection
  ├── Numeric scores
  ├── Public notes
  ├── Private notes
  ├── Collaborators
  ├── Follow portfolio
  └── Add items to checklist

Hungry Passport
  ├── Confirmed tried foods
  ├── Confirmed visited stalls
  ├── Reviews/photos
  ├── Tried items added to portfolios
  └── Trails/badges
```

---

## 4. Product principles

### 4.1 Checklist = private intent

Checklist represents future intent. Adding to checklist should be fast and low-pressure.

Checklist actions should **not** count toward Passport progress.

### 4.2 Portfolio = social food identity

Hungry Portfolio represents taste, recommendation, ranking, curation, and social contribution.

A portfolio can be private, but public/followers-only portfolios become part of the user’s public food identity.

### 4.3 Passport = confirmed exploration

Hungry Passport should only progress when there is a confirmed action.

Confirmed examples:

- Dish marked tried
- Stall marked visited
- Review posted
- Photo posted after trying
- Tried item added to Hungry Portfolio
- Public portfolio published with tried items
- Discovery trail completed

Non-confirmed examples:

- Add to checklist
- Follow portfolio
- Follow user
- View dish/stall
- Create empty portfolio
- Save untried item

### 4.4 Custom items should be first-class

Users can add a dish/stall not yet in the database.

Custom items should be usable in checklists and portfolios, but clearly labelled:

```text
Custom item · Not yet in Hungry
```

If matched to an existing Hungry item later, the user should be able to link it.

### 4.5 Integrated everywhere

The feature should appear in:

- Dish detail page
- Stall detail page
- Search results
- Feed
- User profile
- Portfolio detail page
- Checklist screen
- Passport screen
- Post/review composer
- Notifications/reminders

---

## 5. Main user flows

## 5.1 Add dish/stall to checklist

Entry points:

- Dish detail page
- Stall detail page
- Feed cards
- Search result cards
- Portfolio item cards

Bottom sheet:

```text
Save to Checklist

Choose checklist:
- Default Checklist
- Weekend Food Hunt
- Chicken Rice To Try
- Create New Checklist

Optional:
- Priority
- Planned date
- Reminder
- Private note
```

Confirmation:

```text
Added to “Chicken Rice To Try”.
Mark it as tried later to progress your Hungry Passport.
```

## 5.2 Add custom dish/stall

From checklist:

```text
Add Custom Item
```

Fields:

| Field | Required | Notes |
|---|---:|---|
| Name | Yes | Dish/stall name |
| Type | Yes | Dish or stall |
| Notes | Optional | Private note |
| Location text | Optional | Text only for MVP |
| Cuisine tags | Optional | Helps search/matching |
| Dietary tags | Optional | Halal, vegetarian, etc. |
| Planned date | Optional | For reminder |
| Reminder | Optional | Push/local notification |

Click behavior:

- Existing dish/stall → opens real detail page.
- Custom item → opens custom item detail page/sheet.
- Linked custom item → opens linked real detail page.

## 5.3 Mark item as tried/visited

From checklist item:

```text
Mark as Tried
```

For dishes:

- quick rating, optional
- private note, optional
- photo/review, optional
- add to Hungry Portfolio, optional

For stalls:

- mark visited
- add dish tried, optional
- visit note, optional
- add to Hungry Portfolio, optional

This creates a Passport event.

## 5.4 Create Hungry Portfolio

Entry points:

- Profile page
- Checklist screen
- Add-to-portfolio bottom sheet
- After marking item as tried
- Search page

Fields:

| Field | Required | Example |
|---|---:|---|
| Title | Yes | Ryan’s Chicken Rice Ranking |
| Description | Optional | My favourite chicken rice spots |
| Type | Yes | Recommendation / Ranking / Trail / Collection |
| Visibility | Yes | Private / Followers-only / Public |
| Collaborators | Optional | Add users |
| Tags | Optional | Chicken Rice, Hawker, Budget |
| Cover image | Optional | Auto-generated later |

Portfolio types:

| Type | Purpose |
|---|---|
| Recommendation | General curated picks |
| Ranking | Ordered list with numeric score |
| Trail | Themed discovery path; no map in MVP |
| Collection | Broad/personal grouping |

## 5.5 Add item to Hungry Portfolio

Items can be added from:

- Checklist
- Dish detail page
- Stall detail page
- Search results
- Another portfolio
- User profile
- Post/review composer

Rule:

```text
Public ranking portfolio requires tried/visited confirmation.
```

For private or non-ranking portfolios, untried items can be added.

## 5.6 Ranking portfolio with numeric score

Suggested score scale:

```text
0.0 to 10.0, one decimal place
```

Ranking item data:

| Field | Purpose |
|---|---|
| Position | Manual order |
| Numeric score | e.g. 8.7 |
| Public note | Visible to viewers |
| Private note | Owner/collaborators only |
| Tried status | Required for public ranking |
| Last tried date | Optional |
| Source checklist item | Attribution |
| Source portfolio | Attribution if copied |

Example display:

```text
#1 Tian Tian Chicken Rice — 9.2/10
Best rice texture, strong chilli, long queue at lunch.
```

## 5.7 Follow user vs follow portfolio

Users should be able to:

```text
Follow User
Follow Portfolio
```

Following a user shows that user’s activity and accessible portfolios.

Following a portfolio tracks that specific portfolio only.

## 5.8 View/search portfolios from profile

Every user profile needs a **Hungry Portfolios** section.

Public viewer sees:

- Public portfolios
- Followers-only portfolios if viewer follows the owner
- Search within this user’s portfolios
- Sort/filter
- Follow portfolio
- Add portfolio items to checklist

Owner sees:

- Public portfolios
- Followers-only portfolios
- Private portfolios
- Drafts
- Pending review status
- Collaborator controls
- Edit visibility
- Search all own portfolios

## 5.9 Global portfolio search

Search tabs:

```text
Foods | Stalls | Users | Hungry Portfolios
```

Portfolio result sections:

1. Approved Public Portfolios
2. New Community Portfolios
3. From Users You Follow
4. Followers-only Portfolios Available to You

Portfolio result card:

| Element | Example |
|---|---|
| Title | Ryan’s Chicken Rice Ranking |
| Creator | @ryan |
| Type | Ranking |
| Visibility | Public |
| Items | 24 items |
| Followers | 312 |
| Tags | Chicken Rice, Hawker |
| Top preview | Top 3 items |
| Updated | Updated 2 days ago |
| Status | Approved / New |

## 5.10 Portfolio to checklist loop

On portfolio detail:

```text
Add to My Checklist
Add selected items
Add all to checklist
```

Store attribution:

- source_portfolio_id
- source_user_id
- source_item_id

This supports creator credit and future Food Cred.

---

## 6. Information architecture

Recommended navigation:

| Area | Role |
|---|---|
| Home | Feed, updates, social discovery |
| Explore/Search | Dishes, stalls, users, portfolios |
| Checklist | Personal planning and reminders |
| Passport | Confirmed exploration progress |
| Profile | Posts, portfolios, reviews, badges |

If bottom navigation is crowded, create a **Journey** tab:

```text
Journey
- Checklists
- Passport
- Portfolios
```

Recommendation: keep **Checklist** highly visible because it supports retention and repeat visits.

---

## 7. Data model

Assume Postgres/Supabase-style tables. Adjust to actual backend conventions.

## 7.1 `checklists`

```sql
create table checklists (
  id uuid primary key,
  owner_user_id uuid not null references users(id),
  title text not null,
  description text,
  sort_order int default 0,
  item_count int not null default 0,
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 7.2 `checklist_items`

```sql
create table checklist_items (
  id uuid primary key,
  checklist_id uuid not null references checklists(id) on delete cascade,
  owner_user_id uuid not null references users(id),

  item_type text not null,
  -- dish, stall, custom_dish, custom_stall

  dish_id uuid references dishes(id),
  stall_id uuid references stalls(id),

  custom_name text,
  custom_description text,
  custom_location_text text,
  custom_cuisine_tags text[],
  custom_dietary_tags text[],

  link_status text not null default 'database_item',
  -- database_item, custom_unlinked, custom_suggested_match, custom_linked

  linked_dish_id uuid references dishes(id),
  linked_stall_id uuid references stalls(id),

  status text not null default 'want_to_try',
  -- want_to_try, planned, tried, reviewed, added_to_portfolio, archived

  priority text default 'medium',
  private_note text,
  planned_date date,

  reminder_enabled boolean not null default false,
  reminder_at timestamptz,
  reminder_timezone text,
  reminder_repeat_rule text,
  notification_status text default 'not_scheduled',

  source_type text,
  source_portfolio_id uuid references portfolios(id),
  source_user_id uuid references users(id),

  tried_at timestamptz,
  reviewed_at timestamptz,
  added_to_portfolio_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes:

```sql
create index idx_checklist_items_owner on checklist_items(owner_user_id);
create index idx_checklist_items_checklist on checklist_items(checklist_id);
create index idx_checklist_items_dish on checklist_items(dish_id);
create index idx_checklist_items_stall on checklist_items(stall_id);
create index idx_checklist_items_reminder_at on checklist_items(reminder_at)
where reminder_enabled = true;
```

Duplicate rule:

- Allow same dish/stall across different checklists.
- Warn on duplicate inside same checklist.
- Allow override if user intentionally wants duplicate.

## 7.3 `portfolios`

```sql
create table portfolios (
  id uuid primary key,
  owner_user_id uuid not null references users(id),

  title text not null,
  slug text not null unique,
  description text,

  portfolio_type text not null,
  -- recommendation, ranking, trail, collection

  visibility text not null default 'private',
  -- private, followers_only, public

  permission_mode text not null default 'owner_only',
  -- owner_only, collaborators_can_add, collaborators_can_edit

  cover_image_url text,
  cuisine_tags text[],
  dietary_tags text[],
  location_tags text[],
  custom_tags text[],

  item_count int not null default 0,
  follower_count int not null default 0,
  save_count int not null default 0,
  view_count int not null default 0,

  moderation_status text not null default 'not_required',
  -- not_required, pending_review, approved, limited, rejected

  searchable_section text,
  -- main_results, new_community, hidden

  is_searchable boolean not null default false,
  published_at timestamptz,
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Search behavior:

| Visibility | Moderation | Search behavior |
|---|---|---|
| public | approved | Main search results |
| public | pending_review | New Community Portfolios |
| public | limited | Lower-ranked/restricted section |
| public | rejected | Hidden from search |
| followers_only | approved | Searchable only to followers |
| private | any | Not searchable |

## 7.4 `portfolio_items`

```sql
create table portfolio_items (
  id uuid primary key,
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  added_by_user_id uuid not null references users(id),

  item_type text not null,
  -- dish, stall, custom_dish, custom_stall

  dish_id uuid references dishes(id),
  stall_id uuid references stalls(id),

  custom_name text,
  custom_description text,
  custom_location_text text,
  custom_cuisine_tags text[],
  custom_dietary_tags text[],

  link_status text not null default 'database_item',
  linked_dish_id uuid references dishes(id),
  linked_stall_id uuid references stalls(id),

  position int,
  numeric_score numeric(3,1),
  score_scale_min numeric(3,1) default 0.0,
  score_scale_max numeric(3,1) default 10.0,
  rank_label text,

  public_note text,
  private_note text,

  tried_required boolean not null default false,
  tried_confirmed boolean not null default false,
  tried_at timestamptz,

  source_checklist_item_id uuid references checklist_items(id),
  source_portfolio_id uuid references portfolios(id),
  source_user_id uuid references users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 7.5 `portfolio_collaborators`

```sql
create table portfolio_collaborators (
  id uuid primary key,
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  user_id uuid not null references users(id),

  role text not null default 'contributor',
  -- owner, editor, contributor, viewer

  can_add_items boolean not null default true,
  can_edit_items boolean not null default false,
  can_edit_scores boolean not null default false,
  can_manage_visibility boolean not null default false,

  invited_by_user_id uuid references users(id),
  invitation_status text not null default 'pending',
  -- pending, accepted, declined, removed

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(portfolio_id, user_id)
);
```

## 7.6 `portfolio_follows`

```sql
create table portfolio_follows (
  id uuid primary key,
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  user_id uuid not null references users(id),
  notification_enabled boolean not null default false,
  created_at timestamptz not null default now(),

  unique(portfolio_id, user_id)
);
```

## 7.7 `user_follows`

If not already implemented:

```sql
create table user_follows (
  id uuid primary key,
  follower_user_id uuid not null references users(id),
  following_user_id uuid not null references users(id),
  created_at timestamptz not null default now(),

  unique(follower_user_id, following_user_id)
);
```

## 7.8 `passport_events`

```sql
create table passport_events (
  id uuid primary key,
  user_id uuid not null references users(id),

  event_type text not null,
  -- dish_tried, stall_visited, review_posted, photo_posted,
  -- tried_item_added_to_portfolio, public_portfolio_created,
  -- ranking_portfolio_published, trail_completed

  item_type text,
  dish_id uuid references dishes(id),
  stall_id uuid references stalls(id),
  portfolio_id uuid references portfolios(id),
  checklist_item_id uuid references checklist_items(id),
  portfolio_item_id uuid references portfolio_items(id),

  metadata jsonb,
  created_at timestamptz not null default now()
);
```

## 7.9 `passport_progress`

```sql
create table passport_progress (
  id uuid primary key,
  user_id uuid not null references users(id),

  passport_category text not null,
  progress_count int not null default 0,
  target_count int not null,

  level text not null default 'starter',
  -- starter, progress, complete, expert

  completed_at timestamptz,
  last_event_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(user_id, passport_category)
);
```

## 7.10 `reminders`

MVP can store reminder fields on checklist_items. Better long-term model:

```sql
create table reminders (
  id uuid primary key,
  user_id uuid not null references users(id),
  checklist_item_id uuid references checklist_items(id) on delete cascade,

  reminder_type text not null,
  -- one_time, recurring

  scheduled_at timestamptz not null,
  timezone text not null,
  repeat_rule text,

  channel text not null default 'push',
  status text not null default 'scheduled',
  -- scheduled, sent, snoozed, cancelled, failed

  title text not null,
  body text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

## 8. Backend API plan

## 8.1 Checklist APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/checklists` | Create checklist |
| GET | `/checklists` | Get current user's checklists |
| GET | `/checklists/:id` | Get checklist detail |
| PATCH | `/checklists/:id` | Rename/edit checklist |
| DELETE | `/checklists/:id` | Delete/archive checklist |
| POST | `/checklists/:id/items` | Add dish/stall/custom item |
| PATCH | `/checklist-items/:id` | Update status/note/reminder |
| DELETE | `/checklist-items/:id` | Remove item |
| POST | `/checklist-items/:id/mark-tried` | Confirm tried/visited |
| POST | `/checklist-items/:id/add-to-portfolio` | Add item to portfolio |
| POST | `/checklist-items/:id/link-existing-item` | Link custom item to database item |

## 8.2 Portfolio APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/portfolios` | Create portfolio |
| GET | `/portfolios/:id` | View portfolio |
| PATCH | `/portfolios/:id` | Edit portfolio |
| DELETE | `/portfolios/:id` | Delete/archive portfolio |
| GET | `/users/:userId/portfolios` | View/search profile portfolios |
| GET | `/me/portfolios` | Owner portfolio management |
| POST | `/portfolios/:id/items` | Add item |
| PATCH | `/portfolio-items/:id` | Edit item, score, notes |
| DELETE | `/portfolio-items/:id` | Remove item |
| PATCH | `/portfolios/:id/items/reorder` | Reorder ranking |
| POST | `/portfolios/:id/follow` | Follow portfolio |
| DELETE | `/portfolios/:id/follow` | Unfollow portfolio |
| POST | `/portfolios/:id/collaborators` | Invite collaborator |
| PATCH | `/portfolio-collaborators/:id` | Update collaborator role/status |
| DELETE | `/portfolio-collaborators/:id` | Remove collaborator |

## 8.3 Search APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/search?q=` | Global search |
| GET | `/search/portfolios?q=` | Search portfolios |
| GET | `/dishes/:id/portfolios` | Portfolios containing dish |
| GET | `/stalls/:id/portfolios` | Portfolios containing stall |
| GET | `/users/:userId/portfolios/search?q=` | Search within profile portfolios |

## 8.4 Passport APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/passport` | Passport overview |
| GET | `/passport/progress` | Progress categories |
| POST | `/passport/recalculate` | Admin/debug only |

Passport events should be created server-side, not trusted directly from client input.

## 8.5 Notification APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/reminders` | Create reminder |
| PATCH | `/reminders/:id` | Update/snooze/cancel reminder |
| GET | `/reminders` | Get reminders |
| POST | `/notifications/register-device` | Register push token |
| PATCH | `/notification-settings` | Update preferences |

---

## 9. Frontend screens and components

## 9.1 New screens

| Screen | Purpose |
|---|---|
| `ChecklistListScreen` | All checklists |
| `ChecklistDetailScreen` | Items in one checklist |
| `CreateEditChecklistScreen` | Create/rename checklist |
| `CreateCustomChecklistItemScreen` | Add custom dish/stall |
| `PortfolioListScreen` | User's own portfolios |
| `PortfolioDetailScreen` | View portfolio |
| `CreateEditPortfolioScreen` | Create/edit portfolio |
| `PortfolioItemEditorSheet` | Score/notes/tried state |
| `PortfolioCollaboratorsScreen` | Manage collaborators |
| `PortfolioSearchResultsScreen` | Global portfolio search |
| `UserProfilePortfoliosTab` | Profile portfolio search/view |
| `PassportScreen` | Confirmed discovery progress |
| `ReminderEditorSheet` | Reminder settings |

## 9.2 Reusable components

| Component | Purpose |
|---|---|
| `AddToChecklistButton` | Dish/stall/feed/search action |
| `AddToChecklistSheet` | Checklist picker |
| `ChecklistCard` | Checklist preview |
| `ChecklistItemCard` | Item card |
| `ChecklistStatusPill` | Want to Try / Planned / Tried |
| `AddToPortfolioButton` | Add item to portfolio |
| `AddToPortfolioSheet` | Portfolio picker |
| `PortfolioCard` | Search/profile/feed preview |
| `PortfolioItemCard` | Item in portfolio |
| `PortfolioVisibilityPill` | Private/followers/public |
| `PortfolioModerationBadge` | Pending/approved/limited |
| `PortfolioScoreBadge` | Numeric score |
| `CollaboratorAvatarStack` | Collaboration UI |
| `FollowPortfolioButton` | Follow/unfollow |
| `FollowUserButton` | Follow/unfollow |
| `CustomItemBadge` | Custom/unlinked item |
| `PassportProgressCard` | Passport trail progress |
| `ReminderPicker` | Date/time/repeat picker |

---

## 10. MVP scope

## 10.1 Must-have

1. Multiple checklists
2. Add existing dish/stall to checklist from detail pages
3. Add custom dish/stall to checklist
4. Checklist detail screen
5. Planned dates and reminders
6. Create Hungry Portfolio
7. Portfolio visibility: private, followers-only, public
8. Add tried checklist item to portfolio
9. Add item from dish/stall detail to portfolio
10. Ranking portfolio with numeric score
11. Public and private notes on portfolio item
12. Collaborative portfolios with basic roles
13. Follow users
14. Follow portfolios
15. Portfolio search
16. Profile portfolio tab and search
17. Lightweight moderation status
18. Passport events from confirmed tried/visited/reviewed actions
19. No map view

## 10.2 Should-have

1. Add selected items from portfolio to checklist
2. Add all portfolio items to checklist
3. Portfolio item attribution
4. Featured in portfolios on dish/stall pages
5. Push notification reminders
6. Basic portfolio feed cards
7. Duplicate warning within same checklist
8. Basic custom item matching suggestions

## 10.3 Later

1. Map view
2. Location-aware suggestions
3. Route planner
4. Advanced moderation queue
5. Portfolio comments
6. Portfolio reactions
7. Creator analytics
8. AI-assisted portfolio descriptions
9. Auto-generated portfolio covers
10. Collaborative checklist sharing
11. Nearby reminders
12. Editorial featured portfolios

---

## 11. Moderation and permissions

## 11.1 Visibility

| Visibility | Who can view |
|---|---|
| private | Owner + allowed collaborators |
| followers_only | Owner + followers + collaborators |
| public | Everyone |

## 11.2 Lightweight moderation

When a public portfolio is published:

```text
moderation_status = pending_review
searchable_section = new_community
```

After checks:

```text
approved -> main search
limited -> lower visibility/restricted section
rejected -> hidden from search
```

Checks:

- Profanity
- Spam links
- Repeated duplicate text
- Harassment
- Unsafe content
- NSFW images
- Mass creation spam
- Impersonation
- Personal information exposure

Owner-facing copy:

```text
Your portfolio is live on your profile.
It will appear in main search after a quick review.
```

---

## 12. Privacy and notification rules

Because minors may use Hungry:

1. Checklists should be private by default.
2. Planned dates/reminders should never be public.
3. Public sharing should require clear user action.
4. Followers-only should be available.
5. Do not expose “I am going now” live plans.
6. Avoid public location-sharing.
7. Portfolio update notifications should be opt-in.
8. Reminder notifications should be explicit and customisable.
9. Avoid aggressive streak-style reminders.

---

## 13. Hungry Passport integration

## 13.1 Confirmed actions

| Action | Counts? |
|---|---:|
| Add to checklist | No |
| Add custom item | No |
| Mark dish as tried | Yes |
| Mark stall as visited | Yes |
| Post review | Yes |
| Upload food photo after tried | Yes |
| Add tried item to portfolio | Yes |
| Publish portfolio with tried items | Yes |
| Follow portfolio | No |
| Add item from portfolio to checklist | No |

## 13.2 Trails

| Trail | Source |
|---|---|
| Chicken Rice Trail | Tried chicken rice dishes |
| Hawker Hunter | Visited hawker stalls |
| Cuisine Explorer | Tried dishes across cuisines |
| Neighbourhood Explorer | Visited stalls across areas |
| Checklist Finisher | Planned items marked tried |
| Portfolio Curator | Published portfolios with tried items |
| Trusted Reviewer | Reviews marked helpful |
| Hidden Gem Finder | Tried/reviewed low-visibility stalls |

## 13.3 Badge mapping

Use v8 badge assets:

| State | Ribbon |
|---|---|
| Started | Red |
| In progress | Blue |
| Completed | Green |
| Expert | Expert ribbon |

---

## 14. Analytics

## Checklist events

| Event | Properties |
|---|---|
| `checklist_created` | source |
| `checklist_item_added` | item_type, source, is_custom |
| `checklist_item_marked_tried` | item_type, cuisine, location |
| `checklist_item_reminder_set` | reminder_type |
| `custom_item_created` | item_type |
| `custom_item_linked_to_database_item` | item_type |

## Portfolio events

| Event | Properties |
|---|---|
| `portfolio_created` | type, visibility |
| `portfolio_published` | visibility, item_count |
| `portfolio_visibility_changed` | old_visibility, new_visibility |
| `portfolio_item_added` | item_type, is_custom |
| `portfolio_item_scored` | score |
| `portfolio_item_reordered` | portfolio_type |
| `portfolio_followed` | source |
| `portfolio_collaborator_invited` | role |
| `portfolio_reported` | reason |
| `portfolio_search_result_clicked` | query, section |

## Passport events

| Event | Properties |
|---|---|
| `passport_event_created` | event_type |
| `passport_progress_updated` | category, progress |
| `passport_badge_unlocked` | badge_type, level |
| `passport_trail_completed` | trail_type |

## Success metrics

| Goal | Metric |
|---|---|
| Retention | % users with 2+ checklists |
| Planning | Avg checklist items per active user |
| Conversion | % checklist items marked tried |
| Social discovery | Portfolio follows per user |
| Content quality | Save-to-checklist rate from portfolios |
| Creator activity | Public portfolios created weekly |
| Profile value | Profile portfolio tab views |
| Passport value | Confirmed actions per user |
| Notification value | Reminder open rate |
| Search value | Portfolio search CTR |

---

## 15. Edge cases

| Edge case | Handling |
|---|---|
| Duplicate in same checklist | Warn, allow override |
| Duplicate across portfolios | Allow |
| Custom item later matches database | Offer link/convert |
| Public ranking item not tried | Block until marked tried |
| Collaborator adds bad item | Owner can remove and revoke |
| Portfolio becomes followers-only | Remove from public search |
| Owner deletes portfolio | Keep copied checklist items, remove source link if needed |
| User unfollows owner | Lose access to followers-only portfolios |
| Custom item in public portfolio | Label as custom/unverified |

---

## 16. Implementation sequence

### Sprint 1: Data foundation

- Checklists
- Checklist items
- Custom items
- Add-to-checklist API
- Multiple checklist support
- Add from dish/stall detail pages

### Sprint 2: Checklist UI

- Checklist list
- Checklist detail
- Add custom item
- Status changes
- Planned date/reminder UI
- Mark tried/visited

### Sprint 3: Hungry Portfolio foundation

- Portfolio tables
- Portfolio item tables
- Portfolio detail screen
- Create/edit portfolio
- Add items
- Numeric scores
- Visibility

### Sprint 4: Profile and search

- Profile Hungry Portfolios tab
- Search within user portfolios
- Global portfolio search
- Moderation sections
- Portfolio cards

### Sprint 5: Social and collaboration

- Follow users
- Follow portfolios
- Collaborators
- Roles/permissions
- Add portfolio items to checklist
- Attribution

### Sprint 6: Passport

- Passport events
- Progress calculation
- Confirmed-action-only logic
- Badges/trails

### Sprint 7: Notifications

- Reminder model
- Push notification permissions
- Reminder scheduler
- Snooze/cancel
- Notification settings

---

## 17. Product copy

### Add to Checklist

```text
Save this for your next food hunt.
```

### Custom item

```text
This item is not in Hungry yet.
You can still save it and link it later.
```

### Public ranking requirement

```text
Rankings should be based on what you have tried.
Mark this as tried before adding it to a public ranking.
```

### Portfolio visibility

```text
Public: Anyone can view this portfolio.
Followers-only: Only your followers can view this portfolio.
Private: Only you and selected collaborators can view this portfolio.
```

### Moderation

```text
Your portfolio is live on your profile.
It will appear in main search after a quick review.
```

### Passport progress

```text
Confirmed: You tried a new chicken rice spot.
Chicken Rice Trail: 3 / 5 completed.
```

---

## 18. Open decisions to confirm later

1. Numeric score scale: 0–10, 1–5, or portfolio-specific?
2. Should reminders support recurring rules in MVP or only one-time reminders?
3. Should custom items inside public portfolios be globally searchable?
4. Can collaborators add private notes, or only public notes?
5. Should portfolio update notifications be opt-in only?
6. Should followers-only portfolios show locked previews to non-followers?
7. Should checklist sharing be a later feature?
8. Should moderation have an admin dashboard in MVP?
9. Should “tried” require a review/photo, or is manual confirmation enough?
10. Should users import directly from one portfolio into another, or must they add to checklist first?

---

## 19. Claude/Codex implementation instruction

When building this, Claude/Codex should:

1. Inspect the existing codebase before making changes.
2. Reuse existing dish, stall, user, profile, follow, review, notification, and search models where available.
3. Avoid a standalone silo; integrate across detail pages, profile, search, feed, checklist, portfolio, and Passport.
4. Enforce visibility and collaborator permissions server-side.
5. Keep planned dates/reminders private.
6. Ensure public ranking requires tried confirmation.
7. Ensure Passport progress only uses confirmed server-side events.
8. Add analytics events from day one.
9. Keep the MVP free of map view.
10. Keep the app professional: no vouchers, no delivery/order assumptions, no aggressive streaks.
