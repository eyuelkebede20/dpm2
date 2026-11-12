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

### `/calendar` (Month Production Calendar View)
- [x] Month navigation: Prev Month, Next Month, Today (`src/components/calendar/calendar-client.test.tsx`)
- [x] Calendar day cells: displays total output and variance badge (`src/components/calendar/calendar-client.test.tsx`)
- [x] Day cell click: opens side-drawer with line breakdown (`src/components/calendar/calendar-client.test.tsx`)
- [x] Drawer "Edit Report" button: deep-links to `/entry?date=...` (`src/components/calendar/calendar-client.test.tsx`)

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



