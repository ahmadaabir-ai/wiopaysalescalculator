# Logic Extract — Original Wio Pay Sales Calculator

This document contains the canonical pricing engine, reference data, and
helper logic from the legacy single-file calculator. It is the source of
truth for the rebuild — **do not change formulas, do not invent a new
engine.**

---

## 1. Reference Data

### 1.1 MCC interchange (debit / credit) — `industryInterchange`
```js
const industryInterchange = {
  retail:     { debit: 0.0075, credit: 0.0130, label: 'Retail / Supermarket' },
  government: { debit: 0.0050, credit: 0.0050, label: 'Government' },
  utility:    { debit: 0.0050, credit: 0.0050, label: 'Utility' },
  education:  { debit: 0.0065, credit: 0.0065, label: 'Education' },
  realestate: { debit: 0.0065, credit: 0.0065, label: 'Real Estate' },
  petrol:     { debit: 0.0050, credit: 0.0070, label: 'Petrol' },
  transport:  { debit: 0.0050, credit: 0.0050, label: 'Transportation' },
};
```

### 1.2 MCC customer markup — `mccMarkupTable`
```js
const mccMarkupTable = {
  retail:     0.0030,
  government: 0.0010,
  utility:    0.0010,
  education:  0.0010,
  realestate: 0.0020,
  petrol:     0.0020,
  transport:  0.0020,
};
```

### 1.3 Risk adjustment (additive on final MDR)
```js
const riskAdj   = { low: 0.0000, med: 0.0020, high: 0.0040 };
const riskLabel = { low: 'Low',  med: 'Medium', high: 'High' };
```

### 1.4 Tier ladder (ordered best → worst) — `tiers`
```js
const tiers = [
  { name: 'Strategic', mdr: 0.0050, ratio: 0.0150 },
  { name: 'Premium',   mdr: 0.0075, ratio: 0.0120 },
  { name: 'Preferred', mdr: 0.0100, ratio: 0.0090 },
  { name: 'Plus',      mdr: 0.0125, ratio: 0.0060 },
  { name: 'Standard',  mdr: 0.0150, ratio: 0.0040 },
  { name: 'Entry',     mdr: 0.0175, ratio: 0.0020 },
  { name: 'Base',      mdr: 0.0200, ratio: 0.0000 },
];
```

### 1.5 Per-MCC tier MDR table — `mccTierMDR`
Index 0 = Strategic … 6 = Base
```js
const mccTierMDR = {
  retail:     [0.0050, 0.0075, 0.0100, 0.0125, 0.0150, 0.0175, 0.0200],
  government: [0.0030, 0.0045, 0.0060, 0.0075, 0.0090, 0.0105, 0.0120],
  utility:    [0.0030, 0.0045, 0.0060, 0.0075, 0.0090, 0.0105, 0.0120],
  education:  [0.0040, 0.0055, 0.0070, 0.0085, 0.0100, 0.0115, 0.0130],
  realestate: [0.0040, 0.0055, 0.0070, 0.0085, 0.0100, 0.0115, 0.0130],
  petrol:     [0.0035, 0.0050, 0.0065, 0.0080, 0.0095, 0.0110, 0.0125],
  transport:  [0.0030, 0.0045, 0.0060, 0.0075, 0.0090, 0.0105, 0.0120],
};
```

### 1.6 Tier rank (higher = more conservative)
```js
const tierRank = {
  'Strategic': 1, 'Premium': 2, 'Preferred': 3,
  'Plus': 4, 'Standard': 5, 'Entry': 6, 'Base': 7,
};
```

### 1.7 Absolute banking-revenue → pricing-tier cap (Gate 1)
```js
const bankingRevTiers = [
  { label: 'Strategic',  min: 50000, cap: 'Strategic' },
  { label: 'Premium',    min: 40000, cap: 'Premium'   },
  { label: 'Strong',     min: 30000, cap: 'Preferred' },
  { label: 'Moderate',   min: 20000, cap: 'Plus'      },
  { label: 'Developing', min: 10000, cap: 'Standard'  },
  { label: 'Low',        min: 5000,  cap: 'Entry'     },
  { label: 'Very Low',   min: 0,     cap: 'Base'      },
];
```

### 1.8 Annual PG volume → pricing-tier cap (Gate 3)
```js
const pgScaleTiers = [
  { label: 'Enterprise', min: 2500000, cap: 'Strategic' },
  { label: 'Mid-Market', min: 1500000, cap: 'Premium'   },
  { label: 'Growth SME', min: 750000,  cap: 'Preferred' },
  { label: 'SME',        min: 400000,  cap: 'Plus'      },
  { label: 'Small',      min: 200000,  cap: 'Standard'  },
  { label: 'Micro',      min: 20000,   cap: 'Entry'     },
  { label: 'Nano',       min: 0,       cap: 'Base'      },
];
```

### 1.9 E-com per-transaction fee brackets (AOV-driven, default)
```js
const CMC_FEE_DEFAULTS = [1.00, 0.75, 0.50, 0.00]; // AED
const CMC_FEE_BRACKETS = ['0 – 200', '200 – 500', '500 – 1,000', '1,000+'];
```

### 1.10 Banking yields (annualised, defaults)
```js
const defaultYields = {
  rBal:  0.0375,  // NIM on average balance       (3.75%)
  rXb:   0.0060,  // Cross-border take            (60 bps)
  rDeb:  0.0114,  // Spend interchange            (1.14%)
  rLoan: 0.0800,  // Annual loan rate (reducing)  (8.00%)
};
```

### 1.11 Acquiring cost stack (defaults)
```js
const defaultCosts = {
  pineLabs:  0.0009, // 0.09% variable
  fixedCost: 1.10,   // AED per txn
  debitMix:  0.60,   // 60 / 40 by default
};
```

### 1.12 Commercial floor (defaults)
```js
const defaultFloors = {
  netMdrFloorBps: 0,  // basis points (0 = disabled by default)
  minMonthlyRev:  0,  // AED / month (0 = disabled)
};
```

---

## 2. Helpers

```js
function vintageFloor(months, industry) {
  const mdrs = mccTierMDR[industry] || mccTierMDR.retail;
  if (months < 6)  return mdrs[6]; // Base
  if (months < 12) return mdrs[2]; // Preferred
  return mdrs[0];                  // Strategic
}

function vintageLabel(months) {
  if (months < 6)  return '< 6 months';
  if (months < 12) return '6–12 months';
  return '12+ months';
}

function aovCharge(aov, b1, b2, b3, b4) {
  if (aov < 200)  return b1;
  if (aov < 500)  return b2;
  if (aov < 1000) return b3;
  return b4;
}

function aovBucketLabel(aov) {
  if (aov < 200)  return '0–200';
  if (aov < 500)  return '200–500';
  if (aov < 1000) return '500–1,000';
  return '1,000+';
}

function getMccTierMDR(industry, tierName) {
  const mdrs = mccTierMDR[industry] || mccTierMDR.retail;
  return mdrs[tierRank[tierName] - 1];
}

function getMccMarkup(industry) {
  return mccMarkupTable[industry] !== undefined
    ? mccMarkupTable[industry]
    : mccMarkupTable.retail;
}
```

---

## 3. Loan helpers (reducing balance, year-1 interest)

```js
function calcYear1Interest(principal, annualRate, months) {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 12;
  if (r <= 0) return 0;
  const emi = principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
  let bal = principal, interest = 0;
  for (let m = 0; m < Math.min(months, 12); m++) {
    const int = bal * r;
    interest += int;
    bal -= (emi - int);
  }
  return interest;
}

function solveLoanPrincipal(targetInterest, annualRate, months) {
  if (targetInterest <= 0 || annualRate <= 0 || months <= 0) return 0;
  let lo = 0, hi = 1e9;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (calcYear1Interest(mid, annualRate, months) < targetInterest) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
```

---

## 4. Pricing engine (canonical — DO NOT CHANGE)

```js
function runPricingEngine(inp) {
  const {
    industry, risk, months, tlOverride,
    balance, xborder, spend, loans, loanTenure,
    aov, txnCount,
    debitMix, pineLabs, fixedCost, netMdrFloor, minRev,
    rBal, rXb, rDeb, rLoan, b1, b2, b3, b4,
  } = inp;

  const ic = industryInterchange[industry] || industryInterchange['retail'];
  const creditMix = 1 - debitMix;
  const weightedInterchange = ic.debit * debitMix + ic.credit * creditMix;
  const fixedCostPctOfAOV = fixedCost / Math.max(1, aov);
  const pgCostPct = weightedInterchange + pineLabs + fixedCostPctOfAOV;

  // 4-component banking revenue (Balance NIM + FX + Spend interchange + Loan yr-1)
  const revBal = balance * rBal;
  const revXb  = xborder * rXb;
  const revDeb = spend   * rDeb;
  const monthlyRate = rLoan / 12;
  let revLoan = 0, loanEMI = 0;
  if (loans > 0 && loanTenure > 0 && monthlyRate > 0) {
    const r = monthlyRate, n = loanTenure;
    loanEMI = loans * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    let bal = loans;
    for (let m = 0; m < n; m++) {
      const int = bal * r;
      if (m < 12) revLoan += int;
      bal -= (loanEMI - int);
    }
  }
  const bankingRev = revBal + revXb + revDeb + revLoan;

  const pgYearVol    = aov * txnCount * 12;
  const txnsYear     = pgYearVol / Math.max(1, aov);
  const aovFee       = aovCharge(aov, b1, b2, b3, b4);
  const aovFeeAnnual = aovFee * txnsYear;
  const pgCostAnnual = pgYearVol * pgCostPct;

  // Gate 2 — ratio
  const ratio     = pgYearVol > 0 ? bankingRev / pgYearVol : 0;
  const ratioTier = tiers.find(t => ratio >= t.ratio) || tiers[tiers.length - 1];

  // Gate 1 — banking absolute
  const bankingEntry   = bankingRevTiers.find(t => bankingRev >= t.min);
  const bankingCapName = bankingEntry.cap;

  // Gate 3 — PG scale
  const pgScaleEntry   = pgScaleTiers.find(t => pgYearVol >= t.min);
  const pgScaleCapName = pgScaleEntry.cap;

  // Preliminary tier = most conservative rank
  const prelimRank = Math.max(
    tierRank[ratioTier.name],
    tierRank[bankingCapName],
    tierRank[pgScaleCapName]
  );
  const prelimTier = tiers.find(t => tierRank[t.name] === prelimRank);

  // Vintage floor (waived if Trade License ≥ 36 months)
  const floorVal  = tlOverride ? 0 : vintageFloor(months, industry);
  const prelimIdx = tiers.indexOf(prelimTier);

  // Gate 4 — economics guardrail: step down until net/month ≥ minRev
  let o2FinalTier = prelimTier, o2Final = 0, economicsBump = false;
  for (let i = prelimIdx; i < tiers.length; i++) {
    const t   = tiers[i];
    const mdr = Math.max(getMccTierMDR(industry, t.name), floorVal) + riskAdj[risk];
    const rev = mdr * pgYearVol + aovFeeAnnual;
    const net = bankingRev + rev - pgCostAnnual;
    if (net / 12 >= minRev || i === tiers.length - 1) {
      o2FinalTier = t;
      o2Final     = mdr;
      if (i > prelimIdx) economicsBump = true;
      break;
    }
  }

  const o2PgRev  = o2Final * pgYearVol + aovFeeAnnual;
  const o2Margin = o2PgRev - pgCostAnnual;
  const o2Net    = bankingRev + o2PgRev - pgCostAnnual;

  return {
    pgCostPct, pgCostAnnual, bankingRev,
    revBal, revXb, revDeb, revLoan, loanEMI,
    pgYearVol, txnsYear, aovFee, aovFeeAnnual,
    ratio, ratioTier, bankingEntry, bankingCapName,
    pgScaleEntry, pgScaleCapName,
    prelimTier, prelimRank, economicsBump,
    o2FinalTier, o2Final, floorVal,
    o2PgRev, o2Margin, o2Net,
    baseMDR: getMccTierMDR(industry, 'Base'),
  };
}
```

---

## 5. Manual Calculator — reverse logic from a requested MDR

The Manual Calculator does **not** invent a new engine. It:

1. Computes PG cost, banking revenue, and floors using the same engine helpers.
2. Reverse-engineers the **target tier** for a requested MDR:
```js
function calcTierRevGap(r, inp, reqMdrPct) {
  const adjTiers   = tiers.map((t,i) => ({...t, mdr: mccTierMDR[inp.industry][i]}));
  const dispMarkup = getMccMarkup(inp.industry);
  const dispRisk   = riskAdj[inp.risk] || 0;
  // nearest displayed-MDR tier wins
  let targetTier = adjTiers.reduce((best, t) => {
    const tDisp    = t.mdr    + dispMarkup + dispRisk;
    const bestDisp = best.mdr + dispMarkup + dispRisk;
    return Math.abs(tDisp - reqMdrPct) < Math.abs(bestDisp - reqMdrPct) ? t : best;
  });
  // banking-revenue floor needed to satisfy Gate 1 for that tier
  const reqBankEntry = bankingRevTiers.slice().reverse().find(
    t => tierRank[t.cap] <= tierRank[targetTier.name]
  );
  const totalReq = reqBankEntry ? reqBankEntry.min : 0;
  const revGap   = Math.max(0, totalReq - (r ? r.bankingRev : 0));
  return { revGap, targetTier, reqBankEntry };
}
```
3. Computes PG revenue, PG-only net, total relationship net, controlling
   commercial floor, and coverage status from those values.
4. Shows the requested MDR as approvable, conditional, or below floor.

### Below-floor guard
If `reqMdr < vintageFloor(months, industry) + riskAdj[risk]`, surface a
manual-exception banner — sales cannot offer below this rate without
approval.

---

## 6. Approval paths — shared engine

There are **four** revenue-equivalent paths:

| Key | Driver | AED unit |
|---|---|---|
| `balance` | Balance × NIM (rBal) | Avg balance |
| `spend`   | Spend × interchange (rDeb) | Annual card spend |
| `fx`      | Cross-border × take (rXb)  | Annual FX vol |
| `loan`    | Year-1 interest at rLoan + tenure | Loan principal |

### 6.1 Convert revenue gap → AED for each path
```js
function revToAed(key, rev, inp) {
  if (rev <= 0) return 0;
  if (key === 'balance') return inp.rBal  > 0 ? rev / inp.rBal : 0;
  if (key === 'spend')   return inp.rDeb  > 0 ? rev / inp.rDeb : 0;
  if (key === 'fx')      return inp.rXb   > 0 ? rev / inp.rXb  : 0;
  if (key === 'loan')    return inp.rLoan > 0
    ? solveLoanPrincipal(rev, inp.rLoan, inp.loanTenure || 24) : 0;
  return 0;
}
```

### 6.2 Standalone path init — each path solves the full gap on its own
```js
function initApprovalPath(state, shortfall, inp) {
  const rates = { balance: inp.rBal, spend: inp.rDeb, fx: inp.rXb, loan: inp.rLoan };
  ['balance','spend','fx','loan'].forEach(k => {
    state[k] = rates[k] > 0 ? Math.ceil(revToAed(k, shortfall, inp)) : 0;
  });
}
```

### 6.3 Build-your-own rebalance — AED-based, not percentage
When the user changes one path, recompute the remaining revenue gap and
distribute it evenly across the **other active paths** (those with a
positive yield):
```js
function rebalanceApprovalPath(state, changedKey, newAed, shortfall, inp) {
  state[changedKey] = Math.max(0, +newAed || 0);
  const revChanged = pathRevenue(changedKey, state[changedKey], inp);
  const remaining  = Math.max(0, shortfall - revChanged);
  const rates  = { balance: inp.rBal, spend: inp.rDeb, fx: inp.rXb, loan: inp.rLoan };
  const others = ['balance','spend','fx','loan'].filter(k => k !== changedKey && rates[k] > 0);
  if (others.length === 0 || remaining <= 0) {
    others.forEach(k => { state[k] = 0; });
  } else {
    const revPerPath = remaining / others.length;
    others.forEach(k => { state[k] = Math.ceil(revToAed(k, revPerPath, inp)); });
  }
}

function pathRevenue(key, aedVal, inp) {
  if (!aedVal || aedVal <= 0) return 0;
  if (key === 'balance') return inp.rBal * aedVal;
  if (key === 'spend')   return inp.rDeb * aedVal;
  if (key === 'fx')      return inp.rXb  * aedVal;
  if (key === 'loan')    return inp.rLoan > 0
    ? calcYear1Interest(aedVal, inp.rLoan, inp.loanTenure || 24) : 0;
  return 0;
}

function pathTotalRev(state, inp) {
  return ['balance','spend','fx','loan']
    .reduce((s, k) => s + pathRevenue(k, state[k] || 0, inp), 0);
}
```

### 6.4 Status — total rev vs shortfall
`isValid = totalRev >= shortfall * 0.999` (0.1% tolerance for rounding).

---

## 7. Loan-tenure matrix (for the standalone loan card)

For tenures `[12, 24, 36, 48]` months, compute:
- Required principal to generate `shortfall` of year-1 interest
- EMI at that principal
- Highlight the row matching the user-entered tenure

---

## 8. Pitch / status states

| state | trigger | label |
|---|---|---|
| `pos`  | PG-only net ≥ controlling floor                          | Covered by PG Economics |
| `warn` | Total relationship net ≥ controlling floor (banking subsidy) | Covered by Banking Relationship |
| `cond` | Below floor but reachable with additional balance         | Conditionally Viable — Additional Balance Required |
| `neg`  | Below floor on all routes / below policy floor MDR       | Manual Review / Manual Exception Required |

---

## 9. UI screens to keep (Manual Calculator first)

1. **Sales context** — single editable customer-profile panel:
   - MCC / industry, vintage, trade-license age, risk
   - AOV, monthly txn count (TPV computed)
   - Debit / credit mix
   - Balance, FX, spend, loan amount, loan tenure
2. **Manual Calculator** — single input "Requested MDR %". Output:
   approvable / conditional / below-floor with full coverage waterfall.
3. **Approval Paths** — standalone (Grow Balance / Increase FX / Increase
   Card Spend / Take Business Loan) + Build-Your-Own (AED-based).
4. **Sales Calculator (reverse)** — enter desired MDR, see minimum
   relationship required.
5. **Backend Assumptions Editor** — all reference data editable in a
   single screen; changes propagate live.

## 10. Screens to drop

- Customer-facing pricing page and tier ladder
- Strategic-tier customer card
- Option 1 / 2 / 3 side-by-side comparison
- Calculation Journey, Strategic Tier Mapping, Pricing Route Comparison
  tabs (move any internal-only diagnostics into the Backend tab)
- All explainer tabs not directly needed by Sales

---

## 11. Number formatting

- AED with thousands separators, no decimals (`fmt`)
- Percentages to 2 decimals (`(x*100).toFixed(2)`)
- Negative values: red-highlighted
- bps when the source field uses bps (controlling floor display)
