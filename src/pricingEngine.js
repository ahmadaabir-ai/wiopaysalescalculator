// pricingEngine.js — canonical pricing engine.
// Mirror of LOGIC_EXTRACT §4. Pure function. No DOM. No globals.

import {
  industryInterchange,
  tiers,
  tierRank,
  bankingRevTiers,
  pgScaleTiers,
  riskAdj,
  getMccTierMDR,
  vintageFloor,
  aovCharge,
} from './mccData.js';

export function runPricingEngine(inp) {
  const {
    industry, risk, months, tlOverride,
    balance, xborder, spend, loans, loanTenure,
    aov, txnCount,
    debitMix, pineLabs, fixedCost, netMdrFloor, minRev,
    rBal, rXb, rDeb, rLoan, b1, b2, b3, b4,
  } = inp;

  const ic = industryInterchange[industry] || industryInterchange.retail;
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
    tierRank[pgScaleCapName],
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
