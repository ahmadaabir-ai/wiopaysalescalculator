# Wio Pay Sales Calculator

Internal sales-pricing calculator for Wio Pay. Vanilla JS, native ES modules,
no build step.

The Manual Calculator is the **main screen**. The Sales Calculator (reverse:
desired MDR → minimum relationship required) reuses the same pricing engine,
approval-path engine, and MCC reference data — there is no second copy of
the math anywhere.

---

## What's in the box

- **Manual Calculator** (default tab) — Single requested-MDR input. Outputs
  verdict banner, PG-economics waterfall, relationship-coverage waterfall,
  four standalone approval-path cards, loan tenure matrix, Build-Your-Own
  AED-rebalancing block, and a sales-pitch card.
- **Sales Calculator** — Reverse flow. Enter the MDR you want to offer; see
  the minimum banking relationship that makes it work.
- **Backend Assumptions** — Edit every default from `LOGIC_EXTRACT §1` live.
  Changes propagate instantly via a pub/sub on the mutable `mccData.js`
  store. "Reset to defaults" restores the originals.

---

## Run locally

This is a static site — any HTTP server will do. From the project root:

```powershell
# preferred
npx serve .

# fallback
python -m http.server 8080
```

Open `http://localhost:3000` (serve) or `http://localhost:8080` (python).

---

## Project structure

```
wio-pay-sales-calculator/
+-- package.json
+-- README.md
+-- index.html
+-- src/
|   +-- main.js               # DOM wiring, tabs, panels, BYO rebalance UI
|   +-- pricingEngine.js      # runPricingEngine (LOGIC_EXTRACT §4)
|   +-- manualCalculator.js   # reverse-MDR verdict (LOGIC_EXTRACT §5)
|   +-- approvalPaths.js      # 4 paths + AED rebalance (LOGIC_EXTRACT §6)
|   +-- mccData.js            # mutable defaults + pub/sub
|   +-- state.js              # global state + localStorage persistence
|   +-- styles.css            # Wio design-spec tokens
+-- docs/
|   +-- LOGIC_MAP.md
|   +-- VERSION_HISTORY.md
|   +-- QA_TEST_CASES.md
+-- reference/
    +-- LOGIC_EXTRACT.md      # source of truth — DO NOT EDIT formulas
    +-- DESIGN-SPEC.md        # Wio brand tokens
```

---

## Scope

Kept from the legacy single-file calculator:

- Manual Calculator (requested MDR -> approval verdict + paths)
- Sales Calculator (desired MDR -> minimum relationship)
- Four approval paths: Grow Balance / Increase FX / Increase Card Spend /
  Take Business Loan
- Build-Your-Own approval path with AED-based rebalancing (not %)
- Backend Assumptions editor (MCC interchange, Pine Labs, fixed cost, risk
  adj, vintage floor, NIM, FX take, spend rate, loan rate, e-com brackets,
  banking-rev slabs, PG-volume slabs, tier ladder, commercial floors)
- One backend pricing engine shared by every screen

Dropped (intentionally):

- Customer-facing tier ladder, customer pricing tab
- Option 1 / 2 / 3 side-by-side comparison
- Calculation Journey, Strategic Tier Mapping, Pricing Route Comparison
  tabs
- Any explainer tab not needed by Sales

The Manual Calculator is the **default tab**. No customer-facing screens or
Option 1-2-3 comparison are present anywhere in this codebase.

---

## Sharing the engine

`manualCalculator.runManualCalculator(inp, mdr)` calls
`pricingEngine.runPricingEngine(inp)` once and layers reverse-tier logic on
top. The Sales tab passes its **desired MDR** through the same function —
there is no separate reverse code path. The Build-Your-Own block uses
`approvalPaths.rebalanceApprovalPath(...)` on both tabs.

Editing any default in the Backend tab mutates `mccData.js` in place and
fires `notify()`. `main.js` subscribes once and re-renders every tab.

---

## QA

See `docs/QA_TEST_CASES.md` for the regression list. Run them by hand in the
browser after any change to `pricingEngine.js`, `manualCalculator.js`,
`approvalPaths.js`, or `mccData.js`.

---

## Notes

- `localStorage` key `wio-pay-sales-calc-state-v1` persists the sales
  context (industry, vintage, balances, etc.) and the last-used MDRs. Wipe
  it from DevTools to reset.
- The DevTools console exposes `window.__wio = { getState,
  runManualCalculator, calcTierRevGap }` for ad-hoc poking.
