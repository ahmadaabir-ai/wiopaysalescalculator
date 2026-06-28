# Wio Pay Merchant Dashboard — Design Specification

> Source of truth for colors, typography, spacing, radii, shadows, and component sizing.

---

## Fonts

### Font Families

| Role | Family | Weights Used |
|------|--------|--------------|
| Body / Display | Wio Grotesk App | 400 Regular |
| Headings / Labels | Aktiv Grotesk App | 500 Medium, 700 Bold |

Fall-back stack: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`.

### Type Scale

| Class | Font | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|------|--------|-------------|----------------|-------|
| `.heading-xxxl` | Aktiv | 44px | 500 | 48px | 0 | Page hero |
| `.heading-xl`   | Aktiv | 36px | 500 | 44px | 0 | Section heading |
| `.heading-m`    | Aktiv | 28px | 500 | 32px | 0 | Card / module title |
| `.heading-s`    | Aktiv | 20px | 500 | 24px | -0.5px | Sub-section |
| `.content-lg`   | Wio   | 20px | 400 | 24px | -0.5px | Lead copy |
| `.content-base` | Wio   | 16px | 400 | 22px | 0 | Body |
| `.content-s`    | Wio   | 14px | 400 | 20px | 0 | Secondary / table |
| `.content-xs`   | Wio   | 12px | 400 | 16px | 0 | Caption / badge |
| `.content-tiny` | Wio   | 8px  | 400 | 12px | 0 | Fine print |

---

## Colors

### Brand Palette
| Token | Hex | Usage |
|-------|-----|-------|
| `--brand-primary`   | `#5700ff` | Primary CTAs, active nav, focus rings |
| `--brand-secondary` | `#0f1a38` | App shell, dark text |
| `--brand-accent`    | `#f7d7d0` | Accent surfaces |
| `--brand-neutral`   | `#f2f1ed` | Page background |

### Electric Indigo
`--indigo-900 #4700e0` · `--indigo-800 #5700ff` · `--indigo-700 #6600ff` · `--indigo-600 #8533ff` · `--indigo-400 #b280ff` · `--indigo-200 #ceb3ff` · `--indigo-100 #dcc6ff` · `--indigo-50 #e8d9ff` · `--indigo-20 #f4eeff` · `--indigo-10 #eee6fe`

### Midnight Blue
`--midnight-900 #0f1a38` · `--midnight-800 #1a2b54` · `--midnight-700 #253b6e` · `--midnight-600 #5f667a` · `--midnight-500 #8c92a3` · `--midnight-400 #adb2bf` · `--midnight-300 #c8ccd4` · `--midnight-200 #d9dce3` · `--midnight-100 #e6e8ed` · `--midnight-50 #e1e2e5` · `--midnight-10 #f5f5f7`

### Semantic
| Role | Foreground | Background |
|---|---|---|
| Success | `--green-800 #1f9369` | `--green-50 #e6faf2` |
| Error   | `--red-800   #e8023c` | `--red-50   #ffe0e8` |
| Warning | `--yellow-800 #f9d100` | `--yellow-100 #fdf2ca` |

---

## Spacing

| Token | Value |
|---|---|
| `--sp-0` | 0 |
| `--sp-1` | 1 |
| `--sp-2s` | 4 |
| `--sp-xs` | 8 |
| `--sp-s` | 12 |
| `--sp-m` | 16 |
| `--sp-ml` | 20 |
| `--sp-m2l` | 24 |
| `--sp-m3l` | 28 |
| `--sp-l` | 32 |
| `--sp-xl` | 36 |
| `--sp-2xl` | 40 |
| `--sp-3xl` | 44 |
| `--sp-4xl` | 48 |
| `--sp-5xl` | 52 |
| `--sp-6xl` | 56 |

## Radius
`--radius-sm 10` · `--radius-md 14` · `--radius-lg 20` · `--radius-xl 24` · `--radius-pill 999`

## Elevation
- `--elev-1` `0 1px 2px rgba(15,26,56,.04), 0 1px 1px rgba(15,26,56,.04)`
- `--elev-2` `0 4px 12px rgba(15,26,56,.06), 0 1px 2px rgba(15,26,56,.04)`
- `--elev-3` `0 12px 32px rgba(15,26,56,.10), 0 2px 6px rgba(15,26,56,.06)`
- `--elev-primary-glow` `0 12px 32px rgba(87,0,255,.24)`

## Layout
- Sidebar 224 / 72 (collapsed)
- Topbar 64
- Max content 1440

## Components

### Buttons
- `.btn` 40px tall · radius 10 · `content-s` font
- `.btn-sm` 32px tall · `content-xs`
- `.btn-icon-only` 40×40 · radius 10
- `.btn-primary` white text on `--brand-primary`
- `.btn-ghost` brand text on transparent

### Inputs
- text/select 44px tall · radius 10 · 1px solid `--stroke-primary` · `content-base`

### Cards
- `.card` radius 14 · 1px `--stroke-primary` · `--elev-1` · padding 24
- `.kpi` same · icon badge 40×40 · radius 10

### Tables
- header row 44 · `content-xs` `--fg-mild`
- data row 56 · `content-s`
- hover row `--midnight-10`

### Status badges
| Status | text | bg | dot |
|---|---|---|---|
| Success / Paid | `--green-800` | `--green-50` | `--green-800` |
| Failed | `--red-800` | `--red-50` | `--red-800` |
| Pending | `--yellow-800` | `--yellow-100` | `--yellow-800` |
| Open | `--midnight-600` | `--midnight-10` | `--midnight-400` |

Shape: pill, 12px font.

### Tabs
- pill: 60 tall, filled active
- underline: 44 tall, 2px bottom border

### Nav
- default: transparent / `--fg-mild`
- hover: `--midnight-10` / `--fg-light`
- active: `--indigo-10` / `--brand-primary`

---

## Quick-Reference

```
Primary brand     #5700ff   (--brand-primary / --indigo-800)
Dark text         #0f1a38   (--midnight-900)
Secondary text    #5f667a   (--midnight-600)
Page background   #f2f1ed   (--brand-neutral)
Card background   #ffffff
Border            #e1e2e5   (--midnight-50)
Success           #1f9369
Error             #e8023c
Warning           #f9d100

Body font         Wio Grotesk App, 16px, weight 400
Heading font      Aktiv Grotesk App, weight 500/700

Card radius       14
Input radius      10
Pill radius       999

Button height     40 (32 small)
Input height      44
Sidebar           224 / 72
Topbar            64
```
