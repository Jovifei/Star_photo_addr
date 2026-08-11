# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Star Photo Planner
**Updated:** 2026-08-10
**Category:** Astronomy Weather Decision Workspace
**Design Dials:** Variance 3/10 (Operational / Consistent) | Motion 2/10 (Subtle) | Density 7/10 (Data Dense)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Interaction / selected | `#79CFE2` | `--cyan` |
| Interaction tint | `rgba(121,207,226,.12)` | `--cyan-soft` |
| Warning / planning | `#D4B273` | `--warn` |
| Risk / unavailable | `#CB7768` | `--bad` |
| Background | `#02070B` | `--bg` |
| Deep background | `#04101A` | `--bg-deep` |
| Surface | `#0A1A23` | `--surface` |
| Raised surface | `#112935` | `--surface-3` |
| Foreground | `#E7E7E0` | `--text` |
| Muted text | `#91A4AB` | `--muted` |
| Border | `rgba(165,205,216,.16)` | `--line` |
| Focus ring | `#79CFE2` | `--cyan` |

**Color Notes:** 逐星与星野决策共用深海蓝底、青色交互、琥珀提示和红色风险。颜色不能单独承担含义；状态同时提供文字、数值或图标。

### Typography

- **Heading / Body Font:** Noto Sans SC Variable, PingFang SC, Microsoft YaHei, system-ui
- **Data Font:** ui-monospace, SFMono-Regular, Consolas, Liberation Mono
- **Mood:** dark observatory, weather operations, precise and calm
- **Rule:** headings use explicit `line-height: 1.1–1.25`; numeric metrics use tabular figures.

**CSS Tokens:**
```css
--font-body: "Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
--font-data: ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace;
```

### Spacing Variables

*Density: 7/10 — Standard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  min-height: 44px;
  background: #79CFE2;
  color: #04101A;
  padding: 0 16px;
  border-radius: 6px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  background: #97D7E5;
}

/* Secondary Button */
.btn-secondary {
  min-height: 44px;
  background: #0A1A23;
  color: #D7E4E6;
  border: 1px solid rgba(151,211,225,.32);
  padding: 0 16px;
  border-radius: 6px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #0A1A23;
  border: 1px solid rgba(165,205,216,.16);
  border-radius: 10px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.card:hover {
  border-color: rgba(151,211,225,.32);
}
```

### Inputs

```css
.input {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid rgba(151,211,225,.32);
  border-radius: 6px;
  background: #04101A;
  color: #E7E7E0;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #79CFE2;
  outline: none;
  box-shadow: 0 0 0 3px rgba(121,207,226,.12);
}
```

### Modals

```css
.modal-overlay {
  background: rgba(2, 7, 11, 0.78);
  backdrop-filter: blur(8px);
}

.modal {
  background: #06141B;
  border: 1px solid rgba(151,211,225,.32);
  border-radius: 10px;
  padding: 22px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Real-Time Monitoring

**Keywords:** satellite observation, numerical forecast, multi-night trend, hourly drill-down, shared location session

**Best For:** System monitoring dashboards, DevOps dashboards, real-time analytics, stock market dashboards, live event tracking

**Key Effects:** 150–180ms state transitions, visible update timestamps, numeric legends, explicit loading/stale states, reduced-motion fallback

### Page Pattern

**Pattern Name:** Real-Time / Operations Landing

- **Conversion Strategy:** For ops/security/iot products. Demo or sandbox link. Trust signals.
- **CTA Placement:** Primary CTA in nav + After metrics
- **Section Order:** 1. Hero (product + live preview or status), 2. Key metrics/indicators, 3. How it works, 4. CTA (Start trial / Contact)

---

## Motion

- Chart and panel updates: 150–180ms opacity/color transition; do not animate geometry needed for reading data.
- `prefers-reduced-motion: reduce`: disable animation and smooth scrolling.
- Never use pulsing or perpetual animation for ordinary “available” status.

---

## Anti-Patterns (Do NOT Use)

- ❌ A range tab that changes only card count while the chart dataset stays unchanged
- ❌ Separate location/night/model/time state between 逐星 and 星野决策
- ❌ Color-only chart meaning or charts without units, legend and exact values

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
