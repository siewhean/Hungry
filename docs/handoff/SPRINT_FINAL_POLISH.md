# Implementation Spec Document: Final Polish Sprint (Batch 2026-04-11D)

**Target:** Codex (Implementation Agent) / Engineering Team
**Status:** Approved & Implemented

This document consolidates the high-fidelity UI/UX refactors and architectural decisions made during the April 11 sprint.

## 1. High-Fidelity UI Refactors

### Maps & Discovery
*   **Target:** `HomeMapScreen.tsx`, `MapZoomedInScreen.tsx`
*   **Standard:** Persistent `BottomSheet` with **square bottom corners** and `radii.lg` (40pt) top corners.
*   **Ergonomics:** Added a **12pt bottom margin** clearance from the navigation bar.
*   **Indicators:** Integrated "Live Crowd" badges (Quiet, Moderate, Busy) into all discovery surfaces.
*   **Global Map:** High-fidelity horizontal carousel (Figma 131-105) with non-scrolling detail cards.

### Onboarding & Personalization
*   **Flow:** New multi-page **Cuisine Selection** and **Food Selection** (Cravings) screens.
*   **Logic:** Blended Taste Vector calculation (50/50 weighting between quiz results and craving characteristics).
*   **Results:** Refined `TasteProfileResultScreen` (Figma 131-349) with bar graphs and a "Your Cravings" vault for instant favouriting.

### Home Feed
*   **Layout:** "Instagram Standard" media-first feed.
*   **Interaction:** Horizontal bar below images with Reversed icons (Bookmark, Comment, Heart).
*   **Legibility:** Standardized attribution text (`USER at LOCATION`) to **13pt** for accessibility.
*   **Ergonomics:** Globally synchronized **Left-Handed Mode** support.

## 2. Multiplayer & Safety (Hungry Wheel)
*   **Safety:** Real-time **Dietary Warning Alerts** and "Group Needs" header in the nomination sheet.
*   **Governance:** Host controls for **Entry Limits** (3, 5, Unlimited) per member.
*   **Identification:** Branded "Dices" identity for the Wheel landing page.

## 3. Production Readiness
*   **Copy:** Purged all "mock-session" disclosures. 
*   **Drafts:** Added "Unfinished Posts" recovery logic to the Profile home screen.
*   **Stability:** Resolved `Invariant Violation` for animated virtualized lists and fixed variable scoping in Map views.
