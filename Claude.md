# CLAUDE.md: Daily Product Manager (DPM)

A simple, clean web app where factory teams enter daily production numbers, compare them with the daily target, and browse past days on a calendar. Keep everything as simple as possible. If something feels complex, simplify it or ask.

## Stack

- Next.js (App Router, TypeScript strict)
- PostgreSQL + **Drizzle ORM** (`drizzle-kit` for migrations)
- **Tailwind CSS + DaisyUI** for UI components, **lucide-react** for icons
- zod for input validation
- Auth: Better Auth (email + password, Drizzle adapter, database sessions). Do not use Auth.js credentials (it forces JWT sessions, which are hard to revoke).
- No other libraries unless really needed. Ask before adding one.

## Roles and hierarchy

```
Sys Admin  → creates the Industry Profile and Operation Managers
OM         → creates Factories, Factory Managers (FM) and QA users
FM         → manages Lines, Products, Plans, daily entries and the Store of their factory
QA         → (Quality Assurance) records inspections for products assigned by the OM
```

`role` enum: `sys_admin`, `om`, `fm`, `qa`.

- No self-registration. Each role creates the roles below it, with a temporary password and forced change at first login.
- Single company. The Industry Profile is one settings record (name, working days, units, and `calendar_system: 'ethiopian' | 'gregorian'`).
- The primary and default calendar system across the system is the **Ethiopian Calendar** (ዓ.ም / EC, 13 months: 12 months of 30 days + Pagume of 5 or 6 days).
- Sys Admin can switch the company calendar preference (`ethiopian` vs `gregorian`) in the Admin Industry Profile settings at any time without database corruption or data loss.
- **Dev only:** Sys Admin can "sign in as" an OM or FM. Allowed only when `NODE_ENV !== "production"` AND `ENABLE_DEV_IMPERSONATION=true`. Show a banner while active.

## Data model (Drizzle, keep it small)

- `users`: id, email, name, role, created_by, active, must_change_password
- `industry_profile`: id, company_name, working_days, units, calendar_system (`ethiopian` | `gregorian`, default `ethiopian`), updated_at
- `factories`: id, name, om_id
- `factory_users`: factory_id, user_id (FM and QA belong to a factory)
- `lines`: id, factory_id, name
- `products`: id, factory_id, name, sku
- `line_products`: line_id, product_id
- `qa_assignments`: qa_user_id, product_id
- `plans`: id, line_id, product_id, start_date, end_date, planned_qty
- `report_entries`: id, date, line_id, product_id, `finished_good`, `rework`, `reject`, `scrap`, `wip`, downtime_minutes, issue_note, updated_by, updated_at. Unique on (date, line_id, product_id).
- `qa_inspections`: id, date, product_id, line_id, checked, defects, note, created_by
- `stock_ledger`: id, factory_id, product_id, delta, report_entry_id, created_at

Dates stored in PostgreSQL are plain ISO Gregorian `DATE` (YYYY-MM-DD, no time zone) to preserve data integrity and compatibility. All Ethiopian calendar conversions occur strictly at the application boundary (UI/API) using pure integer Julian Day Number (JDN) arithmetic (`src/lib/ethiopian-calendar.ts`). Time zone reference: `Africa/Addis_Ababa`.

## Daily target (important)

- Plan = `planned_qty` for a line + product over a period (`start_date` → `end_date`).
- **Daily target = planned_qty ÷ number of working days in the period.** Working days exclude non-working weekdays (default: Sunday off, configurable in the Industry Profile). Round for display only; keep decimals in calculations.
- **Variance for a day = `finished_good` − daily target.** Show it as `+12` (green) or `−8` (red). Also show % of target.
- Days with no plan or non-working days show no target.
- Put this logic in one pure function (`lib/target.ts`) with unit tests. Nothing else calculates targets.

## Business rules

- Quantities are non-negative integers. `wip` is entered daily with the others.
- The Store is fed automatically: saving a `finished_good` value writes a `stock_ledger` row, in the same transaction. Edits write only the difference. Current stock = sum of `delta`. Never store a mutable stock number.
- Soft-delete (active flag) users, factories, lines and products so history stays intact.

## UI and UX

Goal: light, clean, fast. DaisyUI light theme, lots of white space, rounded cards, lucide icons. Mobile-friendly, because people enter data on phones and tablets.

**Number entry must be effortless**

- One entry grid per day: a row per line + product, columns for finished good, rework, reject, scrap, WIP, downtime.
- Big numeric inputs with `inputmode="numeric"`, auto-select on focus, Enter or Tab moves to the next field.
- `−` / `+` stepper buttons beside each field, plus tap-friendly quick-add (+1, +5, +10).
- Live variance next to the row while typing (`+12` green / `−8` red vs target).
- One **Save** button (sticky at the bottom), with a clear saved/error toast. Warn before leaving with unsaved changes.

**Calendar view (key screen)**

- Dual Calendar support with **Ethiopian Calendar** (13 months: Meskerem through Pagume) as primary/default, plus Gregorian Calendar option.
- Month grid: each day cell shows total finished goods, target indicator, and variance badge (`+` green, `−` red, grey if non-working/no plan). Displays Ethiopian day number prominently with corresponding Gregorian date subtitle.
- Click a day → side panel (slide-over drawer on desktop, bottom sheet on mobile) previews that day's complete report: per line/product actual vs target, variance, rework/reject/scrap/WIP, downtime. Quick "Edit Daily Report" button opens the daily entry grid for that specific date.
- 13-month quick-jumper modal with year selector, previous/next month navigation, "Today (ዛሬ)" button, Amharic/English name toggle, and line/product filters.

**Other screens (MVP)**

1. Login, change password
2. Sys Admin: industry profile (calendar system selector: Ethiopian vs Gregorian, working days, units), OM list
3. OM: factories, FM/QA users, QA assignments
4. FM: lines, products, plans, fast entry grid (with Ethiopian date picker jumper), calendar, store stock
5. QA: assigned products, inspection form
6. Dashboard per role: today's output vs target with Ethiopian date header, month-to-date vs plan, totals for rework/reject/scrap/WIP

## Security (keep these essentials, do not skip)

Follow OWASP Top 10 and OWASP API Security Top 10 in spirit. The rules that matter most:

1. **Authorization on the server, every time.** Deny by default. Every route handler and server action calls `requireUser()` and then `can(user, action, resource)` from one file (`lib/authz.ts`). Check role AND scope (OM → own factories, FM/QA → own factory/assigned products). Load the record from the DB and verify it belongs to the caller; never trust IDs from the client.
2. **Never take role, factory_id, created_by or updated_by from the request.** Take them from the session.
3. **Validate all input with zod** (strict schemas, reject unknown fields). Return only the fields the UI needs; never return password hashes or internal fields.
4. **Login:** argon2id hashing, minimum 12-character passwords, generic error message, rate limit login and write endpoints, lock the account briefly after repeated failures.
5. **Sessions:** `HttpOnly`, `Secure`, `SameSite=Lax` cookies; idle timeout; revoke sessions when the password or role changes or the user is deactivated.
6. **API hygiene:** mutations use POST/PUT/PATCH/DELETE only; check `Origin` on state-changing requests; no wildcard CORS; cap page size and body size; no stack traces in errors.
7. **Injection:** Drizzle query builder or `sql` template with parameters only; never build SQL with string concatenation; never use `dangerouslySetInnerHTML` with user data.
8. **Config and secrets:** secrets only in env vars (never `NEXT_PUBLIC_*`, never in git); security headers (CSP, HSTS, `X-Content-Type-Options`, `frame-ancestors 'none'`); HTTPS only; least-privilege DB user.
9. **Dependencies:** commit the lockfile, run `pnpm audit` in CI.
10. **Logging:** log logins, failures, permission denials, and user/role/plan changes. Never log passwords or tokens. Fail closed: if an authorization check errors, deny.

Test: for each endpoint, check each role with an in-scope and an out-of-scope record. Never disable a security control to make a feature pass.

## Conventions

- Business logic lives in server actions/route handlers, UI components stay thin.
- Wrap multi-table writes in a DB transaction.
- Seed script creates one Sys Admin from env vars (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`) and demo data in dev.
- Done = input validated, authorization checked, no sensitive data in responses or logs, works on mobile.

## Commands

```
pnpm dev
pnpm drizzle-kit generate && pnpm drizzle-kit migrate
pnpm db:seed
pnpm lint && pnpm test
pnpm audit
```

## Build order

1. Project setup, Drizzle schema, seed, login, role guard
2. Users and hierarchy (Sys Admin → OM → FM/QA), factories, lines, products
3. Plans and the target function (with tests)
4. Entry grid with fast number input and live variance
5. Calendar view with day preview
6. Store ledger, QA inspections, dashboards
7. Security pass (authorization test matrix, headers, rate limits)

## Assumptions to confirm

1. Plan is entered per line + product for a date range (usually a month), and daily target = plan ÷ working days.
2. Sunday is the default day off. Public holidays can be marked non-working later.
3. Ethiopian Calendar (ዓ.ም / EC, 13 months) is the default active calendar across all production views (Calendar, Daily Entry Grid, Dashboard). Gregorian calendar is supported and configurable on the Admin Industry Profile, with boundary-only conversions.
4. Password reset is done by an admin until email is set up.
