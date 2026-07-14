# App Store Submission QC Report

Updated: 2026-06-21
Market: Singapore
Status: **No-Go**

## ASO Draft

| Field | Draft |
|---|---|
| App name | Hungry |
| App name option | Hungry: Singapore Food |
| Subtitle | Nearby hawker dishes |
| Promotional text | Find nearby dishes, compare stalls, save favourites, and review Singapore food spots. |
| Keyword set draft | hawker,food near me,menus,laksa,chicken rice,makan,stalls,reviews |
| Positioning | Decide what to eat with nearby dishes, menus, stall details, photos, and community reviews. |
| Primary category draft | Food & Drink |
| Secondary category draft | Lifestyle |
| Screenshot 1 | Nearby discovery and area count |
| Screenshot 2 | Dish detail with real image, rating, price/menu context |
| Screenshot 3 | Stall detail with address, open status, unit, and signature dishes |
| Screenshot 4 | Reviews/posts with report/block/moderation proof only if UGC gates pass |
| Screenshot 5 | Profile, saved places, privacy/account controls |
| Screenshot 6 | Merchant tools only if full-platform merchant gates pass |

## App Review Notes Template

| Field | Draft / required proof |
|---|---|
| Demo access | Provide active reviewer account or approved demo mode; account must have a seeded Singapore profile and enough saved/review content to inspect core flows. |
| Backend availability | Confirm Supabase environment, storage, Edge Functions, and email callbacks are live for the full review window. |
| Core test path | Launch app -> sign in -> allow or deny location -> browse Discover -> open Dish Detail -> open Stall Detail -> save a dish -> submit a review/post if UGC is enabled -> delete account path. |
| Production-disabled features | Explicitly state any disabled surfaces: OAuth providers, floorplans, prototype routes, and any social/merchant/gamification surfaces not enabled in the submitted binary. |
| UGC explanation | If posts/reviews/comments are enabled, name the report, block, moderation queue/action, terms/community standards, and support-contact evidence. If disabled, state they are unavailable in the submitted build. |
| Permissions | Location powers nearby ranking/maps; camera/photo library powers review/post/profile media; microphone is only allowed if the submitted media flow truly records video/audio. |
| Account deletion | Provide in-app settings path and public deletion URL. |
| Notes not to claim | Do not claim awards, rankings, discounts, delivery/order/payment support, official stall/operator endorsement, or merchant self-service unless those flows are live and evidenced. |

## App Store Checklist

| Item | Status | Required proof |
|---|---:|---|
| App metadata complete | pending | App Store Connect screenshot/export |
| App name/subtitle/keywords ASO review | repo-drafted | Owner must approve final fields in App Store Connect |
| Privacy nutrition labels | pending | Owner/legal approval against data mapping |
| Support URL | pending | Public reachable URL proof |
| Privacy URL | pending | Public reachable URL proof |
| Account deletion URL | pending | Public reachable URL and in-app path proof |
| Demo account/reviewer notes | pending | Credentials or approved demo-mode steps |
| iOS preview/production build | pending | EAS/TestFlight artifact |
| UGC moderation notes | pending | Report/block/moderation evidence |
| Location/media permission explanations | source-ready | Verify final binary strings |
| Content rights for screenshots | pending | No real user personal data; food/store imagery rights checked |
| Age rating answers | pending | Owner confirmation against submitted features and UGC status |
| No fake claims/screenshots | pending | Final screenshot review |

## App Store No-Go Blockers

- Store-console metadata and privacy labels are not attached.
- iOS EAS/TestFlight build proof is not attached.
- Legal approval for privacy/terms/account deletion is external.
- Full-platform UGC and merchant proof is incomplete until live/native evidence is captured.
