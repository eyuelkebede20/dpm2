# DPM Calendar Specification & Implementation Guide

> Analysis of the core calendar engine and UX from `../dpm`, adapted for Next.js App Router, Tailwind CSS, DaisyUI, and Drizzle ORM in `DPM2`.

---

## 1. Executive Summary

In Ethiopian industrial manufacturing environments, factory operations run on the **Ethiopian Calendar (EC / ዓ.ም)**, while enterprise software, databases, and APIs standardize on ISO 8601 Gregorian dates (`YYYY-MM-DD`).

In `../dpm`, the calendar is not just a standard Gregorian date picker. It is a **dual-calendar executive control system** featuring:
1. **Ethiopian Calendar Engine:** 13-month cycle (12 months of 30 days + Pagume with 5/6 days).
2. **Boundary-Only Conversion:** Database stores UTC Gregorian `DATE`; all UI components, month views, fiscal reporting, and locks translate at the boundary via integer Julian Day Number (JDN) arithmetic.
3. **Dual Date Visibility:** Operators see both Ethiopian dates (e.g. `ጥቅምት 29, 2017 ዓ.ም`) and Gregorian equivalents (e.g. `2024-11-08`).
4. **13-Month Quick Jumper:** Instant switching between Meskerem, Tikimt, Hidar, Tahsas, Tir, Yekatit, Megabit, Miazia, Ginbot, Sene, Hamle, Nehase, and Pagume.
5. **Tile Status Badging & Variance:** High-contrast daily output totals with variance indicators (`+N` green, `−N` red), weekend badges, non-working day markers, and drill-down inspection drawers.

---

## 2. Ethiopian Calendar Mathematics & Algorithms

### 2.1 Core Epoch Constants
```typescript
ETH_EPOCH_JDN  = 1724221;  // 1 Meskerem 1 EC (August 29, 8 CE Julian)
OFFSET         = 1723856;  // Used by jdnToEth inverse calculation
UNIX_EPOCH_JDN = 2440588;  // 1970-01-01 Gregorian
```

### 2.2 Leap Year & Month Rules
- **Months 1 to 12 (Meskerem to Nehase):** Always exactly 30 days.
- **Month 13 (Pagume / ጳጉሜ):**
  - Standard year: 5 days.
  - Leap year (`year % 4 === 3`): 6 days.
- **Total Days:** 365 days in standard year, 366 days in leap year.

### 2.3 Integer Conversion Formulas (Zero Timezone Shift)
```typescript
// Ethiopian (Y, M, D) -> JDN
function ethToJdn(y: number, m: number, d: number): number {
  return ETH_EPOCH_JDN + 365 * (y - 1) + Math.floor(y / 4) + 30 * (m - 1) + (d - 1);
}

// JDN -> Ethiopian (Y, M, D)
function jdnToEth(jdn: number): EthiopianDate {
  const diff = jdn - OFFSET;
  const q = Math.floor(diff / 1461);
  const r = ((diff % 1461) + 1461) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year = 4 * q + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  return { year, month, day };
}
```

### 2.4 Month Names

| # | English Name | Amharic (ፊደል) | Approximate Gregorian Start |
|---|---|---|---|
| 1 | Meskerem | መስከረም | Sept 11 / 12 |
| 2 | Tikimt | ጥቅምት | Oct 11 / 12 |
| 3 | Hidar | ኅዳር | Nov 10 / 11 |
| 4 | Tahsas | ታኅሣሥ | Dec 10 / 11 |
| 5 | Tir | ጥር | Jan 9 / 10 |
| 6 | Yekatit | የካቲት | Feb 8 / 9 |
| 7 | Megabit | መጋቢት | Mar 10 / 11 |
| 8 | Miazia | ሚያዝያ | Apr 9 / 10 |
| 9 | Ginbot | ግንቦት | May 9 / 10 |
| 10 | Sene | ሰኔ | Jun 8 / 9 |
| 11 | Hamle | ሐምሌ | Jul 8 / 9 |
| 12 | Nehase | ነሐሴ | Aug 7 / 8 |
| 13 | Pagume | ጳጉሜ | Sept 6 (5 or 6 days) |

---

## 3. Verified Golden Test Vectors (from `../dpm`)

| Ethiopian (EC) | Gregorian (GC) | JDN | Verification Scenario |
|---|---|---|---|
| `2015-13-05` | `2023-09-10` | 2460198 | Pagume 5 in a leap year |
| `2015-13-06` | `2023-09-11` | 2460199 | Pagume 6 (leap year 2015) |
| `2016-01-01` | `2023-09-12` | 2460200 | New Year after leap Pagume |
| `2018-13-05` | `2026-09-10` | 2461294 | Last day of non-leap year |
| `2019-01-01` | `2026-09-11` | 2461295 | New Year 2019 |
| `2019-02-03` | `2026-10-13` | 2461327 | Mid-year Tikimt date |
| `2019-13-06` | `2027-09-11` | 2461660 | Next leap Pagume 6 |
| `2020-01-01` | `2027-09-12` | 2461661 | New Year after leap |
| `2020-06-21` | `2028-02-29` | 2461831 | Gregorian leap day alignment |

---

## 4. UI/UX Features to Port from `../dpm` to `DPM2`

1. **Dual Calendar Selector (Ethiopian / Gregorian):**
   - Toggle switch on the top right allowing users to view either the Ethiopian 13-month grid or Gregorian 12-month grid.
2. **Tabular Numerals & High-Contrast Day Tiles:**
   - Bold primary day number (Ethiopian or Gregorian).
   - Secondary subtitle showing the corresponding date in the other calendar.
   - Total finished goods output displayed in monospace bold font.
   - Variance pill: `+N` (green), `−N` (red), or `0` (neutral).
   - Non-working day styling (Sunday off default, dimmed tile with "Off" badge).
3. **13-Month Quick Jumper Modal:**
   - Dropdown or popup dialog displaying the 13 Ethiopian months for direct navigation.
4. **Interactive Day Preview Drawer:**
   - Clicking any day slides open a detail panel with line-by-line actual vs target, variance %, rework, reject, scrap, WIP, and downtime.
   - Direct "Edit Report" button navigating to `/entry?date=YYYY-MM-DD`.
5. **Integration with Daily Entry Screen (`/entry`):**
   - Date picker displays both Ethiopian date and Gregorian date.
