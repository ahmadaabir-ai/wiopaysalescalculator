// manualCalculator.js — reverse logic for a single requested MDR.
// Calls runPricingEngine — does not redo the math.
// Mirror of LOGIC_EXTRACT §5.

import { runPricingEngine } from './pricingEngine.js';
import {
  mccTierMDR,
  tiers,
  tierRank,
  bankingRevTiers,
  riskAdj,
  getMccMarkup,
  vintageFloor,
  defaultFloors,
} from './mccData.js';

/**
 * Reverse-engineer the target tier for a requested MDR.
 * Same shape as LOGIC_EXTRACT §5 `calcTierRevGap`.
 */
export function calcTierRevGap(r, inp, reqMdrPct) {
  const industryMdrs = mccTierMDR[inp.industry] || mccTierMDR.retail;
  const adjTiers   = tiers.map((t, i) => ({ ...t, mdr: industryMdrs[i] }));
  const dispMarkup = getMccMarkup(inp.industry);
  const dispRisk   = riskAdj[inp.risk] || 0;
  // nearest displayed-MDR tier wins
  const targetTier = adjTiers.reduce((best, t) => {
    const tDisp    = t.mdr    + dispMarkup + dispRisk;
    const bestDisp = best.mdr + dispMarkup + dispRisk;
    return Math.abs(tDisp - reqMdrPct) < Math.abs(bestDisp - reqMdrPct) ? t : best;
  });
  // banking-revenue floor needed to satisfy Gate 1 for that tier
  const reqBankEntry = bankingRevTiers.slice().reverse().find(
    t => tierRank[t.cap] <= tierRank[targetTier.name],
  );
  const totalReq = reqBankEntry ? reqBankEntry.min : 0;
  const revGap   = Math.max(0, totalReq - (r ? r.bankingRev : 0));
  return { revGap, targetTier, reqBankEntry };
}

/**
 * Run the full manual-calculator verdict.
 * @param {object} inp  - engine input (sales context + yields/costs)
 * @param {number} reqMdrPct - requested MDR as a decimal (e.g. 0.015 = 1.5%)
 * @returns {object} verdict
 */
export function runManualCalculator(inp, reqMdrPct) {
  const r = runPricingEngine(inp);
  const { revGap, targetTier, reqBankEntry } = calcTierRevGap(r, inp, reqMdrPct);

  // PG revenue using the user-requested MDR (this is what we'd actually charge)
  const pgRev      = reqMdrPct * r.pgYearVol + r.aovFeeAnnual;
  const pgOnlyNet  = pgRev - r.pgCostAnnual;
  const totalRelNet = r.bankingRev + pgOnlyNet;

  // Controlling commercial floor:
  //   netMdrFloorBps interprets bps relative to PG volume,
  //   minMonthlyRev is an AED/month minimum on total relationship net.
  const netMdrFloorBps = inp.netMdrFloor != null ? inp.netMdrFloor : defaultFloors.netMdrFloorBps;
  const minMonthlyRev  = inp.minRev      != null ? inp.minRev      : defaultFloors.minMonthlyRev;
  const floorFromBps   = (netMdrFloorBps / 10000) * r.pgYearVol;   // annual AED
  const floorFromMin   = minMonthlyRev * 12;                       // annual AED
  const controllingFloor = Math.max(floorFromBps, floorFromMin);
  const controllingFloorIsMdr = floorFromBps >= floorFromMin && netMdrFloorBps > 0;

  const pgCovers  = pgOnlyNet  >= controllingFloor;
  const relCovers = totalRelNet >= controllingFloor;

  // Vintage / risk floor — manual exception below this
  const minAllowedMdr   = vintageFloor(inp.months, inp.industry) + (riskAdj[inp.risk] || 0);
  const belowPolicyFloor = reqMdrPct < minAllowedMdr && !inp.tlOverride;

  // Status banner
  let status, statusLabel;
  if (belowPolicyFloor) {
    status      = 'neg';
    statusLabel = 'Manual Exception Required — Below Policy Floor';
  } else if (pgCovers) {
    status      = 'pos';
    statusLabel = 'Covered by PG Economics';
  } else if (relCovers) {
    status      = 'warn';
    statusLabel = 'Covered by Banking Relationship';
  } else if (revGap > 0) {
    status      = 'cond';
    statusLabel = 'Conditionally Viable — Additional Relationship Required';
  } else {
    status      = 'neg';
    statusLabel = 'Manual Review Required';
  }

  // Shortfall is what extra banking revenue is needed for total-net to clear the floor.
  const shortfall = Math.max(0, controllingFloor - totalRelNet);
  // Required incremental balance to close the shortfall via balance NIM alone.
  const reqBalance = (inp.rBal > 0) ? shortfall / inp.rBal : 0;

  return {
    status,
    statusLabel,
    requestedMdrPct: reqMdrPct,
    pgCostPct: r.pgCostPct,
    pgYearVol: r.pgYearVol,
    pgRev,
    pgOnlyNet,
    bankingRev: r.bankingRev,
    totalRelNet,
    controllingFloor,
    controllingFloorIsMdr,
    pgCovers,
    relCovers,
    shortfall,
    reqBalance,
    belowPolicyFloor,
    minAllowedMdr,
    targetTier,
    reqBankEntry,
    revGap,
    // Pass-through engine values so the UI can render the waterfall without
    // re-running the engine.
    engine: r,
  };
}
