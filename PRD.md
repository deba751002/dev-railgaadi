# Dev RailGaadi — Product Requirements Document

**Version:** 1.0 (MVP → Scale)
**Status:** Draft for Engineering Kickoff
**Owner:** Product/Engineering
**Last Updated:** 2026-08-01

---

## 1. Product Vision

### 1.1 Product Overview

Dev RailGaadi is a premium, real-time Indian train tracking and journey companion app. It turns raw train-running data (position, delay, route) into a beautiful, map-first experience: passengers, families waiting at stations, and logistics-curious users can see exactly where a train is, what's around it, whether it's on time, and what the trip looks like end to end — visually, on a living map, not a static timetable.

Where existing Indian train-tracking tools (NTES, Where is my Train, RailYatri) treat live status as a data table, Dev RailGaadi treats it as a **journey experience**: an animated marker gliding across a dark, cinematic map, contextual weather at each stop, terrain and points of interest along the route, and journey analytics that read like a fitness-tracker summary of the trip.

### 1.2 Problem Statement

- Existing live-train-status apps are functional but visually dated, ad-heavy, and data-dense without being insight-dense.
- Passengers and their families want reassurance ("is it running late, when will it get to my station, what does the route look like") delivered in a glanceable, low-effort way — not a raw list of station timings.
- There is no product that combines live rail position with weather, terrain, and points-of-interest context to make a train journey feel like a first-class "trip," the way flight trackers (Flighty, FlightAware) have done for air travel.
- No incumbent offers a shareable, presentable "live journey" view — something you'd screenshot or send to a family member picking you up.

### 1.3 Target Audience

**Primary**
- Passengers actively traveling on Indian Railways who want live status, ETA, and journey context on their phone.
- Family/friends tracking a traveling passenger remotely (the "receiving end" use case — picking someone up, planning around arrival).

**Secondary**
- Rail enthusiasts ("railfans") who track trains recreationally and care about route visualization, elevation profiles, and running history.
- Frequent business/commuter travelers who want a fast, low-friction favourites-based dashboard instead of re-searching every trip.

### 1.4 Goals

**Product goals**
1. Make "where is my train right now" answerable in under 5 seconds from cold open.
2. Make the live map experience feel premium enough to be a daily-use, screenshot-worthy product, not a utility.
3. Turn train data into a narrative (progress, delay trend, weather, terrain) rather than a flat table.
4. Build a foundation (auth-ready data model, favourites, recent searches) that can support monetization (ads-free premium tier, notifications, alerts) post-MVP.

**Business goals**
- Establish daily/weekly active usage habits via favourites + recent searches + shareable links (organic loop).
- Validate willingness to pay for a premium tier (no ads, push notifications, unlimited favourites) within 2 quarters of MVP launch.

### 1.5 Success Metrics

| Metric | Target (MVP + 3 months) |
|---|---|
| D1 retention | ≥ 25% |
| D7 retention | ≥ 10% |
| Median time-to-first-result (search → live map) | < 5s |
| Live status auto-refresh success rate | > 99% |
| Share-link opens per shared journey | ≥ 1.5 |
| Avg. session duration | > 90s |
| Crash-free session rate | > 99.5% |
| API error rate (RailRadar proxy) | < 1% |

---

## 2. User Personas

### 2.1 "The Traveler" — Primary
- Boarding or currently on a train; phone in hand, spotty connectivity.
- Goals: confirm on-time status, know time to next station, know if they should worry about a connection.
- Pain points: apps that require re-entering PNR/train number every session; slow load on poor rail-corridor networks; cluttered UI when they just want a quick glance.

### 2.2 "The Receiver" — Primary
- Not traveling; waiting for someone. Opens a shared link or searches the train themselves.
- Goals: know precisely when to leave for the station; reassurance during delays.
- Pain points: no shareable "live view," has to describe status verbally over calls/WhatsApp.

### 2.3 "The Railfan" — Secondary
- Power user, tracks trains as a hobby, cares about route geometry, elevation, history, on-time performance trends.
- Goals: rich analytics, beautiful map, ability to explore route detail beyond the current trip.
- Pain points: existing apps are functional but ugly; lack elevation/terrain and POI overlays.

### 2.4 "The Commuter/Frequent Traveler" — Secondary
- Travels the same 2–4 routes regularly.
- Goals: near-zero-friction repeat lookups.
- Pain points: re-typing train numbers every time; no personalization.

---

## 3. Functional Requirements

Each feature area below is expanded into user stories, flows, edge cases, validation, and state handling.

### 3.1 Live Train Tracking

**User stories**
- As a traveler, I can search a train by number or name and see its current live status within seconds.
- As a user, I can see the current station, the next station, and ETA to it.
- As a user, I can see whether the train is on time or delayed, and by how much.
- As a user, I can see a "last updated" timestamp so I trust the data's freshness.
- As a user, I can share a link to the live journey so someone else can view the same live state without searching.

**Primary flow**
1. User lands on Home → sees search bar (autofocused) + Recent Searches + Favourite Trains.
2. User types a train number (e.g., `12951`) or name (e.g., "Rajdhani"). Debounced (300ms) fuzzy search returns matching trains with number, name, and route (origin → destination).
3. User selects a result → navigates to Journey screen for that train (for the current/most relevant running instance, since a train number can have multiple date-instances).
   - If more than one active instance exists (train runs multiple days and one is still en route from a prior day), disambiguate with a date-selection sheet, defaulting to "most likely current" instance.
4. Journey screen loads: skeleton state → live data populates (map, status card, ETA).
5. Auto-refresh polls live position/status every 30s (configurable; backs off to 60s if tab/app backgrounded).
6. User taps Share → generates a deep link (`dev-railgaadi.pages.dev/j/{trainNumber}/{journeyDate}` — the free Cloudflare Pages subdomain, see §6 Deployment) that opens directly to this Journey screen for anyone, no login required.

**Edge cases**
- Train number valid but not running today → show "Not running on this date" state with next scheduled running date if derivable.
- Train terminated/journey completed → show "Journey completed" state with a summary (arrived at destination at X, final delay).
- No live GPS ping received yet (train not yet departed origin) → show "Awaiting departure" state with scheduled departure countdown.
- Ambiguous search query (multiple trains match name loosely) → show ranked list, exact number match always first.
- API returns stale data (`lastUpdated` > 15 min old) → show a "Data may be delayed" badge instead of failing silently.
- Network loss mid-session → keep last-known state visible, show non-blocking "Reconnecting…" indicator, retry with exponential backoff (5s, 10s, 20s, capped at 60s).

**Validation**
- Train number input: numeric, 4–5 digits; reject non-numeric with inline hint but still attempt name-based fuzzy search.
- Reject empty submissions; search only triggers with ≥ 2 characters.

**Empty states**
- No search history: friendly illustration + "Search a train number or name to get started."
- No search results: "No trains matched '{query}'. Check the number or try the train name."

**Loading states**
- Search: inline skeleton rows (3) under the search bar while debounced query resolves.
- Journey screen: full skeleton (map placeholder shimmer, status card shimmer) — never a blank white/dark screen.

**Error handling**
- Distinguish network errors (retry affordance) from "train not found" (no retry, corrective guidance) from upstream provider errors (generic "Live data temporarily unavailable" with retry).

### 3.2 Immersive Journey Map

**User stories**
- As a user, I want a full-screen, cinematic map showing my train's live position moving along its route.
- As a user, I want to visually distinguish completed route from remaining route.
- As a user, I want the map to follow the train automatically, but I can also pan freely and return to follow-mode with one tap.

**Primary flow**
1. Map initializes centered on train's current position at a preset zoom/pitch (3D-ish angled view, MapLibre GL + MapTiler dark vector style).
2. Full route line rendered as a GeoJSON LineString: completed segment styled solid/bright with a subtle glow, remaining segment styled dimmer/dashed.
3. Train marker: custom animated icon, rotates to match bearing of travel, interpolated smoothly between position updates (client-side tween over the ~30s poll interval so motion isn't jumpy).
4. Current station marker highlighted (pulsing ring). Passed stations shown as small dots; upcoming stations shown as slightly larger dots with name labels that appear on zoom-in.
5. "Follow" mode (default): camera recenters/follows marker as it updates. User pan/zoom gesture disables follow and shows a floating "Recenter" button; tapping it restores follow mode.
6. Controls: zoom (+/-), compass/rotate reset, pitch toggle (3D ⇄ flat top-down), fullscreen toggle (mobile web).

**Edge cases**
- Route geometry unavailable from provider for an obscure train → fallback to straight-line segments between known stations with a "simplified route" badge.
- Train position outside expected route corridor (GPS drift/bad data) → clamp marker to nearest point on route line (snap-to-route) rather than showing it off in a field.
- Map tile load failure (offline) → show static last-rendered frame + offline banner, disable pan/zoom gracefully.

**Validation / states**
- Loading: shimmer over map container + spinner on first load only (not on refresh).
- Smart map loading: pre-fetch tiles for route bounding box before reveal, so the initial paint isn't a flash of unstyled/ungeometried map.

### 3.3 Journey Analytics

**User stories**
- As a user, I want to see what % of the journey is complete.
- As a user, I want a delay trend (is it catching up or falling further behind).
- As a user, I want distance covered/remaining and a timeline of station arrivals so far.
- As a railfan, I want an elevation profile of the route and the highest point reached.

**Primary flow**
1. Analytics tab/section on Journey screen (below map on mobile, side panel on desktop/tablet).
2. Journey Completion: animated circular/linear progress (e.g., "62% complete — 412 km of 663 km").
3. Delay Analysis: current delay in minutes, small sparkline showing delay at each of the last N stations (trend up/down), badge color (green on-time, amber <30min, red >30min).
4. Distance Analytics: covered vs remaining, average speed estimate (derived from distance/time between last two pings).
5. Elevation Profile: chart (via OpenTopography elevation samples along the Turf.js-generated route line) — line/area chart, highest elevation point annotated with station/location name.
6. Travel Timeline: vertical timeline of stations already passed with actual arrival time vs scheduled, and delay at each.
7. Journey Statistics Dashboard: summary cards (total distance, total scheduled duration, number of stops, current average delay).

**Edge cases**
- Elevation data unavailable for a route segment → gracefully degrade chart (interpolate/flat-line that segment, don't crash chart).
- No historical station arrivals yet (train just departed origin) → show "Journey just started" empty state instead of an empty chart.
- Negative delay (train running early) → explicitly show "5 min early" in green, don't just clamp to 0.

**Validation**
- All computed analytics values derived server-side or in a shared utility (not duplicated client logic) to avoid drift between screens.

### 3.4 Smart Travel Companion

**User stories**
- As a user, I want to see current weather at the train's current station, and forecast at the next and final stations.
- As a user, I want to know what natural/geographic features (rivers, mountains, bridges) and points of interest are near the route.

**Primary flow**
1. Weather strip: 3 cards — Current Station, Next Station, Destination — each with temperature, condition icon, humidity, wind (OpenWeather API), refreshed on each major station change (not every 30s poll, to conserve API quota).
2. Rain-along-route: lightweight strip/map overlay showing precipitation icons at upcoming stations if rain forecast > threshold probability.
3. "Nearby & Along the Route" section: Overpass API query for POIs within a buffer (Turf.js buffer around the route line) — categorized: Rivers & Lakes, Mountains & Ghats, Bridges & Tunnels, Monuments & Attractions, Cities & Districts. Rendered as a horizontally scrollable card list per category, and optionally as toggleable map layers/pins.
4. Tapping a POI card centers the map on it with a small info popover (name, category, distance from route).

**Edge cases**
- OpenWeather rate-limited or down → show cached last-known weather with a "cached X min ago" note, never a hard error blocking the rest of the screen.
- Overpass query returns nothing for a category (e.g., no mountains on a flat plains route) → hide that category section entirely rather than showing an empty card row.
- Overpass timeout (public instance can be slow) → background-load with skeleton, non-blocking to the rest of the journey screen; timeout after 8s and hide section gracefully with silent retry on next refresh cycle.

**Validation**
- Cache weather per station for 15 minutes; cache POIs per route indefinitely (route geometry doesn't change) keyed by train number + route hash.

### 3.5 Premium User Experience

**User stories**
- As a user, I want the app to feel fast, fluid, and premium — not like a government utility app.
- As a user, I want quick access to trains I search often and ones I've favourited.

**Primary flow**
1. White-theme, Apple Maps-inspired visual language (see companion `design.md` for full design system) as the default; map itself retains a dark theme for contrast/immersion (map darkness is intentional even in light app theme, similar to how Apple/Google Maps night-mode tiles read against a light chrome).
2. Recent Searches: last 10 searched trains, shown as compact chips/rows on Home, tap to jump straight to Journey screen.
3. Favourite Trains: user can star a train from the Journey screen; favourites pinned to top of Home in a dedicated horizontally scrollable row with live mini-status (delay badge) refreshed periodically even without opening the full journey.
4. Skeleton loading everywhere data is fetched (search results, journey screen, analytics, weather, POIs) — no spinners-only states except tiny inline ones.
5. Animated counters for all numeric values that change (distance covered, completion %, delay minutes) — count up/down smoothly rather than snapping.
6. Page transitions: shared-element-style transition from a search result / favourite card into the full Journey screen (the card visually expands into the header).
7. Fully responsive: mobile-first (primary usage context), scales up to tablet/desktop with a two/three-column layout (map + analytics + weather side by side on desktop).

**Edge cases**
- First-time user (no recents, no favourites) → onboarding empty state with 2–3 example/popular trains to try (e.g., top Rajdhanis/Shatabdis) so Home isn't blank.
- Favouriting limit for free tier (e.g., max 5 favourites) reached → prompt explaining the limit, no hard paywall block in MVP (soft upsell placeholder for future premium tier).

### 3.6 Offline Tracking Mode

Two distinct offline capabilities, layered so the second builds on the first:

- **A. Cached Snapshot (any train the user has opened online before)**
- **B. On-Device GPS Tracking (self-locating, "Where is my Train"-style, for the train the user is physically riding)**

#### 3.6.A Cached Snapshot Mode

**User stories**
- As a user, once I've opened a train's Journey screen while online, I want to be able to reopen it later even with no internet and still see its last-known status, position, and route — not a blank/error screen.

**Primary flow**
1. Every successful `GET /api/journey/:trainNumber` response (§7.2) is persisted client-side (IndexedDB) keyed by `trainNumber:journeyDate`, including: last status, position, progress, route geometry, station timeline, and weather snapshot — i.e., the full payload already defined in the data model, not a new shape.
2. Route geometry, elevation, and POIs (already cached "indefinitely" per §6.2) are written to IndexedDB, not just in-memory/React Query cache, so they survive an app restart with no network.
3. When the client detects `navigator.onLine === false` or a live poll fails after retries (§3.1 edge case), the Journey screen falls back to the last IndexedDB snapshot for that train instead of showing an error.
4. A persistent, non-dismissible banner communicates the state clearly: **"Offline — showing status from [X min/hours] ago."** The delay/status pill, ETA, and "last updated" timestamp all continue to reflect the cached values (never silently re-labeled as live).
5. Map renders using cached route geometry + last known marker position (static, non-animating — there's nothing new to interpolate towards). If MapLibre tile cache (browser/service worker) has the route's tiles from the earlier online session, they render too; otherwise the route line/markers render over a plain background tile-less canvas.
6. The moment connectivity returns, the app silently re-fetches, reconciles, and removes the offline banner — no user action required.

**Edge cases**
- User opens a train they've **never** searched online before, while offline → clear empty/error state: "This train hasn't been loaded yet. Connect to the internet once to view it, then it'll be available offline." (Distinct copy from a generic network error — this is expected behavior, not a failure.)
- Cached snapshot is very old (e.g., > 24h, journey likely long completed) → still show it, but the "showing status from X ago" framing makes staleness obvious; do not attempt to extrapolate a fake "current" state.
- Storage limits (IndexedDB quota) → cap cached journeys at a reasonable count (e.g., last 20 opened trains, LRU-evicted) so this never silently fills device storage.

**Validation**
- Snapshot writes are best-effort and non-blocking — a failed IndexedDB write never breaks the live (online) experience.

#### 3.6.B On-Device GPS Tracking Mode (self-locating)

**User stories**
- As a traveler physically on a train with no signal (tunnel, remote track), I want the app to keep estimating my train's position and delay using my phone's own GPS, without needing a live server connection.

**Primary flow**
1. A lightweight **offline route/schedule dataset** (station coordinates + scheduled timings, GTFS-static-like structure) is bundled/synced to the device — downloaded opportunistically over Wi-Fi/data and refreshed periodically (e.g., weekly), independent of any specific journey lookup.
2. When a user opens a Journey screen for a train they are actively riding, they can enable **"Track using my location"** (explicit opt-in, requests device GPS permission with clear rationale copy).
3. While enabled, the app reads device GPS periodically (even fully offline — GPS itself needs no internet) and, client-side, snaps the position to the nearest point on that train's cached route geometry (Turf.js `nearestPointOnLine`), derives current/next station and an estimated delay by comparing GPS-derived arrival progress against the offline schedule.
4. This locally-derived status renders in the same UI (status pill, ETA, progress) as the live/API-derived one, but visually marked with a distinct badge: **"Estimated from your location"** (vs. "Live" for RailRadar-sourced data) — the user must always be able to tell which source they're looking at.
5. When connectivity returns, the locally-estimated status is reconciled against the RailRadar live feed (live feed takes precedence once available), and — with the user's consent — the on-device GPS trace can optionally be uploaded to help crowdsource/improve position accuracy for other users on the same journey (explicitly opt-in, not default-on; ties into the Overpass/route data pipeline as a future data source, not required for MVP).

**Edge cases**
- User enables GPS tracking but isn't actually near the train's route (opened the wrong train, or testing at home) → if snapped distance-from-route exceeds a sane threshold (e.g., 2 km), show a gentle warning ("Your location doesn't seem to match this route") instead of silently displaying a wrong position.
- GPS permission denied → feature simply stays hidden/disabled with an explanatory row in the offline banner ("Enable location access to track this journey offline"), never a blocking prompt.
- Battery/background restrictions (mobile OS suspends background GPS reads) → degrade gracefully to foreground-only updates; clearly show "last updated" timestamp same as the online mode so staleness is never hidden.
- Offline route/schedule dataset missing for this specific train (rare/unlisted train) → GPS mode unavailable for that train; fall back to Cached Snapshot mode (3.6.A) only, with copy explaining why.

**Validation**
- On-device estimation is always clearly labeled as an estimate, never presented with the same visual confidence as the live server-confirmed status — this is a trust/accuracy requirement, not just a UI nicety.

---

## 4. Information Architecture

### 4.1 Application Structure

```
Dev RailGaadi
├── Home (/)
│   ├── Search bar (global, always accessible)
│   ├── Favourite Trains (row)
│   └── Recent Searches (list)
├── Search Results (/search?q=)
├── Journey (/journey/:trainNumber/:date?)
│   ├── Live Map (default view)
│   ├── Analytics (tab/section)
│   ├── Weather & Nearby (tab/section)
│   └── Route Details (tab/section — full station list, schedule)
├── Shared Journey (/j/:trainNumber/:date) — public, no-auth view of Journey
└── Settings (/settings)
    ├── Theme (future: dark mode toggle)
    ├── Notification preferences (post-MVP)
    └── About / Data sources / attribution
```

### 4.2 Navigation

- **Mobile:** bottom tab bar — Home, Search, (center) Live/Map for last-viewed active journey if any, Favourites, Settings. Journey screen itself uses a segmented control (Map / Analytics / Weather / Route) rather than nested tabs.
- **Desktop/tablet:** persistent left sidebar (Home, Favourites, Settings) + main content area; Journey screen uses a 3-pane layout (map dominant, right rail for analytics/weather tabs).

### 4.3 Screens

1. Home
2. Search Results
3. Journey — Map view
4. Journey — Analytics view
5. Journey — Weather & Nearby view
6. Journey — Route Details view
7. Shared Journey (public)
8. Settings
9. Empty/Error/Not-Found states (shared components, not standalone screens)

### 4.4 Layout Hierarchy

`AppShell` → `NavigationChrome` (tab bar / sidebar) → `PageContainer` → screen-specific composition of shared components (`SearchBar`, `TrainResultCard`, `JourneyHeader`, `MapCanvas`, `AnalyticsPanel`, `WeatherStrip`, `POICardRow`, `Timeline`).

---

## 5. UI/UX Specification

Full visual system specified separately in `design.md`. Summary per screen below.

### 5.1 Home Screen
- **Layout:** Large, centered search bar near top (Apple Spotlight-esque), rounded-full input, subtle shadow, soft white/off-white background (#F5F5F7-style neutral, per Apple HIG surfaces).
- **Favourite Trains row:** horizontally scrollable cards, each showing train name/number, a live delay pill (green/amber/red), tap → Journey.
- **Recent Searches list:** simple rows with train number/name, route (origin → destination abbreviation), relative time ("2h ago"), swipe-to-remove on mobile.
- **Animations:** search bar focus expands slightly with a soft spring; cards have a subtle press-scale (0.97) micro-interaction.
- **Dark mode:** deferred post-MVP per design.md notes, but color tokens defined now to avoid rework.

### 5.2 Search Results
- Debounced live results list below search bar (or as a modal/sheet on mobile).
- Each `TrainResultCard`: train number, name, origin→destination, small route glyph icon.
- Skeleton: 3 shimmering rows while debounce/query resolves.
- Empty: illustration + corrective copy.

### 5.3 Journey — Map View
- Full-bleed `MapCanvas` (MapLibre GL, MapTiler dark style) below a compact floating `JourneyHeader` (glassmorphism/blur card: train name/number, status pill, ETA to next station, last-updated timestamp).
- Floating controls: zoom, recenter/follow toggle, pitch toggle — bottom-right, frosted-glass circular buttons.
- Bottom sheet (mobile) / right panel (desktop): draggable sheet with peek state showing current/next station + progress bar; drag up to reveal full Analytics/Weather/Route tabs.
- Share button in header → native share sheet (mobile) / copy-link toast (desktop).

### 5.4 Journey — Analytics
- Stat cards grid (2-col mobile, 4-col desktop): Completion %, Distance Covered/Remaining, Current Delay, Avg Speed — each with animated counter.
- Delay sparkline chart (small, inline).
- Elevation profile: area chart, gradient fill, annotated peak.
- Timeline: vertical list, dot-and-line connector, station name, scheduled vs actual time, delay chip per stop.

### 5.5 Journey — Weather & Nearby
- 3 weather cards (Current / Next / Destination) in a row, icon + temp + condition, tap to expand humidity/wind detail.
- Rain-forecast strip if applicable.
- POI categories as horizontally scrollable card rows, each card: icon, name, distance from route; tapping recenters map with popover.

### 5.6 Journey — Route Details
- Full scrollable station list (table on desktop, stacked rows on mobile): station, scheduled arrival/departure, actual (if passed), platform (if available), distance from origin.

### 5.7 Shared Journey (Public)
- Identical to Journey — Map view but read-only chrome (no favourite/settings actions), plus a small "Powered by Dev RailGaadi" footer/branding and a CTA to open the full app.

### 5.8 Settings
- Simple list: Notification preferences (post-MVP placeholder), Units (km/miles), About, Data source attribution (RailRadar, MapTiler, OpenWeather, OpenTopography, OSM/Overpass — required attribution compliance).
- **Offline & Location:** toggle for background GPS tracking permission (§3.6.B), "Manage offline trains" (view/clear the up-to-20 cached journeys from §3.6.A), last offline-dataset sync timestamp with manual "Sync now" action.

### 5.9 Cross-cutting UI elements
- **Modals/Drawers:** bottom sheets on mobile (spring physics, drag-to-dismiss), centered modals on desktop.
- **Buttons:** primary (filled, rounded-full, brand accent), secondary (tinted), icon buttons (frosted circular, used on map overlays).
- **Micro-interactions:** haptic-feeling scale/opacity feedback on tap (web: CSS transform + transition), skeleton shimmer via animated gradient, route "glow" via animated dash-offset or blurred duplicate layer under the main route line.
- **Mobile responsiveness:** single-column stacked; map view is default full-screen with bottom sheet overlay.
- **Dark mode:** app chrome defaults to light per feature spec ("White theme Interface"); map remains dark-styled regardless, by design, for contrast and immersion.

---

## 6. Technical Architecture

### 6.1 Frontend Architecture

- **Framework:** React (Vite) + TypeScript, React Router for navigation.
- **Rendering:** SPA with route-based code splitting; Journey screen (map + charts) is the heaviest bundle and is lazy-loaded.
- **State management:**
  - Server/remote state: TanStack Query (React Query) — handles polling (live status refetch every 30s via `refetchInterval`), caching, retry/backoff, and stale-time per data type (weather 15 min, POIs effectively infinite via `staleTime: Infinity` keyed by route hash, live status 30s).
  - Local/UI state: Zustand for lightweight global UI state (follow-mode toggle, active tab, theme) — avoids prop drilling without Redux overhead.
  - Persisted state (favourites, recent searches): Zustand slice persisted to `localStorage` (MVP) with a clear seam to swap for backend-persisted user accounts later.
- **Map layer:** MapLibre GL JS + MapTiler vector tiles (dark style), Turf.js for geometry (route buffering, distance calc, snapping, elevation-sampling point generation along the line).
- **Charting:** lightweight charting lib (e.g., Recharts) for sparklines/elevation/analytics — SSR not required since SPA.
- **Offline persistence layer (§3.6):**
  - **IndexedDB** (via a thin wrapper, e.g., `idb`) stores the full composed Journey payload (§7.2 shape) per `trainNumber:journeyDate`, plus route geometry/elevation/POI blobs keyed by route hash — this is what powers Cached Snapshot mode, separate from React Query's in-memory cache which doesn't survive a reload.
  - **Service Worker** (Workbox) caches the app shell + MapLibre/MapTiler tile requests for previously-viewed route bounding boxes, so the map itself (not just the data) renders offline.
  - **Offline route/schedule dataset** (GTFS-static-like: station coordinates + timetables) synced in the background via the Service Worker on a schedule (e.g., weekly, Wi-Fi-preferred), independent of any single journey lookup — this is what powers GPS Tracking mode (§3.6.B), since it must exist before the user ever goes offline.
  - A single `useConnectivity()` hook exposes online/offline state (via `navigator.onLine` + a lightweight periodic reachability ping) that `useLiveTrainStatus` consults to decide: live poll → cached snapshot fallback → GPS-estimated fallback, in that priority order.

### 6.2 Backend Architecture

- **Pattern:** Backend-for-Frontend (BFF) — a thin Node/TypeScript service (e.g., Fastify/NestJS) that:
  - Proxies and normalizes RailRadar, OpenWeather, OpenTopography, and Overpass calls (hides API keys from client, applies caching/rate-limit shielding).
  - Combines/derives data the client shouldn't compute redundantly (e.g., completion %, ETA smoothing, snapped position) — single source of truth for journey math.
  - Owns favourites/recent-search persistence once accounts exist (post-MVP); MVP can run client-only with localStorage and this BFF layer purely as an API proxy/cache.
- **Caching layer:** Redis (or in-memory LRU for MVP scale) in front of third-party APIs:
  - Live train status: cache 20–25s (just under poll interval) to dedupe concurrent user requests for the same train.
  - Weather: cache 15 min per station.
  - Route geometry + elevation + POIs: cache indefinitely per route hash, invalidate manually/rarely (route geometry doesn't change).
- **Rate-limit shielding:** BFF enforces per-IP/session request quotas so a single client can't exhaust shared upstream API quotas (especially Overpass's public instance and OpenWeather free tier).

### 6.3 Service / Provider Layer (Frontend)

```
src/
  services/           # thin fetch wrappers per external concern, all calling OUR BFF, never third-party APIs directly from client
    trainService.ts
    weatherService.ts
    poiService.ts
    elevationService.ts
    geocodeService.ts (if needed for search)
  providers/          # React context providers
    MapProvider.tsx        # shared MapLibre instance/config
    QueryProvider.tsx       # React Query client
    ThemeProvider.tsx
  hooks/
    useLiveTrainStatus.ts   # wraps React Query polling for a train
    useRouteGeometry.ts
    useElevationProfile.ts
    useWeatherAlongRoute.ts
    useNearbyPOIs.ts
    useFavourites.ts
    useRecentSearches.ts
    useMapFollowMode.ts
    useConnectivity.ts       # online/offline detection + reachability ping
    useOfflineSnapshot.ts    # read/write cached Journey payloads to IndexedDB (§3.6.A)
    useGpsTracking.ts        # opt-in device GPS + offline route snapping (§3.6.B)
  store/
    uiStore.ts          # Zustand: follow mode, active tab, theme
    userDataStore.ts     # Zustand + persist: favourites, recents
  offline/
    db.ts               # IndexedDB wrapper (idb) — journeys, route/POI/elevation blobs, GTFS-static dataset
    serviceWorker.ts     # Workbox config: app shell, map tile caching, background dataset sync
  components/
    search/
    home/
    journey/
      map/
      analytics/
      weather/
      route/
    shared/           # Button, Card, Sheet, Modal, Skeleton, StatTile, AnimatedCounter
  utils/
    geo.ts             # Turf.js wrappers: buffer, distance, snapToLine, sampleAlongLine
    format.ts          # distance/time/delay formatting
    delay.ts           # delay classification (on-time/minor/major) + color mapping
    eta.ts              # ETA calculation helpers
  pages/ (route-level components)
```

### 6.4 Backend Folder Structure

```
server/
  src/
    modules/
      trains/       # RailRadar proxy + normalization + caching
      weather/       # OpenWeather proxy + caching
      elevation/     # OpenTopography proxy + caching
      poi/           # Overpass proxy + caching + categorization
      journey/       # composed endpoint: merges train+weather+elevation+poi into one Journey payload
      offlineDataset/ # serves versioned GTFS-static-like station/schedule bundles for offline GPS mode
    common/
      cache/         # Redis/LRU cache client
      http/          # resilient fetch client (timeout, retry, circuit breaker)
      config/
    server.ts
```

### 6.5 Reusable Hooks & Utilities (highlights)
- `useLiveTrainStatus(trainNumber, date)` — polling, backoff on backgrounding, exposes `status`, `isStale`, `lastUpdated`.
- `useMapFollowMode(mapRef, position)` — encapsulates follow/pan-detach/recenter logic.
- `useAnimatedCounter(value, durationMs)` — shared across all analytics stat tiles.
- `geo.snapToLine(point, lineString)` — Turf-based snapping for noisy GPS pings.
- `delay.classify(minutes)` → `{ level: 'onTime' | 'minor' | 'major', color }`.
- `useOfflineSnapshot(trainNumber, date)` — reads/writes the IndexedDB journey cache; returns `{ snapshot, isFromCache, cachedAt }` for the offline-banner UI.
- `useGpsTracking(trainNumber)` — wraps the browser Geolocation API + offline route dataset lookup; returns `{ estimatedStatus, distanceFromRouteKm, isPermissionGranted }`.

---

## 7. API Design

All client calls hit **our BFF**, never third-party APIs directly. Each BFF endpoint below wraps one or more upstream providers.

### 7.1 `GET /api/trains/search?q=`
- **Purpose:** train number/name search/autocomplete.
- **Upstream:** RailRadar search endpoint (or local static train-list index cached at build/deploy time for instant fuzzy match, falling back to RailRadar for freshness).
- **Response:** `{ results: [{ trainNumber, name, origin, destination }] }`
- **Errors:** 400 invalid query; 502 upstream failure → client shows generic "search unavailable" with retry.
- **Caching:** train metadata (number/name/route) is near-static → cache 24h.
- **Retry:** 1 retry with 500ms backoff on 5xx.

### 7.2 `GET /api/journey/:trainNumber?date=`
- **Purpose:** composed "everything for the Journey screen" payload — live position, status, route geometry, nearby weather, station timeline.
- **Request flow:** BFF fans out in parallel to RailRadar (live status + route), OpenWeather (current/next/destination station), reads cached elevation/POI if present (else triggers async population); merges into one response so the client makes a single request per poll.
- **Response (shape):**
```json
{
  "train": { "number": "12951", "name": "Mumbai Rajdhani", "date": "2026-08-01" },
  "status": { "state": "RUNNING", "delayMinutes": 12, "currentStation": "...", "nextStation": "...", "etaNextStation": "2026-08-01T14:32:00+05:30", "lastUpdated": "..." },
  "position": { "lat": 0, "lng": 0, "bearing": 0 },
  "progress": { "distanceCoveredKm": 412, "distanceTotalKm": 663, "percentComplete": 62.1 },
  "route": { "geometry": "GeoJSON LineString (cached ref or inline for short routes)", "stations": [ ... ] },
  "weather": { "current": {...}, "next": {...}, "destination": {...} }
}
```
- **Errors:** 404 train/date not found; 409-style soft state for "not yet running"/"completed" (modeled as a `status.state` enum, not an HTTP error, since it's a valid product state).
- **Caching:** 20–25s server-side cache keyed by `trainNumber:date`.
- **Retry:** client (React Query) retries failed polls with exponential backoff; BFF itself does 1 retry per upstream call before failing that sub-piece gracefully (partial-degrade: e.g., return status without weather if weather upstream fails, rather than failing the whole request).

### 7.3 `GET /api/journey/:trainNumber/elevation?date=`
- **Purpose:** elevation profile along the route.
- **Upstream:** OpenTopography, sampled at N points generated via Turf.js `along()`/`lineChunk()` over the route geometry.
- **Response:** `{ points: [{ distanceKm, elevationM }], peak: { distanceKm, elevationM, nearestStation } }`
- **Caching:** cached indefinitely per route hash (route geometry doesn't change day to day for a given train).
- **Retry:** 2 retries with backoff (OpenTopography can be slow); degrade to omitting chart section on failure.

### 7.4 `GET /api/journey/:trainNumber/nearby?date=`
- **Purpose:** POIs along the route (rivers, mountains, bridges, monuments, cities).
- **Upstream:** Overpass API, queried against a Turf.js buffer polygon around the route line.
- **Response:** `{ categories: { rivers: [...], mountains: [...], bridgesTunnels: [...], monuments: [...], cities: [...] } }`
- **Caching:** cached indefinitely per route hash; background-refreshed rarely (e.g., monthly) since OSM data changes slowly.
- **Retry:** 1 retry, 8s timeout, then omit category gracefully (never blocks the rest of the journey payload).

### 7.5 `GET /api/share/:trainNumber?date=`
- **Purpose:** resolves a shared-link view; effectively same as 7.2 but served without requiring the requester to have searched — used by the public Shared Journey screen.
- **Caching/Retry:** identical to 7.2.

### 7.6 `GET /api/offline-dataset/manifest`
- **Purpose:** powers §3.6.B — lets the client know which offline route/schedule bundles exist and their current version, so the Service Worker can sync only what's changed.
- **Request flow:** returns a lightweight manifest `{ version, trains: [{ trainNumber, routeHash, updatedAt }] }`; client diffs against its locally-stored versions and fetches only stale/missing bundles via `GET /api/offline-dataset/:trainNumber`.
- **Response (bundle):** `{ trainNumber, stations: StationStop[], routeGeometry: GeoJSON.LineString, scheduleVersion }` — deliberately excludes anything live (no position/delay), since this is the static reference data GPS mode snaps against.
- **Errors:** 404 if a requested train has no offline bundle available (rare/unlisted trains) — client surfaces the §3.6.B "GPS mode unavailable for this train" copy.
- **Caching:** manifest cached client-side with a short TTL (e.g., 1h) so periodic background syncs stay cheap; individual bundles cached indefinitely until `scheduleVersion` changes.
- **Retry:** background sync only, silent retry with backoff; never blocks foreground UI.

---

## 8. Data Models

```ts
interface Train {
  trainNumber: string;      // e.g., "12951"
  name: string;              // e.g., "Mumbai Rajdhani"
  origin: Station;
  destination: Station;
}

interface Station {
  code: string;               // e.g., "NDLS"
  name: string;
  lat: number;
  lng: number;
}

type TrainRunState = 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'NO_DATA';

interface LiveStatus {
  trainNumber: string;
  journeyDate: string;        // ISO date
  state: TrainRunState;
  delayMinutes: number;       // negative = early
  currentStation: Station | null;
  nextStation: Station | null;
  etaNextStation: string | null; // ISO datetime
  lastUpdated: string;        // ISO datetime
  position: { lat: number; lng: number; bearingDeg: number } | null;
}

interface JourneyProgress {
  distanceCoveredKm: number;
  distanceTotalKm: number;
  percentComplete: number;
  averageSpeedKmh: number | null;
}

interface RouteGeometry {
  trainNumber: string;
  geometry: GeoJSON.LineString;
  stations: StationStop[];
}

interface StationStop {
  station: Station;
  scheduledArrival: string | null;
  scheduledDeparture: string | null;
  actualArrival: string | null;
  actualDeparture: string | null;
  distanceFromOriginKm: number;
  platform: string | null;
}

interface WeatherSnapshot {
  stationCode: string;
  temperatureC: number;
  condition: string;
  humidityPct: number;
  windKmh: number;
  rainProbabilityPct: number | null;
  fetchedAt: string;
}

interface ElevationProfile {
  points: { distanceKm: number; elevationM: number }[];
  peak: { distanceKm: number; elevationM: number; nearestStationCode: string };
}

type POICategory = 'RIVER_LAKE' | 'MOUNTAIN_GHAT' | 'BRIDGE_TUNNEL' | 'MONUMENT' | 'CITY_DISTRICT';

interface POI {
  id: string;
  category: POICategory;
  name: string;
  lat: number;
  lng: number;
  distanceFromRouteKm: number;
}

interface FavouriteTrain {
  trainNumber: string;
  addedAt: string;
}

interface RecentSearch {
  trainNumber: string;
  searchedAt: string;
}

// --- Offline (§3.6) ---

interface CachedJourneySnapshot {
  trainNumber: string;
  journeyDate: string;
  payload: JourneyResponse;   // the full composed §7.2 response, stored verbatim
  cachedAt: string;           // ISO datetime this snapshot was last written
}

interface OfflineRouteBundle {
  trainNumber: string;
  routeGeometry: GeoJSON.LineString;
  stations: StationStop[];    // scheduled times only — no live/actual data
  scheduleVersion: string;
  syncedAt: string;
}

interface GpsEstimatedStatus {
  trainNumber: string;
  snappedPosition: { lat: number; lng: number };
  distanceFromRouteKm: number;
  nearestStation: Station;
  estimatedDelayMinutes: number;
  estimatedAt: string;
  source: 'ON_DEVICE_GPS';    // discriminates from server-derived LiveStatus in the UI layer
}
```

**Persistence (MVP):** `FavouriteTrain[]` and `RecentSearch[]` persisted client-side (`localStorage` via Zustand persist middleware). **Post-MVP:** move to backend-owned `users`, `favourites`, `recent_searches` tables once accounts ship (Postgres: `user_id`, `train_number`, `created_at`, unique constraint on `(user_id, train_number)` for favourites, capped-length recency table or a simple ring-buffer approach for recents).

**Offline persistence:** `CachedJourneySnapshot` and `OfflineRouteBundle` are stored in IndexedDB (not `localStorage`, given payload size and the need for indexed lookup by `trainNumber:journeyDate`), LRU-evicted at 20 cached journeys (§3.6.A). `GpsEstimatedStatus` is computed in-memory on-device and never persisted server-side unless the user opts in to crowdsourced upload (§3.6.B, post-MVP).

---

## 9. Component Inventory

**Shared/UI primitives:** `Button`, `IconButton`, `Card`, `Sheet` (bottom sheet), `Modal`, `Skeleton`, `Badge/Pill` (status colors), `StatTile`, `AnimatedCounter`, `SegmentedControl`, `Toast`, `EmptyState`, `ErrorState`, `Avatar/Icon` set.

**Search/Home:** `SearchBar`, `TrainResultCard`, `RecentSearchRow`, `FavouriteTrainCard`, `FavouritesRow`, `RecentSearchesList`.

**Journey — Map:** `MapCanvas`, `TrainMarker`, `RouteLine` (completed/remaining variants), `StationMarker`, `MapControls` (zoom/recenter/pitch), `JourneyHeader` (glass card), `FollowModeToggle`, `ShareButton`.

**Journey — Analytics:** `AnalyticsPanel`, `CompletionRing`, `DelaySparkline`, `DistanceStatTile`, `ElevationChart`, `JourneyTimeline`, `TimelineStationRow`.

**Journey — Weather/Nearby:** `WeatherCard`, `WeatherStrip`, `RainForecastStrip`, `POICardRow`, `POICard`, `NearbyMapLayerToggle`.

**Journey — Route Details:** `RouteStationTable` (desktop), `RouteStationList` (mobile).

**Offline (§3.6):** `OfflineBanner` (persistent "showing status from X ago" strip), `GpsTrackingToggle`, `SourceBadge` (Live / Cached / Estimated indicator), `OfflineUnavailableEmptyState`, `ManageOfflineTrainsList` (Settings).

**Layout/Navigation:** `AppShell`, `BottomTabBar`, `Sidebar`, `PageContainer`, `BottomSheetContainer`.

---

## 10. Performance Strategy

- **Code splitting:** route-based (`React.lazy`) — Home/Search bundle separate from Journey (map+charts) bundle.
- **Lazy loading:** map library (MapLibre) and chart library loaded only when Journey screen mounts; map tiles loaded on-demand per viewport.
- **Memoization:** `React.memo` on list-heavy components (`TrainResultCard`, `POICard`, `TimelineStationRow`); `useMemo` for derived geometry (buffers, route bounds) so Turf.js recomputation doesn't run every render.
- **Image optimization:** SVG icons for markers/UI (scale-independent, tiny); any raster assets served via responsive `srcset` and compressed (WebP/AVIF).
- **API caching:** React Query cache tuned per data volatility (30s live status, 15min weather, effectively-infinite route/elevation/POI) — see §6.2/§7.
- **Debouncing:** search input debounced 300ms before firing autocomplete requests.
- **Virtualization:** `RouteStationTable`/`RouteStationList` virtualized (e.g., via `@tanstack/react-virtual`) for long routes (some trains have 40+ stops).
- **Infinite scroll:** not core to MVP scope (no long feed), but Recent Searches list paginates/truncates at 10 with "clear all" rather than infinite scroll.
- **Marker animation efficiency:** interpolate train position client-side between polls using `requestAnimationFrame`, not by re-rendering React on every frame — drive the MapLibre marker's coordinates imperatively.

---

## 11. Security

- **Authentication:** MVP is anonymous/no-login (favourites/recents local-only). Architecture leaves a clean seam for adding auth (email/OTP or OAuth) later without reworking data flow — the BFF's `journey`/`trains` endpoints are already stateless and user-agnostic.
- **Authorization:** N/A in MVP (no user-owned server data). Post-MVP: favourites/recents scoped strictly to the authenticated user; standard JWT/session-based authorization on the BFF.
- **Input validation:** all query params (train number, date, search query) validated server-side (schema validation, e.g., Zod) before hitting upstream providers — prevents injection into upstream query strings and malformed-request abuse.
- **API security:** all third-party API keys (RailRadar, MapTiler, OpenWeather, OpenTopography) live server-side only, never exposed to the client bundle; BFF is the sole caller of upstream services.
- **Environment variables:** all secrets via `.env` (server) + secret manager in production (never committed); client build only ever receives public, non-sensitive config (e.g., public MapTiler style URL if it's a non-sensitive public key tier).
- **Rate limiting:** BFF applies per-IP rate limiting (e.g., token bucket, ~60 req/min general, tighter on search) to protect shared upstream quotas (especially Overpass and OpenWeather free tiers) and to mitigate scraping/abuse.
- **Transport:** HTTPS-only, HSTS; CORS restricted to known app origins.
- **Location data (§3.6.B):** device GPS coordinates are processed on-device only in MVP and never transmitted to the server by default — the opt-in crowdsourced upload (post-MVP) requires explicit, separately-worded consent (distinct from the location-permission prompt itself) before any position trace leaves the device.

---

## 12. Accessibility

- Follow WCAG 2.1 AA where feasible for a map-heavy product:
  - Color is never the sole indicator of status — delay pills pair color with text/icon ("On Time" / "+12 min").
  - All interactive controls (map zoom/recenter/pitch, share, favourite-star) have accessible labels and are keyboard-reachable on desktop.
  - Sufficient contrast for text over the light app chrome (WCAG AA contrast ratios for body text/buttons); map itself is exempt (rendered imagery) but overlay chrome (header, sheet) meets contrast requirements against the dark map background via scrim/blur.
  - Animated counters and marker motion respect `prefers-reduced-motion` (fall back to instant value updates / non-animated marker jumps).
  - Skeleton loaders use `aria-busy`/`aria-live="polite"` region for status changes (e.g., "Live status updated") so screen reader users get non-visual refresh cues.
  - Charts (elevation, sparkline) include a text-equivalent summary (e.g., "Peak elevation 1,200m near Khandala") for non-visual access.
  - Touch targets ≥ 44×44px per Apple HIG / WCAG target-size guidance.

---

## 13. Development Roadmap

**Milestone 0 — Foundations (Week 1–2)**
- Project scaffolding (Vite/React/TS), design tokens from `design.md`, BFF skeleton, provider API key setup, CI.

**Milestone 1 — MVP Core: Search + Live Status (Week 3–5)**
- Train search/autocomplete, Journey screen skeleton, `/api/journey/:trainNumber` composed endpoint (status only, no weather/POI yet), live polling, status card, basic non-map fallback view.

**Milestone 2 — Immersive Map (Week 6–8)**
- MapLibre + MapTiler integration, route geometry rendering, animated train marker, follow mode, completed/remaining route styling, map controls.

**Milestone 3 — Analytics (Week 9–10)**
- Completion %, distance analytics, delay analytics/sparkline, travel timeline, elevation profile (OpenTopography + Turf integration).

**Milestone 4 — Smart Travel Companion (Week 11–12)**
- OpenWeather integration (current/next/destination), Overpass POI integration + categorized cards, map POI layer toggle.

**Milestone 5 — Premium Polish (Week 13–14)**
- Full design-system pass (white theme, animations, transitions, skeletons everywhere), Favourites + Recent Searches, Share links + public Shared Journey screen, empty/error states audit.

**Milestone 6 — Offline Mode (Week 15–16)**
- IndexedDB snapshot persistence + Service Worker tile/app-shell caching (§3.6.A), offline banner + reconnect reconciliation.
- Offline route/schedule dataset endpoint (§7.6) + on-device GPS snapping mode (§3.6.B), permission flow, source-badge UI (Live/Cached/Estimated).

**Milestone 7 — Hardening & Launch Prep (Week 17–18)**
- Caching/rate-limit hardening, accessibility pass, performance pass (bundle size, virtualization), analytics/telemetry instrumentation for success metrics, beta rollout.

**Post-MVP Roadmap**
- User accounts + server-persisted favourites/recents.
- Push notifications (delay alerts, arrival-soon alerts) — the natural next feature given "Auto Refresh Live Status" already exists.
- Premium tier (ad-free, unlimited favourites, notification alerts).
- Dark mode for app chrome (tokens already reserved).
- PNR-based booking status lookup as an adjacent feature.
- Opt-in crowdsourced upload of on-device GPS traces (§3.6.B) to improve position accuracy for other users — requires its own privacy/consent review before scoping.

---

## Appendix: External APIs Referenced
- **RailRadar** — live train position, status, route, station timings.
- **MapTiler + MapLibre GL** — vector map tiles and rendering engine.
- **OpenWeather** — current conditions and forecast.
- **OpenTopography** — elevation data along route.
- **Turf.js** — client/server geometry utilities (buffer, distance, along, snapping).
- **Overpass API** — OpenStreetMap POI queries (rivers, mountains, bridges, monuments, cities).

All third-party data usage must comply with each provider's attribution and licensing terms (notably OpenStreetMap/Overpass ODbL attribution, displayed in Settings/About).
