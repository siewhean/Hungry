# Offline Experience Specification

This document defines the Hungry app's behavior and user experience when a network connection is unavailable or the Supabase backend is unreachable.

## 1. Connectivity Detection
- **Mechanism**: Use `@react-native-community/netinfo` to monitor device-level connectivity.
- **State Management**: Update `isOffline` in `useUIStore`.
- **Latency Handling**: Connectivity changes are debounced by 1s to prevent flickering during rapid network transitions (e.g., entering a basement).

## 2. UI Treatment & Data Access

### Screen-Level Availability
The app distinguishes between "Blocked" screens (require network) and "Degraded" screens (use cached data).

| Screen | Type | Offline Behavior |
| :--- | :--- | :--- |
| **Home (Discover)** | Degraded | Shows last cached recommendation slates. Display "Offline" banner at top. |
| **Search** | Blocked | Redirects to `OfflineStateScreen`. Searching requires live data. |
| **Favourites** | Full | Full access to local favourites list. Add "Offline" badge. |
| **Profile** | Degraded | View stats and info. Disable "Edit Profile" and "Sync" actions. |
| **Stall/Dish Detail** | Degraded | Show cached metadata and images (via `expo-image`). Block Review submission if queue is full. |
| **Wheel of Fortune**| Blocked | Redirects to `OfflineStateScreen`. Requires server-side verification. |

### OfflineStateScreen (Blocked Path)
- **Visuals**: Full-screen illustration with clear "No Internet Connection" copy.
- **Manual Retry**: "Check Connection" button that manually triggers a network state refresh.
- **Auto-Recovery**: Listens for network restoration; once detected, automatically dismisses and returns the user to their previous screen.

### Degraded State Banner
- Sticky 32pt banner at the top of the screen (below header).
- Text: "You're offline. Some data may be outdated."
- Interaction: Tapping the banner triggers a connection check toast.

## 3. Caching Strategy
- **Zustand Persistence**: `useProfileStore`, `useSessionStore`, and `useDiscoveryStore` are persisted via `AsyncStorage` / `SecureStore`.
- **Media Caching**: `expo-image` handles disk-level caching for all dish and stall photos.
- **Stale-While-Revalidate**: On connection restoration, the app background-refreshes the `DiscoverySlates` to ensure the Home feed is current.

## 4. Queue-and-Sync for Reviews

### Technical Design
Pending reviews are managed in `useSyncStore` (or an extension of `useProfileStore`) and persisted to disk.

```typescript
interface PendingReview {
  id: string; // Client-side UUID
  venueId: string;
  dishId: string;
  rating: number;
  text: string;
  tags: string[];
  photoUris: string[];
  videoUri?: string;
  createdAt: string;
  retryCount: number;
}
```

### Media Handling
1. **Local Storage**: Photos/videos captured in-app are stored in the device's temporary directory.
2. **Persistent Path**: When queued, media is moved to a persistent `hungry/pending_uploads/` directory to prevent OS cleanup.
3. **Sync Sequence**: 
   - Upload media to Supabase Storage first.
   - Replace local URIs with remote URLs in the review metadata.
   - Submit the review to the `reviews` table.

### Conflict Resolution & Error Handling
- **Duplicate Prevention**: Supabase unique constraints on `(user_id, dish_id)` prevent double-posting if a sync is interrupted and retried.
- **Failures**: If a review fails (e.g., 400 Bad Request), it is moved to a "Failed" list with a user notification. Transient errors (500, Timeout) trigger exponential backoff retries.
- **Atomic Operations**: Review metadata is only removed from the queue after the database confirms successful insertion.

## 5. Recovery Path & User Feedback
- **Toast Notifications**: When connectivity returns, show a "Back Online" success toast.
- **Sync Progress**: While background syncing, show a subtle progress indicator in the Profile tab ("Syncing 2 reviews...").
- **Finality**: Once all items are synced, notify the user if they earned XP or badges during the offline period.
