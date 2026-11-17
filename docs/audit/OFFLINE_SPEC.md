# Offline Experience Specification

This document defines the Hungry app's behavior and user experience when a network connection is unavailable or the Supabase backend is unreachable.

## 1. Connectivity Detection
- **Mechanism**: Use `@react-native-community/netinfo` to monitor device-level connectivity.
- **State Management**: Update `isOffline` in `useUIStore`.
- **Latency Handling**: Connectivity changes are debounced by 1s to prevent flickering during rapid network transitions (e.g., entering a basement).

## 2. UI Treatment

### Global Offline State
- When `isOffline` is true, the `RootNavigator` redirects the user to the `Offline` route (`OfflineStateScreen`).
- This is a non-dismissible full-screen overlay that prevents interactions that require a network (e.g., searching, posting reviews).

### Background Degraded State (Optional/Future)
- For screens with cached data (e.g., Favourites), we may allow viewing cached items with a "Degraded" banner at the top instead of a full-screen block.

## 3. Caching Strategy
- **Zustand Persistence**: `useProfileStore`, `useSessionStore`, and `useDiscoveryStore` are persisted via `AsyncStorage` / `SecureStore`. This ensures that taste vectors, favourites, and cached recommendation slates are available immediately on launch.
- **Image Caching**: `expo-image` is used for all media, providing automatic disk caching of previously viewed dish and stall photos.

## 4. Sync & Queueing (Post-Launch)
- **Review Queueing**: If a user attempts to submit a review while connectivity is lost, the review is saved to a `pendingReviews` queue in `useProfileStore`.
- **Auto-Sync**: When connectivity is restored (`isOffline` becomes false), the app background-syncs all pending items to Supabase.
- **Conflict Resolution**: Last-write-wins for profile updates; unique constraints on Supabase handle duplicate review attempts.

## 5. Recovery Path
- **Manual Retry**: The `OfflineStateScreen` provides a "Retry Connection" button that manually refreshes the NetInfo state.
- **Automatic Recovery**: The app automatically returns to the previous screen once a valid connection is detected.
