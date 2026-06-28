# QA Regression Test Cases

Run these by hand in the browser (sales rep flow). Each TC lists the inputs
exercised, the action, and what the UI must show. The shared pricing engine
means a regression in one tab is a regression everywhere — re-run the full
list whenever `pricingEngine.js`, `manualCalculator.js`, `approvalPaths.js`,
or `mccData.js` changes.

---

## TC-MANUAL-001 — Reverse tier logic

**Goal:** A requested MDR resolves to the nearest tier on the displayed-MDR
ladder for the merchant's MCC + risk.

**Inputs**
- Industry: Retail / Supermarket
- Vintage: 12 – 18 months (months = 15)
- Trade License: Under 3y
- Risk: Low
- AOV: 200, Monthly txns: 500
- Debit mix: 60%
- Balance / FX / Spend / Loans: 0
- Requested MDR: **1.50 %**

**Expected**
- Status banner: amber `cond` (or `warn` if banking rev is high enough)
- Target tier in subtitle: **Standard** (1.50% mid-ladder for retail).
- Required banking-rev floor in subtitle: AED 10,000 (Developing).
- PG-only Net KPI: positive small number (MDR 1.50% > pgCostPct on retail).

---

## TC-MANUAL-002 — Build-Your-Own sync

**Goal:** Editing one path AED redistributes the remaining revenue gap
evenly across the other active paths.

**Inputs**
- Same as TC-MANUAL-001
- Requested MDR: **0.80 %** (forces a shortfall)

**Action**
1. Wait for the standalone cards to populate.
2. The BYO section auto-fills with the same AED values as standalone.
3. In BYO, change **Balance** to `0`.

**Expected**
- The other three BYO inputs (Spend, FX, Loan) jump up — each carries 1/3 of
  the remaining shortfall, in AED, derived from its own rate.
- Status line: `Blended revenue AED X vs shortfall AED Y — shortfall covered`.

---

## TC-MANUAL-003 — Approval path rebalancing tolerance

**Goal:** Total blended revenue must equal the shortfall within 0.1%.

**Inputs**
- Same as TC-MANUAL-002

**Action**
- After the BYO block populates, sum the revenue strings under each input.

**Expected**
- Total revenue ≥ shortfall × 0.999. Status block reads `shortfall covered`.

---

## TC-SALES-001 — Reverse flow (Sales tab)

**Goal:** The Sales Calculator returns the same shortfall and same standalone
cards as the Manual Calculator when the same MDR is entered.

**Inputs**
- Sales context unchanged from TC-MANUAL-001.
- Manual tab: Requested MDR 1.20%. Record the four standalone AED values.
- Switch to Sales tab. Desired MDR: 1.20%.

**Expected**
- All four standalone path cards on the Sales tab show **identical AED**
  values to what the Manual tab produced.

---

## TC-SALES-002 — Shared approval-path component

**Goal:** The Sales tab's BYO block uses the same rebalance function.

**Inputs**
- Same as TC-SALES-001.

**Action**
- On Sales tab BYO, change **FX** input.

**Expected**
- The other three inputs rebalance evenly, identical to the Manual tab's
  behaviour. Status string format identical.

---

## TC-EDGE-001 — Zero AOV clamps to 1

**Action**
- AOV input: type `0`, press Tab.

**Expected**
- AOV is treated as 1 internally (engine uses `Math.max(1, aov)`); UI does
  not crash; PG cost % stays finite (fixedCostPctOfAOV = fixedCost / 1).

---

## TC-EDGE-002 — Negative txnCount clamps to 0

**Action**
- Monthly Transactions: type `-50`.

**Expected**
- Internally clamped to 0. Monthly TPV hint shows AED 0. PG year vol = 0.
- Ratio guard handles this (`pgYearVol > 0 ? bankingRev / pgYearVol : 0`).

---

## TC-EDGE-003 — Negative MDR rejected

**Action**
- Requested MDR: type `-0.5`.

**Expected**
- Treated as 0% by the engine input clamp. Verdict falls back to the
  policy-floor alert (below vintage floor).

---

## TC-EDGE-004 — MCC edit refreshes calculator instantly

**Action**
- Open Backend tab. Edit Retail Debit interchange to `1.00%`.
- Switch to Manual tab without reloading.

**Expected**
- PG Cost % KPI on Manual tab reflects the new value immediately
  (mccData `notify()` fires and `subscribe(render)` re-renders).
- Pressing "Reset to defaults" reverts the change and refreshes.
