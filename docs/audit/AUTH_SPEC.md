# Auth Visual System Specification (G-05)

> Generated 2026-04-12 by Gemini (ArchitectUX). This spec governs the implementation of Batch 3.

---

## 1. Branding Consistency (P2-16)

### Logo Usage
- **Primary Mark**: `HungryLogo` (Orange mark + Navy text).
- **Placement**: Centered at the top of every auth screen (Login, SignUp, ForgotPassword, ResetPassword, EmailVerification).
- **Scale**: `width: 140px`, `height: auto`.
- **Spacing**: `marginTop: spacing[8]`, `marginBottom: spacing[12]`.

---

## 2. Shared Form Layout

### Typography
- **Screen Title**: `variant="h1"`, `fontSize: 24`, `textAlign: "center"`.
- **Subtitle**: `variant="body"`, `tone="secondary"`, `textAlign: "center"`, `marginBottom: spacing[8]`.
- **Labels**: `variant="bodySmall"`, `fontWeight: "700"`, `marginBottom: spacing[2]`.

### Field Styling
- **Input Primitive**: Use `Input` component with `radii.md` (12px).
- **Active State**: Border color `palette.orange`, Background `palette.surface`.
- **Validation State**: Border color `palette.error`, adjacent error text `variant="micro"`, `color: palette.error`.

### Primary Actions
- **Button**: Full-width `primary` variant button.
- **Secondary Actions**: Tappable `AppText` with `fontWeight: "700"`, `color: palette.orange`.

---

## 3. Screen-Specific Polish

### Email Verification
- **Visual**: Large `Mail` icon (Lucide) in `palette.orange`.
- **Code Input**: 4-digit or 6-digit split input fields with auto-focus.
- **Resend Countdown**: "Resend in 00:59" (Disabled) → "Resend Code" (Active, orange).

### Success States
- **Visual**: Green Checkmark (`CircleCheck`) animation or static icon.
- **Message**: "Your password has been reset successfully. Please log in with your new credentials."
- **CTA**: "Back to Login".

---

## 4. Auth Design System Checklist (G-10)
- [ ] HungryLogo is present and centered.
- [ ] Titles and subtitles follow the typography scale.
- [ ] Error states use red borders and micro labels.
- [ ] Password visibility toggles are present on all password fields.
- [ ] Terms and Privacy links are present on the SignUp screen.
