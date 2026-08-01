# Dev RailGaadi — Design System (design.md)

**Companion to:** PRD.md
**Scope:** Visual language, tokens, and component-level design guidance for the "Premium User Experience" pillar (White theme, Apple Maps-inspired, fluid micro-animations).

---

## 1. Design Principles

1. **Light, airy app chrome; dark, cinematic map.** The app shell (search, cards, sheets, navigation) is a clean white/off-white surface — calm, high-contrast, text-forward. The map itself stays dark-styled at all times, by design, for depth and to make the animated train marker and glowing route pop, echoing how Apple/Google Maps night mode reads against light system chrome.
2. **Motion communicates state, not decoration.** Every animation (counter, marker glide, sheet drag, skeleton shimmer) exists to tell the user something changed or is loading — never motion for its own sake.
3. **Glanceable first, detailed on demand.** The default view of any screen must answer its core question (where's my train, is it late) in under 2 seconds of visual scanning; deeper detail (elevation charts, full station tables) is one tap/scroll away, never forced upfront.
4. **Native-feeling, not web-feeling.** Rounded-full controls, spring physics, bottom sheets, frosted-glass overlays — borrow iOS/Apple Maps interaction patterns even on web.

---

## 2. Color Tokens

### 2.1 App Chrome (Light Theme — default)

| Token | Value | Usage |
|---|---|---|
| `color.bg.base` | `#F5F5F7` | App background (Apple-style neutral off-white) |
| `color.bg.surface` | `#FFFFFF` | Cards, sheets, headers |
| `color.bg.surfaceRaised` | `#FFFFFF` + shadow | Elevated cards (favourites, result cards) |
| `color.border.subtle` | `#E5E5EA` | Hairline dividers |
| `color.text.primary` | `#1C1C1E` | Primary text |
| `color.text.secondary` | `#6E6E73` | Secondary/meta text |
| `color.text.tertiary` | `#AEAEB2` | Placeholder/disabled |
| `color.accent.primary` | `#0A84FF` | Primary actions, links, active states (iOS system blue) |
| `color.accent.primaryPressed` | `#0066CC` | Pressed state |

### 2.2 Status / Semantic Colors

| Token | Value | Usage |
|---|---|---|
| `color.status.onTime` | `#34C759` | On-time pill/badge |
| `color.status.minorDelay` | `#FF9F0A` | < 30 min delay |
| `color.status.majorDelay` | `#FF3B30` | ≥ 30 min delay |
| `color.status.early` | `#30B0C7` | Running early |
| `color.status.neutral` | `#8E8E93` | Not running / completed / no data |

### 2.3 Map Theme (always dark, regardless of app theme)

| Token | Value | Usage |
|---|---|---|
| `map.bg` | `#0B0E14` | Base map canvas |
| `map.routeCompleted` | `#0A84FF` (glow: `#0A84FF` @ 40% blur) | Completed route segment |
| `map.routeRemaining` | `#3A3F4B` dashed | Remaining route segment |
| `map.stationPassed` | `#5A5F6B` | Passed station dot |
| `map.stationUpcoming` | `#FFFFFF` | Upcoming station dot |
| `map.stationCurrent` | `#0A84FF` + pulsing ring | Current station |
| `map.markerTrain` | `#FFFFFF` fill, `#0A84FF` outline | Train marker |

### 2.4 Future Dark Mode (tokens reserved, not implemented in MVP)

| Token | Value |
|---|---|
| `color.bg.base.dark` | `#000000` |
| `color.bg.surface.dark` | `#1C1C1E` |
| `color.text.primary.dark` | `#FFFFFF` |
| `color.text.secondary.dark` | `#98989D` |

---

## 3. Typography

- **Typeface:** System font stack — `-apple-system, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif` (falls back gracefully on non-Apple platforms while matching Apple's type rhythm where available).
- **Scale:**
  | Token | Size / Weight | Usage |
  |---|---|---|
  | `type.display` | 34px / Bold | Journey header train name (large state) |
  | `type.title` | 22px / Semibold | Screen titles, sheet headers |
  | `type.headline` | 17px / Semibold | Card titles, stat tile values |
  | `type.body` | 15px / Regular | Body text, list rows |
  | `type.caption` | 13px / Regular | Meta text, timestamps |
  | `type.micro` | 11px / Medium, uppercase, letter-spacing +0.5px | Section eyebrows ("NEXT STATION") |

---

## 4. Spacing, Radius & Elevation

- **Spacing scale (4px base):** 4, 8, 12, 16, 20, 24, 32, 40, 48.
- **Corner radius:** `radius.sm` 8px (chips/badges), `radius.md` 14px (cards), `radius.lg` 20px (sheets/modals), `radius.full` (pills, primary buttons, search bar).
- **Elevation (light theme shadows):**
  - `elevation.1`: `0 1px 2px rgba(0,0,0,0.04)` — subtle card rest state.
  - `elevation.2`: `0 4px 16px rgba(0,0,0,0.08)` — floating headers/sheets.
  - `elevation.3`: `0 12px 32px rgba(0,0,0,0.12)` — modals.
- **Glassmorphism overlay (map header/controls):** `background: rgba(255,255,255,0.72); backdrop-filter: blur(20px) saturate(180%);` with a 1px `rgba(255,255,255,0.5)` inner border for the frosted-glass edge.

---

## 5. Motion System

| Interaction | Spec |
|---|---|
| Button/card press | scale 1 → 0.97, 100ms ease-out, opacity 1 → 0.85 |
| Sheet open/close | spring (stiffness ~300, damping ~30) drag-to-dismiss with velocity-based fling |
| Page/card → Journey transition | shared-element expand: card grows and morphs into `JourneyHeader` over ~350ms ease-in-out |
| Skeleton shimmer | linear-gradient sweep, 1.2s loop, ease-in-out |
| Animated counters | value tween over 600–800ms, ease-out, formatted at each frame (no layout shift) |
| Train marker movement | interpolated via `requestAnimationFrame` across the ~30s poll window; ease-linear (constant apparent speed) with bearing rotation eased separately (ease-in-out, 300ms) to avoid snapping on turns |
| Route glow | pulsing opacity 0.4 → 0.7 → 0.4 on the completed-segment glow layer, 2.5s loop |
| Current-station ring | pulsing scale 1 → 1.4 with fading opacity, 1.8s loop |

All motion must respect `prefers-reduced-motion: reduce` — reduce to instant/opacity-only transitions, disable marker easing (snap to position) and disable pulsing loops (static ring instead).

---

## 6. Iconography

- Line-style icons (SF Symbols-inspired: consistent 1.5–2px stroke, rounded caps/joins), used for: weather conditions, POI categories (river, mountain, bridge, monument, city), controls (zoom, recenter, pitch, share, star/favourite).
- Status pills always pair an icon + short text label (never color-only), e.g., ⏱ "On Time", ⚠ "+12 min".

---

## 7. Component Design Notes

- **Search bar:** rounded-full, `elevation.1` at rest, `elevation.2` + subtle scale-up (1.02) on focus, leading magnifier icon, trailing clear (×) icon appears once text entered.
- **Cards (Train result / Favourite / POI):** `radius.md`, `elevation.1`, 16px internal padding, leading icon or route-glyph, title (`type.headline`) + meta (`type.caption`).
- **Status pill:** `radius.full`, tinted background at 12% opacity of the semantic color, text/icon in the full-opacity semantic color.
- **Bottom sheet:** `radius.lg` top corners only, drag handle (36×5px, `color.border.subtle`, centered, 8px from top), peek/half/full snap points.
- **Map floating controls:** circular, 44px diameter, glassmorphism background, single icon centered, stacked vertically bottom-right with 8px gaps.
- **Stat tile:** `radius.md`, `elevation.1`, eyebrow label (`type.micro`) + animated value (`type.headline`/`type.display` depending on grid density) + optional trend sparkline beneath.

---

## 8. Responsive Behavior

- **Mobile (< 768px):** single column, map is default full-screen view, all secondary content (analytics, weather, route) lives in the draggable bottom sheet.
- **Tablet (768–1024px):** map + a persistent right-side analytics/weather panel (no bottom sheet needed), sidebar navigation replaces bottom tabs.
- **Desktop (> 1024px):** three-pane — sidebar nav, dominant map (min 55% width), right rail with tabbed Analytics/Weather/Route content, all cards get more breathing room (24px padding vs 16px on mobile).

---

## 9. Attribution Footer Styling

Data-source attribution (RailRadar, MapTiler, OpenWeather, OpenTopography, OpenStreetMap/Overpass) rendered in `type.caption`, `color.text.tertiary`, in Settings/About and as a minimal single-line footer on the public Shared Journey view — never intrusive, never overlapping map controls.
