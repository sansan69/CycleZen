# CycleZen v2 — Complete Redesign & Improvement Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan phase by phase.

**Goal:** Transform CycleZen from a monolithic prototype into a production-grade, feature-rich cycling app that competes with Komoot/RideWithGPS.

**Architecture:** Feature-based Next.js 15 App Router with Server Components, Zustand + TanStack Query for state, Firebase for auth/storage, with modular service layer.

**Tech Stack:** Next.js 15, React 18, TypeScript (strict), Tailwind CSS 4, shadcn/ui, Zustand, TanStack Query, Firebase Auth + Firestore, OpenRouteService API, Google Maps API

---

## 🔍 Issues Found — Complete Audit

### 🔴 Critical — Architecture

| # | Issue | File(s) | Impact |
|---|-------|---------|--------|
| 1 | **1210-line monolithic page component** | `src/app/page.tsx` | Impossible to maintain, test, or reuse |
| 2 | **All business logic in UI components** | All page files | No separation of concerns |
| 3 | **Duplicate code everywhere** | 3 page files | `formatTime`, `onMapLoad`, `useJsApiLoader` duplicated 3x |
| 4 | **Two map providers (Google + Mapbox)** | `google-map.tsx`, `map.tsx` | Redundant dependency, Mapbox unused |
| 5 | **No custom hooks** | All files | Logic not reusable or testable |
| 6 | **No API/service layer** | — | Firebase calls spread across components |
| 7 | **No TypeScript strict mode** | `next.config.ts:7` | `ignoreBuildErrors: true` hides real bugs |

### 🟠 High — Code Quality

| # | Issue | Impact |
|---|-------|--------|
| 8 | **30+ verbose console.log in production code** | `firebase.ts` alone has 37 log statements |
| 9 | **Zero tests** | No unit, integration, or e2e tests |
| 10 | **No error boundaries** | Any uncaught error crashes the app |
| 11 | **Inconsistent error handling** | Mix of toast, throw, console.error |
| 12 | **Magic numbers everywhere** | Zoom levels, timeout durations, calorie constants |
| 13 | **Commented-out code** | Profile page has avatar section commented |
| 14 | **Inconsistent naming** | `onAuthUserChanged` vs `firebaseOnAuthStateChanged` |
| 15 | **No loading skeleton consistency** | Each page implements its own |

### 🟡 Medium — Performance

| # | Issue | Impact |
|---|-------|--------|
| 16 | **Google Maps API loaded 3x independently** | Wastes API quota, slows page loads |
| 17 | **No code splitting** | Entire app bundle loaded upfront |
| 18 | **No memoization** | Map re-renders on every parent state change |
| 19 | **No image optimization** | No next/image usage |
| 20 | **No debouncing on slider** | Radius change fires on every pixel |

### 🟢 Low-Medium — UX/Features

| # | Issue | Current State | Industry Standard |
|---|-------|---------------|-------------------|
| 21 | **Hardcoded LA default** | Map defaults to Los Angeles | Auto-detect or ask user |
| 22 | **Naive calorie calc** | 60 cal/km constant | Weight × MET × duration |
| 23 | **No difficulty classification** | Always "Moderate" | Elevation %, surface type, distance |
| 24 | **No weather integration** | Not present | Komoot shows weather along route |
| 25 | **No GPX export** | Only Google Maps link | Industry standard format |
| 26 | **No offline maps** | Requires connectivity | Komoot/RideWithGPS core feature |
| 27 | **No route surface detection** | Always "Primarily Road" | OSM surface tags available |
| 28 | **Placeholder PWA icons** | `placehold.co` URLs | Needs real icon set |
| 29 | **No dark mode toggle** | CSS vars exist, no UI | Expected in 2025 |
| 30 | **No social sharing as image** | Only URL copy | Route card image sharing |
| 31 | **No segment/achievement system** | Just save/complete | Strava's core engagement driver |
| 32 | **No training metrics** | No FTP, zones, TSS | Expected by serious cyclists |

### ⚪ Security

| # | Issue |
|---|-------|
| 33 | No CSP headers configured |
| 34 | No rate limiting on route generation |
| 35 | No input sanitization beyond zod |
| 36 | API keys exposed to client (standard for Next.js but needs CSP) |

---

## 🏗️ Redesign — New Architecture

### Folder Structure

```
cyclezen/
├── src/
│   ├── app/                          # Next.js App Router (routes only)
│   │   ├── layout.tsx                # Root layout with providers
│   │   ├── page.tsx                  # Home — thin, delegates to features
│   │   ├── dashboard/page.tsx
│   │   ├── saved-routes/page.tsx
│   │   ├── profile/page.tsx
│   │   └── api/                      # API routes (rate limiting, proxy)
│   │       └── routes/route.ts
│   ├── features/                     # Feature-based modules
│   │   ├── map/
│   │   │   ├── components/
│   │   │   │   ├── MapContainer.tsx
│   │   │   │   ├── LocationPicker.tsx
│   │   │   │   └── RoutePolyline.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useGoogleMaps.ts
│   │   │   │   ├── useGeolocation.ts
│   │   │   │   └── useMapBounds.ts
│   │   │   └── index.ts
│   │   ├── route-generation/
│   │   │   ├── components/
│   │   │   │   ├── RouteGenerator.tsx
│   │   │   │   ├── RadiusSlider.tsx
│   │   │   │   └── RouteCard.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useRouteGeneration.ts
│   │   │   ├── services/
│   │   │   │   └── open-route-service.ts
│   │   │   └── index.ts
│   │   ├── ride-mode/
│   │   │   ├── components/
│   │   │   │   ├── RideTracker.tsx
│   │   │   │   ├── RideSummary.tsx
│   │   │   │   └── LiveMap.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useRideTimer.ts
│   │   │   │   └── useRideTracking.ts
│   │   │   └── index.ts
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   └── AuthButton.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.ts
│   │   │   ├── services/
│   │   │   │   └── auth-service.ts
│   │   │   └── store.ts              # Zustand auth store
│   │   ├── routes/                   # Saved routes management
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   ├── dashboard/                # Stats, history
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── index.ts
│   │   ├── profile/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── index.ts
│   │   └── weather/                  # NEW: Weather integration
│   │       ├── components/
│   │       │   └── WeatherWidget.tsx
│   │       ├── services/
│   │       │   └── weather-service.ts
│   │       └── index.ts
│   ├── shared/                       # Shared across features
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui components
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── LoadingSkeleton.tsx
│   │   │   └── EmptyState.tsx
│   │   ├── hooks/
│   │   │   ├── useDebounce.ts
│   │   │   └── useMediaQuery.ts
│   │   ├── lib/
│   │   │   ├── utils.ts              # cn(), formatTime(), etc.
│   │   │   ├── constants.ts          # Zoom levels, defaults
│   │   │   ├── calories.ts           # Calorie calculation
│   │   │   └── difficulty.ts         # Route difficulty classification
│   │   ├── services/
│   │   │   ├── firebase.ts           # Clean, minimal init
│   │   │   └── logger.ts            # Environment-aware logging
│   │   └── types/
│   │       └── index.ts              # Shared type definitions
│   └── stores/                       # Global Zustand stores
│       ├── app-store.ts              # Theme, preferences
│       └── index.ts
├── tests/                            # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── public/
│   ├── icons/                        # Real PWA icons
│   └── manifest.json
```

### Component Architecture

```
┌─────────────────────────────────────────┐
│              RootLayout                   │
│  ┌─────────────────────────────────────┐ │
│  │  Providers (QueryClient, Zustand)   │ │
│  │  ┌─────────────────────────────┐    │ │
│  │  │        Page (thin)           │    │ │
│  │  │  ┌───────┐ ┌──────────────┐ │    │ │
│  │  │  │ Header │ │ <Feature/>   │ │    │ │
│  │  │  └───────┘ │              │ │    │ │
│  │  │            │ ┌──────────┐ │ │    │ │
│  │  │            │ │ Map      │ │ │    │ │
│  │  │            │ └──────────┘ │ │    │ │
│  │  │            │ ┌──────────┐ │ │    │ │
│  │  │            │ │ Controls │ │ │    │ │
│  │  │            │ └──────────┘ │ │    │ │
│  │  │            │ ┌──────────┐ │ │    │ │
│  │  │            │ │ Routes   │ │ │    │ │
│  │  │            │ └──────────┘ │ │    │ │
│  │  │            └──────────────┘ │    │ │
│  │  └─────────────────────────────┘    │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Data Flow

```
User Action → Zustand Store → React Query → API/Service → Firebase/ORS
                    ↓
              Optimistic Update → Re-render UI
                    ↓
              Server Sync → Invalidate Query → Re-fetch
```

### State Management Strategy

| State Type | Tool | Example |
|------------|------|---------|
| Server state | TanStack Query | Routes, rides, profile data |
| Client/UI state | Zustand | Auth user, theme, selected location |
| Form state | React Hook Form + Zod | Profile form, route search |
| URL state | useSearchParams | Route filters, view mode |
| Local state | useState | Component-specific UI toggle |

---

## 📋 Implementation Plan — 5 Phases

### Phase 1: Foundation & Cleanup (Week 1)

**Objective:** Establish project structure, fix critical issues, add guardrails.

#### Task 1.1: Project restructuring
- Create feature-based folder structure as designed above
- Move existing code into appropriate feature modules
- Extract shared utilities (formatTime, cn, constants)

#### Task 1.2: TypeScript strict mode
- Enable strict: true in tsconfig.json
- Remove `ignoreBuildErrors` from next.config.ts
- Fix all type errors
- Add proper return types to all functions

#### Task 1.3: Logger service
- Create environment-aware logger (dev=console, prod=silent)
- Replace all 37+ console.log with logger calls
- Add log levels (debug, info, warn, error)

#### Task 1.4: Error boundaries
- Create `<ErrorBoundary>` for route sections
- Create `<MapErrorBoundary>` for map failures
- Add fallback UI for each boundary

#### Task 1.5: Centralize constants
- Extract all magic numbers to `shared/lib/constants.ts`
- Map defaults, zoom levels, timeouts, limits
- Calorie MET values, difficulty thresholds

#### Task 1.6: Remove Mapbox dependency
- Remove `mapbox-gl` from package.json
- Delete `src/components/map.tsx`
- Clean up unused imports

#### Task 1.7: Centralize Google Maps loading
- Single `useGoogleMaps` hook in features/map
- Share across all pages
- Cache map instance

#### Task 1.8: Add tests infrastructure
- Set up Vitest + React Testing Library
- Add test for formatTime, calories, difficulty utils
- Add `npm run test` and `npm run test:watch` scripts

---

### Phase 2: State Management & Data Layer (Week 2)

**Objective:** Introduce proper state management, separate concerns.

#### Task 2.1: Zustand stores
- `useAuthStore` — user, loading, login/logout actions
- `useAppStore` — theme, preferences
- `useRouteStore` — selectedLocation, radius, generated routes

#### Task 2.2: TanStack Query setup
- Wrap app in `<QueryClientProvider>`
- Create query keys factory
- Replace direct Firestore calls with queries

#### Task 2.3: Refactor auth flow
- Extract auth logic from page.tsx to `features/auth/`
- Create `useAuth` hook wrapping Zustand + Firebase
- Add loading/error states

#### Task 2.4: Service layer
- Create `features/routes/services/route-firestore-service.ts`
- Create `features/dashboard/services/ride-history-service.ts`
- All Firestore operations go through services
- Components never call Firebase directly

#### Task 2.5: Custom hooks extraction
- Extract `useRouteGeneration` from page.tsx
- Extract `useRideTimer` from RouteDisplay
- Extract `useRideTracking` with location watch
- Extract `useGeolocation` with permission handling

---

### Phase 3: Feature Improvements (Week 3)

**Objective:** Add new features matching industry standards.

#### Task 3.1: Route difficulty classification
- Use elevation gain / distance ratio
- Consider route length
- Output: Easy / Moderate / Hard / Expert
- Replace hardcoded "Moderate" label

#### Task 3.2: Improved calorie calculation
- Use weight × MET × hours formula
- MET value: 8.0 (moderate cycling), 10.0 (vigorous)
- Let user set weight in profile
- Default to 70kg if not set

#### Task 3.3: Weather integration
- Add OpenWeatherMap API service
- Show weather for route start location
- Display: temp, wind, precipitation
- Warning badges: "Strong headwind", "Rain expected"

#### Task 3.4: GPX export
- Generate GPX XML from route coordinates
- Download as `.gpx` file
- Include elevation data
- Match Strava/Komoot import format

#### Task 3.5: Route surface detection
- Use OSM surface tags via Overpass API
- Classify: Road / Gravel / Mixed / Trail
- Display surface type on route cards
- Allow filtering by surface preference

#### Task 3.6: Dark mode toggle
- Add theme switcher to header
- Persist preference to localStorage + Zustand
- Respect system preference by default

---

### Phase 4: Performance & UX (Week 4)

**Objective:** Optimize, polish, and add PWA readiness.

#### Task 4.1: Code splitting
- `dynamic(() => import(...))` for map component
- Lazy load route cards with skeleton
- Lazy load dashboard charts

#### Task 4.2: Performance optimization
- `React.memo` on RouteCard, RouteDisplay
- `useMemo` for expensive computations
- `useCallback` for event handlers
- Debounce radius slider (300ms)

#### Task 4.3: Image optimization
- Replace placeholder PWA icons with real icon set
- Create proper app icon (192px, 512px, maskable)
- Add splash screen configuration

#### Task 4.4: Loading states
- Consistent `<Skeleton>` patterns across all pages
- `<EmptyState>` component for zero-data views
- `<MapSkeleton>` for map loading
- Suspense boundaries for async content

#### Task 4.5: Accessibility
- Add aria-labels to interactive elements
- Ensure keyboard navigation on map controls
- Color contrast audit (teal #008080 on white = good)
- Focus management for dialogs

#### Task 4.6: Route card image sharing
- Generate route card as image using html2canvas
- Add "Share as Image" button
- Include route stats + mini-map preview

---

### Phase 5: Advanced Features (Week 5+)

**Objective:** Differentiating features for power users.

#### Task 5.1: Elevation profile chart
- Recharts elevation profile on route detail
- Show grade % at steepest sections
- Interactive hover for point details

#### Task 5.2: Route segments & achievements
- Track personal bests on repeated routes
- "Fastest climb", "Longest ride", "Weekly warrior"
- Achievement badges on dashboard

#### Task 5.3: AI route recommendations
- Use existing Genkit + Gemini setup
- Analyze saved routes for preferences
- Suggest routes matching user's style
- "Since you liked X, try Y"

#### Task 5.4: Live tracking & sharing
- WebSocket/Realtime DB for live location
- Share live ride link with friends
- ETA and current speed display
- Safety check-in prompts

#### Task 5.5: Training metrics
- FTP estimation from ride data
- Weekly TSS (Training Stress Score)
- Training load chart on dashboard
- Recovery recommendations

---

## 📊 Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| page.tsx size | 1210 lines | <200 lines |
| Duplicated code blocks | 6+ | 0 |
| Test coverage | 0% | >80% |
| TypeScript errors hidden | Yes (ignoreBuildErrors) | No |
| Console.log in prod | 37+ locations | 0 (logger only) |
| Map providers | 2 (Google + Mapbox) | 1 (Google) |
| User-calibrated calories | No (60 cal/km) | Yes (weight × MET) |
| Route surface info | Hardcoded "Road" | Real OSM data |
| GPX export | No | Yes |
| Weather on route | No | Yes |
| Dark mode | No | Yes |
| PWA icons | Placeholder URLs | Real icons |

---

## 🚦 Risk Assessment

| Risk | Mitigation |
|------|------------|
| Migration breaks existing features | Per-feature migration, test each module |
| OpenRouteService rate limits | Cache results, add retry logic |
| Firestore costs increase | Query optimization, pagination |
| API key exposure | CSP headers, API route proxy |
| Mobile browser compatibility | Progressive enhancement, feature detection |

---

## 📦 Dependency Changes

### Remove
```json
"mapbox-gl": "*"              // Unused map provider
```

### Add
```json
"zustand": "^5.0"             // State management
"@tanstack/react-query": "^5" // Server state
"vitest": "^2.0"              // Testing
"@testing-library/react": "^16"
"xml2js": "^0.6"              // GPX generation
```

### Upgrade
```
next: 15.2.3 → 15.x latest
react: 18.x → 19.x (when stable for Next.js)
```

---

> **Ready to implement?** Start with Phase 1 to establish the foundation, then proceed phase by phase. Each phase is independently shippable and testable.
