# Error Boundary Specification (ERR-00)

This document defines the fallback copy and interaction patterns for uncaught rendering errors across the Hungry app's major screen groups.

## Visual Design

All error states utilize the `FeedErrorBoundary` component, which renders a `FeedStateView` in an error state. This ensures:
- **Brand Consistency**: Uses theme-aware tokens for backgrounds, spacing, and typography.
- **Clear Information**: Provides a prominent title and descriptive body text.
- **Recovery Path**: Includes a "Retry" Call-to-Action (CTA) that attempts to re-render the affected component tree.

---

## Screen Group Specifics

### 1. Auth Screens
**Applies to**: Login, SignUp, ForgotPassword, EmailVerification, ResetPassword.
- **Title**: "Authentication is currently unavailable"
- **Body**: "We're having trouble connecting to our security services. Please check your connection or try again in a moment."
- **CTA**: "Retry"
- **Implementation**: Wrapped at the `AuthStack` level in `RootNavigator.tsx`.

### 2. Detail Screens
**Applies to**: DishDetailScreen, StallDetailScreen.
- **Title**: "Details unavailable"
- **Body**: "We couldn't load those delicious details. Our chefs are on it! Please try again."
- **CTA**: "Retry"
- **Implementation**: Wrapped around the main content in each individual detail screen.

### 3. Profile Screens
**Applies to**: ProfileHome, Favourites, ReviewHistory, Settings, EditProfile.
- **Title**: "Profile unavailable"
- **Body**: "We hit a snag loading your profile. Your taste data is safe—please try again."
- **CTA**: "Retry"
- **Implementation**: Wrapped at the `ProfileStack` level.

### 4. Discovery & Maps
**Applies to**: DiscoverHome, HomeMapScreen.
- **Pattern**: Inline `try/catch` for high-availability components where a full-screen block is undesirable.
- **Map Fallback**: Show a static coordinate overlay or a placeholder if the interactive Mapbox surface fails.
- **Discovery Fallback**: Show a generic "We hit a rendering issue" banner while preserving the rest of the discovery sections.

---

## Technical Note
These boundaries are the "last line of defense". Whenever possible, individual hooks and data-fetching components should handle errors gracefully (e.g., showing local empty states) before the Error Boundary is triggered.
