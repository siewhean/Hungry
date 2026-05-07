## 2026-05-07 - Accessibility labels for Icon-only buttons
**Learning:** Found multiple instances of icon-only Pressable components in auth screens and media playback components lacking screen reader support. It's easy to overlook these when they only toggle state like password visibility or media mute.
**Action:** Always add accessibilityRole="button" and a context-aware accessibilityLabel to icon-only interactive elements to ensure a11y compliance for screen reader users.
