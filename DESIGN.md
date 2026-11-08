# DESIGN.md — Design System Tokens & Guidelines

This document specifies the design tokens for DPM (Daily Product Manager). All UI components, styles, layouts, and animations must adhere to these tokens. **No magic numbers.**

---

## 1. Color Palette & Surfaces (Background Ladder)

| Token Name | Tailwind Class / Variable | Hex Value | Usage / Semantic Role |
| :--- | :--- | :--- | :--- |
| `surface-canvas` | `bg-slate-50` | `#F8FAFC` | Page background, low-contrast canvas |
| `surface-card` | `bg-white` | `#FFFFFF` | Primary card background, dialog surfaces |
| `surface-elevated` | `bg-white shadow-sm` | `#FFFFFF` | Slide-over panels, floating drawers, toolbars |
| `surface-subtle` | `bg-slate-100` | `#F1F5F9` | Table headers, chip backgrounds, disabled inputs |
| `surface-muted` | `bg-slate-200` | `#E2E8F0` | Dividers, subtle borders, inactive toggle tracks |

---

## 2. Text Hierarchy (Readability & Contrast)

WCAG AA contrast minimum: `4.5:1` for normal text, `3.0:1` for large text.

| Level | Size | Weight | Line Height | Color Token | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display / H1** | `1.5rem (24px)` | `700 (Bold)` | `2rem (32px)` | `text-slate-900` (`#0F172A`) | Top page titles |
| **Heading / H2** | `1.125rem (18px)`| `700 (Bold)` | `1.75rem (28px)`| `text-slate-900` (`#0F172A`) | Section cards, panel titles |
| **Subheading / H3**| `0.875rem (14px)`| `600 (Semibold)` | `1.25rem (20px)`| `text-slate-800` (`#1E293B`) | Group headers, modal titles |
| **Body Primary** | `0.875rem (14px)`| `400 (Normal)` | `1.25rem (20px)`| `text-slate-700` (`#334155`) | Standard table text, input labels |
| **Body Secondary**| `0.75rem (12px)` | `400 (Normal)` | `1rem (16px)` | `text-slate-500` (`#64748B`) | Helper copy, timestamps, subtexts |
| **Caption / Pill** | `0.6875rem (11px)`| `600 (Semibold)` | `0.875rem (14px)`| `text-slate-600` (`#475569`) | Badges, tags, SKU labels |
| **Numbers / Data** | Monospace | `700 (Bold)` | Tabular Nums | `text-slate-900` (`#0F172A`) | Finished goods, targets, variances |

---

## 3. Brand & Accent Colors

| Role | Tailwind Token | Hex / HSL | Usage |
| :--- | :--- | :--- | :--- |
| **Primary (Brand)** | `bg-indigo-600` | `#4F46E5` | Primary buttons, active tabs, focused rings |
| **Primary Hover** | `bg-indigo-700` | `#4338CA` | Hover state on primary elements |
| **Secondary** | `bg-blue-600` | `#2563EB` | Operation Manager accents, secondary actions |
| **Accent / QA** | `bg-emerald-600` | `#059669` | Positive variances, QA inspector tags, pass status |
| **Warning** | `bg-amber-500` | `#F59E0B` | Temporary password alerts, dev impersonation banner |
| **Danger / Reject** | `bg-rose-600` | `#E11D48` | Negative variances, scrap/reject inputs, delete actions |

---

## 4. Border Radii Scale

| Token Name | Value | Tailwind Class | Semantic Usage |
| :--- | :--- | :--- | :--- |
| `radius-sm` | `0.375rem (6px)` | `rounded-md` | Stepper pill buttons, small badges |
| `radius-md` | `0.5rem (8px)` | `rounded-lg` | Input fields, dropdown menus, table action buttons |
| `radius-lg` | `0.75rem (12px)` | `rounded-xl` | Buttons, form cards, filter bars |
| `radius-xl` | `1rem (16px)` | `rounded-2xl` | Main dashboard cards, modal containers, drawers |
| `radius-full` | `9999px` | `rounded-full` | Avatar bubbles, circular counters, status dots |

---

## 5. Shadow Elevations

| Token Name | CSS Value | Tailwind Class | Usage |
| :--- | :--- | :--- | :--- |
| `elevation-none` | `none` | `shadow-none` | Flat cards on gray canvas |
| `elevation-1 (sm)`| `0 1px 2px 0 rgb(0 0 0 / 0.05)` | `shadow-sm` | Content cards, data tables |
| `elevation-2 (md)`| `0 4px 6px -1px rgb(0 0 0 / 0.1)` | `shadow-md` | Sticky save bars, dropdown popovers |
| `elevation-3 (lg)`| `0 10px 15px -3px rgb(0 0 0 / 0.1)` | `shadow-lg` | Modals, slide-over panels |
| `elevation-focus` | `0 0 0 2px #EEF2FF, 0 0 0 4px #6366F1` | `ring-2 ring-indigo-500 ring-offset-2` | Keyboard accessible focus ring |

---

## 6. Spacing Scale

Based on 4px grid.

- `space-1`: `4px` (`gap-1`, `p-1`) — Icon-to-text micro-spacing
- `space-2`: `8px` (`gap-2`, `p-2`) — Compact form controls, inline pills
- `space-3`: `12px` (`gap-3`, `p-3`) — Button padding, list item gaps
- `space-4`: `16px` (`gap-4`, `p-4`) — Standard container padding, form field gaps
- `space-6`: `24px` (`gap-6`, `p-6`) — Card interior padding, section separation
- `space-8`: `32px` (`gap-8`, `p-8`) — Major page grid gutters

---

## 7. Motion & Interaction Standards

**Hard Ceiling:** standard UI transitions stay within **150–250ms** (absolute maximum 300ms).

| Purpose | Duration | Easing Curve | Tailwind / CSS |
| :--- | :--- | :--- | :--- |
| **Micro-interaction** (Hover, Button Press) | `150ms` | `cubic-bezier(0.4, 0, 0.2, 1)` | `transition-all duration-150 ease-out` |
| **Drawer / Modal Entrance** | `200ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | `transition-all duration-200 ease-out` |
| **Dropdown / Popover** | `150ms` | `cubic-bezier(0.2, 0, 0, 1)` | `transition-opacity duration-150` |
| **Button Active Press** | Instant | `scale-95` | `active:scale-[0.98]` |

### Reduced Motion Requirement
All components must respect `@media (prefers-reduced-motion: reduce)`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 8. Mobile & Touch Standards

- **Touch targets:** Minimum `44px × 44px` for all clickable controls on mobile devices.
- **Input font size:** ≥ `16px` on mobile inputs to prevent automatic iOS zoom.
- **Viewport height:** Use `100dvh` for full-height views.
- **Hover guarding:** Guard hover effects with `@media (hover: hover)` to prevent sticky hover on touchscreens.
