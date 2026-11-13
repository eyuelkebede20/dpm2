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

---

## 2026-11-11 — Mobile App Bottom Navigation Bar & Impeccable Ergonomic Audit (Item 14)

**Goal:** Implement an accessible, thumb-friendly persistent mobile bottom navigation bar (`md:hidden`) with role-tailored destinations, high-contrast active state indicators, and an accessible "More" sheet for secondary views, eliminating mobile header hamburger dependency and ensuring page content and sticky save bars are never obscured.

### Libraries & Primitives Evaluated

| Component / Layer | Pattern | Verdict | Reason |
| :--- | :--- | :--- | :--- |
| **Mobile Bottom Bar (`<nav aria-label="Mobile Navigation">`)** | Native Fixed HTML5 Nav + Tailwind Backdrop Blur | **Selected** | Placed in the primary thumb sweep zone (`fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]`). Adheres to Apple HIG and Material Design max-5-destination rule with `grid grid-cols-5` (or `grid-cols-3` for QA/Admin). |
| **Role-Specific Tab Destination Allocation** | Config-driven Tab Mapping | **Selected** | Tailors primary mobile destinations per role: FM (`Dashboard`, `Lines`, `Entry`, `Calendar`, `More`), OM (`Dashboard`, `Plants`, `Review`, `Calendar`, `More`), QA (`Dashboard`, `Inspections`, `More`), Sys Admin (`Dashboard`, `Admin Portal`, `More`). |
| **Overflow "More" Sheet** | Accessible Modal Bottom Sheet (`role="dialog"`) | **Selected** | Houses secondary destinations (e.g. `Production Plans`, `Store Stock`, `Change Password`, `Sign Out`). Displays a prominent indicator dot on the "More" tab if the active view lives inside the overflow sheet. |
| **Page Layout Clearance (`src/app/layout.tsx`)** | Global `<main className="flex-1 pb-16 md:pb-0">` | **Selected** | Guarantees that mobile screens maintain 64px bottom clearance so tables, cards, and buttons are never hidden behind the bottom navigation bar. |
| **Sticky Save Bar Elevation (`DailyEntryClient`)** | Responsive Offset (`bottom-16 md:bottom-0`) | **Selected** | On mobile devices, the daily entry sticky save bar floats neatly at `bottom-16` directly atop the bottom navigation bar, allowing one-thumb batch saving without overlapping navigation controls. |

### Edge Cases & Gotchas Discovered

- **iOS Home Indicator Overlap:** Devices with home indicators (iPhone X and newer) require safe-area padding. Using `pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]` prevents navigation buttons from sitting directly on the physical gesture bar.
- **Save Bar Occlusion on Mobile:** Fixed bottom bars (e.g., in daily production entry) previously anchored to `bottom-0`, which would sit behind a persistent bottom navigation bar. Elevating to `bottom-16 md:bottom-0` maintains stacked visibility on mobile while docking flush to `bottom-0` on desktop.
- **Multiple Elements in Test Assertions:** When navigation destinations exist in both the top desktop header and the mobile bottom bar simultaneously, strict `getByText` queries throw `Found multiple elements`. Using `getAllByText` or scoping to `getByRole("navigation", { name: /mobile navigation/i })` ensures deterministic assertions.

### Decision

1. Added mobile bottom navigation bar in `src/components/navbar.tsx` with role-specific item mapping and active indicator styling.
2. Updated `src/app/layout.tsx` to provide `pb-16 md:pb-0` bottom clearance on mobile viewports.
3. Updated `src/components/entry-grid/daily-entry-client.tsx` sticky save bar to `bottom-16 md:bottom-0`.
4. Expanded test suite in `src/components/navbar.test.tsx` with 6 dedicated mobile bottom navigation tests (all 14 tests pass).
5. Ran full verification: all 56 tests across `navbar.test.tsx`, `notifications-dropdown.test.tsx`, `daily-entry-client.test.tsx`, and `calendar-client.test.tsx` passed.
6. Ran `pnpm typecheck` (`tsc --noEmit`) with 0 errors.


---

## 2026-11-11 — PostgreSQL `ON CONFLICT` Target Rules & QA Inspection/Approval Synchronization

**Goal:** Resolve PostgreSQL error `42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification` during OM report reviews, and synchronize QA 1-click approvals (`qa_approvals`) across the Daily Entry Grid and Operation Manager views.

### Libraries evaluated

| Library | Maintained? | License | Size | Verdict | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Drizzle ORM `onConflictDoUpdate`** | Yes (v0.39) | Apache-2.0 | Core | **Used** | PostgreSQL requires an explicit unique constraint or index matching the columns specified in `target: [...]`. Targeting the primary key `dailyReportReviews.id` (`daily_report_reviews_pkey`) or using a pre-check query avoids runtime `42P10` exceptions. |
| **Next.js `revalidatePath`** | Yes | MIT | Core | **Used** | Ensures server action mutations on `/qa` immediately invalidate `/entry`, `/om`, and `/calendar` cache tags. |

### Edge cases & gotchas discovered

- **PostgreSQL `42P10` Error with Composite Columns:** In PostgreSQL, an `INSERT ... ON CONFLICT (col_a, col_b) DO UPDATE` query requires a unique index or unique constraint specifically on `(col_a, col_b)`. If the underlying table in the live database lacks an explicit unique composite constraint on `(factory_id, date)`, passing `target: [dailyReportReviews.factoryId, dailyReportReviews.date]` fails at runtime with `42P10`. Querying for an existing record by `factoryId` and `date` first and branching (`update` by `existing.id` if found, `insert` with PK `target: dailyReportReviews.id` if not) guarantees safety across all database instances without requiring schema migrations.
- **Dual QA Domain Entities:** DPM has two distinct QA workflows:
  1. `qaInspections`: Piece-level physical inspection (checked count, defect count, defect rate).
  2. `qaApprovals`: 1-click batch/line approvals or denials performed by QA personnel on the `/qa` portal.
  Previously, `getDailyGridData` only queried `qaInspections`, ignoring `qaApprovals`. As a result, when QA marked an item approved or denied on `/qa`, the Daily Entry Grid and OM review screens remained stuck on "Pending QA Inspection". Joining `qaApprovals` and checking `status` ensures the review card and table row instantly reflect "QA Approved" or "QA Denied" with inspector details and feedback notes.
- **Defects vs. Explicit Denial Precedence:** The badge logic in `DailyEntryClient` previously fell back to "QA Approved" when `row.qaReview.defects === 0`. If a QA officer explicitly rejected a submission (status `"denied"` or `"rejected"`) even with 0 reported defects, the UI erroneously showed "QA Approved". Updating the condition to check `row.qaReview.status === "approved" || (!row.qaReview.status && row.qaReview.defects === 0)` ensures explicit QA denials are respected.

### Decision

1. In `src/actions/review-actions.ts`:
   - Updated `markDailyReportReviewedAction` and `reviewItemAction` to check for existing `dailyReportReviews` record first.
   - If present, execute `db.update` targeted by `existing.id`.
   - If absent, execute `db.insert` targeted by primary key `dailyReportReviews.id`.
2. In `src/actions/data.ts`:
   - Query `qaApprovals` joined with `users` (`name as qaUserName`) for all `reportEntryIds` on the date.
   - Map `qaApproval` status, verdict ("QA Approved" / "QA Denied"), inspector name, and note into `qaReview` for each product line.
   - Preserve physical inspection data fallback when no QA approval decision has been made.
3. In `src/actions/qa-actions.ts`:
   - Added `revalidatePath("/entry")`, `revalidatePath("/om")`, and `revalidatePath("/calendar")` to `reviewQAEntryAction`.
4. In `src/components/entry-grid/daily-entry-client.tsx`:
   - Corrected QA status rendering so explicit denials show "QA Denied" rather than defaulting to approved.

---

## 2026-11-11 — Full Seed Reset with Homicho Defense Manufacturing Dataset (HAEI)

**Goal:** Cleanly wipe all legacy demo/added database records in DPM2 and seed the authoritative defense manufacturing dataset from `../DPM` (Homicho Ammunition Engineering Industry - HAEI), harmonizing user roles to DPM2's 4 roles (`sys_admin`, `om`, `fm`, `qa`).

### Seed Source & Dataset Mapped

- **Source Reference:** `../DPM/backend/src/db/seeds/01_production_seed.ts`, `02_test_seed.ts`, and `../DPM/backend/src/modules/catalogs/homicho-sample-data.service.ts`.
- **Enterprise Profile:**
  - Company: `Homicho Ammunition Engineering Industry` (HAEI)
  - Working Days: Monday–Saturday (`[1, 2, 3, 4, 5, 6]`, Sunday off)
  - Unit of Measure: `pcs`
  - Calendar System: `ethiopian`
- **5 Munitions Production Plants:**
  1. `Small Arm Factory (SAF)` (`fac_sac`)
  2. `Medium Arm Factory (MAF)` (`fac_mac`)
  3. `Heavy Weapon Factory (HWF)` (`fac_hwc`)
  4. `Chemical Charging Shop (CCS)` (`fac_chem`)
  5. `Tool and Auxiliary Shop (TAS)` (`fac_tool`)
- **15 Munitions Production Lines:**
  - SAF: `SAF-39-L01: 39mm Cartridge Line`, `SAF-39-L02: 39mm Bullet Line`, `SAF-39-L03: 39mm Final Assembly`, `SAF-54-L01: 54mm Cartridge Line`, `SAF-54-L02: 54mm Bullet Line`, `SAF-54-L03: 54mm Final Assembly`
  - MAF: `MAF-127-L01: 12.7mm Cartridge Line`, `MAF-127-L02: 12.7mm Steel Core Line`, `MAF-127-L03: 12.7mm Final Assembly`
  - HWF: `HWF-L01: 100mm/122mm Machining Line`, `HWF-L02: 82mm/60mm Mortar Line`
  - CCS: `CCS-L01: Warhead Melt-Cast Filling Bay`, `CCS-L02: Propellant Charging & Sealing`
  - TAS: `TAS-L01: CNC Punch & Die Toolmaking`, `TAS-L02: Die Heat Treatment & Calibration`
- **12 Munitions Products & Calibers:**
  - `39mm Cartridge Case (7.62x39)` (`SAP-39-CR`), `39mm Bullet Core & Jacket` (`SAP-39-BL`), `7.62x39mm Final Round` (`SAP-39-ASM`), `54mm Rimmed Case (7.62x54R)` (`SAP-54-CR`), `7.62x54mmR PKM Final Round` (`SAP-54-ASM`), `12.7mm Cartridge Case` (`MAP-127-CR`), `12.7mm Armor-Piercing Core` (`MAP-127-SC`), `12.7x108mm DShK Heavy Round` (`MAP-127-ASM`), `122mm Howitzer Shell Body` (`HWP-122-WH`), `82mm Mortar Bomb Machined` (`HWP-82-MB`), `122mm Warhead TNT Melt Charge` (`CCS-122-WHC`), `Tungsten Carbide Drawing Punch` (`TAS-DD-PUNCH`).
- **9 Defense Munitions Downtime Classifications:**
  - `DOW-01` (Punch / Die Tool Wear or Breakage), `DOW-02` (CNC Control / Scale & Sensor Fault), `DOW-03` (Tooling & Caliber Changeover), `DOW-04` (Brass Strip / Steel / Powder Shortage), `DOW-05` (Ballistic Test & Chamber Verification), `DOW-06` (Chemical & Pyrotechnic Safety Clearance), `DOW-07` (Preventive Press Maintenance & Lubrication), `DOW-08` (Power Cut / Generator Transition), `DOW-09` (Machine Breakdown).
- **Leadership & Role Conflict Resolution:**
  - DPM2 enforces 4 strict roles: `sys_admin`, `om`, `fm`, `qa`.
  - Legacy `stock` role from `../DPM` (Dawit Kebede) was omitted in compliance with prompt ("review the roles and if there are conflicts forget those names").
  - Mapped Users:
    - Sys Admin: `Col. Kebede Worku (Sys Admin)` (`admin@dpm.local`)
    - Operation Manager: `Mr. Mihretab Guramela (OM)` (`om@dpm.local`)
    - Factory Managers: `Sisay Milkessa` (`fm@dpm.local` / SAF), `Eliyas Bekele` (`fm_mac@dpm.local` / MAF), `Maru Tessema` (`fm_hwc@dpm.local` / HWF), `Getenet Sahelu` (`fm_chem@dpm.local` / CCS), `Solomon Geleta` (`fm_tool@dpm.local` / TAS)
    - Quality Assurance: `Capt. Tigist Haile (QA)` (`qa@dpm.local`, assigned to all 5 plants)

### Verification

- Database reset and seed executed cleanly with `pnpm db:seed`.
- Full Vitest suite: 44 test files passed, 477 tests passed with 0 failures.
- TypeScript typecheck: `tsc --noEmit` passed with 0 errors.
- ESLint: `next lint` passed with 0 errors, 0 warnings.
- Production build: `next build` compiled all routes and static pages with exit code 0.


---

## 2026-11-11 — Operation Manager Navigation & Workspace Polish (and Cross-Role UX Standardization)

**Goal:** Conduct an in-depth audit on the Operation Manager navigation bar and page complexity, resolve semantic navigation mismatches across roles, eliminate redundant nested drilldown friction in `/om`, and standardize polished UX across FM, QA, and Sys Admin.

### Audit Findings & Root Causes

1. **Semantic Navigation Mismatches:**
   - The desktop navigation previously labeled `/entry` as `"Daily Entry"` for all roles. While appropriate for Factory Managers, Operation Managers are strictly barred from entering daily counts; their role is to **review**, **inspect QA approvals/denials**, and **tune daily targets**. Presenting a `"Daily Entry"` pen-tool item to an OM conveyed confusing intent.
   - `/om` was previously labeled `"OM Operations"`, which is bureaucratic and abstract compared to concrete domain responsibilities.
2. **Plant Drilldown & Context Switching:**
   - In `/om`, drilling down into a plant completely replaced the view, requiring OMs managing multiple plants to repeatedly click "Back to Plants" to switch facilities.
   - Plant cards lacked direct quick shortcuts to jump straight into plant-scoped team management or QA matrix assignment.

### Decisions & Solutions

1. **Role-Tailored Desktop Navigation (`src/components/navbar.tsx`):**
   - **For OM:**
     - `/entry` &rarr; **`"Daily Reports"`** with `ClipboardCheck` icon.
     - `/om` &rarr; **`"Operations Hub"`** with `Building2` icon.
     - Retains `"Production Plans"`, `"Calendar"`, and `"Dashboard"`.
   - **For FM:**
     - `/entry` &rarr; **`"Daily Entry"`** with `PenTool` icon.
     - `/fm` &rarr; **`"Lines & Floor"`**, `/planning` &rarr; **`"Production Plans"`**, `/fm/store` &rarr; **`"Store Stock"`**.
   - **For QA:**
     - `/qa` &rarr; **`"QA Approvals"`** with `ClipboardCheck` icon.
   - **For Sys Admin:**
     - `/admin` &rarr; **`"Admin Portal"`** with `Shield` icon.
2. **OM Workspace Polish (`src/app/om/om-client.tsx` & `src/app/om/page.tsx`):**
   - **Plant Switcher in Plant Hub:** Added an instant `<select aria-label="Switch Plant">` dropdown inside the Plant Hub header, allowing OMs to switch between plants in 1 click without navigating back to the card grid.
   - **Breadcrumb Navigation:** Added `Operating Plants / [Plant Name]` clickable breadcrumb.
   - **Direct Jump Shortcuts on Plant Cards:** Added clean 1-click shortcut badges (`Team`, `QA Matrix`, `Lines`) on each plant card so the OM can immediately jump to the relevant tab pre-filtered to that facility.
   - **Visual Polish:** Standardized active plant counts, refined typography, and ensured all interactive targets meet the 44px touch guideline.
3. **Cross-Role Quality Verification:**
   - Standardized `src/app/offline/page.tsx` button and link layout.
   - Full Vitest suite: 44 test files passed, 477 tests passed.
   - `tsc --noEmit`: 0 TypeScript errors.
   - `next lint`: 0 warnings, 0 errors.

---

## 2026-11-11 — Progressive Web App (PWA) with Over-The-Air (OTA) Updates Engine

**Goal:** Transform DPM into an installable Progressive Web App (PWA) featuring an automated Over-The-Air (OTA) updates engine, version tracking endpoint, intelligent Service Worker caching (network-first for pages/API, stale-while-revalidate for static assets), offline resilience fallback, and interactive update prompts.

### Libraries & Architectures Evaluated

| Approach / Library | Maintained? | License | Bundle Size | Verdict | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`@ducanh2912/next-pwa` / `next-pwa`** | Mixed | MIT | ~28kB | Rejected | Known compilation and worker hook conflicts with Next.js 15, React 19 App Router, and Turbopack (`--turbo`). Introduces heavy Webpack plugin layers that complicate build pipelines. |
| **Native Web Standards (Next.js 15 `manifest.ts` + Custom `sw.js` + `navigator.serviceWorker`)** | W3C Standard | MIT | 0kB ext | **Selected** | 100% native compatibility with Next.js 15 App Router, zero external npm dependencies, native `MetadataRoute.Manifest` support, direct lifecycle event control (`updatefound`, `waiting`, `SKIP_WAITING`, `controllerchange`), full offline fallback resilience, and seamless OTA prompt execution. |

### Architecture & Key Mechanisms

1. **Web App Manifest (`src/app/manifest.ts`):**
   - Automatically serves `/manifest.webmanifest` and injects link tags.
   - Branded for `Homicho Ammunition Engineering Industry - DPM` (`HAEI DPM`).
   - `display: standalone`, `orientation: portrait-primary`, `theme_color: #1e293b`, `background_color: #0f172a`.
   - Complete icon suite: `icon-192.png`, `icon-512.png`, `icon-maskable.png`, `apple-touch-icon.png`, and `icon.svg`.
2. **Version Architecture (`src/lib/version.ts` & `/api/version`):**
   - Centralizes version constants (`CURRENT_APP_VERSION = "1.0.1"`, `GITHUB_REPO = "eyuelkebede20/dpm"`, `CURRENT_GIT_COMMIT = "bc4b2e1"`).
   - Next.js App Router route rule: HTTP route handlers (`route.ts`) must only export HTTP methods (`GET`, `POST`) and segment configs (`dynamic`), never arbitrary constant values (which fail Next.js internal type constraint check `checkFields<Diff<...>>`). Moving constants to `src/lib/version.ts` resolved this cleanly.
   - Endpoint `/api/version` returns version, build timestamp, application name, git commit hash, repository link, and release notes.
3. **Service Worker & Cache Headers (`public/sw.js` & `next.config.ts`):**
   - Version-stamped cache bucket (`haei-dpm-v1.0.1`).
   - Pre-caches critical offline assets (`/offline`, `/icons/icon.svg`, `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable.png`, `/icons/apple-touch-icon.png`, `/manifest.webmanifest`).
   - **OTA Skip Waiting Control:** During updates, does *not* auto-skip waiting, keeping the new worker in `waiting` state until receiving `{ type: 'SKIP_WAITING' }` from user confirmation.
   - **Cache Purge:** Purges obsolete cache buckets during `activate`.
   - **Network Routing:** Network-first for HTML pages with fallback to cached `/offline`; cache-first with stale-while-revalidate for static assets; network-only with graceful 503 JSON for offline API calls.
   - **HTTP Cache Headers:** Explicit `Cache-Control: no-cache, no-store, must-revalidate` configured in `next.config.ts` for `/sw.js` and `/api/version` so browsers immediately detect new OTA versions without HTTP disk caching delays.
4. **Client PWA & OTA Engine (`src/hooks/use-pwa-ota.ts` & `src/components/pwa/pwa-ota-manager.tsx`):**
   - Safe context provider with default fallback for SSR and tests.
   - Listens for `updatefound` on service worker registration and `statechange` to `installed`.
   - Surfaces high-contrast, accessible `<PwaOtaBanner />` (`role="alert"`) informing user of the new version, release notes, and direct GitHub commit link.
   - `applyUpdate()` sends `SKIP_WAITING` to the waiting worker; the `controllerchange` event catches worker takeover and triggers `window.location.reload()`.
   - Captures `beforeinstallprompt` for native "Install App" triggers.
   - Provides manual "Check for Updates" button with version indicator in the desktop profile menu and mobile drawer.
5. **Offline Fallback Page (`src/app/offline/page.tsx`):**
   - Displays accessible offline emblem with bilingual messaging.
   - Includes "Try Reconnecting" button (`window.location.reload()`) and "Dashboard" link.

### Verification

- Scoped Vitest tests: `pwa-ota-banner.test.tsx`, `offline/page.test.tsx`, `version/route.test.ts`, `navbar.test.tsx`, `om-actions.test.ts`, and `switch-role/route.test.ts` all passing.
- Full Vitest suite: 50 test files passed, 505 tests passed (0 failures).
- `tsc --noEmit`: 0 TypeScript errors.
- `next lint`: 0 warnings, 0 errors.
- Production build: `next build` compiled all routes including `○ /manifest.webmanifest`, `ƒ /offline`, and `ƒ /api/version` with exit code 0.

---

## 2026-11-11 — Authentication, Multi-Tenant Authorization, OWASP Top 10 & API Security Hardening (Item 15)

**Goal:** Implement comprehensive defense-in-depth security covering Authentication (password strength, lockout), Authorization (least privilege, Broken Object Level Authorization / BOLA prevention), API Security (sliding-window rate limiting), Security Misconfigurations (HSTS, CSP, COOP, CORP), and Structured Audit Logging.

### Threat Modeling & Mitigations Evaluated

| Threat / OWASP Category | Attack Vector / Risk | Architectural Mitigation | Status |
| :--- | :--- | :--- | :--- |
| **A01: Broken Access Control (BOLA / IDOR)** | Cross-tenant deletion or state tampering (e.g. deleting plans or toggling users belonging to another OM's plant). | Guarded `deletePlanAction` in `plan-actions.ts` and `fm-actions.ts`, `toggleFactoryUserStatusAction` in `om-actions.ts`, and `revokeDailyReportReviewAction` in `review-actions.ts` with strict factory ownership and tenant boundary validation. Stripped `create`/`update`/`delete` from `roles.fm.plan` in `rbac.ts` (least privilege). | **Enforced** |
| **A03: Injection & Path Traversal** | Directory traversal (`../../etc/passwd`), prototype pollution (`__proto__`), or XSS scripts in notes/inputs. | Next.js Edge Middleware inspects full request URLs, blocking traversal and proto pollution attacks with 400 Bad Request. Added `sanitizeString()` to strip script tags and inline event handlers from user text fields. | **Enforced** |
| **A04: Insecure Design & Brute Force** | High-velocity automated credential stuffing or API resource exhaustion. | Built `checkRateLimit()` token bucket / sliding window limiter with memory leak protection (5-minute stale key purge). Enforced in `src/middleware.ts` (15 req/min on `/api/auth/*`, 120 req/min on `/api/*`). | **Enforced** |
| **A05: Security Misconfiguration** | Missing transport security, framing vulnerabilities, or leaking dev test endpoints in production. | Configured strict HTTP security headers in `next.config.ts` and `src/middleware.ts` (`Strict-Transport-Security: max-age=63072000; preload`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `COOP: same-origin`, `CORP: same-origin`, `X-XSS-Protection: 1; mode=block`). Hard-locked dev role-switcher (`/api/dev/switch-role`) to return 404 in production. | **Enforced** |
| **A07: Authentication Failures** | Weak user-supplied passwords and admin self-lockout. | Enforced OWASP ASVS password complexity (min 12 chars, uppercase, lowercase, number, special character) via `validatePasswordStrength()` across user provisioning and password resets. Added self-lockout guard preventing admins from deactivating their own accounts. | **Enforced** |
| **A09: Security Logging & Monitoring** | Silent failures or unrecorded privilege escalations and brute-force attempts. | Built structured audit logger `logSecurityEvent()` with timestamp, event code, IP, and masked details, writing structured `[SECURITY_AUDIT]` records without leaking secrets. | **Enforced** |

### Decision & Key Files

1. `src/lib/rate-limit.ts` & `src/lib/rate-limit.test.ts`: High-performance sliding window rate limiter.
2. `src/lib/security.ts` & `src/lib/security.test.ts`: Password complexity validator, XSS sanitizer, PII email masking, and structured audit logger.
3. `src/middleware.ts` & `src/middleware.test.ts`: Next.js security middleware enforcing anti-brute force rate limiting, path traversal blocks, and OWASP headers.
4. `src/lib/rbac.ts` & `src/lib/rbac.test.ts`: Harmonized Factory Manager role to `plan: ["read"]` only.
5. `src/actions/plan-actions.ts` & `src/actions/fm-actions.ts`: Added BOLA checks to `deletePlanAction` validating factory ownership.
6. `src/actions/om-actions.ts`: Added multi-tenant checks to `toggleFactoryUserStatusAction` and password strength validation to `provisionFactoryUserAction`.
7. `src/actions/review-actions.ts`: Added factory ownership validation to `revokeDailyReportReviewAction`.
8. `src/actions/admin-actions.ts`: Added admin self-lockout prevention to `toggleUserActiveAction` and password strength validation to `createUserAction` and `adminResetPasswordAction`.
9. `next.config.ts`: Enriched security headers (`Strict-Transport-Security`, `COOP`, `CORP`, `X-Permitted-Cross-Domain-Policies`).
10. `src/app/api/dev/switch-role/route.ts`: Enforced strict production 404 lockout.

### Verification & Quality Gates

- Unit & Security tests: 45 security tests and 102 action tests passing (147/147 passed).
- TypeScript: `pnpm typecheck` passed with 0 errors.

---

## 2026-11-12 — Production Docker Containerization, LAN Working IP Exposure & Robust Shell Automation (Item 16)

**Goal:** Implement a production-grade Docker container hosting architecture for DPM2 (Next.js 15 Standalone + PostgreSQL 16 Alpine + Drizzle ORM + Better Auth) with automatic LAN host IP discovery, zero-downtime updates with automatic rollback, unprivileged container execution, and shell scripts learned directly from `../Bure_Card`.

### Architectural Reference & Patterns Studied

- `../Bure_Card/Dockerfile` — Learned multi-stage caching pattern (`deps`, `build`, `runtime`), standalone Next.js tracing, non-root `node` user execution, and `postgresql-client` runtime utility inclusion for database backups.
- `../Bure_Card/docker-compose.yml` — Learned network isolation strategy (internal bridge network `backend` where PostgreSQL port 5432 is strictly private and never exposed to the external LAN), container healthchecks using built-in `fetch` and `pg_isready`, and resource constraints (`1g` memory limit for app, `2g` for database).
- `../Bure_Card/start.sh` & `update.sh` — Learned interactive progress bars, self-updating Git logic, pre-flight Docker Engine & Compose validation, permission remediation for `run/backups/logs`, dynamic host LAN IP detection (`ip -4 route get 1.1.1.1`), and zero-downtime `--quick` updates with automated `pg_dump` backups and instant rollback on healthcheck timeout.
- `../Bure_Card/deploy/` — Studied `show-url.sh`, `static-ip.sh`, and `clinic-watcher.sh` background update daemon.

### Edge Cases & Gotchas Discovered

- **Standalone Output Mode in Next.js 15:** By default, Next.js does not package dependencies into `.next/standalone`. Setting `output: "standalone"` in `next.config.ts` enables tracing and creates a minimal self-contained production bundle, drastically shrinking runtime image size from ~1.2GB to < 220MB.
- **Better Auth Cookies over LAN HTTP vs. HTTPS:** When clients access the application across an on-premises factory LAN (e.g. `http://192.168.1.50:3000`), `NODE_ENV === "production"` would normally set `secure: true` on cookies. Because browsers reject Secure cookies on non-localhost HTTP, users could not stay logged in. Making `useSecureCookies` conditional on `COOKIE_SECURE=true` or an `https://` base URL allows seamless LAN authentication without compromising production reverse-proxy security.
- **Dynamic Origin Validation on Industrial Networks:** Plant managers and inspectors access the server using different IP addresses or hostnames. Adding dynamic `trustedOrigins` in `src/lib/auth.ts` extracts the incoming `origin` and `host` headers, allowing Better Auth to accept requests across all local LAN subnets without hardcoding IP addresses.
- **Drizzle Migrations in Standalone Container:** Running Drizzle migrations at container boot without devDependencies is achieved via `scripts/migrate.mjs`, utilizing native `drizzle-orm/node-postgres/migrator` and `pg` already in runtime dependencies.
- **Docker Socket Security:** Exposing `/var/run/docker.sock` to the web container creates root-equivalent vulnerabilities. In this architecture, updates are requested via an unprivileged flag file (`run/update.request`), monitored by host-side `deploy/dpm-watcher.sh`.

### Decision & Delivered Artifacts

1. `Dockerfile`: Multi-stage build (`node:22-alpine`), pnpm cache mounts, standalone build, `postgresql-client`, non-root user `node`, port 3000 exposed, and automatic migration on startup.
2. `docker-compose.yml`: `db` (Postgres 16 Alpine, 512MB shared buffers, healthcheck) and `app` (Next.js standalone, healthcheck probe, 1GB memory limit, internal bridge network).
3. `.dockerignore`: Prevents node_modules, .next, .git, and local logs from entering build context.
4. `start.sh`: Full Linux start script with self-update, pre-flight checks, LAN IP detection (`http://${LAN_IP}:${APP_PORT}`), live build animation, and zero-downtime quick update (`--quick`) with automated pre-update database backup and rollback.
5. `update.sh`: Host update script writing live progress to `run/update.status`.
6. `deploy/show-url.sh` & `deploy/static-ip.sh`: Interactive terminal scripts displaying LAN IP endpoints and guiding network configuration.
7. `deploy/dpm-watcher.sh` & `deploy/install-watcher.sh`: Systemd / cron background daemon watching `run/update.request`.
8. `START.bat`, `UPDATE.bat`, `deploy/show-url.bat`, `deploy/static-ip.bat`: Native Windows companion scripts for local execution.
9. `src/app/api/health/route.ts` & `src/app/api/health/route.test.ts`: Healthcheck endpoint verifying PostgreSQL connectivity (`SELECT 1`), tested and verified.
10. `next.config.ts`: Configured `output: "standalone"`.
11. `src/lib/auth.ts`: Dynamic `trustedOrigins` and LAN-safe `useSecureCookies`.
12. `.env.example`: Updated with complete Docker hosting settings.
13. `docker.md`: Administrator and developer deployment manual.

---

## 2026-11-12 — Dynamic Backend URL Inputting, Server Endpoint Presets & Multi-Environment PWA Switcher (Item 17)

**Goal:** Allow users to switch between local LAN factory servers (e.g. `http://192.168.1.100:3000`) and internet cloud instances (e.g. `https://dpm.homicho.et`) directly from the PWA's settings section, with admin-manageable server endpoint presets, real-time connectivity health probes (latency & version ping), persistent client configuration, and fallback resilience when offline.

### Architectural Patterns & Strategy

1. **Dual Switching Strategy:**
   - **App Host Switching (PWA Context Shift):** Allows the user to transfer their browser or PWA window to another server host (`window.location.href = targetServerUrl + path`).
   - **Client API Dynamic Resolution:** Enhances `apiClient` so relative `/api/*` requests automatically route to `getActiveBackendUrl()` if configured.
2. **Persistence & Reactivity:**
   - Stores active backend preference in `localStorage` (`dpm_active_backend_url`) and cookie (`dpm_backend_url`).
   - Emits a custom window event `"dpm:backend-changed"` so all components, hooks, and banners re-render reactively without page reloads when needed.
3. **Connectivity Pre-Flight Verification (Health Probe):**
   - Before switching, users can test any preset or custom URL. The probe contacts `${url}/api/health` and `${url}/api/version` with a 5000ms timeout.
   - Measures round-trip latency in milliseconds, checks database connectivity, and retrieves remote app version and git commit.
4. **Admin Endpoint Management:**
   - Database table `server_endpoints` stores shared corporate endpoints (LAN factory server, HQ cloud, edge gateway, etc.).
   - Admins (`sys_admin`) can add, update, toggle active/inactive, or delete server presets via Server Actions (`src/actions/server-endpoint-actions.ts`) and Admin Portal (`/admin` under "Servers" tab).
   - Authenticated/unauthenticated users receive active presets via `/api/server-endpoints` with hardcoded fallback presets if database or network is unreachable.
5. **Universal Accessibility:**
   - Available to logged-in users from Navbar desktop menu and mobile navigation drawer.
   - Available to logged-out users directly on the Login page (`/login`) so mobile workers can switch between LAN and Internet before authenticating.

### Edge cases & gotchas discovered

- **Mixed Content Warnings (HTTPS vs HTTP):** If the PWA is installed from an HTTPS origin (e.g., `https://dpm.cloud`), modern browsers block background `fetch()` calls to non-secure HTTP LAN IP addresses (`http://192.168.x.x`) due to Mixed Content policies. For HTTP LAN destinations, full host navigation (`window.location.href`) is the compliant, working approach. The UI displays an informational badge explaining this when switching between HTTPS and HTTP.
- **Trailing Slashes & URL Sanitation:** Users may enter URLs with trailing slashes, extra whitespace, or missing protocol schemes (`192.168.1.50:3000` instead of `http://192.168.1.50:3000`). `normalizeServerUrl` auto-prepends `http://` or `https://` if missing and strips trailing slashes to guarantee clean endpoint concatenation.
- **Offline / Isolated LAN Fallback:** If the client is completely offline or the primary DB is unreachable, the server switcher must still function using local presets and `localStorage` so users can switch to an available edge server.

---

## 2026-11-12 — Self-Healing System Updater, Host Flag Protocol & Live Log Streaming (Item 18)

**Goal:** Implement a self-healing in-app system updater on the SysAdmin portal (`/admin` -> System Updates) replicating the architecture from `Bure_Card`, allowing administrators to pull latest commits, run database migrations, and perform zero-downtime container reloads with live terminal log streaming and auto-rollback protection.

### Reference Architecture Studied

- `../Bure_Card/src/features/admin/components/system-updater.tsx`
- `../Bure_Card/src/app/api/update-status/route.ts`
- `../Bure_Card/deploy/clinic-watcher.sh`

### Architecture & Security Decisions

1. **Flag File Decoupling (`/run/updater/update.request`):**
   - The web container is run as non-root (`node:1000`) and does **not** mount the dangerous host `/var/run/docker.sock`.
   - Instead, the container writes a flag file into the shared volume `./run:/run/updater`.
   - The host watcher daemon (`deploy/dpm-watcher.sh` or systemd service) detects the flag, triggers `update.sh` (or `start.sh --quick`), pipes logs to `run/update.status`, and cleans up the flag.
2. **Real-time Terminal Log Streaming (`GET /api/update-status`):**
   - Protected endpoint restricted to `sys_admin` role only.
   - Reads `run/update.status` and parses lines, completion status (`done`), and rollback/failure indicators (`failed`).
   - The UI polls every 2 seconds, auto-scrolls the terminal output, and formats status messages with color indicators.
3. **Post-Restart Health Probe (`GET /api/health`):**
   - When the host script reports completion and recycles the container, the frontend transitions to the `restarting` phase.
   - Polls `/api/health` every 4 seconds until the new container returns HTTP 200, confirming both web server and PostgreSQL connectivity.
4. **Troubleshooting Diagnostics:**
   - If the update request sits on `[0/4] Waiting for host updater daemon...` for > 24 seconds without progress, the UI automatically surfaces troubleshooting commands (`sudo ./deploy/install-watcher.sh` or manual `./update.sh` execution).
5. **Testing & Verification:**
   - Unit tests covering `triggerSystemUpdateAction()` for both authorized sysadmin and unauthorized roles (`src/actions/admin-actions.test.ts`).
   - Endpoint tests for `/api/update-status` covering unauthenticated, forbidden, running, complete, and rollback states (`src/app/api/update-status/route.test.ts`).
   - Component tests for `<SystemUpdater />` with mock timers/intervals verifying confirmation modal, trigger execution, terminal log streaming, health polling, and failure recovery (`src/components/admin/system-updater.test.tsx`).
   - Integration test for SysAdmin navigation tab (`src/app/admin/admin-client.test.tsx`).

---

## 2026-11-13 — Developer Option Toggle & Strict Role Switcher Lockout for System Administrator

**Goal:** Ensure the floating role-switching tool (`RoleSwitcher`) is strictly restricted to authenticated System Administrators (`sys_admin`) who have explicitly enabled the "Developer Option" in Settings, hiding the button/icon completely from all other users, unauthenticated guests, and when disabled.

### Architecture & Access Control Decisions

1. **Triple-Gate Defense-in-Depth:**
   - **Gate 1 (Server & Layout `src/app/layout.tsx`):** `RoleSwitcher` is only rendered when `user && user.role === "sys_admin"`. Unauthenticated guests and non-sysadmin roles (OM, FM, QA) never have the component mounted into HTML/DOM.
   - **Gate 2 (Client & Hook `src/components/role-switcher.tsx` & `src/hooks/use-developer-mode.ts`):** Client-side check validates both `isSysAdmin` and `isDeveloperMode`. If either is false, `RoleSwitcher` immediately returns `null`.
   - **Gate 3 (Backend API `src/app/api/dev/switch-role/route.ts`):** Both `GET` and `POST` verify the active session belongs to an authenticated user with `role === "sys_admin"`. Unauthorized requests are rejected with HTTP 403 Forbidden.

2. **Settings Section Integration:**
   - **Global Settings Modal (`BackendServerSettingsModal`):** Added a dedicated "Developer Options (የደቨሎፐር ምርጫዎች)" card visible strictly when `isAdmin={true}`. Features an accessible toggle switch (`role="switch"`, `aria-checked`), badge indicator, and toast notifications.
   - **Admin Portal Settings (`src/app/admin/admin-client.tsx`):** Added the Developer Option switch in the "Industry Profile Settings" tab for seamless configuration from within the Admin Portal.
   - **In-Switcher Quick Dismiss:** Added a "Hide Switcher" button in the `RoleSwitcher` drawer footer to allow quick one-click deactivation.

3. **Persistence & Synchronization:**
   - Shared preference store in `src/lib/developer-mode.ts` using `localStorage` (`dpm_developer_mode_enabled`) and cookie fallback (`dpm_developer_mode`).
   - Cross-tab and in-page event dispatching (`dpm:developer-mode-changed`) so toggling in settings immediately updates the switcher on the page without requiring a page refresh.

### Edge cases & gotchas discovered

- In JSDOM / headless test environments, assigning `document.cookie = ""` does not delete existing cookies unless an expired date (`expires=Thu, 01 Jan 1970 00:00:00 GMT` / `max-age=0`) is explicitly provided. Updated `setDeveloperModeActive(false)` to always write the expired date header to guarantee clean cookie deletion.
- Non-sysadmin users opening settings must never see the Developer Options toggle, preventing accidental or unauthorized discovery.

### Verification & Tests Passing

- `src/lib/developer-mode.test.ts` (5 tests): verifies storage persistence, cookie deletion, non-sysadmin lockout, and toggle behavior.
- `src/components/role-switcher.test.tsx` (7 tests): verifies strict unmount when user is guest, OM, FM, QA, or when dev option is OFF; verifies FAB display when sysadmin has dev mode ON; verifies drawer interactions and role switching.
- `src/components/settings/backend-server-settings-modal.test.tsx` (10 tests): verifies developer option toggle is hidden from non-admins, displayed for sysadmin, and toggles preference.
- `src/app/admin/admin-client.test.tsx` (11 tests): verifies developer option card under Industry Profile Settings.
- `src/app/api/dev/switch-role/route.test.ts` (9 tests): verifies 403 Forbidden for non-sysadmin users on GET and POST.
- `src/components/navbar.test.tsx` (16 tests): all passing with zero regressions.

---

## 2026-11-13 — Master Production Planning: Ethiopian/Amharic Calendar Shift & Strict 1 Plan Per Product Rule

**Goal:** Fix Ethiopian calendar month index mapping in `PlanDatePicker` (resolving Hamle/Nehase month mixing and day count clamping) and enforce a strict 1-plan-per-product business constraint across backend actions and frontend planning UI.

### Root Cause Analysis & Calendar Math

1. **1-Indexed Month Array Mapping:**
   - In `src/lib/ethiopian-calendar.ts`, `ETH_MONTH_NAMES_AM` and `ETH_MONTH_NAMES_EN` are 1-indexed (index 0 is `""`, indices 1..13 are Meskerem through Pagume).
   - In `src/components/planning/plan-date-picker.tsx`, `ETH_MONTH_NAMES_AM.map((amName, idx) => ...)` mapped `idx = 0..13` with `mNum = idx + 1`. This caused every month name to be shifted by +1:
     - Hamle (index 11) was mapped with `mNum = 12` (Nehase).
     - Nehase (index 12) was mapped with `mNum = 13` (Pagume).
     - When Nehase was selected, the component treated it as Pagume (month 13), which only has 5 or 6 days! This clamped Nehase 30 to Pagume 5/6, corrupting the date range calculations.
   - **Fix:** Switched to explicit 1-based indexing using `Array.from({ length: 13 }, (_, i) => i + 1)`, correctly mapping month 11 to Hamle (30 days) and month 12 to Nehase (30 days).

2. **Conversion Accuracy Verification:**
   - Hamle 1, 2018 E.C. correctly converts to Gregorian `2026-07-08`.
   - Nehase 30, 2018 E.C. correctly converts to Gregorian `2026-09-05`.
   - The arithmetic in `ethToGregorian` and `gregorianToEth` was verified as 100% correct; the issue was purely UI index alignment in the select options.

### Strict 1 Plan Per Product Architecture

1. **Backend Database & Server Action Guard (`src/actions/plan-actions.ts`):**
   - In `createPlanAction`: Checks `db.query.plans.findFirst({ where: eq(plans.productId, data.productId) })`. If a plan exists, rejects with an error: `"A production plan already exists for this product. Only one plan per product is allowed."`
   - In `updatePlanAction`: Validates `and(eq(plans.productId, data.productId), ne(plans.id, data.id))`. Rejects any attempt to reassign a plan to a product that is already planned.
   - Preserves RBAC enforcement: Factory Managers (`fm`) can only create/update plans for their assigned factory (`factoryId`), while Operation Managers (`om`) and System Administrators (`sys_admin`) have multi-factory jurisdiction.

2. **Frontend UI Enforcement (`src/components/planning/planning-client.tsx`):**
   - `plannedProductIds`: Memoized `Set<string>` containing all product IDs that currently have a plan.
   - **Create Modal:**
     - Disables products in the `<select>` dropdown that already have a plan, appending `— [Plan Already Exists]` to their label.
     - Auto-selects the first available *unplanned* product when a line/factory is picked.
     - Form submit validation prevents submission if `plannedProductIds.has(createProductId)`.
   - **Edit Modal:**
     - Same visual indicators and validation guards ensuring an existing plan cannot be switched to another planned product.


---

## 2026-11-13 — PWA Download Button in Settings & Docker Standalone Build Resolution

**Goal:** Provide an accessible, one-click "Download App (PWA)" installation button and device guidance in the Settings Modal and Navbar, and resolve the Docker container build failure (`COPY --from=build ... /app/.next/standalone: not found`).

### Edge Cases & Gotchas Discovered

- **Next.js Docker Standalone Output Requirements:** When Next.js builds inside a multi-stage Docker container (`Dockerfile`), the runtime stage copies `/app/.next/standalone`. If `next.config.ts` has conditional `output` or if `NEXT_OUTPUT` is not set, Next.js defaults to standard build output without generating the `.next/standalone` directory, causing Docker BuildKit to crash with `failed to calculate checksum of ref ... "/app/.next/standalone": not found`.
  - **Fix:** Explicitly configured `output: "standalone"` directly in `next.config.ts` and set `ENV NEXT_OUTPUT="standalone"` in `Dockerfile` builder stage.
- **PWA Installation Behavior Across Platforms:**
  - On **Android / Chromium Desktop**, the browser fires `beforeinstallprompt`, allowing one-click native installation via `promptInstall()`.
  - On **iOS Safari**, Apple disables `beforeinstallprompt`, requiring user action via Share (⎋) → "Add to Home Screen" (+).
  - On **Standalone Mode** (already installed), opening the modal detects `display-mode: standalone` and displays a green badge `✓ Installed` with a confirmation toast.
  - Adding expandable step-by-step instructions for iOS, Android, and Desktop ensures 100% device coverage.

### Decision

1. **`next.config.ts` & `Dockerfile`:**
   - Updated `next.config.ts` to output `"standalone"` unconditionally.
   - Added `ENV NEXT_OUTPUT="standalone"` to `Dockerfile` build stage.
   - Hardened `start.sh` self-update to pull cleanly from `origin main`.
2. **`BackendServerSettingsModal` (`src/components/settings/backend-server-settings-modal.tsx`):**
   - Added dedicated "Download App (PWA) / አፕሊኬሽኑን ጫን" section card.
   - Added "Download App" button with `data-testid="download-pwa-button"`.
   - Added standalone mode detection via `window.matchMedia("(display-mode: standalone)")`.
   - Added expandable guide with tailored instructions for iOS Safari, Android, and Desktop PC.
3. **`Navbar` (`src/components/navbar.tsx`):**
   - Added "Download App (PWA)" button in Desktop Profile Dropdown.
   - Added "Download App (PWA)" button in Mobile Navigation Drawer.
4. **Automated Verification:**
   - `src/components/settings/backend-server-settings-modal.test.tsx`: 11/11 tests pass.
   - `src/components/navbar.test.tsx`: 18/18 tests pass.
   - `tsc --noEmit`: 0 errors.

---

## 2026-11-13 — Comprehensive API Endpoints Security Audit & Hardening (Cloudflare Skill)

**Goal:** Conduct a multi-phase defensive security audit across all 12 Next.js API endpoints and Edge Middleware using Cloudflare's official `security-audit-skill` framework, identifying and patching all Broken Access Control, CSRF, Unauthenticated Database Reset, Rate Limit Bypass, and Information Disclosure vulnerabilities.

### Libraries & Guidelines Evaluated

| Tool / Framework | Source | Verdict | Purpose |
| :--- | :--- | :--- | :--- |
| **`cloudflare/security-audit-skill`** | Cloudflare GitHub | **Selected** | 6-phase structured security audit framework (`RECONNAISSANCE.md`, `ATTACK-CLASSES.md`, `WEB-PROTOCOL-AND-AUTH.md`). |
| **Better-Auth (v1.1.21)** | Existing dependency | **Audited** | Inspected session validation, CSRF origin handling, cookie prefixes, and signing keys. |
| **Drizzle ORM Migrator** | Existing dependency | **Audited** | Hardened programmatic database migrations against unauthenticated execution. |
| **Next.js Edge Middleware** | Existing Next.js 15 | **Audited** | Enhanced rate limiting attribution using Cloudflare's `cf-connecting-ip` header. |

### Vulnerabilities Discovered & Remediated

1. **Better-Auth Trusted Origins Reflection (`src/lib/auth.ts` - HIGH):**
   - *Vulnerability:* The `trustedOrigins` callback blindly parsed and pushed whatever `Origin` or `Host` header was sent by the client into the trusted origins list. This completely bypassed Better-Auth's cross-origin request forgery protections.
   - *Fix:* Replaced header reflection with a strict allowlist derived from `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and `TRUSTED_ORIGINS`. In development mode only, local RFC 1918 LAN and loopback IPs are permitted for mobile PWA testing.
2. **Missing Authentication on Seeding & User Enumeration (`/api/seed-db`, `/api/seed` - CRITICAL):**
   - *Vulnerability:* Unauthenticated callers sending `GET /api/seed-db` received a full JSON dump of user emails, IDs, and roles. Adding `?force=true` triggered `seedDatabase({ reset: true })`, completely wiping all database tables.
   - *Fix:* Added hard production lockout (`NODE_ENV === "production"` returns 403 Forbidden). In development, required Sys Admin session authentication (`role === "sys_admin"`) or explicit `SEED_API_SECRET` bearer token. Removed user PII from responses and enforced `POST` for state changes.
3. **Unauthenticated Database Migrations (`/api/push-db`, `/api/migrate-db` - HIGH):**
   - *Vulnerability:* Any unauthenticated client reaching `/api/push-db` could trigger SQL migrations and inspect the inventory of all 21 database tables.
   - *Fix:* Protected routes with Sys Admin session check or `MIGRATION_API_SECRET` bearer token. Masked internal database driver errors in production.
4. **Rate Limit Bypass via Client-Controlled IP Headers (`src/middleware.ts` - MEDIUM):**
   - *Vulnerability:* Middleware extracted client IP addresses directly from `X-Forwarded-For` and `X-Real-IP`, which can be spoofed or rotated by attackers.
   - *Fix:* Prioritized Cloudflare's tamper-proof `cf-connecting-ip` header before fallback proxies. Extended production route lockout to `/api/seed` and `/api/seed-db`.
5. **Database Connection Error Information Disclosure (`/api/health` - LOW):**
   - *Vulnerability:* On database failure, `GET /api/health` returned raw driver error strings (`error.message`) to unauthenticated callers, exposing internal database hostnames, ports, and connection parameters.
   - *Fix:* Masked errors in production with generic `"Database service unavailable"`.
6. **Server Presets Creation Status Mapping (`/api/server-endpoints` - LOW):**
   - *Vulnerability:* `POST /api/server-endpoints` returned 500 when unauthenticated and 400 when unauthorized.
   - *Fix:* Added explicit `requireUser()` validation returning 401 Unauthorized for anonymous callers and 403 Forbidden for non-admin accounts.

### Automated Verification Results

- **API Test Files:** 11 passed (11 total)
- **API Endpoint Tests:** 50 passed (50 total)
- **Middleware Tests:** 5 passed (5 total)
- **TypeScript Typecheck:** 0 errors (`pnpm typecheck` passed cleanly)


