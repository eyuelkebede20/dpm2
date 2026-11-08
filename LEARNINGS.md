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
