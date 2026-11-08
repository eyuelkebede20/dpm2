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
- [ ] Email input: focus, validation, keyboard entry
- [ ] Password input: show/hide toggle, min-length validation
- [ ] Sign In button: loading spinner during in-flight request, double-click prevention
- [ ] Error alert: surfaces clear user message on invalid credentials
- [ ] Rate-limit countdown lock: disables submit button during lockout window
- [ ] Auto-redirects if already authenticated

### `/change-password` (Forced Password Change)
- [ ] New password & confirm password validation
- [ ] Copy temporary password feedback
- [ ] Submit button: loading lockout and password mismatch feedback
- [ ] Success state redirects to dashboard

---

## 3. Factory Management Screens

### `/entry` (Fast Daily Number Entry Grid)
- [ ] Date switcher: previous day, next day, today, Ethiopian/Gregorian toggle
- [ ] Numeric inputs: `inputmode="numeric"`, auto-select on focus, Enter/Tab key navigation
- [ ] Stepper buttons: `−` and `+` buttons decrement/increment by 1
- [ ] Quick-add pills: `+1`, `+5`, `+10` add quantity instantly
- [ ] Live variance pill: calculates `Finished Good - Daily Target` dynamically
- [ ] Save Report sticky bar: loading lockout, success toast, unsaved navigation guard

### `/calendar` (Month Production Calendar View)
- [ ] Month navigation: Prev Month, Next Month, Today
- [ ] Calendar day cells: displays total output and variance badge
- [ ] Day cell click: opens side-drawer with line breakdown
- [ ] Drawer "Edit Report" button: deep-links to `/entry?date=...`

---

## 4. Role Administration & Management Portals

### `/admin` (System Administrator Portal)
- [ ] Navigation tabs: switch between "Role Assignment & Users" and "Industry Profile"
- [ ] Role Assignment Table: inline `<select>` updates user role with live feedback
- [ ] Role Filter Pills: filters user list by `sys_admin`, `om`, `fm`, `qa`
- [ ] Search input: live filter by user name or email
- [ ] "Provision User" button: opens modal with role selector
- [ ] User Active toggle: activates/deactivates user accounts
- [ ] Dev Impersonation toolbar: switches session into candidate OM/FM

### `/om` (Operation Manager Portal)
- [ ] Tabs: "Factories", "Factory Personnel & Role Assignment", "QA Matrix"
- [ ] Create Factory modal: validation, submit lockout, factory card addition
- [ ] Factory Personnel Table: inline role dropdown switches role between `fm` and `qa`
- [ ] Provision Team Member modal: validates plant assignment and temporary password
- [ ] QA Matrix checkboxes: toggles assignment with pending spinner

---

## 5. UI Stress-Testing Matrix (Worst-Case Edge Payloads)

- [ ] 120-character unbroken product names and emails
- [ ] Zero, negative, and extreme integer values (e.g. 1,000,000)
- [ ] Empty database collections (zero factories, zero lines, zero users)
- [ ] Offline / simulated network failure recovery
