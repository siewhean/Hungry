# Hungry Website Motion System Specification

## 1. Motion System Goal

The Hungry website should feel highly immersive without becoming distracting.

Motion should make the website feel alive, local, premium, and interactive while helping users understand the product.

The motion system should support:

- immersive homepage storytelling
- interactive food and merchant cards
- horizontal carousels
- reveal-on-scroll content
- app UI showcase transitions
- clear conversion moments

## 2. Motion Personality

### Motion should feel

- smooth
- warm
- premium
- responsive
- slightly playful
- cinematic but controlled

### Motion should not feel

- chaotic
- gimmicky
- over-engineered
- heavy on mobile
- disconnected from the product story

## 3. Motion Intensity

Confirmed direction:

```text
Highly immersive
```

However, this does not mean every element should animate.

Motion should be concentrated in:

1. hero section
2. audience split
3. problem-to-solution section
4. sticky product showcase
5. horizontal carousels
6. merchant workflow
7. final CTA entrance

## 4. Core Motion Patterns

## 4.1 Reveal-on-Scroll

### Purpose

Progressively reveal story content as users scroll.

### Use for

- section titles
- feature cards
- problem cards
- merchant steps
- app showcase explanations
- local culture cards

### Recommended behaviour

- fade in
- slight vertical movement
- staggered entrance for grouped cards
- mask reveal for images

### Suggested timing

```text
Duration: 500–800ms
Ease: ease-out / cubic-bezier(0.16, 1, 0.3, 1)
Stagger: 80–140ms
```

### Avoid

- large bouncy animations
- overly delayed content
- repeated dramatic reveals on every small element

---

## 4.2 Interactive Cards

### Purpose

Make the page feel tactile and product-like.

### Use for

- Foodie card
- Merchant card
- dish cards
- feature cards
- business category cards
- merchant workflow cards
- review/ranking cards

### Desktop behaviours

- hover lift
- subtle scale
- shadow increase
- image zoom or reveal
- pointer-based tilt only if subtle

### Mobile behaviours

- tap-to-expand
- press feedback
- carousel swipe
- accordion-style reveal

### Suggested values

```text
Hover scale: 1.015–1.03
Lift: 4–8px
Transition: 180–260ms
Tilt: max 3–5 degrees
```

### Accessibility

- hover-only information must also be visible on tap/focus
- cards must have focus states
- no essential content hidden only behind hover

---

## 4.3 Horizontal Carousel

### Purpose

Create immersive browsing moments and showcase variety.

### Use for

- local food categories
- app screens
- business types
- ranking/review cards
- dish discovery cards

### Required behaviours

- mouse drag / touch swipe
- snap points
- keyboard navigation
- visible progress indicator or affordance
- mobile-friendly swipe experience

### Suggested carousel sections

```text
Built for the way Singapore eats
Reviews and rankings
App screen previews
Business category examples
```

### Motion feel

- smooth drag
- slight card depth
- no aggressive infinite spinning
- no auto-scroll unless subtle and pausable

---

## 4.4 Sticky Product Showcase

### Purpose

Explain the app visually through scroll.

### Use for

The main app preview section.

### Structure

```text
Sticky device mockup
Scroll-linked feature cards
Screen changes as user scrolls
Progress indicator
```

### Screen transition options

- fade + slide
- vertical wipe
- stacked card transition
- phone screen crossfade

### Recommended story steps

1. Discover food across Singapore
2. See reviews and rankings
3. View stall and menu information
4. Save favourites
5. Merchant gets discovered

### Mobile fallback

On mobile, use:

- shorter sticky duration
- stacked screens
- swipeable app screen carousel
- simple reveal transitions

Avoid overly complex scroll locking on mobile.

---

## 4.5 Hero Parallax / Layered Motion

### Purpose

Make the hero immersive and memorable.

### Use for

- food imagery
- app UI cards
- local atmosphere layers
- signage-inspired shapes

### Suggested layers

```text
Layer 1: warm background texture
Layer 2: local atmosphere imagery
Layer 3: food photography cards
Layer 4: phone mockup
Layer 5: floating UI chips
```

### Motion

- slow parallax on scroll
- subtle floating movement
- card entrance on load
- no excessive spinning or bouncing

### Mobile behaviour

- simplify layers
- reduce parallax
- prioritise readable headline and CTA

---

## 4.6 Merchant Workflow Animation

### Purpose

Show merchants how Hungry helps them get discovered.

### Use for

Merchant section and merchant page.

### Interaction

- step cards
- dashboard preview changes per step
- progress line / stepper
- CTA after final step

### Steps

1. Register interest
2. Claim or create listing
3. Add menu and photos
4. Update business details
5. Get discovered

### Motion style

- clean, confident, business-like
- less playful than foodie sections
- smooth card transitions

---

## 5. Section-by-Section Motion Plan

## 5.1 Announcement Bar

Motion intensity: low

```text
Fade in
Optional slight slide down
No looping animation
```

## 5.2 Hero

Motion intensity: high

```text
Headline line reveal
Phone mockup entrance
Floating food and UI cards
Subtle parallax on scroll
CTA appears last
```

## 5.3 Audience Split

Motion intensity: medium-high

```text
Two cards reveal side by side
Hover/tap expansion
Selected state highlights foodie or merchant journey
```

## 5.4 Problem Section

Motion intensity: medium

```text
Problem cards stack in
Cards shift into solution statement
Optional scroll-linked transformation
```

## 5.5 Product Showcase

Motion intensity: high

```text
Sticky phone
Scroll-linked screen changes
Feature cards reveal progressively
Progress indicator updates
```

## 5.6 Singapore Food Culture Section

Motion intensity: medium-high

```text
Horizontal carousel
Image reveal masks
Card hover/tap details
```

## 5.7 Merchant Story

Motion intensity: medium

```text
Workflow steps reveal
Dashboard preview transitions
Register Interest CTA locks focus
```

## 5.8 Community Layer

Motion intensity: medium-high

```text
Horizontal carousel
Review/ranking cards reveal
Sample UI elements animate gently
```

## 5.9 Final CTA

Motion intensity: low-medium

```text
Split CTA cards fade/slide into view
CTA buttons have subtle hover/press
Avoid heavy distractions
```

---

## 6. Timing Guidelines

## Micro-interactions

```text
Button hover / press: 120–180ms
Card hover: 180–260ms
Chip selection: 120–200ms
```

## Section reveals

```text
Title reveal: 500–700ms
Card group reveal: 600–900ms
Image reveal: 700–1000ms
```

## Scroll-linked transitions

```text
Phone screen transition: 300–500ms
Pinned section state transition: tied to scroll progress
Carousel drag: immediate response
```

## 7. Easing Guidelines

Recommended easing types:

```text
Premium reveal: cubic-bezier(0.16, 1, 0.3, 1)
Quick UI feedback: ease-out
Card hover: cubic-bezier(0.22, 1, 0.36, 1)
Modal/large transition: cubic-bezier(0.16, 1, 0.3, 1)
```

Avoid:

- elastic bounce
- harsh linear transitions
- slow animations that block reading
- excessive springiness

---

## 8. Reduced Motion Requirements

The site must respect `prefers-reduced-motion`.

When reduced motion is enabled:

- disable parallax
- disable scroll-linked movement
- replace screen transitions with simple fades
- remove card tilt
- keep essential content visible
- keep carousels usable manually

Reduced motion should still look polished, not broken.

---

## 9. Performance Guidelines

## General

- avoid unnecessary JavaScript for simple CSS transitions
- lazy-load large images
- use responsive image sizes
- optimise all food photography
- avoid running scroll listeners manually if possible
- use requestAnimationFrame-safe animation libraries

## Mobile

- reduce parallax intensity
- reduce pinned section complexity
- avoid large 3D scenes
- test on lower-end devices
- keep first load fast

## Animation Budget

Large immersive motion should be limited to:

- hero
- sticky product showcase
- one or two carousel sections

Other sections should use lighter reveal animations.

---

## 10. Technical Recommendations

### Primary motion library

```text
Framer Motion
```

Best for:

- card animations
- page transitions
- reveal-on-scroll
- UI state transitions
- component-level motion

### Advanced scroll storytelling

```text
GSAP + ScrollTrigger
```

Use only if needed for:

- complex pinned sequences
- timeline-based scroll animation
- sticky product showcase control

### Carousel

Use a performant carousel library or custom implementation with:

- touch support
- keyboard support
- snap points
- low layout shift

### 3D

Only use Three.js / React Three Fiber if there is a strong design reason.

For now, 3D phone effects can likely be achieved with CSS transforms and layered 2D motion.

---

## 11. Motion QA Checklist

Before shipping, verify:

- animations support reduced-motion
- site remains usable without JavaScript-heavy motion
- no section causes scroll jank
- carousels are keyboard accessible
- CTAs remain visible and clear
- mobile animations are simplified
- images lazy-load correctly
- animations do not block reading
- animation timing feels premium, not gimmicky
- merchant CTA is not visually buried

---

## 12. Motion Success Criteria

The motion system is successful if:

1. the homepage feels immersive and memorable
2. users understand Hungry faster, not slower
3. app features feel tangible
4. merchant value is clear
5. the experience feels premium and local
6. the site remains fast and accessible
7. motion supports conversion instead of distracting from it
