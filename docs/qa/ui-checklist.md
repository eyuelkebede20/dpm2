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

---

## 5. UI Stress-Testing Matrix (Worst-Case Edge Payloads)

- [x] 120-character unbroken product names and emails (`src/test/ui-stress-harness.test.tsx`)
- [x] Zero, negative, and extreme integer values (e.g. 1,000,000) (`src/test/ui-stress-harness.test.tsx`)
- [x] Empty database collections (zero factories, zero lines, zero users) (`src/test/ui-stress-harness.test.tsx`)
- [x] Offline / simulated network failure recovery (`src/lib/api-client.test.ts`)
