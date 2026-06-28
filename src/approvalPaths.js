// approvalPaths.js — four approval-path engine + AED-based rebalancing.
// Mirror of LOGIC_EXTRACT §3 + §6. Pure functions.

// ---------------------------------------------------------------------------
// §3 Loan helpers (reducing balance, year-1 interest)
// ---------------------------------------------------------------------------
export function calcYear1Interest(principal, annualRate, months) {
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

export function solveLoanPrincipal(targetInterest, annualRate, months) {
  if (targetInterest <= 0 || annualRate <= 0 || months <= 0) return 0;
  let lo = 0, hi = 1e9;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (calcYear1Interest(mid, annualRate, months) < targetInterest) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// §6.1 revenue → AED for each path
// ---------------------------------------------------------------------------
export function revToAed(key, rev, inp) {
  if (rev <= 0) return 0;
  if (key === 'balance') return inp.rBal  > 0 ? rev / inp.rBal : 0;
  if (key === 'spend')   return inp.rDeb  > 0 ? rev / inp.rDeb : 0;
  if (key === 'fx')      return inp.rXb   > 0 ? rev / inp.rXb  : 0;
  if (key === 'loan')    return inp.rLoan > 0
    ? solveLoanPrincipal(rev, inp.rLoan, inp.loanTenure || 24) : 0;
  return 0;
}

// ---------------------------------------------------------------------------
// §6.3 path revenue from an AED amount
// ---------------------------------------------------------------------------
export function pathRevenue(key, aedVal, inp) {
  if (!aedVal || aedVal <= 0) return 0;
  if (key === 'balance') return inp.rBal * aedVal;
  if (key === 'spend')   return inp.rDeb * aedVal;
  if (key === 'fx')      return inp.rXb  * aedVal;
  if (key === 'loan')    return inp.rLoan > 0
    ? calcYear1Interest(aedVal, inp.rLoan, inp.loanTenure || 24) : 0;
  return 0;
}

export function pathTotalRev(state, inp) {
  return ['balance', 'spend', 'fx', 'loan']
    .reduce((s, k) => s + pathRevenue(k, state[k] || 0, inp), 0);
}

// ---------------------------------------------------------------------------
// §6.2 standalone init — each path solves the full gap on its own
// ---------------------------------------------------------------------------
export function initApprovalPath(state, shortfall, inp) {
  const rates = { balance: inp.rBal, spend: inp.rDeb, fx: inp.rXb, loan: inp.rLoan };
  ['balance', 'spend', 'fx', 'loan'].forEach(k => {
    state[k] = rates[k] > 0 ? Math.ceil(revToAed(k, shortfall, inp)) : 0;
  });
}

// ---------------------------------------------------------------------------
// §6.3 build-your-own rebalance (AED, not percentage)
// ---------------------------------------------------------------------------
export function rebalanceApprovalPath(state, changedKey, newAed, shortfall, inp) {
  state[changedKey] = Math.max(0, +newAed || 0);
  const revChanged = pathRevenue(changedKey, state[changedKey], inp);
  const remaining  = Math.max(0, shortfall - revChanged);
  const rates  = { balance: inp.rBal, spend: inp.rDeb, fx: inp.rXb, loan: inp.rLoan };
  const others = ['balance', 'spend', 'fx', 'loan']
    .filter(k => k !== changedKey && rates[k] > 0);
  if (others.length === 0 || remaining <= 0) {
    others.forEach(k => { state[k] = 0; });
  } else {
    const revPerPath = remaining / others.length;
    others.forEach(k => { state[k] = Math.ceil(revToAed(k, revPerPath, inp)); });
  }
}

// ---------------------------------------------------------------------------
// §6.4 status — total rev vs shortfall (0.1% tolerance)
// ---------------------------------------------------------------------------
export function approvalPathStatus(state, shortfall, inp) {
  const totalRev = pathTotalRev(state, inp);
  const isValid  = shortfall <= 0 ? true : totalRev >= shortfall * 0.999;
  return { totalRev, isValid, shortfall };
}

// ---------------------------------------------------------------------------
// §7 standalone loan-tenure matrix
// ---------------------------------------------------------------------------
export function loanTenureMatrix(shortfall, inp, tenures = [12, 24, 36, 48]) {
  return tenures.map(months => {
    const principal = shortfall > 0 ? solveLoanPrincipal(shortfall, inp.rLoan, months) : 0;
    const r = (inp.rLoan || 0) / 12;
    const emi = (principal > 0 && r > 0)
      ? principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1)
      : 0;
    return { months, principal, emi };
  });
}
