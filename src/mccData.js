// mccData.js — mutable reference data store + helpers.
// All numbers come from reference/LOGIC_EXTRACT.md §1 + §2.
// The Backend Assumptions editor mutates these in place; the
// `subscribe(callback)` pub/sub lets other modules re-render on change.

// ---------------------------------------------------------------------------
// 1.1 MCC interchange (debit / credit)
// ---------------------------------------------------------------------------
export const industryInterchange = {
  retail:     { debit: 0.0075, credit: 0.0130, label: 'Retail / Supermarket' },
  government: { debit: 0.0050, credit: 0.0050, label: 'Government' },
  utility:    { debit: 0.0050, credit: 0.0050, label: 'Utility' },
  education:  { debit: 0.0065, credit: 0.0065, label: 'Education' },
  realestate: { debit: 0.0065, credit: 0.0065, label: 'Real Estate' },
  petrol:     { debit: 0.0050, credit: 0.0070, label: 'Petrol' },
  transport:  { debit: 0.0050, credit: 0.0050, label: 'Transportation' },
};

// ---------------------------------------------------------------------------
// 1.2 MCC customer markup
// ---------------------------------------------------------------------------
export const mccMarkupTable = {
  retail:     0.0030,
  government: 0.0010,
  utility:    0.0010,
  education:  0.0010,
  realestate: 0.0020,
  petrol:     0.0020,
  transport:  0.0020,
};

// ---------------------------------------------------------------------------
// 1.3 Risk adjustment (additive on final MDR)
// ---------------------------------------------------------------------------
export const riskAdj   = { low: 0.0000, med: 0.0020, high: 0.0040 };
export const riskLabel = { low: 'Low',  med: 'Medium', high: 'High' };

// ---------------------------------------------------------------------------
// 1.4 Tier ladder (ordered best → worst)
// ---------------------------------------------------------------------------
export const tiers = [
  { name: 'Strategic', mdr: 0.0050, ratio: 0.0150 },
  { name: 'Premium',   mdr: 0.0075, ratio: 0.0120 },
  { name: 'Preferred', mdr: 0.0100, ratio: 0.0090 },
  { name: 'Plus',      mdr: 0.0125, ratio: 0.0060 },
  { name: 'Standard',  mdr: 0.0150, ratio: 0.0040 },
  { name: 'Entry',     mdr: 0.0175, ratio: 0.0020 },
  { name: 'Base',      mdr: 0.0200, ratio: 0.0000 },
];

// ---------------------------------------------------------------------------
// 1.5 Per-MCC tier MDR table (Strategic … Base)
// ---------------------------------------------------------------------------
export const mccTierMDR = {
  retail:     [0.0050, 0.0075, 0.0100, 0.0125, 0.0150, 0.0175, 0.0200],
  government: [0.0030, 0.0045, 0.0060, 0.0075, 0.0090, 0.0105, 0.0120],
  utility:    [0.0030, 0.0045, 0.0060, 0.0075, 0.0090, 0.0105, 0.0120],
  education:  [0.0040, 0.0055, 0.0070, 0.0085, 0.0100, 0.0115, 0.0130],
  realestate: [0.0040, 0.0055, 0.0070, 0.0085, 0.0100, 0.0115, 0.0130],
  petrol:     [0.0035, 0.0050, 0.0065, 0.0080, 0.0095, 0.0110, 0.0125],
  transport:  [0.0030, 0.0045, 0.0060, 0.0075, 0.0090, 0.0105, 0.0120],
};

// ---------------------------------------------------------------------------
// 1.6 Tier rank (higher = more conservative)
// ---------------------------------------------------------------------------
export const tierRank = {
  Strategic: 1, Premium: 2, Preferred: 3,
  Plus: 4, Standard: 5, Entry: 6, Base: 7,
};

// ---------------------------------------------------------------------------
// 1.7 Banking-rev → tier cap (Gate 1)
// ---------------------------------------------------------------------------
export const bankingRevTiers = [
  { label: 'Strategic',  min: 50000, cap: 'Strategic' },
  { label: 'Premium',    min: 40000, cap: 'Premium'   },
  { label: 'Strong',     min: 30000, cap: 'Preferred' },
  { label: 'Moderate',   min: 20000, cap: 'Plus'      },
  { label: 'Developing', min: 10000, cap: 'Standard'  },
  { label: 'Low',        min: 5000,  cap: 'Entry'     },
  { label: 'Very Low',   min: 0,     cap: 'Base'      },
];

// ---------------------------------------------------------------------------
// 1.8 Annual PG volume → tier cap (Gate 3)
// ---------------------------------------------------------------------------
export const pgScaleTiers = [
  { label: 'Enterprise', min: 2500000, cap: 'Strategic' },
  { label: 'Mid-Market', min: 1500000, cap: 'Premium'   },
  { label: 'Growth SME', min: 750000,  cap: 'Preferred' },
  { label: 'SME',        min: 400000,  cap: 'Plus'      },
  { label: 'Small',      min: 200000,  cap: 'Standard'  },
  { label: 'Micro',      min: 20000,   cap: 'Entry'     },
  { label: 'Nano',       min: 0,       cap: 'Base'      },
];

// ---------------------------------------------------------------------------
// 1.9 E-com per-transaction fee brackets (AOV-driven)
// ---------------------------------------------------------------------------
export const CMC_FEE_DEFAULTS = [1.00, 0.75, 0.50, 0.00];
export const CMC_FEE_BRACKETS = ['0 – 200', '200 – 500', '500 – 1,000', '1,000+'];

// ---------------------------------------------------------------------------
// 1.10 Banking yields (annualised)
// ---------------------------------------------------------------------------
export const defaultYields = {
  rBal:  0.0375,
  rXb:   0.0060,
  rDeb:  0.0114,
  rLoan: 0.0800,
};

// ---------------------------------------------------------------------------
// 1.11 Acquiring cost stack
// ---------------------------------------------------------------------------
export const defaultCosts = {
  pineLabs:  0.0009,
  fixedCost: 1.10,
  debitMix:  0.60,
};

// ---------------------------------------------------------------------------
// 1.12 Commercial floor
// ---------------------------------------------------------------------------
export const defaultFloors = {
  netMdrFloorBps: 0,
  minMonthlyRev:  0,
};

// ---------------------------------------------------------------------------
// Deep-clone of original defaults so "Reset to defaults" can restore them
// without losing the immutable source-of-truth values from this module.
// ---------------------------------------------------------------------------
const SNAPSHOT = {
  industryInterchange: JSON.parse(JSON.stringify(industryInterchange)),
  mccMarkupTable:      JSON.parse(JSON.stringify(mccMarkupTable)),
  riskAdj:             JSON.parse(JSON.stringify(riskAdj)),
  tiers:               JSON.parse(JSON.stringify(tiers)),
  mccTierMDR:          JSON.parse(JSON.stringify(mccTierMDR)),
  bankingRevTiers:     JSON.parse(JSON.stringify(bankingRevTiers)),
  pgScaleTiers:        JSON.parse(JSON.stringify(pgScaleTiers)),
  CMC_FEE_DEFAULTS:    [...CMC_FEE_DEFAULTS],
  defaultYields:       { ...defaultYields },
  defaultCosts:        { ...defaultCosts },
  defaultFloors:       { ...defaultFloors },
};

export function resetMccDefaults() {
  Object.keys(industryInterchange).forEach(k => delete industryInterchange[k]);
  Object.assign(industryInterchange, JSON.parse(JSON.stringify(SNAPSHOT.industryInterchange)));

  Object.keys(mccMarkupTable).forEach(k => delete mccMarkupTable[k]);
  Object.assign(mccMarkupTable, JSON.parse(JSON.stringify(SNAPSHOT.mccMarkupTable)));

  Object.assign(riskAdj, JSON.parse(JSON.stringify(SNAPSHOT.riskAdj)));

  tiers.length = 0;
  JSON.parse(JSON.stringify(SNAPSHOT.tiers)).forEach(t => tiers.push(t));

  Object.keys(mccTierMDR).forEach(k => delete mccTierMDR[k]);
  Object.assign(mccTierMDR, JSON.parse(JSON.stringify(SNAPSHOT.mccTierMDR)));

  bankingRevTiers.length = 0;
  JSON.parse(JSON.stringify(SNAPSHOT.bankingRevTiers)).forEach(t => bankingRevTiers.push(t));

  pgScaleTiers.length = 0;
  JSON.parse(JSON.stringify(SNAPSHOT.pgScaleTiers)).forEach(t => pgScaleTiers.push(t));

  CMC_FEE_DEFAULTS.length = 0;
  SNAPSHOT.CMC_FEE_DEFAULTS.forEach(v => CMC_FEE_DEFAULTS.push(v));

  Object.assign(defaultYields, SNAPSHOT.defaultYields);
  Object.assign(defaultCosts,  SNAPSHOT.defaultCosts);
  Object.assign(defaultFloors, SNAPSHOT.defaultFloors);
  notify();
}

// ---------------------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------------------
export function vintageFloor(months, industry) {
  const mdrs = mccTierMDR[industry] || mccTierMDR.retail;
  if (months < 6)  return mdrs[6]; // Base
  if (months < 12) return mdrs[2]; // Preferred
  return mdrs[0];                  // Strategic
}

export function vintageLabel(months) {
  if (months < 6)  return '< 6 months';
  if (months < 12) return '6–12 months';
  return '12+ months';
}

export function aovCharge(aov, b1, b2, b3, b4) {
  if (aov < 200)  return b1;
  if (aov < 500)  return b2;
  if (aov < 1000) return b3;
  return b4;
}

export function aovBucketLabel(aov) {
  if (aov < 200)  return '0–200';
  if (aov < 500)  return '200–500';
  if (aov < 1000) return '500–1,000';
  return '1,000+';
}

export function getMccTierMDR(industry, tierName) {
  const mdrs = mccTierMDR[industry] || mccTierMDR.retail;
  return mdrs[tierRank[tierName] - 1];
}

export function getMccMarkup(industry) {
  return mccMarkupTable[industry] !== undefined
    ? mccMarkupTable[industry]
    : mccMarkupTable.retail;
}

// ---------------------------------------------------------------------------
// Pub/sub — Backend editor calls notify() after each mutation.
// ---------------------------------------------------------------------------
const subscribers = new Set();

export function subscribe(callback) {
  if (typeof callback === 'function') subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function notify() {
  subscribers.forEach(cb => {
    try { cb(); } catch (e) { console.error('mccData subscriber error', e); }
  });
}
