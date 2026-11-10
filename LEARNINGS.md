# Engineering Learnings & Architecture Decision Records (ADRs)

This document is the living knowledge base for DPM (Daily Production Manager), recording library audits, technical decisions, edge cases, and architectural discoveries.

---

## 2026-11-08 — Core Design Tokens & Error Foundation (Item 01)

**Goal:** Establish systematic design tokens in `DESIGN.md`, create accessible `<Button />` with double-click and loading locks, build typed `AppError` model, and `<ErrorBoundary />` with retry capability.

### Libraries evaluated

| Library | Maintained? | License | Size | Verdict | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **sonner** | Yes (v2.0.8, active) | MIT | ~4kB | **Selected** | Lightweight, accessible, supports promise toasts, zero heavy CSS overhead, native Next.js/React 19 support. |
| **react-toastify** | Yes (v10) | MIT | ~16kB | Rejected | Much larger bundle size, bulky default styles that conflict with DaisyUI. |
| **lucide-react** | Yes (v0.475) | ISC | Tree-shakable | **Selected** | Crisp SVG icons, accessible, standard in modern clean UI, already in project. |
| **react-icons** | Yes | MIT | >30kB | Rejected | Massive sub-bundles, inconsistent SVG sizing across icon sets. |
| **zod** | Yes (v3.24) | MIT | ~12kB | **Selected** | Robust TypeScript inference, runtime validation for forms, APIs, and env vars. |
| **superstruct / yup** | Yes | MIT | Variable | Rejected | Zod already integrated across Drizzle schema mutations and Better Auth. |
| **@testing-library/user-event** | Yes (v14.6) | MIT | Dev | **Selected** | Dispatches full browser event lifecycle (focus, click, keydown/keyup), critical for button testing. |

### Reference files studied

- `src/components/ui/stepper-input.tsx` — Learned how DaisyUI join-items and touch targets are structured in this codebase.
- `src/app/globals.css` — Audited existing CSS variables and DaisyUI color themes.
- `agent.md` Sections 4–7 — Studied strict accessibility, motion ceilings (≤ 250ms), and error recovery contracts.

### Edge cases & gotchas discovered

- In Next.js 15, route segment configuration (e.g. `export const dynamic = "force-dynamic"`) must only be placed in Server Components, never in `"use client"` files. Placing it in client files causes webpack prerender crashes.
- Client bundles must never import server-only packages (e.g., `@better-auth/core/error`). Pure types and metadata should live in client-safe files (`rbac-types.ts`), while server access control logic stays in server modules (`rbac.ts`).
- Rapid multi-clicks on submit buttons without async lockouts cause race conditions and duplicate database transactions. The `<Button />` primitive must enforce in-flight locking and debounce protection.
- DOM tests using `@testing-library/react` without automated `cleanup()` between `it()` blocks can leak rendered nodes, causing `getByRole` to find multiple elements.

### Decision

1. Adopt `sonner` as the centralized toast notifications engine.
2. Structure all design constants in `DESIGN.md` using semantic tokens (surfaces, typography, shadows, radii, motion) matching DaisyUI light theme tokens.
3. Build `<Button />` with polymorphic element support (`asChild` or button tag), explicit variants, accessible roles (`aria-busy`), touch targets (≥ 44px min-height for touch), and automatic double-invocation blocking.
4. Centralize error handling in `src/lib/errors.ts` using `AppError` with error codes, HTTP status mapping, user-facing safe translations, and retryability flags.
5. Provide `<ErrorBoundary />` with error boundary isolation, diagnostic logging, and a user-friendly retry button.

### Follow-ups

- Wire `<Button />` and `<ErrorBoundary />` across existing factory and admin screens in Item 03.
- Connect API fetch wrappers with `AppError` in Item 02.

---

## 2026-11-08 — Resilient API & State Layer (Item 02)

**Goal:** Build a robust, typed API client and query hook with AbortController, request timeouts, exponential backoff with jitter for idempotent operations, Zod schema validation, and complete AppError translation.

### Libraries evaluated

| Library | Maintained? | License | Size | Verdict | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TanStack Query (v5)** | Yes (v5.66) | MIT | ~13kB | Rejected | Heavy for this architecture; DPM relies on Next.js 15 Server Components and Server Actions for 95% of data fetching and mutations. Adding QueryClientProvider and hydration creates unnecessary overhead. |
| **SWR (v2)** | Yes (v2.3) | MIT | ~4.5kB | Rejected | Still requires global context and configuration; does not natively integrate with our central `AppError` taxonomy or Zod schemas out of the box. |
| **Custom `apiClient` + `useApiQuery`** | Maintained internally | MIT | 0kB ext | **Selected** | Zero external dependencies; leverages native `fetch` + `AbortController`; strict TypeScript generic inference; native Zod validation; automated exponential backoff with full jitter on idempotent calls (GET/PUT/DELETE); 100% integrated with `AppError`. |
| **ky** | Yes (v1.7) | MIT | ~3.5kB | Evaluated | Good fetch wrapper, but custom client with our exact error contracts and backoff jitter formula provides tighter coupling to `AppError` without extra runtime dependencies. |

### Reference files studied

- `src/lib/errors.ts` — Leveraged typed error constructors (`AppError.network`, `AppError.timeout`, `AppError.validation`, `AppError.fromHttpStatus`).
- `agent.md` Section 6 — Implemented the 4 required async states (loading, success, empty, error), cancellation on unmount, and backoff with jitter for idempotent calls only.

### Edge cases & gotchas discovered

- Retrying non-idempotent operations (POST / PATCH) by default can result in duplicate payments or duplicate database records. Automatic retries must strictly guard against non-idempotent methods unless the caller explicitly flags `idempotent: true`.
- Native `AbortSignal.timeout()` is supported in Node 18+ and modern browsers, but chaining with a user-supplied `signal` requires `AbortSignal.any()` or manual cleanup listeners to prevent memory leaks.
- When `fetch` fails due to network disconnection, browsers throw a generic `TypeError: Failed to fetch`. The client must inspect `navigator.onLine` and error signatures to distinguish true offline/connectivity issues from CORS or DNS failures.
- In Vitest test environments, `fetch` must be cleanable between tests, and `AbortController` timers must be handled cleanly with fake or real timers.

### Decision

1. Build `apiClient` in `src/lib/api-client.ts` supporting standard HTTP methods (`get`, `post`, `put`, `patch`, `delete`).
2. Include timeout handling via `AbortController` with configurable `timeoutMs` (default 10,000ms).
3. Implement exponential backoff with full jitter: `delay = Math.min(maxDelay, baseDelay * 2 ** attempt + Math.random() * jitterMs)`.
4. Restrict automatic retry to idempotent methods (GET, HEAD, OPTIONS, PUT, DELETE) and retryable HTTP status codes (408, 429, 500, 502, 503, 504).
5. Parse and validate JSON responses with `zod` schemas if provided, surfacing structured `AppError` validation issues.
6. Provide `useApiQuery<T>()` React hook with automatic cancellation on unmount, loading/error state tracking, and a `refetch()` function.
7. Test the client comprehensively in `src/lib/api-client.test.ts`.

### Follow-ups

- Replace raw `fetch` in `impersonation-banner.tsx` and `role-switcher.tsx` with `apiClient`.
- Add offline indicator banner when `AppError.isOffline()` is detected in Item 03.

---

## 2026-11-08 — UI Stress-Test Harness & Frictionless Control Verification (Item 03)

**Goal:** Establish systematic break-ui stress-test harness and complete every-control interactive verification checklist across all screens.

### Libraries evaluated

| Library | Maintained? | License | Size | Verdict | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **@testing-library/react** | Yes (v16.3) | MIT | Dev | **Selected** | Already configured; dispatches synthetic DOM interactions with high-fidelity accessibility assertions (`getByRole`, `aria-busy`). |
| **Playwright** | Yes (v1.50) | Apache-2.0 | Heavy | Complementary | Ideal for full-browser end-to-end journeys; happy-dom unit/component harness selected for fast automated CI execution. |

### Reference files studied

- `agent.md` Sections 4.3 (break-ui), 4.4 (Round of Subtraction), 7.2 (Test Every Button).
- `docs/qa/ui-checklist.md` — Audited every interactive control across all 9 application routes.

### Edge cases & gotchas discovered

- 120-character unbroken strings without `truncate` or `break-words` push table columns off-screen and break responsive mobile containers.
- Inputs receiving negative or out-of-range values can produce nonsensical variances unless clamped via `Math.max(0, val)`.
- Rapid button spamming requires in-flight locks and debounce protection (350ms window) to prevent duplicate transactions.
- Zero-record states (empty factories, empty lines, empty plans) must display actionable guidance cards rather than blank space.

### Decision

1. Implement `src/test/ui-stress-harness.test.tsx` with rigorous edge-payload test suites:
   - 120-character unbroken names and emails.
   - Extreme numbers (0, negative inputs, 1,000,000 units).
   - Empty collections for all roles.
   - Rapid double-click protection on primary buttons.
   - Amharic unicode localization rendering.
2. Complete all items in `docs/qa/ui-checklist.md` with verified automated test coverage.

### Follow-ups

- Wire CI quality gates in Item 04 to execute lint, typecheck, tests with coverage, and build.

---

## 2026-11-08 — CI Quality Gates & Automated Build Pipeline (Item 04)

**Goal:** Establish GitHub Actions continuous integration pipeline enforcing lint, strict typecheck, 32 automated test suites, and production build on every push and pull request to main.

### Libraries evaluated

| Tool / Action | Maintained? | License | Size | Verdict | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **pnpm/action-setup** | Yes (v4) | MIT | Action | **Selected** | Fast, official pnpm action with native store caching. |
| **actions/setup-node** | Yes (v4) | MIT | Action | **Selected** | Standard, official Node.js setup with integrated cache: 'pnpm' support. |
| **actions/checkout** | Yes (v4) | MIT | Action | **Selected** | Standard repository checkout action. |

### Reference files studied

- `agent.md` Section 7.3 (Build Gate: `install → lint → format:check → typecheck → test → build`) and Section 8 (Strict Git Workflow).
- `package.json` — Added unified `"ci"` and `"typecheck"` script targets.

### Edge cases & gotchas discovered

- In Next.js builds within CI environments, missing environment variables (such as `BETTER_AUTH_SECRET`) can cause auth initialization crashes during page static analysis. Providing deterministic test environment variables in the workflow prevents false-positive CI failures.
- Concurrency group cancellation (`cancel-in-progress: true`) prevents runner queuing backlog when multiple commits are pushed in rapid succession.

### Decision

1. Create `.github/workflows/ci.yml` with concurrency control, Node 20, pnpm v9, and 15-minute timeout.
2. Add `"typecheck": "tsc --noEmit"` and `"ci": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"` to `package.json`.
3. Require 100% clean exit (code 0) across all 4 stages to allow merging.

### Follow-ups

- Backlog complete. All Items 01 through 04 implemented, tested, and verified.

---

## 2026-11-08 — Special Days, Ethiopian Holidays Engine & OM Downtime Reason Templates (Item 05)

**Goal:** Implement automated yearly Ethiopian holiday generation with working-day flags, configurable custom special days (holidays, plant maintenance, strike, power outages), and OM-managed downtime reason templates with bilingual Amharic localization and active toggles.

### Libraries evaluated

| Library | Maintained? | License | Size | Verdict | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Custom `ethiopian-holidays.ts`** | Maintained internally | MIT | 0kB ext | **Selected** | Pure mathematical algorithm based on Ethiopian Coptic Calendar astronomy (Meskerem 1 New Year, Meskel, Timket, Genna, Adwa Victory, Patriots Day, Downfall of Derg, and lunar Easter calculation via Gauss Meeus Computus algorithm). Zero heavy external dependencies, 100% test coverage. |
| **ethiopian-calendar-date-converter** | Yes | MIT | ~8kB | Evaluated | Good for generic conversion, but lacks Ethiopian public holiday calculations and lunar movable Orthodox feast day determinations. |

### Reference files studied

- `src/lib/ethiopian-calendar.ts` — Leveraged core Ethiopian solar day-to-Gregorian transformations.
- `src/db/schema.ts` — Added `specialDays` and `downtimeReasonTemplates` tables with Drizzle PostgreSQL schema definitions.
- `src/lib/target.ts` — Connected target daily working day calculations with `specialDays` database records.

### Edge cases & gotchas discovered

- In Next.js 15, files marked with `"use server"` can strictly export **only async functions**. Exporting objects, arrays, or constants (e.g. `export const DEFAULT_REASONS = [...]`) causes Next.js build compilation failure (`invalid-use-server-value`). Constants must be exported from standard non-server modules or kept file-internal.
- In Drizzle ORM for PostgreSQL, text columns without explicit non-null modifiers produce `string | null` in inferred select models. Any TypeScript interface accepting DB records (`SpecialDayInfo`, `SpecialDayInput`, `DowntimeReasonTemplate`) must use `nameAm?: string | null` rather than `string | undefined` to prevent strict TypeScript assignment errors.
- Working status determination in the daily entry grid and calendar requires checking both the day of the week (e.g. Sunday) and custom special day records, where a working day override on a holiday or maintenance shutdown can change expected production line targets to 0.

### Decision

1. Build pure TypeScript Ethiopian holiday computation in `src/lib/ethiopian-holidays.ts` supporting fixed holidays and movable Easter/Fasika feasts.
2. Store special days in PostgreSQL via `specialDays` table with `isWorkingDay` boolean, localized names (`nameEn`, `nameAm`), and factory scoping.
3. Provide OM settings tab (`OMSettingsClient`) in `src/app/om/settings-client.tsx` with one-click "Seed Yearly Ethiopian Holidays" action, custom date modal, and downtime reason templates table.
4. Add 11 automated component tests in `src/app/om/om-settings.test.tsx` and full action coverage in `reason-actions.test.ts` and `special-days-actions.test.ts`.

---

## 2026-11-08 — Next.js 15 App Router Edge Middleware vs. `_not-found` Tracing & `requireAuthPage` Guard (Item 06)

**Goal:** Diagnose and resolve the App Router `_not-found` static page entry invariant and NFT build trace `ENOENT` failures, and establish a bulletproof `requireAuthPage` server component guard pattern.

### Reference files studied

- `node_modules/next/dist/build/collect-build-traces.js` — Traced how `@vercel/nft` attempts to read server route bundles for pages not present in `staticPages`.
- `node_modules/next/dist/shared/lib/router/utils/app-paths.js` — Analyzed `selectAppPageEntry` invariant matching logic.
- `src/lib/authz.ts` and `src/app/*/page.tsx` — Studied repeated auth boilerplate across server components.

### Edge cases & gotchas discovered

- **Edge Middleware Conflict with App Router Fallbacks:** Adding an edge `middleware.ts` file that matches root and static paths causes Next.js 15 to register synthetic edge routes. When combined with server pages or dynamic root redirects, it prevents the compiler from emitting direct app page entries for `/_not-found`, triggering `Invariant: no direct app page entry found for /_not-found`.
- **`force-dynamic` on System Boundaries:** Setting `export const dynamic = "force-dynamic"` on `src/app/layout.tsx` or `src/app/not-found.tsx` forces system fallbacks dynamic. Because `_not-found` has no dedicated server bundle when statically optimized, `collect-build-traces` attempts to open `.next/server/app/_not-found/page.js.nft.json` and fails with `ENOENT`.
- **Client Boundary for 404 Pages:** Adding `"use client";` to `src/app/not-found.tsx` ensures Next.js classifies it as a client-rendered component (`!isServerComponent`), correctly categorizing it under static pages and completely preventing missing server trace errors.
- **Server Component Auth Redirect vs. 500 Throw:** Server components calling `requireUser()` directly throw an error if the user is unauthenticated, resulting in a server error (500) if not wrapped in a try/catch. Next.js server components require using `redirect("/login")` from `next/navigation` to smoothly transition unauthenticated users to the login route.

### Decision

1. Remove superfluous `src/middleware.ts`; implement instantaneous client-side authentication dispatch in `src/app/page.tsx` via `/api/auth/status`.
2. Add `"use client";` to `src/app/not-found.tsx` to ensure canonical static compilation without missing `.nft.json` traces.
3. Create `requireAuthPage(allowedRoles?: Role[])` in `src/lib/authz.ts` as the standard, unified guard across all server component routes (`admin`, `dashboard`, `fm`, `om`, `qa`, `entry`, `calendar`, `fm/store`):
   - Redirects unauthenticated visitors to `/login`.
   - Redirects forced password-change visitors to `/change-password`.
   - Redirects role-violating visitors to `/dashboard`.
   - Returns typed `SessionUser` for immediate data querying.
4. Validate with 100% test coverage in `src/lib/authz.test.ts` (17 tests) and full multi-core `next build` passing in ~7s with exit code 0.

---

## 2026-11-09 — Per-Plant Dedicated QA Product Assignment Matrix (Item 07)

**Goal:** Disaggregate the monolithic cross-plant QA assignment table into dedicated per-plant matrix tables, reflecting that each factory plant manufactures its own distinct product catalog and assigns only its own QA inspectors.

### Edge cases & gotchas discovered

- **Cross-Tenant Product Pollution:** When all products and QA inspectors across multiple factories are rendered in a single flat grid, inspectors belonging to Plant A are shown alongside products produced exclusively by Plant B. This creates visual clutter, invites invalid cross-factory assignments, and does not scale when dozens of products and plants exist.
- **Bulk Assignment Performance:** Toggling individual checkboxes for 10–20 products per inspector creates unnecessary request cascades. Adding `bulkAssignQAProductsAction` allows atomic assignment/clearing across all of a plant's products in a single database transaction (`onConflictDoNothing` / `inArray`).
- **Global Icon vs. Global Scope Invariant:** Using `<History />` in JSX without importing `History` from `lucide-react` causes TypeScript to resolve `window.History`, throwing TS2607/TS2786.

### Decision

1. In `src/app/om/om-client.tsx`, replace the monolithic global table with individual per-plant QA Product Assignment Matrix cards and tables.
2. In each plant's matrix table:
   - Rows are strictly inspectors provisioned to that plant.
   - Columns are strictly products registered to that plant.
   - Headers display live inspector assignment ratios and product assignment counts.
   - Each inspector row provides one-click "Assign All" and "Clear All" bulk actions.
3. Add plant filter pills (`All Plants` or specific plant) and live inspector search (`matrixSearchQuery`).
4. Replicate the enhanced design in the Plant Operations Hub drill-down (`plantSubTab === "matrix"`).
5. Implement `bulkAssignQAProductsAction` in `src/actions/om-actions.ts`.
6. Add comprehensive unit testing in `src/app/om/om-client.test.tsx` verifying separate plant tables, distinct product columns, bulk assignment actions, and plant filtering.

---

## 2026-11-09 — Calendar Drawer Pop-up on Load Bug Fix & Accessibility (Item 08)

**Goal:** Remove the automatic pop-up / drawer opening upon navigating to `/calendar`, and ensure day inspection details only open when the user explicitly clicks on a specific date in the calendar.

### Edge cases & gotchas discovered

- **Auto-Selection on Mount:** `calendar-client.tsx` contained a `useEffect` setting `setActiveDayDateStr(todayGC)` on mount. Because `daySummaryMap` includes every day in the month, `calendarViewMode !== "compact" && activeDayDateStr && activeDaySummary` evaluated to `true` immediately on page load, instantly popping open the modal slide-over drawer / bottom sheet over the screen.
- **Escape Key Accessibility:** Slide-over drawers and modal dialogs must listen to `Escape` key events to close cleanly in compliance with `AGENTS.md` Section 7.2.
- **Compact View State:** In compact view mode, having no active date selected should present a helpful, accessible placeholder message inviting the user to select a date, rather than displaying an empty or unguided UI.
- **Test Tile Distinctness:** Generic CSS class queries (`b.className.includes("text-left")`) in tests matched product filter pills instead of day cells. Adding dedicated `data-testid="calendar-day-tile"`, `data-testid="compact-day-tile"`, and `data-testid="list-day-tile"` ensures deterministic and robust test assertions.

### Decision

1. Remove the automatic `setActiveDayDateStr(todayGC)` `useEffect` in `src/components/calendar/calendar-client.tsx`. `activeDayDateStr` now starts as `null`.
2. Keep today visually highlighted using `item.isCurrentToday` (`border-emerald-500 bg-white shadow-2xs`) without opening the drawer automatically.
3. Open the day inspection drawer / bottom sheet only when the user clicks a day tile button (`onClick={() => setActiveDayDateStr(item.gregorianDateStr)}`).
4. Add global `Escape` key event handling so users can press `Esc` to close either the month jumper modal or the day inspection drawer.
5. Add `role="dialog"`, `aria-modal="true"`, and `aria-label="Close day inspection"` to the drawer for WCAG AA compliance.
6. Provide a subtle, clean empty state in compact view mode when no date is selected.
7. Update `src/components/calendar/calendar-client.test.tsx` with dedicated tests asserting that no dialog is open on initial mount, that clicking a day opens the drawer, and that clicking the close button or pressing `Escape` closes it. All 14 tests passing.


