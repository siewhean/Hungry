# Profile & Reads Visual Polish (G-07)

> Generated 2026-04-12 by Gemini (ArchitectUX). This spec governs the implementation of Batch 6.

---

## 1. Profile Editing & Completeness (P2-25)

### Edit Profile Screen
- **Avatar**: Circle `Avatar` with edit icon overlay (pencil) in `palette.orange`.
- **Display Name**: Field validation (non-empty, alphanumeric).
- **Email**: Field validation (RFC compliant format).
- **Password**: "Change Password" button that opens a modal with current/new/confirm fields.

---

## 2. Reads Feed & Content Metadata (P2-30, P2-31, P2-32)

### Article Metadata
- **Read Time**: Calculate as `Math.ceil(wordCount / 200)` minutes. If not available, default to "5 MIN READ".
- **Category Tags**: "CULTURE", "HEALTH", "GUIDE" tags in micro uppercase.

### Feed Polish
- **View Archive**: Wrap "View Archive" text in a `Pressable` or `Button` with `radii.pill` and `variant="secondary"`.
- **Atmosphere Grid**: Map hex colors (e.g., `#E8531E`) to `palette` tokens. Use `palette.orangeLight` for soft card backgrounds.

---

## 3. Account Management (P2-27, P2-28)

### Settings Screen
- **App Version**: Display "Hungry v0.1.0 · Singapore" at the very bottom in `variant="micro"`, `tone="muted"`.
- **Account Deletion**: Red `AppText` "Delete Account" button with a multi-step confirmation alert ("This action is irreversible.").

---

## 4. Dead Code & Indirection (P2-29)

### Cleanup
- **Remove**: `src/app/screens/profile/ProfileScreen.tsx`.
- **Rewire**: Navigation to point directly to `ProfileHomeScreen`.
- **Consolidate**: Profile sub-screens into a single directory with clear component/screen separation.

---

## 5. Profile & Reads Checklist (G-10)
- [ ] Avatar editing logic is wired.
- [ ] Read time is dynamically calculated.
- [ ] "View Archive" is interactable.
- [ ] App version is sourced correctly.
- [ ] All mock disclosures are removed.
