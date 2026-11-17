# Feature Flag Release Matrix

Date: 2026-06-07
Source: `src/constants/featureFlags.ts`

## Rule

Production defaults must stay MVP-safe. Advanced surfaces may be visible in development or staging, but production must not expose unfinished routes through root navigation, linking, bottom tabs, or direct deep links.

## Matrix

| Flag | Development | Staging | Production | Notes |
| --- | --- | --- | --- | --- |
| `readsEnabled` | true | true | true | Stable MVP surface |
| `craveEnabled` | true | true | true | Stable if current QA remains green |
| `hungryWheelEnabled` | true | true | true | Stable decision flow |
| `notificationsEnabled` | false | false | false | Push not release-proven |
| `mockMapboxEnabled` | env-gated | env-gated | env-gated | Controlled by explicit env only |
| `prototypeRoutesEnabled` | true | true | false | Blocks V2/design/prototype roots in production |
| `merchantCentreEnabled` | true | true | false | Production requires separate launch approval |
| `merchantClaimCtaEnabled` | true | true | false | Hidden in production MVP |
| `directMessagesEnabled` | true | true | false | Disabled until moderation and safety proof |
| `commentsEnabled` | true | true | false | Disabled until moderation and safety proof |
| `storiesEnabled` | true | true | false | Disabled until moderation and safety proof |
| `collectionsEnabled` | true | true | false | Disabled until MVP launch approval |
| `gamificationEnabled` | true | true | false | Passport/Missions disabled in production MVP |
| `oauthProvidersEnabled` | true | true | false | Disabled until live provider credentials are verified |
| `floorplansEnabled` | false | false | false | Hidden until floorplan release gates pass |

## Route Exposure Contract

Production must not expose these as root-openable or deep-link-openable surfaces:

- Merchant tabs and merchant claim CTAs
- Direct messages and chat routes
- Stories and story creation
- Collections
- Passport, Missions, and FoodCred-only surfaces
- Floorplans and building drilldown surfaces
- Prototype-only V2/design routes
- Admin or portfolio moderation routes

## Acceptance

- `src/constants/featureFlags.ts` derives advanced flags from `nonProductionSurfaceEnabled`.
- `RootNavigator` conditionally registers advanced routes behind `FEATURE_FLAGS`.
- `linking.ts` only maps merchant/prototype paths when the relevant flag is enabled.
- Static contracts fail if production gates are weakened without updating this matrix.
