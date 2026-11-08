# DPM (Daily Product Manager) Task Plan & Multi-Agent Work Allocation

## Overview
Based on `Claude.md`, DPM is a simple, clean factory management web app where factory teams enter daily production numbers, compare them against calculated daily targets, and browse past days on a calendar with light theme, rounded cards, and DaisyUI components.

---

## Agent Allocation

### 🤖 Agent 1: Architecture, Drizzle Schema, Auth, Core Business Logic & Seed
**Focus:** Backend foundations, database schema & migrations, target calculation logic with unit tests, Better Auth integration, server-side authorization guard, and database seeding.

- [x] Review `Claude.md` and initialize project configuration (`package.json`, `tsconfig.json`, `drizzle.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `.env`).
- [x] Define complete Drizzle schema (`src/db/schema.ts`):
  - `users` (id, email, name, role `sys_admin | om | fm | qa`, created_by, active, must_change_password)
  - Better Auth tables (`sessions`, `accounts`, `verifications` aligned with Drizzle adapter)
  - `industry_profile` (id, company_name, working_days, units, updated_at)
  - `factories` (id, name, om_id, active, created_at)
  - `factory_users` (factory_id, user_id)
  - `lines` (id, factory_id, name, active)
  - `products` (id, factory_id, name, sku, active)
  - `line_products` (line_id, product_id)
  - `qa_assignments` (qa_user_id, product_id)
  - `plans` (id, line_id, product_id, start_date, end_date, planned_qty)
  - `report_entries` (id, date, line_id, product_id, finished_good, rework, reject, scrap, wip, downtime_minutes, issue_note, updated_by, updated_at, unique on [date, line_id, product_id])
  - `qa_inspections` (id, date, product_id, line_id, checked, defects, note, created_by, created_at)
  - `stock_ledger` (id, factory_id, product_id, delta, report_entry_id, created_at)
- [x] Run Drizzle schema generation and migration (`drizzle-kit generate` & `drizzle-kit push` / `migrate`).
- [x] Implement `src/lib/target.ts`:
  - Pure function for daily target: `planned_qty ÷ working_days_in_period`.
  - Exclude configured non-working weekdays (default: Sunday off).
  - Calculate variance (`finished_good - daily_target`) and percentage.
  - No target on non-working days or days with no plan.
- [x] Implement target unit tests (`src/lib/target.test.ts`) with Vitest covering edge cases (leap years, month boundaries, non-working days, zero plans).
- [x] Implement Auth with Better Auth & Drizzle adapter:
  - Database sessions, email/password, temporary password change flag (`must_change_password`).
  - Dev impersonation endpoint/helper for Sys Admin (`ENABLE_DEV_IMPERSONATION=true`).
- [x] Implement Central Authorization Guard (`src/lib/authz.ts`):
  - `requireUser()` and `can(user, action, resource)`.
  - Role-based and scope-based checks (OM -> own factories, FM/QA -> own factory/assigned products).
- [x] Implement Database Seed script (`src/db/seed.ts`):
  - Creates Sys Admin from env vars (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`).
  - Creates demo Industry Profile, OM, Factory, FM, QA, Lines, Products, Plans, and initial entries.
- [x] Implement Core Server Actions / DB mutations:
  - Daily report entry save/update with atomic `stock_ledger` delta calculation inside a single DB transaction.

---

### 🎨 Agent 2: UI/UX, Fast Entry Grid & Calendar Experience
**Focus:** Frontend layout, DaisyUI styling, lightning-fast daily number entry grid, and interactive month calendar view.

- [x] Global styling and layout (`src/app/layout.tsx`, `src/app/globals.css`):
  - Clean DaisyUI light theme, rounded cards, crisp typography, responsive top navigation with user role badge, logout, and dev impersonation alert banner.
- [x] Fast Daily Entry Grid Screen (`/entry` or `/factories/[id]/entry`):
  - Ethiopian date header display with Amharic & English formatting (`formatEthDate`) and dual Gregorian subtitle.
  - Interactive Ethiopian Date Jumper Modal (select Year 2014-2020, Month 1-13, Day 1-30/6) with instant JDN boundary conversion.
  - Date selector with Prev/Next day, Yest, Today, and native date input support.
  - One table/grid row per Line + Product assigned to the factory.
  - Columns: Finished Good, Rework, Reject, Scrap, WIP, Downtime (min), Issue Notes.
  - Inputs formatted with `inputmode="numeric"`, auto-select on focus, Enter/Tab key navigation down/across fields.
  - Tap-friendly stepper buttons (`−` / `+`) and quick-add pills (`+1`, `+5`, `+10`).
  - Live client-side variance calculation dynamically displaying `+12` (green) / `−8` (red) and % vs daily target.
  - Sticky bottom Save bar with visual feedback, Ethiopian date display, unsaved changes confirmation on navigation, and toast notifications.
- [x] Calendar Screen (`/calendar` or `/factories/[id]/calendar`):
  - 13-Month Ethiopian Calendar grid view (Meskerem through Pagume) with dual Gregorian reference dates.
  - 13-Month Jumper Modal with quick year/month selector and "Today (ዛሬ)" button.
  - Amharic / English weekday and month name toggle.
  - Line / Product filter with real-time recalculation of cell outputs and variance badges.
  - Day details side panel (slide-over drawer on desktop, bottom sheet on mobile) displaying:
    - Detailed breakdown per Line & Product (Actual, Target, Variance, Rework, Reject, Scrap, WIP, Downtime).
    - Quick "Edit Report" button navigating directly to the entry grid for that specific day.
- [x] Reusable UI components (`src/components/ui`):
  - Stat cards, Stepper input, Status badges, Modal dialogs, Toast system.

---

### 🛡️ Agent 3: Role Portals, Workflows, Dashboards & Security Verification
**Focus:** Role-based management screens (Sys Admin, OM, FM, QA), Store Stock Ledger, QA Inspection forms, Analytics Dashboards, and End-to-End Security Validation.

- [x] Authentication Screens:
  - `/login`: Clean email/password form with rate-limiting and clear error handling.
  - `/change-password`: Forced password change workflow for newly provisioned users (`must_change_password`).
- [x] Sys Admin Portal (`/admin`):
  - Industry Profile management: company name, working days configuration (checkboxes Mon–Sun), unit of measure.
  - Active Calendar System selector (`ethiopian` vs `gregorian`) with immediate live update and boundary conversion.
  - Operation Managers (OM) list and creation modal (email, name, temporary password).
  - Dev Impersonation toolbar (switch active session to any OM/FM when enabled).
- [x] Operation Manager (OM) Portal (`/om`):
  - Factories overview and factory creation.
  - User management: provision Factory Managers (FM) and QA inspectors with temporary passwords.
  - QA Product Assignment matrix (assign QA inspectors to products).
- [x] Factory Manager (FM) Portal (`/fm`):
  - Manage Lines & Products (create, soft-delete toggle).
  - Link Products to Lines (`line_products`).
  - Manage Production Plans (select Line + Product, start date, end date, planned quantity).
  - Store Stock Ledger view (`/fm/store`): displays accumulated stock balance (`sum(delta)` per product) and transaction history log.
- [x] QA Inspector Portal (`/qa`):
  - View assigned products list.
  - Inspection form: Date, Line, Product, quantity checked, defects found, notes, inspection history.
- [x] Role-Tailored Dashboards (`/dashboard`):
  - Sys Admin: System overview, active factories, OMs.
  - OM: Factory performance comparison, total output vs monthly target.
  - FM: Today's factory output vs target, Month-to-date plan progress, totals for Rework, Reject, Scrap, and WIP.
  - QA: Daily defect rate, inspection count.
- [x] Security Pass & Validation:
  - Verify every route handler & server action enforces `requireUser()` and `can(user, action, resource)`.
  - Validate all payloads with strict Zod schemas (rejecting unknown fields).
  - Confirm transactions for multi-table writes (`stock_ledger` atomic updates).
  - Security headers verification in Next.js config.
- [x] Comprehensive Unit Test Suite Across All Workflows (13 test suites, 165 unit tests):
  - Daily target & variance calculation edge cases (`src/lib/target.test.ts`)
  - RBAC & Authorization guard permissions matrix (`src/lib/authz.test.ts`, `src/lib/rbac.test.ts`)
  - Ethiopian calendar conversion & date utilities (`src/lib/ethiopian-calendar.test.ts`)
  - Password change workflow & transaction tests (`src/actions/auth-actions.test.ts`)
  - Daily production reporting & atomic stock ledger delta calculations (`src/actions/report-actions.test.ts`)
  - Sys Admin workflows: industry profile, OM provisioning, user toggle, impersonation candidates (`src/actions/admin-actions.test.ts`)
  - OM workflows: factory creation, FM/QA user provisioning, factory ownership validation, QA assignment matrix (`src/actions/om-actions.test.ts`)
  - FM workflows: lines, products, line-product links, plans validation, store stock view (`src/actions/fm-actions.test.ts`)
  - QA workflows: workspace data, inspection validation (defects <= checked), assignment authorization, history (`src/actions/qa-actions.test.ts`)
  - Role dashboards: Sys Admin, OM, FM, QA dashboard aggregations & formulas (`src/actions/dashboard-actions.test.ts`)
  - Data & calendar aggregation: user context, daily grid assembly, month calendar summary, store ledger (`src/actions/data.test.ts`)
  - Dev impersonation API route: role checks, dev mode flags, cookie management (`src/app/api/admin/impersonate/route.test.ts`)

---

## Execution Sequence
1. **Agent 1** establishes the database schema, Drizzle migration/push, Better Auth setup, target calculation with Vitest suite, seed script, and database transactions.
2. **Agent 2** designs and builds the DaisyUI layout, navigation, Daily Entry Grid with real-time variance and steppers, and the Calendar Month Grid with day preview drawer.
3. **Agent 3** implements the role portals (Admin, OM, FM, QA), Store Stock view, QA Inspection forms, Role Dashboards, and performs security verification.
4. **Impeccable UX Audit Engine**: Conducted exhaustive 5-pillar audit across all viewports (Mobile, Tablet, Desktop), eliminated all identified friction points, implemented mobile navigation drawer, frozen line column grid, mobile card toggle, live target and yield calculators, 1-click password copy, and verified 100% clean type check and test suite (165/165 passing).
