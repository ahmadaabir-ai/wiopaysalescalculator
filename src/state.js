// state.js — single global app state + tiny pub/sub.
// Sales-context inputs persist in localStorage so a reload keeps the merchant profile.

const STORAGE_KEY = 'wio-pay-sales-calc-state-v1';

const DEFAULTS = Object.freeze({
  // Sales context
  industry: 'retail',
  risk: 'low',
  months: 12,
  tlOverride: false,         // UAE Trade License ≥ 36 months overrides vintage floor
  balance: 0,
  xborder: 0,
  spend: 0,
  loans: 0,
  loanTenure: 24,
  aov: 200,
  txnCount: 500,
  debitMix: 0.60,

  // Manual & Sales calculator inputs
  requestedMdrPct: 0.0150,   // 1.50%
  desiredMdrPct: 0.0150,

  // Active tab
  activeTab: 'manual',

  // Build-Your-Own approval path (AED amounts per driver)
  manualPath: { balance: 0, spend: 0, fx: 0, loan: 0 },
  salesPath:  { balance: 0, spend: 0, fx: 0, loan: 0 },
});

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS, manualPath: { ...DEFAULTS.manualPath }, salesPath: { ...DEFAULTS.salesPath } };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...parsed,
      manualPath: { ...DEFAULTS.manualPath, ...(parsed.manualPath || {}) },
      salesPath:  { ...DEFAULTS.salesPath,  ...(parsed.salesPath  || {}) },
    };
  } catch {
    return { ...DEFAULTS, manualPath: { ...DEFAULTS.manualPath }, salesPath: { ...DEFAULTS.salesPath } };
  }
}

function save(s) {
  try {
    // Persist only the sales context + last-used MDRs (not the active tab).
    const persisted = {
      industry: s.industry, risk: s.risk, months: s.months, tlOverride: s.tlOverride,
      balance: s.balance, xborder: s.xborder, spend: s.spend,
      loans: s.loans, loanTenure: s.loanTenure,
      aov: s.aov, txnCount: s.txnCount, debitMix: s.debitMix,
      requestedMdrPct: s.requestedMdrPct, desiredMdrPct: s.desiredMdrPct,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch { /* ignore storage errors */ }
}

const state = load();
const subscribers = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  save(state);
  emit();
}

export function setManualPath(key, value) {
  state.manualPath[key] = value;
  emit();
}

export function setSalesPath(key, value) {
  state.salesPath[key] = value;
  emit();
}

export function resetSalesContext() {
  Object.assign(state, {
    industry: DEFAULTS.industry, risk: DEFAULTS.risk, months: DEFAULTS.months,
    tlOverride: DEFAULTS.tlOverride,
    balance: DEFAULTS.balance, xborder: DEFAULTS.xborder, spend: DEFAULTS.spend,
    loans: DEFAULTS.loans, loanTenure: DEFAULTS.loanTenure,
    aov: DEFAULTS.aov, txnCount: DEFAULTS.txnCount, debitMix: DEFAULTS.debitMix,
  });
  save(state);
  emit();
}

export function onChange(cb) {
  if (typeof cb === 'function') subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function emit() {
  subscribers.forEach(cb => {
    try { cb(state); } catch (e) { console.error('state subscriber error', e); }
  });
}

// ---------------------------------------------------------------------------
// Numeric coercion helpers — every input goes through here so the engine
// never sees NaN / negative-zero / strings.
// ---------------------------------------------------------------------------
export function num(v, fallback = 0) {
  const n = +v;
  return Number.isFinite(n) ? n : fallback;
}
export function clampMin(v, min) { return Math.max(min, num(v, min)); }
