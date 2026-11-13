# UI & Interactive Element Verification Checklist

This living checklist tracks every interactive element (buttons, forms, links, toggles, keyboard shortcuts) across all DPM screens.

---

## 1. Global Core Components

### `<Button />` (Universal Primitive)
- [x] Renders accessible role `button` and accessible name
- [x] Visual focus indicator on keyboard tab navigation (`focus-visible:ring-2`)
- [x] Activates via keyboard `Enter` and `Space`
- [x] Enforces loading lockout: `aria-busy="true"` and blocks duplicate invocations
- [x] Prevents double-click race conditions
- [x] Disabled state prevents events and communicates disabled status
- [x] Icon slots render correctly on left and right without layout shift

### `<ErrorBoundary />` (Resilience Wrapper)
- [x] Catches runtime render errors in isolated regions
- [x] Displays friendly user-facing fallback without technical stack traces
- [x] Provides actionable Retry / Reset button that clears error and remounts children
- [x] Fires `onError` diagnostic callback with error details

---

## 2. Authentication & Account Screens

### `/login` (Login Screen)
- [x] Email input: focus, validation, keyboard entry (`src/app/login/login-client.test.tsx`)
- [x] Password input: show/hide toggle, min-length validation (`src/app/login/login-client.test.tsx`)
- [x] Sign In button: loading spinner during in-flight request, double-click prevention (`src/app/login/login-client.test.tsx`)
- [x] Error alert: surfaces clear user message on invalid credentials (`src/app/login/login-client.test.tsx`)
- [x] Rate-limit countdown lock: disables submit button during lockout window (`src/app/login/login-client.test.tsx`)
- [x] Auto-redirects if already authenticated (`src/actions/auth-actions.test.ts`)

### `/change-password` (Forced Password Change)
- [x] New password & confirm password validation (`src/app/change-password/change-password-client.test.tsx`)
- [x] Copy temporary password feedback (`src/app/change-password/change-password-client.test.tsx`)
- [x] Submit button: loading lockout and password mismatch feedback (`src/app/change-password/change-password-client.test.tsx`)
- [x] Success state redirects to dashboard (`src/actions/auth-actions.test.ts`)

---

## 3. Factory Management Screens

### `/entry` (Fast Daily Number Entry Grid)
- [x] Date switcher: previous day, next day, today, Ethiopian/Gregorian toggle (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] Numeric inputs: `inputmode="numeric"`, auto-select on focus, Enter/Tab key navigation (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] Stepper buttons: `−` and `+` buttons decrement/increment by 1 (`src/components/ui/stepper-input.test.tsx`)
- [x] Quick-add pills: `+1`, `+5`, `+10` add quantity instantly (`src/components/ui/stepper-input.test.tsx`)
- [x] Live variance pill: calculates `Finished Good - Daily Target` dynamically (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] Save Report sticky bar: loading lockout, success toast, unsaved navigation guard (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] Strict 1 Entry Per Day Lockout: locks all inputs and steppers when entry is submitted, rendering completion banner and badge (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] Immediate in-session lockout after save, preventing duplicate or subsequent submissions (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] Admin override mode: allows Sys Admin to edit numbers when needed with visible override indicator (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] Unreviewed daily report warning banner: surfaces when report has not received OM review (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] Product unreviewed & not uploaded warning signs: displayed on product rows and cards when unreviewed or unrecorded (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] Strict FM monthly alteration lockout: locks all steppers, inputs, and submit button when viewing past month (`src/components/entry-grid/daily-entry-client.test.tsx`, `src/actions/report-actions.test.ts`)
- [x] 1-Click "Notify Factory Managers" reminder action for OM (`src/components/entry-grid/daily-entry-client.test.tsx`, `src/actions/review-actions.test.ts`)

### `/calendar` (Month Production Calendar View)
- [x] Month navigation: Prev Month, Next Month, Today (`src/components/calendar/calendar-client.test.tsx`)
- [x] Quick Month Jumper: responsive mobile bottom-sheet modal (`animate-in slide-in-from-bottom`, drag handle) and desktop centered dialog supporting 13 Ethiopian months & 12 Gregorian months (`src/components/calendar/calendar-client.test.tsx`)
- [x] Responsive Calendar Date Boxes: bold font-mono numerals (`text-sm sm:text-base md:text-lg font-black`), dual-calendar micro-labels (`EC` / `GC`), high-contrast rings (Today, Holiday, Off-day), touch targets ≥ 44px (`src/components/calendar/calendar-client.test.tsx`)
- [x] Compact vs Grid vs List view modes with mobile-optimized compact badge indicators (`✦` for holidays) preventing overcrowded text overlap (`src/components/calendar/calendar-client.test.tsx`)
- [x] Day cell click: opens responsive bottom-sheet inspection drawer on mobile (< 640px) and inline card on desktop with line breakdown (`src/components/calendar/calendar-client.test.tsx`)
- [x] Drawer "Edit Daily Production Numbers" button: deep-links to `/entry?date=...` (`src/components/calendar/calendar-client.test.tsx`)
- [x] Responsive Ethiopian Date Picker Modal: mobile-native bottom sheet (`rounded-t-3xl`, drag handle, `pb-safe`) and desktop centered dialog with 7-column weekday headers (`ETH_PICKER_WEEKDAYS`), leading blank offset, and live dual-date preview chips (`src/components/entry-grid/daily-entry-client.test.tsx`)

### `/entry` (Daily Entry & Production Tracking)
- [x] Top Section Hierarchy: reminder banners (Unreviewed warning, month-locked, holiday, OM mode) and smaller KPI cards rendered at the top of the page before controls (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] Dedicated Controls Toolbar: positioned directly after KPI cards and above grid for maximum accessibility (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] Search input: filters production lines by line name, product name, or SKU with clear button (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] Sorting selector: sorts by line name (A-Z/Z-A), product name, finished good, daily target, and variance (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] Product filter dropdown & Product performance strip: synchronized filtering across both controls (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] Group Mode Toggle: seamlessly switches between "By Product" and "By Line" views (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] View Mode Switcher: switches between Table View and mobile-optimized Card View (`src/components/entry-grid/daily-entry-client.test.tsx`)
- [x] Empty state handling: clear feedback when search query has 0 matches with 1-click "Clear Search" button (`src/components/entry-grid/daily-entry-client.test.tsx`)

---

## 4. Role Administration & Management Portals

### `/admin` (System Administrator Portal)
- [x] Navigation tabs: switch between "Role Assignment & Users" and "Industry Profile" (`src/app/admin/admin-client.test.tsx`)
- [x] Role Assignment Table: inline `<select>` updates user role with live feedback (`src/app/admin/admin-client.test.tsx`)
- [x] Role Filter Pills: filters user list by `sys_admin`, `om`, `fm`, `qa` (`src/app/admin/admin-client.test.tsx`)
- [x] Search input: live filter by user name or email (`src/app/admin/admin-client.test.tsx`)
- [x] "Provision User" button: opens modal with role selector (`src/app/admin/admin-client.test.tsx`)
- [x] User Active toggle: activates/deactivates user accounts (`src/app/admin/admin-client.test.tsx`)
- [x] Dev Impersonation toolbar: switches session into candidate OM/FM (`src/app/admin/admin-client.test.tsx`)

### `/om` (Operation Manager Portal)
- [x] Tabs: "Factories", "Factory Personnel & Role Assignment", "QA Matrix" (`src/app/om/om-client.test.tsx`)
- [x] Create Factory modal: validation, submit lockout, factory card addition (`src/app/om/om-client.test.tsx`)
- [x] Factory Personnel Table: inline role dropdown switches role between `fm` and `qa` (`src/app/om/om-client.test.tsx`)
- [x] Provision Team Member modal: validates plant assignment and temporary password (`src/app/om/om-client.test.tsx`)
- [x] QA Matrix checkboxes: toggles assignment with pending spinner (`src/app/om/om-client.test.tsx`)
- [x] Notification badge & report card OM review sign-off (`src/actions/review-actions.test.ts`)
- [x] Item-by-item OM review with note and approval status (`src/actions/review-actions.test.ts`)
- [x] Operating plant cards display `⚠️ Review Pending` warning sign (`src/app/om/om-client.test.tsx`)
- [x] Quick "Notify FM" button dispatches upload reminder notifications to assigned Factory Managers (`src/app/om/om-client.test.tsx`, `src/actions/review-actions.test.ts`)

### `/qa` (Quality Assurance Portal)
- [x] Pending reports list with status badges (`src/actions/qa-actions.test.ts`)
- [x] 1-Click Approve / Deny with optional feedback notes (`src/actions/qa-actions.test.ts`)
- [x] Revalidation propagation: updates `/entry`, `/om`, and `/calendar` immediately on review (`src/actions/qa-actions.test.ts`)
- [x] QA approval status banner rendered in Daily Entry Grid card with inspector name (`src/components/entry-grid/daily-entry-client.test.tsx`)

---

## 5. UI Stress-Testing Matrix (Worst-Case Edge Payloads)

- [x] 120-character unbroken product names and emails (`src/test/ui-stress-harness.test.tsx`)
- [x] Zero, negative, and extreme integer values (e.g. 1,000,000) (`src/test/ui-stress-harness.test.tsx`)
- [x] Empty database collections (zero factories, zero lines, zero users) (`src/test/ui-stress-harness.test.tsx`)
- [x] Offline / simulated network failure recovery (`src/lib/api-client.test.ts`)

---

## 6. Progressive Web App (PWA) & Over-The-Air (OTA) Updates Engine

### Service Worker & Caching Strategy (`public/sw.js`)
- [x] Pre-caches critical offline assets (`/offline`, `/icons/*`, `/manifest.webmanifest`) during `install`
- [x] Automatically purges obsolete version cache buckets upon `activate`
- [x] Stale-While-Revalidate caching for static Next.js assets (`/_next/static/*`), fonts, CSS, and icons
- [x] Network-First with Cache fallback for HTML navigations, gracefully degrading to `/offline` when disconnected
- [x] Structured 503 JSON fallback for offline API calls (`/api/*`)
- [x] Cache-Control headers configured in `next.config.ts` (`no-cache, no-store, must-revalidate` for `/sw.js` and `/api/version`)

### Over-The-Air (OTA) Updates & Install Flow
- [x] Manual "Check for Updates" button in desktop navbar profile menu (`src/components/navbar.test.tsx`)
- [x] Manual "Check for Updates" button in mobile drawer (`src/components/navbar.test.tsx`)
- [x] Live version check endpoint with GitHub commit tracking (`src/app/api/version/route.test.ts`)
- [x] Accessible `<PwaOtaBanner />` (`role="alert"`) informing user of new versions with release notes and GitHub commit link (`src/components/pwa/pwa-ota-banner.test.tsx`)
- [x] "Update Now / አዘምን" button triggers `SKIP_WAITING` and reloads window via `controllerchange` (`src/components/pwa/pwa-ota-banner.test.tsx`)
- [x] "Later" and "X" close buttons dismiss banner cleanly (`src/components/pwa/pwa-ota-banner.test.tsx`)
- [x] PWA Install Prompt handling (`beforeinstallprompt`) with 1-tap "Install App" button (`src/components/pwa/pwa-ota-banner.test.tsx`)
- [x] Offline fallback page with bilingual messaging and "Try Reconnecting" button (`src/app/offline/page.test.tsx`)

---

## 7. Backend Server Endpoint Switcher & LAN / Cloud Configuration

### `<BackendServerSettingsModal />` (User Settings Section)
- [x] Accessible dialog (`role="dialog"`, title, backdrop click, Escape key close) (`src/components/settings/backend-server-settings-modal.test.tsx`)
- [x] Displays currently active server with live green pulse status and custom route indicator (`src/components/settings/backend-server-settings-modal.test.tsx`)
- [x] Preset server list selection (Factory LAN, Internet Cloud, Localhost) (`src/components/settings/backend-server-settings-modal.test.tsx`)
- [x] Custom URL input with scheme auto-prefixing (`http://` / `https://` quick toggles) (`src/components/settings/backend-server-settings-modal.test.tsx`)
- [x] "Test Connection" button with real-time ping latency (ms), HTTP status, and app version diagnostics (`src/components/settings/backend-server-settings-modal.test.tsx`)
- [x] "Switch & Connect" button saving selection to `localStorage` and cookie, executing pre-flight verification, and navigating to new host (`src/components/settings/backend-server-settings-modal.test.tsx`)
- [x] "Reset Host" button restoring default window origin (`src/lib/backend-config.test.ts`)
- [x] Admin inline "+ Add Preset" form expanding directly for `sys_admin` (`src/components/settings/backend-server-settings-modal.test.tsx`)

### Admin Portal Server Management (`/admin` -> Servers Tab)
- [x] Tab navigation: 3rd tab "Server Endpoints (LAN / Cloud)" with item count badge (`src/app/admin/admin-client.test.tsx`)
- [x] Server presets table displaying Name, URL, Environment, Default status, and Active status (`src/app/admin/admin-client.test.tsx`)
- [x] "Add Server Preset" modal: provisions new shared presets into PostgreSQL (`src/app/admin/admin-client.test.tsx`)
- [x] Ping connectivity test button per server row displaying latency in milliseconds (`src/app/admin/admin-client.test.tsx`)
- [x] Active / Inactive status toggle button (`src/actions/server-endpoint-actions.test.ts`)
- [x] Delete preset confirmation and database deletion (`src/actions/server-endpoint-actions.test.ts`)

### Access Entrypoints
- [x] Desktop Navbar Profile Dropdown: "Server Settings (LAN / Cloud)" item (`src/components/navbar.test.tsx`)
- [x] Mobile Navigation Drawer: "Server Settings (LAN / Cloud)" button (`src/components/navbar.test.tsx`)
- [x] Login Screen: "Server: ... Change Server" quick pill allowing pre-login server switching (`src/app/login/login-client.test.tsx`)

---

## 8. System Updates & Self-Healing Deployment (Learned from Bure_Card)

### `<SystemUpdater />` (`/admin` -> System Updates Tab)
- [x] Tab navigation: 4th tab "System Updates & Deployment (የሲስተም ማዘመኛ)" in SysAdmin portal (`src/app/admin/admin-client.test.tsx`)
- [x] Automated host-container update pipeline explanation banner with rollback protection details (`src/components/admin/system-updater.test.tsx`)
- [x] "Pull Latest Updates & Rebuild" trigger button with accessible loading states (`aria-busy`, disabled lockout) (`src/components/admin/system-updater.test.tsx`)
- [x] Modal confirmation dialog with warning on automatic restart and database migration execution (`src/components/admin/system-updater.test.tsx`)
- [x] Server Action `triggerSystemUpdateAction()` writes flag file `/run/updater/update.request` or runs host script (`src/actions/admin-actions.test.ts`)
- [x] Live log terminal pane streaming real-time output from `/api/update-status` (`src/components/admin/system-updater.test.tsx`)
- [x] Status polling loop every 2 seconds with troubleshooting diagnostics if host watcher is uninstalled (`src/components/admin/system-updater.test.tsx`)
- [x] Healthcheck verification polling `/api/health` every 4 seconds during container reboot until HTTP 200 (`src/components/admin/system-updater.test.tsx`)
- [x] Accessible completion alerts: emerald success banner on recovery or rose alert on failure/rollback (`src/components/admin/system-updater.test.tsx`)

---

## 9. Developer Option & Role Switcher Access Control

### `<RoleSwitcher />` (Floating Role Changing Icon / Button)
- [x] Complete hidden lockout for unauthenticated guests (`user === null`) (`src/components/role-switcher.test.tsx`)
- [x] Complete hidden lockout for all non-sysadmin roles (OM, FM, QA) even if dev mode was previously enabled in localStorage (`src/components/role-switcher.test.tsx`)
- [x] Hidden lockout for `sys_admin` when Developer Option is turned OFF (default state) (`src/components/role-switcher.test.tsx`)
- [x] Displays floating action pill ONLY when authenticated as `sys_admin` AND Developer Option is turned ON (`src/components/role-switcher.test.tsx`)
- [x] Open / close popover drawer via floating action button and Close button (`src/components/role-switcher.test.tsx`)
- [x] Role switching buttons: instant session generation and redirect to destination workspace (`src/components/role-switcher.test.tsx`)
- [x] "Hide Switcher" footer button: instantly deactivates developer mode and unmounts switcher (`src/components/role-switcher.test.tsx`)

### Settings Developer Option Controls
- [x] User Settings Modal (`<BackendServerSettingsModal />`): "Developer Options" card hidden for non-admins, visible for `sys_admin` (`src/components/settings/backend-server-settings-modal.test.tsx`)
- [x] User Settings Modal: accessible switch toggle (`role="switch"`, `aria-checked`) turning role switcher ON/OFF with toast feedback (`src/components/settings/backend-server-settings-modal.test.tsx`)
- [x] Admin Portal Settings (`/admin` -> Industry Profile Settings): Developer Option switch card toggling developer mode (`src/app/admin/admin-client.test.tsx`)
- [x] Backend API route `/api/dev/switch-role`: GET and POST enforce `sys_admin` authentication check and reject unauthorized requests with 403 Forbidden (`src/app/api/dev/switch-role/route.test.ts`)

---

## 10. Progressive Web App (PWA) & Offline Capabilities

### Download / Install App (PWA) Button & Settings Guide
- [x] Settings Modal (`<BackendServerSettingsModal />`): Dedicated PWA installation card with responsive badge indicating installation state (`src/components/settings/backend-server-settings-modal.test.tsx`)
- [x] Action button (`data-testid="download-pwa-button"`): Prompts native installation via `promptInstall()` when installable (`src/components/settings/backend-server-settings-modal.test.tsx`)
- [x] Standalone mode detection: Displays emerald badge "✓ Installed (Standalone App)" when running as installed PWA (`src/components/settings/backend-server-settings-modal.tsx`)
- [x] Device Installation Guide: Expandable instructions for iOS Safari, Android Chrome, and Desktop Chrome/Edge (`src/components/settings/backend-server-settings-modal.test.tsx`)
- [x] Navbar Desktop Profile Menu: "Download App (PWA)" button (`data-testid="navbar-download-pwa-button"`) triggers install or opens guide (`src/components/navbar.test.tsx`)
- [x] Navbar Mobile Navigation Drawer: "Download App (PWA)" button (`data-testid="mobile-download-pwa-button"`) triggers install or opens guide (`src/components/navbar.test.tsx`)

---

## 11. Master Production Planning (`/planning`)

### Plan Date Picker (`<PlanDatePicker />`)
- [x] Correctly renders 13 Ethiopian months without off-by-one shifts (`src/components/planning/plan-date-picker.test.tsx`)
- [x] Accurately maps Hamle 1, 2018 E.C. to 2026-07-08 Gregorian (`src/components/planning/plan-date-picker.test.tsx`)
- [x] Accurately maps Nehase 30, 2018 E.C. with full 30 days to 2026-09-05 Gregorian without Pagume clamping (`src/components/planning/plan-date-picker.test.tsx`)
- [x] Synchronizes Gregorian ISO strings with Ethiopian day/month/year selections (`src/components/planning/plan-date-picker.test.tsx`)

### 1 Plan Per Product Constraint & Planning Modals
- [x] Backend `createPlanAction` rejects duplicate plan for the same product (`src/actions/plan-actions.test.ts`)
- [x] Backend `updatePlanAction` rejects reassignment to a product that already has another plan (`src/actions/plan-actions.test.ts`)
- [x] New Production Plan modal disables already-planned products in `<select>` with "— [Plan Already Exists]" label (`src/components/planning/planning-client.test.tsx`)
- [x] Auto-selects first unplanned product upon line/factory selection (`src/components/planning/planning-client.test.tsx`)
- [x] Client-side form submit guard blocks creating duplicate plan for same product (`src/components/planning/planning-client.test.tsx`)
- [x] Edit modal prevents duplicate product reassignment (`src/components/planning/planning-client.test.tsx`)

### Multi-Period Tabs (Daily, Weekly, Monthly) & Batch Schedule Initialization
- [x] Unplanned Products Warning Banner (`data-testid="unplanned-warning-banner"`) displays count, list of unplanned products, and Amharic badge (`src/components/planning/planning-client.test.tsx`)
- [x] Batch Add Plans button (`data-testid="batch-add-plans-button"`) opens modal for OM, initializing plans across all unplanned products (`src/components/planning/planning-client.test.tsx`)
- [x] Backend `batchCreatePlansAction` filters out products with existing plans, rejects FM role, and inserts baseline plans (`src/actions/plan-actions.test.ts`)
- [x] Tab Switcher: seamless switching between Daily (`tab-daily`), Weekly (`tab-weekly`), Monthly (`tab-monthly`), and Master (`tab-master`) (`src/components/planning/planning-client.test.tsx`)
- [x] Daily Tab: date navigation (Prev, Next, Today), daily target based on 26-day manufacturing cycle, day output, variance, and status (`src/components/planning/planning-client.test.tsx`)
- [x] Weekly Tab: weekly target, 7-day trailing output, remaining balance, progress bar, and pacing status (`src/components/planning/planning-client.test.tsx`)
- [x] Monthly Tab: monthly scheduled target, month-to-date output, remaining balance, fulfillment bar, and completion status (`src/components/planning/planning-client.test.tsx`)
- [x] Quick `+ Set Plan` action: OM can click `set-plan-[productId]` on any unplanned product row to prefill and open create modal (`src/components/planning/planning-client.test.tsx`)
- [x] Factory Manager Read-Only Lockdown: FM sees all 4 tabs, warnings, targets, and progress, with all alteration controls (`New Plan`, `Batch Add`, `Edit`, `Set Plan`) strictly hidden (`src/components/planning/planning-client.test.tsx`)

---

## 12. DevMode Role Switcher & Authentication Resilience

### SysAdmin Dev Token Role Switching (`<RoleSwitcher />`)
- [x] Issues signed `dpm_dev_sysadmin_token` cookie when Sys Admin logs in or switches roles (`src/lib/dev-token.test.ts`, `src/app/api/auth/status/route.test.ts`)
- [x] `verifySysAdminDevToken` checks HMAC-SHA256 signature, validates database user active status, and confirms `sys_admin` role (`src/lib/dev-token.test.ts`)
- [x] Session context (`getSessionContext()`) reads dev token and preserves `canSwitchRole: true` across all role transitions (`src/lib/authz.test.ts`)
- [x] `<RoleSwitcher />` remains visible and fully interactive when switched to `om`, `fm`, or `qa` (`src/components/role-switcher.test.tsx`)
- [x] `/api/dev/switch-role` (GET, POST) allows role switching when active session role is `sys_admin` OR valid `dpm_dev_sysadmin_token` is present (`src/app/api/dev/switch-role/route.test.ts`)
- [x] Explicit Sign Out (`handleSignOut`) and `DELETE /api/dev/switch-role` clear `dpm_dev_sysadmin_token`, `dpm.session_token`, and `dpm_impersonate_user_id` (`src/components/navbar.tsx`, `src/app/api/dev/switch-role/route.test.ts`)

### Temporary Password Login Removal
- [x] Removed all forced redirects to `/change-password` from `LoginClient` on mount and after successful authentication (`src/app/login/login-client.test.tsx`)
- [x] `requireAuthPage()` does not force redirect users with `mustChangePassword = true` to `/change-password`, routing directly to requested page or `/dashboard` (`src/lib/authz.test.ts`)
- [x] User creation actions (`createOmAction`, `createUserAction`, `provisionFactoryUserAction`) default `mustChangePassword` to `false` (`src/actions/admin-actions.test.ts`, `src/actions/om-actions.test.ts`)
- [x] Admin password reset schema (`adminResetPasswordSchema`) defaults `mustChangePassword` to `false` (`src/actions/admin-actions.test.ts`)







