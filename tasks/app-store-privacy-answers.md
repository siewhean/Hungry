# App Store Connect: App Privacy answers

Source of truth: `ios/Hungry/PrivacyInfo.xcprivacy` (kept in step by `src/app/release-native-profile-contracts.test.ts`) and the privacy policy at `usehungry.com/privacy`. Answer "Yes, we collect data" and for every type below say it is **linked to the user** and **not used for tracking**. Tracking is "No": no data is combined with other companies' data for ads, and no ad network or data broker SDK is in the app, so no App Tracking Transparency prompt is needed.

| Apple category | Data type | Purposes | Notes |
| --- | --- | --- | --- |
| Contact Info | Email address | App functionality, Authentication | Sign-in code and account emails (Resend) |
| Contact Info | Name | App functionality | Display name |
| Identifiers | User ID | App functionality, Analytics | Supabase user id, PostHog person |
| Identifiers | Device ID | App functionality, Analytics | PostHog/Sentry install id |
| Location | Coarse location | App functionality, Product personalization | Optional; area pick works without it |
| Location | Precise location | App functionality | Optional; nearby ranking and map |
| User Content | Photos or videos | App functionality | Review, menu and profile photos |
| User Content | Other user content | App functionality | Reviews, lists, reports |
| Search History | Search history | App functionality, Product personalization | Typed searches used for recommendations |
| Usage Data | Product interaction | Analytics, Product personalization | PostHog; off until the person agrees (onboarding question) |
| Diagnostics | Crash data, Performance data, Other diagnostic data | App functionality, Analytics | Sentry |

Do not tick: Health and Fitness, Financial Info, Contacts, Browsing History, Purchases, Sensitive Info, Advertising Data.

Third-party processors to mention in your own records: Supabase (database, auth, storage), Resend (email), Mapbox (map tiles), PostHog (analytics, US), Sentry (crashes), Expo (updates), Google Cloud Vision and Gemini (menu photos, after permission), Anthropic (AI search, after permission).

Other store fields: privacy policy URL `https://usehungry.com/privacy`; support URL `https://usehungry.com/contact`; account deletion page `https://usehungry.com/account/delete`; export compliance is already declared (`ITSAppUsesNonExemptEncryption` false).
