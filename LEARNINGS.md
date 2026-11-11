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




---

## 2026-11-10 — Calendar Layout Optimization, Month Navigation Bar Placement & Compact UI (Item 11)

**Goal:** Reorganize the "Calendar & Production" page to position the month navigation bar directly atop the calendar, streamline buttons and day tiles to eliminate excessive vertical scrolling, and ensure per-plant QA Product Assignment Matrix tables are accessible in the OM portal.

### Libraries evaluated

| Library | Maintained? | License | Size | Verdict | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tailwind CSS Grid & DaisyUI** | Yes | MIT | Built-in | **Selected** | Streamlined day tiles from `min-h-[115px]` down to `min-h-[48px] sm:min-h-[64px] md:min-h-[74px] lg:min-h-[84px]`, saving over 180px of vertical space while preserving WCAG AA touch targets (`>= 44x44px` on mobile/compact view). |
| **Lucide Icons** | Yes | ISC | Built-in | **Selected** | Standardized icons (`ChevronLeft`, `ChevronRight`, `CalendarDays`, `GridIcon`, `ListIcon`, `PenTool`) at `14px-16px` for dense, sleek navigation controls. |

### Edge cases & gotchas discovered

- **Month Bar Disconnect:** Previously, the month stepper (`[ < Month Year > ]`, `Today`, Calendar Switcher) was mounted in the global top header, separated from the calendar view by: 1) Product Month Performance Strip, 2) 4 large KPI cards, and 3) View/Filter toolbar. Users navigating months had to scroll up and down repeatedly. Moving the Unified Calendar Toolbar directly atop the calendar views eliminates this context split.
- **Button Sizing & Excessive Scrolling:** Buttons (`min-h-[44px]`, `min-h-[42px]`) and cards (`p-4`, `my-4`, `text-3xl`) pushed the calendar grid below the fold on standard laptop displays. Streamlining header buttons to `h-8 sm:h-9`, KPI cards to `p-2.5 sm:p-3` with `text-base sm:text-xl font-mono`, and day tiles to `84px` max height fits the entire calendar within standard 1080p viewports without requiring vertical scrolling.
- **Compact View Touch Targets:** Compact view tiles were optimized to `min-h-[40px] min-w-[40px] sm:min-h-[46px]`, maintaining touch accessibility while avoiding layout bloating on desktop screens.
- **QA Review Status Value in Test Mock:** In `daily-entry-client.test.tsx`, `qaReview.status` was typed as `"approved" | "denied" | "pending" | undefined`. Using `"rejected"` triggered a TS2322 type error during `tsc --noEmit`. Harmonized to `"denied"`, ensuring 0 type errors across the entire codebase.

### Decision

1. In `src/components/calendar/calendar-client.tsx`:
   - Unified the Month Stepper, 13M jumper, Today button, Dual Calendar switcher, Amharic/English toggle, view mode buttons (`Compact`, `Grid`, `List`), and filters into a single compact bar placed **directly atop the calendar views**.
   - Streamlined grid day tiles to `min-h-[48px] sm:min-h-[64px] md:min-h-[74px] lg:min-h-[84px]` and compact view cells to `min-h-[40px] min-w-[40px] sm:min-h-[46px]`.
   - Reduced KPI ribbon padding and text scale to fit comfortably in a 4-column desktop row (~70px height).
   - Rendered Product Month Performance as a compact horizontal scrolling pill strip (~45px height).
2. All 14 tests in `src/components/calendar/calendar-client.test.tsx` pass.
3. All 10 tests in `src/app/om/om-client.test.tsx` pass.
4. All 20 tests in `src/components/entry-grid/daily-entry-client.test.tsx` pass.
5. Quality Gate: `tsc --noEmit` (0 errors), `next lint` (0 warnings/errors), and `next build` production compilation succeeded with exit code 0.

---

## 2026-11-11 — Readable High-Contrast Notifications Layout with Status, Plant Name & Metric Variance (Item 12)

**Goal:** Redesign incoming notifications to be exceptionally readable and glanceable with explicit "NEW" / "READ" badge, clean plant name ("Name..."), signed metric value ("Value - + or -"), while preserving both "View Report" and "Mark as Reviewed" action buttons.

### Libraries evaluated

| Library | Maintained? | License | Size | Verdict | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tailwind CSS Flexbox & Badges** | Yes | MIT | Built-in | **Selected** | Structured each card into a high-contrast horizontal scan layout: `NEW`/`READ` pill on the left, bold truncated plant name, and color-coded signed pill (`+` in emerald, `-` in rose) on the right. |
| **Lucide Icons** | Yes | ISC | Built-in | **Selected** | Standardized icons (`Check`, `CheckCheck`, `TrendingUp`, `TrendingDown`, `ExternalLink`, `Bell`) for visual scannability and WCAG AA contrast. |

### Edge cases & gotchas discovered

- **Visual Clutter & Paragraph Bloat:** Previously, notifications rendered long verbose strings like `"Daily report for 2026-11-08 submitted. 1 data entry recorded, ready for OM review."` with generic gray bell icons, making it difficult for Operation Managers to quickly determine which factory reported and whether production was above or below target.
- **Signed Output Representation:** By extracting or computing signed variance (`+X pcs` or `-Y pcs`), OM managers can immediately see factory health at a glance from the top navbar bell dropdown without opening individual reports.
- **Factory Manager 1-Entry-Per-Day Enforcement:** During report unit tests, mock database returns must account for the strict FM one-entry limit (`saveDailyReportEntryAction`), ensuring admin revision tests simulate `role: "sys_admin"` while asserting that FM submissions for existing dates are rejected with a clear message.
- **Ethiopian Date Formatter Type Scope:** Adding `"short_am"` to `formatEthDate` in `src/lib/ethiopian-calendar.ts` resolved type assignability across `fm-client.tsx` and `planning-client.tsx`, maintaining full TypeScript safety with 0 errors.

### Decision

1. Redesigned `NotificationsDropdown` in `src/components/notifications-dropdown.tsx`:
   - High-contrast top header: `NEW` (bold emerald badge) / `READ` (subtle slate badge), Plant Name (`font-black text-slate-900 truncate`), and Signed Variance (`font-mono font-black` badge with `TrendingUp` or `TrendingDown` icon, colored in emerald for positive `+` and rose for negative `-`).
   - Meta footer with report date and relative timestamp (`timeAgo`).
   - Clean action row preserving **View Report** (`Link` with `ExternalLink` icon) and **Mark as Reviewed** button (or **Reviewed ✓** status pill).
2. Enriched `getNotificationsAction()` in `src/actions/review-actions.ts` to parse clean factory names and signed `+` or `-` values with fallback extraction.
3. Created comprehensive test suite `src/components/notifications-dropdown.test.tsx` (5/5 tests passing).
4. Verified all 16 tests in `src/actions/report-actions.test.ts` and 13 tests in `src/actions/review-actions.test.ts` pass (34/34 tests passing).
5. Ran full `tsc --noEmit` and confirmed 0 TypeScript errors.

---

## 2026-11-11 — Strict "One Data Entry Per Day" Production Reporting Rule (Item 13)

**Goal:** Enforce a strict "One Data Entry Per Day" constraint for factory production reporting. Once a Factory Manager saves daily numbers for a given date, the entry is locked to prevent multiple submissions or post-save modifications, while preserving System Administrator emergency override.

### Libraries & Primitives Evaluated

| Component / Layer | Pattern | Verdict | Reason |
| :--- | :--- | :--- | :--- |
| **`saveDailyReportBatchAction`** | Atomic Drizzle Transaction | **Selected** | Replaced sequential per-line saves with a single atomic batch transaction. Evaluates whether any report entries already exist for this date and factory, rejecting subsequent submissions by FM with 0 partial writes. |
| **`saveDailyReportEntryAction`** | Strict Role-Based Pre-check | **Selected** | Enforces that if `user.role === "fm"` and an entry already exists for the date, re-entry is blocked with actionable error `"Only one data entry is permitted per day. The daily entry for this date has already been recorded."` Sys Admins retain override access. |
| **`DailyEntryClient` Locked State** | Prop-driven Reactive Lockout | **Selected** | When `isDaySubmitted` is true (or immediately upon saving in session), `isReadOnly` becomes `true` for FM. Disables all steppers, inputs, downtime buttons, and replaces the Save button with an accessible completion badge. |

### Edge Cases & Gotchas Discovered

- **Sequential Loop vs. Atomic Batch Submission:** In earlier versions, `handleSaveAll` called `saveDailyReportEntryAction` sequentially in a `for` loop. If line 1 passed and line 2 failed, the database was left in an inconsistent partial state. Introducing `saveDailyReportBatchAction` executes the entire day's report across all lines in one atomic database transaction, validating the "one entry per day" constraint before making any writes.
- **Immediate In-Session Lockout:** In addition to reading `isDaySubmitted` from `getDailyGridData` on initial page load, the client UI must immediately set `daySubmitted = true` upon successful batch save. This provides instant feedback, locking steppers and disabling the Save button without requiring an asynchronous roundtrip or page reload.
- **Admin Emergency Override Distinction:** System Administrators (`sys_admin`) may occasionally need to correct erroneous data reported by a plant manager. The backend and UI explicitly distinguish between `fm` (strictly one entry, permanently locked) and `sys_admin` (allowed to edit with an visible "Admin Override Mode" badge).
- **Vitest Mocking with Nested Sub-queries:** When mocking `db.select().from(reportEntries).where(...).limit(1)`, ensure the table being inspected distinguishes between `reportEntries` (where existing entry check returns empty array for initial saves) and other tables like `lines` (which must return active line definitions).

### Decision

1. Implemented `saveDailyReportBatchAction` and updated `saveDailyReportEntryAction` in `src/actions/report-actions.ts` to strictly block FM from submitting more than once per day.
2. Updated `getDailyGridData` in `src/actions/data.ts` to compute `isDaySubmitted`, `submittedAt`, and `submittedBy`.
3. Updated `src/app/entry/page.tsx` and `src/components/entry-grid/daily-entry-client.tsx`:
   - Renders a prominent "Daily Data Entry Completed (የዕለቱ መረጃ ተመዝግቧል)" banner when entries exist.
   - Replaces the bottom floating Save button with a locked completion pill (`"Daily Entry Completed (የዕለቱ መረጃ ተመዝግቧል) — 1 Data Entry Recorded"`).
   - Locks all steppers, numeric inputs, downtime reasons, and issue notes (`isReadOnly = true`).
4. Expanded test suites:
   - Added 4 batch and one-entry-per-day tests in `src/actions/report-actions.test.ts` (all 20 pass).
   - Added locked state, immediate post-save lockout, and admin override tests in `src/components/entry-grid/daily-entry-client.test.tsx` (all 23 pass).
5. All 44 test files (470 tests) passed; TypeScript `tsc --noEmit` passed with 0 errors; production build `next build` compiled cleanly.


---

## 2026-11-11 — Central Production Planning Portal, Sys Admin Calendar Selection & FM Read-Only Role Enforcement (Item 12)

**Goal:** Provide a dedicated Production Planning portal (`/planning`) for the Operation Manager (OM) and Factory Manager (FM), bind plan start and end dates strictly to the Sys Admin's calendar system selection (`ethiopian` vs `gregorian`), and enforce that Factory Managers cannot edit or create production plans (OM-only authoring), while allowing FMs read-only view of their plant's items.

### Libraries evaluated

| Library | Maintained? | License | Size | Verdict | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Custom PlanDatePicker Component** | Maintained internally | MIT | 0kB | **Selected** | Provides coordinated 3-tier Ethiopian selects (Year ዓ.ም, Month ወር 1–13 with bilingual Amharic/English names, Day ቀን 1–30 or 1–5/6 with leap-year calculation via `daysInMonthEth`) alongside HTML5 `<input type="date">` for Gregorian mode, always outputting canonical ISO dates (`YYYY-MM-DD`). |
| **Better Auth Access Control (RBAC)** | Yes | MIT | Built-in | **Selected** | Updated `roles.fm` to `plan: ["read"]` (stripped `create`, `update`, `delete`), while giving `roles.om` full `plan: ["create", "read", "update", "delete"]`. |

### Edge cases & gotchas discovered

- **Calendar System Independence from Database Storage:** All plans store `startDate` and `endDate` as canonical ISO date strings (`YYYY-MM-DD`) in PostgreSQL. When the Sys Admin changes the company calendar system in the Industry Profile (`admin-actions.ts`), no database migration is required: `PlanDatePicker` and the UI table dynamically render and parse dates in the configured system (`ethiopian` or `gregorian`) without data corruption.
- **Factory Manager Authority Restriction:** In industrial multi-plant operations, Factory Managers reporting local daily output should not arbitrarily adjust periodic production commitments. Setting `roles.fm` to `plan: ["read"]` and guarding server actions (`createPlanAction` and `updatePlanAction`) ensures that attempts by FMs to modify periodic plans are strictly rejected at both UI and server API layers.
- **Leap Year and Pagume (13th Month) Clamping:** Month 13 (Pagume) only has 5 days (6 in a leap year). When switching months to Pagume, `PlanDatePicker` dynamically recalculates `maxEthDays` and clamps the selected day to prevent invalid date generation.
- **Multi-Plant Navigation for OM:** An OM managing multiple plants can filter plans by plant using the header dropdown or view all plans in an aggregated table with Initial Baseline vs Edited Plan comparisons.

### Decision

1. Created `src/actions/plan-actions.ts` with `getProductionPlansAction`, `createPlanAction`, `updatePlanAction`, and `deletePlanAction`.
2. Created reusable `src/components/planning/plan-date-picker.tsx` driven by `industryProfile.calendarSystem`.
3. Created `src/app/planning/page.tsx` and `src/components/planning/planning-client.tsx`:
   - OM has full planning controls ("New Production Plan" button, "Edit" button, plant switcher, multi-plant overview).
   - FM has read-only access (informative notice banner, hidden action buttons, scoped to FM's plant).
   - Start and end dates are formatted and chosen based on the Sys Admin's calendar setting (`ethiopian` or `gregorian`).
4. Updated `src/lib/rbac.ts` to restrict `fm` to `plan: ["read"]`.
5. Updated `src/components/navbar.tsx` to add `"Production Plans"` (`/planning`) for both OM and FM.
6. Updated `src/app/fm/page.tsx` and `src/app/fm/fm-client.tsx` to respect `calendarSystem` and read-only mode for FMs.
7. Added comprehensive unit tests in `src/components/planning/planning-client.test.tsx` (9 tests passing), `fm-actions.test.ts` (23 tests passing), `fm-client.test.tsx` (10 tests passing), and `navbar.test.tsx` (8 tests passing).
8. Quality Gate: `tsc --noEmit` (0 errors), `next lint` (0 warnings/errors), and `next build` compiled with exit code 0.

---

## 2026-11-11 — Big-Screen Responsiveness, Left/Right Page Padding, & UI Component Consolidation (Item 12)

**Goal:** Establish responsive gutters on big screens (1080p, 1440p, 4K monitors), normalize input box heights (min 44px) and widths (controlled max-widths), and eliminate redundant, scattered form inputs by introducing shared, accessible UI primitives (`PageContainer`, `Input`, `SearchInput`, `Select`, `FormField`).

### Edge cases & gotchas discovered

- **Cramped Big Screen Layouts vs. Overstretched Inputs:** Locking desktop layouts to `max-w-7xl` (1280px) on 1920px+ monitors left 320px+ awkward side voids while leaving inputs inside modal cards stretching unconstrained to 100% width. Introducing `<PageContainer />` with `max-w-7xl 2xl:max-w-8xl` and responsive padding `px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16` provides breathing room on ultra-wide screens, while `max-w-md` / `max-w-lg` constraints prevent single-line text inputs from ballooning across the screen.
- **Microscopic 32px Inputs:** Numerous search and form inputs used DaisyUI's `input-sm` (32px), which violates the WCAG AA 44x44px touch target requirement and causes iOS Safari to auto-zoom on mobile devices due to font sizes < 16px. Standardizing inputs to `min-h-[44px] h-11 text-base sm:text-sm` eliminates auto-zoom and ensures comfortable desktop/mobile ergonomics.
- **Duplicated Search Bar Logic:** Search inputs in Admin, OM, FM, QA, and Store views duplicated the same 15-line JSX pattern (`Search` icon + `input` + clear `X` button). Consolidating into `<SearchInput />` reduced boilerplate, standardized clear-button touch targets, and unified keyboard accessibility.

### Decision

1. Created `src/components/ui/page-container.tsx` providing standard responsive gutters across all viewports (`px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16` and `max-w-7xl 2xl:max-w-8xl`).
2. Updated all main layout views to utilize `<PageContainer>` or the unified responsive gutter:
   - Header Navigation (`src/components/navbar.tsx`)
   - Dashboard View (`src/app/dashboard/page.tsx`)
   - Admin Portal (`src/app/admin/page.tsx`)
   - OM Operations (`src/app/om/page.tsx`)
   - FM Operations (`src/app/fm/page.tsx`)
   - Store Stock (`src/app/fm/store/page.tsx`)
   - QA Operations (`src/app/qa/page.tsx`)
   - Calendar Hub (`src/components/calendar/calendar-client.tsx`)
   - Daily Production Entry Grid (`src/components/entry-grid/daily-entry-client.tsx`)
3. Created `src/components/ui/input.tsx`, `src/components/ui/search-input.tsx`, `src/components/ui/select.tsx`, and `src/components/ui/form-field.tsx` with ref forwarding, 44px min-height, text-base on mobile / text-sm on desktop, and full keyboard/ARIA support.
4. Refactored repeated search bars and form fields across Admin, OM, FM, QA, and Store views to use the unified components.
5. Added unit tests for each new primitive (`page-container.test.tsx`, `input.test.tsx`, `search-input.test.tsx`, `select.test.tsx`). 35 UI unit tests pass; all 68 component tests pass.

