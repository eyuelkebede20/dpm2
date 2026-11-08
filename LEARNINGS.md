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
