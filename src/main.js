// main.js — wires everything together.
// Tabs: Manual Calculator (default), Sales Calculator, Backend Assumptions.

import {
  industryInterchange, mccMarkupTable, riskAdj, tiers, tierRank,
  mccTierMDR, bankingRevTiers, pgScaleTiers,
  CMC_FEE_DEFAULTS, defaultYields, defaultCosts, defaultFloors,
  vintageFloor, getMccMarkup, getMccTierMDR,
  subscribe as subscribeMcc, notify as notifyMcc, resetMccDefaults,
} from './mccData.js';
import { runManualCalculator, calcTierRevGap } from './manualCalculator.js';
import {
  initApprovalPath, rebalanceApprovalPath, pathRevenue, pathTotalRev,
  loanTenureMatrix, revToAed,
} from './approvalPaths.js';
import { getState, setState, setManualPath, setSalesPath, onChange, num, clampMin } from './state.js';

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
const aedFmt = new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 });
const fmtAED = v => (Number.isFinite(v) ? aedFmt.format(Math.round(v)) : '0');
const fmtPct = v => (Number.isFinite(v) ? (v * 100).toFixed(2) + '%' : '0.00%');
const fmtAEDSigned = v => {
  if (!Number.isFinite(v)) return '0';
  return (v < 0 ? '-' : '') + 'AED ' + fmtAED(Math.abs(v));
};

// ---------------------------------------------------------------------------
// Build engine input from current state
// ---------------------------------------------------------------------------
function buildEngineInput(s) {
  return {
    industry: s.industry,
    risk: s.risk,
    months: clampMin(s.months, 0),
    tlOverride: !!s.tlOverride,
    balance: clampMin(s.balance, 0),
    xborder: clampMin(s.xborder, 0),
    spend: clampMin(s.spend, 0),
    loans: clampMin(s.loans, 0),
    loanTenure: clampMin(s.loanTenure, 0),
    aov: clampMin(s.aov, 1),
    txnCount: clampMin(s.txnCount, 0),
    debitMix: Math.min(1, Math.max(0, num(s.debitMix, defaultCosts.debitMix))),
    pineLabs: defaultCosts.pineLabs,
    fixedCost: defaultCosts.fixedCost,
    netMdrFloor: defaultFloors.netMdrFloorBps,
    minRev: defaultFloors.minMonthlyRev,
    rBal:  defaultYields.rBal,
    rXb:   defaultYields.rXb,
    rDeb:  defaultYields.rDeb,
    rLoan: defaultYields.rLoan,
    b1: CMC_FEE_DEFAULTS[0],
    b2: CMC_FEE_DEFAULTS[1],
    b3: CMC_FEE_DEFAULTS[2],
    b4: CMC_FEE_DEFAULTS[3],
  };
}

// ---------------------------------------------------------------------------
// Shell — tabs + panels
// ---------------------------------------------------------------------------
const app = document.getElementById('app');

function mountShell() {
  app.innerHTML = `
    <section class="panel" id="panel-manual"></section>
    <section class="panel" id="panel-sales"></section>
    <section class="panel" id="panel-backend"></section>
  `;
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      setState({ activeTab: btn.dataset.tab });
    });
  });
}

function showActiveTab() {
  const s = getState();
  document.querySelectorAll('.tab').forEach(btn => {
    const on = btn.dataset.tab === s.activeTab;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', on);
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('is-active'));
  const active = document.getElementById('panel-' + s.activeTab);
  if (active) active.classList.add('is-active');
}

// ---------------------------------------------------------------------------
// Sales-context panel (shared between Manual + Sales)
// ---------------------------------------------------------------------------
function salesContextHTML(s) {
  const industryOpts = Object.entries(industryInterchange)
    .map(([k, v]) => `<option value="${k}" ${k === s.industry ? 'selected' : ''}>${v.label}</option>`)
    .join('');
  return `
    <div class="card">
      <h2 class="card__title">Sales Context</h2>
      <p class="card__subtitle">Merchant profile — shared across Manual + Sales calculators.</p>

      <div class="field">
        <label class="field__label" for="f-industry">Industry (MCC)</label>
        <select class="select" id="f-industry">${industryOpts}</select>
      </div>

      <div class="field">
        <label class="field__label" for="f-months">Business Vintage</label>
        <select class="select" id="f-months">
          <option value="3"  ${s.months === 3  ? 'selected' : ''}>0 – 6 months</option>
          <option value="9"  ${s.months === 9  ? 'selected' : ''}>6 – 12 months</option>
          <option value="15" ${s.months === 15 ? 'selected' : ''}>12 – 18 months</option>
          <option value="21" ${s.months === 21 ? 'selected' : ''}>18 – 24 months</option>
          <option value="30" ${s.months === 30 ? 'selected' : ''}>24+ months</option>
        </select>
      </div>

      <div class="field">
        <label class="field__label">UAE Trade License</label>
        <div class="chips">
          <button class="chip ${!s.tlOverride ? 'is-active' : ''}" data-tl="0">Under 3 years</button>
          <button class="chip ${ s.tlOverride ? 'is-active' : ''}" data-tl="1">3 years or more</button>
        </div>
        <div class="field__hint">3y+ waives the vintage floor.</div>
      </div>

      <div class="field">
        <label class="field__label">Risk Rating</label>
        <div class="chips">
          <button class="chip ${s.risk === 'low'  ? 'is-active' : ''}" data-risk="low">Low</button>
          <button class="chip ${s.risk === 'med'  ? 'is-active' : ''}" data-risk="med">Medium +0.20%</button>
          <button class="chip ${s.risk === 'high' ? 'is-active' : ''}" data-risk="high">High +0.40%</button>
        </div>
      </div>

      <div class="row-2">
        <div class="field">
          <label class="field__label" for="f-aov">AOV (AED)</label>
          <input class="input mono" id="f-aov" type="number" min="1" step="1" value="${s.aov}" />
        </div>
        <div class="field">
          <label class="field__label" for="f-txn">Monthly Transactions</label>
          <input class="input mono" id="f-txn" type="number" min="0" step="1" value="${s.txnCount}" />
        </div>
      </div>
      <div class="field__hint" id="tpv-hint">Monthly TPV: AED ${fmtAED(s.aov * s.txnCount)}</div>

      <div class="field" style="margin-top:14px;">
        <label class="field__label">Debit / Credit Mix (Debit ${(s.debitMix * 100).toFixed(0)}%)</label>
        <input class="slider" id="f-debitMix" type="range" min="0" max="100" step="1" value="${Math.round(s.debitMix * 100)}" />
      </div>

      <div class="row-2">
        <div class="field">
          <label class="field__label" for="f-balance">Avg Balance (AED)</label>
          <input class="input mono" id="f-balance" type="number" min="0" step="1000" value="${s.balance}" />
        </div>
        <div class="field">
          <label class="field__label" for="f-xborder">Cross-Border Vol / yr</label>
          <input class="input mono" id="f-xborder" type="number" min="0" step="1000" value="${s.xborder}" />
        </div>
      </div>

      <div class="row-2">
        <div class="field">
          <label class="field__label" for="f-spend">Card Spend / yr</label>
          <input class="input mono" id="f-spend" type="number" min="0" step="1000" value="${s.spend}" />
        </div>
        <div class="field">
          <label class="field__label" for="f-loans">Loan Amount (AED)</label>
          <input class="input mono" id="f-loans" type="number" min="0" step="1000" value="${s.loans}" />
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="f-loanTenure">Loan Tenure (months)</label>
        <input class="input mono" id="f-loanTenure" type="number" min="0" step="1" value="${s.loanTenure}" />
      </div>
    </div>
  `;
}

function wireSalesContext(root) {
  root.querySelector('#f-industry').addEventListener('change', e => setState({ industry: e.target.value }));
  root.querySelector('#f-months').addEventListener('change',   e => setState({ months: num(e.target.value, 12) }));
  root.querySelectorAll('[data-tl]').forEach(c =>
    c.addEventListener('click', () => setState({ tlOverride: c.dataset.tl === '1' })));
  root.querySelectorAll('[data-risk]').forEach(c =>
    c.addEventListener('click', () => setState({ risk: c.dataset.risk })));
  root.querySelector('#f-aov').addEventListener('input',     e => setState({ aov: clampMin(e.target.value, 1) }));
  root.querySelector('#f-txn').addEventListener('input',     e => setState({ txnCount: clampMin(e.target.value, 0) }));
  root.querySelector('#f-debitMix').addEventListener('input', e => setState({ debitMix: num(e.target.value, 60) / 100 }));
  root.querySelector('#f-balance').addEventListener('input', e => setState({ balance: clampMin(e.target.value, 0) }));
  root.querySelector('#f-xborder').addEventListener('input', e => setState({ xborder: clampMin(e.target.value, 0) }));
  root.querySelector('#f-spend').addEventListener('input',   e => setState({ spend: clampMin(e.target.value, 0) }));
  root.querySelector('#f-loans').addEventListener('input',   e => setState({ loans: clampMin(e.target.value, 0) }));
  root.querySelector('#f-loanTenure').addEventListener('input', e => setState({ loanTenure: clampMin(e.target.value, 0) }));
}

// ---------------------------------------------------------------------------
// Pitch text per status
// ---------------------------------------------------------------------------
function pitchText(v, mode = 'manual') {
  const tier = v.targetTier ? v.targetTier.name : 'Base';
  switch (v.status) {
    case 'pos':
      return `PG economics alone clear the floor at this rate — the merchant maps cleanly to the ${tier} tier. Lock the offer.`;
    case 'warn':
      return `PG economics fall short on their own, but the wider banking relationship covers the floor. Position this as a relationship deal and reinforce the cross-product hooks (NIM, FX, spend, loan).`;
    case 'cond':
      return `The rate is conditionally viable — close the gap with one of the approval paths below. The build-your-own block lets you blend AED across drivers without re-pricing.`;
    case 'neg':
    default:
      return v.belowPolicyFloor
        ? `The requested MDR is below the policy floor for this MCC + vintage + risk profile. Escalate as a manual exception, or revise the rate up to ${fmtPct(v.minAllowedMdr)}.`
        : `Floor not met on any standard route. Recommend repositioning the offer or escalating for manual review.`;
  }
}

// ---------------------------------------------------------------------------
// Standalone approval-path cards
// ---------------------------------------------------------------------------
function standalonePathsHTML(shortfall, inp) {
  if (shortfall <= 0) {
    return `<div class="muted" style="margin-top:8px;">No additional relationship required.</div>`;
  }
  const tmp = {};
  initApprovalPath(tmp, shortfall, inp);
  const cards = [
    { key: 'balance', name: 'Grow Balance',       unit: 'Required avg balance', rate: inp.rBal, hint: `NIM ${fmtPct(inp.rBal)}` },
    { key: 'fx',      name: 'Increase FX',        unit: 'Required FX volume / yr', rate: inp.rXb,  hint: `Take ${fmtPct(inp.rXb)}` },
    { key: 'spend',   name: 'Increase Card Spend',unit: 'Required spend / yr',  rate: inp.rDeb, hint: `Interchange ${fmtPct(inp.rDeb)}` },
    { key: 'loan',    name: 'Take Business Loan', unit: 'Required principal',   rate: inp.rLoan,hint: `Rate ${fmtPct(inp.rLoan)} · ${inp.loanTenure}mo` },
  ];
  return `
    <div class="paths">
      ${cards.map(c => `
        <div class="path-card">
          <div class="path-card__name">${c.name}</div>
          <div class="path-card__aed">AED ${fmtAED(tmp[c.key])}</div>
          <div class="path-card__hint">${c.unit} · ${c.hint}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function loanMatrixHTML(shortfall, inp) {
  if (shortfall <= 0) return '';
  const rows = loanTenureMatrix(shortfall, inp);
  return `
    <div class="section-label">Loan tenure matrix</div>
    <table class="loan-matrix">
      <thead>
        <tr><th>Tenure</th><th>Required principal</th><th>EMI</th></tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr class="${r.months === inp.loanTenure ? 'is-active' : ''}">
            <td>${r.months} months</td>
            <td>AED ${fmtAED(r.principal)}</td>
            <td>AED ${fmtAED(r.emi)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ---------------------------------------------------------------------------
// Build-Your-Own approval path block
// ---------------------------------------------------------------------------
function byoHTML(pathState, shortfall, inp, idPrefix) {
  const meta = [
    { key: 'balance', label: 'Balance (AED)',      rate: inp.rBal },
    { key: 'spend',   label: 'Card Spend (AED)',  rate: inp.rDeb },
    { key: 'fx',      label: 'Cross-Border (AED)', rate: inp.rXb },
    { key: 'loan',    label: 'Loan Principal (AED)', rate: inp.rLoan },
  ];
  return `
    <div class="byo-grid">
      ${meta.map(m => `
        <div class="byo">
          <label class="byo__label" for="${idPrefix}-${m.key}">${m.label}</label>
          <input class="input mono" id="${idPrefix}-${m.key}" type="number" min="0" step="1000" value="${Math.round(pathState[m.key] || 0)}" />
          <div class="byo__rev" data-byo-rev="${m.key}">Revenue: AED ${fmtAED(pathRevenue(m.key, pathState[m.key] || 0, inp))}</div>
        </div>
      `).join('')}
    </div>
    <div class="byo-status" id="${idPrefix}-status"></div>
  `;
}

function wireByo(root, pathStateGetter, shortfallGetter, inpGetter, setter, idPrefix) {
  ['balance', 'spend', 'fx', 'loan'].forEach(key => {
    const el = root.querySelector(`#${idPrefix}-${key}`);
    if (!el) return;
    el.addEventListener('input', e => {
      const aed = clampMin(e.target.value, 0);
      const pathState = pathStateGetter();
      rebalanceApprovalPath(pathState, key, aed, shortfallGetter(), inpGetter());
      // Push every value back into state so persistence and re-render stay in sync.
      ['balance', 'spend', 'fx', 'loan'].forEach(k => setter(k, pathState[k]));
    });
  });
}

function renderByoStatus(root, pathState, shortfall, inp, idPrefix) {
  const total = pathTotalRev(pathState, inp);
  const ok = shortfall <= 0 ? true : total >= shortfall * 0.999;
  const el = root.querySelector(`#${idPrefix}-status`);
  if (!el) return;
  el.className = 'byo-status ' + (ok ? 'is-ok' : 'is-bad');
  el.innerHTML = shortfall <= 0
    ? `No revenue gap to close — current relationship already covers the floor.`
    : `Blended revenue <strong>AED ${fmtAED(total)}</strong> vs shortfall <strong>AED ${fmtAED(shortfall)}</strong> — ${ok ? 'shortfall covered' : `still short AED ${fmtAED(Math.max(0, shortfall - total))}`}.`;
}

// ---------------------------------------------------------------------------
// Manual Calculator panel
// ---------------------------------------------------------------------------
function renderManualPanel() {
  const s = getState();
  const inp = buildEngineInput(s);
  const v = runManualCalculator(inp, num(s.requestedMdrPct, 0));
  const panel = document.getElementById('panel-manual');

  // Lazy-init the manual path block when shortfall becomes positive and state is empty.
  const pathEmpty = ['balance', 'spend', 'fx', 'loan'].every(k => !s.manualPath[k]);
  if (v.shortfall > 0 && pathEmpty) {
    const tmp = {};
    initApprovalPath(tmp, v.shortfall, inp);
    Object.entries(tmp).forEach(([k, val]) => setManualPath(k, val));
  }

  panel.innerHTML = `
    <div class="split">
      <div>${salesContextHTML(s)}</div>
      <div>
        <div class="card">
          <h2 class="card__title">Manual Calculator</h2>
          <p class="card__subtitle">Enter a requested MDR — see whether the relationship economics can support it.</p>

          <div class="field">
            <label class="field__label" for="f-reqMdr">Requested MDR %</label>
            <input class="input input--lg mono" id="f-reqMdr" type="number" min="0" step="0.01" value="${(s.requestedMdrPct * 100).toFixed(2)}" />
            <div class="field__hint">Vintage floor for this profile: ${fmtPct(v.minAllowedMdr)}</div>
          </div>

          <div class="verdict verdict--${v.status}">
            <span class="verdict__dot"></span>
            <div>
              <div class="verdict__label">${v.statusLabel}</div>
              <div class="verdict__detail">Target tier: ${v.targetTier ? v.targetTier.name : '—'}${v.reqBankEntry ? ` · Gate 1 needs AED ${fmtAED(v.reqBankEntry.min)} banking rev` : ''}</div>
            </div>
          </div>

          ${v.belowPolicyFloor ? `<div class="alert">Requested MDR is below the policy floor (${fmtPct(v.minAllowedMdr)}). Manual exception required — sales cannot offer this rate without approval.</div>` : ''}

          <div class="kpis">
            <div class="kpi"><div class="kpi__label">Requested MDR</div><div class="kpi__value">${fmtPct(v.requestedMdrPct)}</div></div>
            <div class="kpi"><div class="kpi__label">PG Cost %</div><div class="kpi__value">${fmtPct(v.pgCostPct)}</div></div>
            <div class="kpi"><div class="kpi__label">PG Revenue</div><div class="kpi__value">AED ${fmtAED(v.pgRev)}</div></div>
            <div class="kpi"><div class="kpi__label">PG-only Net</div><div class="kpi__value ${v.pgOnlyNet < 0 ? 'neg' : ''}">AED ${fmtAED(v.pgOnlyNet)}</div></div>
            <div class="kpi"><div class="kpi__label">Total Relationship Net</div><div class="kpi__value ${v.totalRelNet < 0 ? 'neg' : ''}">AED ${fmtAED(v.totalRelNet)}</div></div>
            <div class="kpi"><div class="kpi__label">Controlling Floor</div><div class="kpi__value">AED ${fmtAED(v.controllingFloor)}</div><div class="kpi__hint">${v.controllingFloorIsMdr ? 'Net MDR bps' : 'Min monthly rev'}</div></div>
            <div class="kpi"><div class="kpi__label">${v.shortfall > 0 ? 'Required Extra Balance' : 'Coverage Buffer'}</div><div class="kpi__value">AED ${fmtAED(v.shortfall > 0 ? v.reqBalance : (v.totalRelNet - v.controllingFloor))}</div></div>
          </div>
        </div>

        <div class="card">
          <h3 class="card__title">PG Economics Waterfall</h3>
          <div class="waterfall">
            <div class="waterfall__row"><span class="waterfall__label">MDR revenue</span><span class="waterfall__value">AED ${fmtAED(v.requestedMdrPct * v.pgYearVol)}</span></div>
            <div class="waterfall__row"><span class="waterfall__label">+ E-com per-txn fee</span><span class="waterfall__value">AED ${fmtAED(v.engine.aovFeeAnnual)}</span></div>
            <div class="waterfall__row"><span class="waterfall__label">− PG cost stack</span><span class="waterfall__value neg">AED ${fmtAED(v.engine.pgCostAnnual)}</span></div>
            <div class="waterfall__row"><span class="waterfall__label">PG-only net</span><span class="waterfall__value ${v.pgOnlyNet < 0 ? 'neg' : ''}">AED ${fmtAED(v.pgOnlyNet)}</span></div>
          </div>
        </div>

        <div class="card">
          <h3 class="card__title">Relationship Coverage Waterfall</h3>
          <div class="waterfall">
            <div class="waterfall__row"><span class="waterfall__label">PG-only net</span><span class="waterfall__value ${v.pgOnlyNet < 0 ? 'neg' : ''}">AED ${fmtAED(v.pgOnlyNet)}</span></div>
            <div class="waterfall__row"><span class="waterfall__label">+ Banking revenue (NIM · FX · spend · loan yr-1)</span><span class="waterfall__value">AED ${fmtAED(v.bankingRev)}</span></div>
            <div class="waterfall__row"><span class="waterfall__label">vs Controlling floor</span><span class="waterfall__value">AED ${fmtAED(v.controllingFloor)}</span></div>
            <div class="waterfall__row"><span class="waterfall__label">Verdict</span><span class="waterfall__value">${v.relCovers ? 'Covered' : 'Short by AED ' + fmtAED(v.shortfall)}</span></div>
          </div>
        </div>

        <div class="card">
          <h3 class="card__title">Approval Paths (Standalone)</h3>
          <p class="card__subtitle">Each path closes the entire revenue gap on its own.</p>
          ${standalonePathsHTML(v.shortfall, inp)}
          ${loanMatrixHTML(v.shortfall, inp)}
        </div>

        <div class="card">
          <h3 class="card__title">Build-Your-Own Approval Path</h3>
          <p class="card__subtitle">AED-based — change one and the others rebalance evenly across active drivers.</p>
          ${byoHTML(s.manualPath, v.shortfall, inp, 'm-byo')}
        </div>

        <div class="pitch">
          <div class="pitch__title">Sales Pitch</div>
          <div class="pitch__body">${pitchText(v, 'manual')}</div>
        </div>
      </div>
    </div>
  `;

  wireSalesContext(panel);

  panel.querySelector('#f-reqMdr').addEventListener('input', e => {
    const pct = clampMin(e.target.value, 0) / 100;
    setState({ requestedMdrPct: pct });
    // Reset manual path so it re-inits to new shortfall on next render.
    ['balance', 'spend', 'fx', 'loan'].forEach(k => setManualPath(k, 0));
  });

  wireByo(
    panel,
    () => getState().manualPath,
    () => {
      const cur = getState();
      const verdict = runManualCalculator(buildEngineInput(cur), num(cur.requestedMdrPct, 0));
      return verdict.shortfall;
    },
    () => buildEngineInput(getState()),
    setManualPath,
    'm-byo',
  );
  renderByoStatus(panel, s.manualPath, v.shortfall, inp, 'm-byo');
}

// ---------------------------------------------------------------------------
// Sales Calculator panel (reverse)
// ---------------------------------------------------------------------------
function renderSalesPanel() {
  const s = getState();
  const inp = buildEngineInput(s);
  const desiredMdr = num(s.desiredMdrPct, 0);
  // Reverse: treat the desired MDR like a "requested" MDR and ask the manual
  // calculator what relationship is needed to make it work.
  const v = runManualCalculator(inp, desiredMdr);
  const panel = document.getElementById('panel-sales');

  const pathEmpty = ['balance', 'spend', 'fx', 'loan'].every(k => !s.salesPath[k]);
  if (v.shortfall > 0 && pathEmpty) {
    const tmp = {};
    initApprovalPath(tmp, v.shortfall, inp);
    Object.entries(tmp).forEach(([k, val]) => setSalesPath(k, val));
  }

  panel.innerHTML = `
    <div class="split">
      <div>${salesContextHTML(s)}</div>
      <div>
        <div class="card">
          <h2 class="card__title">Sales Calculator (Reverse)</h2>
          <p class="card__subtitle">Enter the MDR you want to offer — see the minimum relationship that supports it.</p>

          <div class="field">
            <label class="field__label" for="f-desiredMdr">Desired MDR to Offer %</label>
            <input class="input input--lg mono" id="f-desiredMdr" type="number" min="0" step="0.01" value="${(desiredMdr * 100).toFixed(2)}" />
            <div class="field__hint">Vintage floor: ${fmtPct(v.minAllowedMdr)}</div>
          </div>

          <div class="verdict verdict--${v.status}">
            <span class="verdict__dot"></span>
            <div>
              <div class="verdict__label">${v.statusLabel}</div>
              <div class="verdict__detail">Target tier: ${v.targetTier ? v.targetTier.name : '—'}${v.reqBankEntry ? ` · Gate 1 needs AED ${fmtAED(v.reqBankEntry.min)} banking rev` : ''}</div>
            </div>
          </div>

          ${v.belowPolicyFloor ? `<div class="alert">Desired MDR is below the policy floor (${fmtPct(v.minAllowedMdr)}). Manual exception required.</div>` : ''}

          <div class="kpis">
            <div class="kpi"><div class="kpi__label">Desired MDR</div><div class="kpi__value">${fmtPct(v.requestedMdrPct)}</div></div>
            <div class="kpi"><div class="kpi__label">PG Revenue at MDR</div><div class="kpi__value">AED ${fmtAED(v.pgRev)}</div></div>
            <div class="kpi"><div class="kpi__label">PG-only Net</div><div class="kpi__value ${v.pgOnlyNet < 0 ? 'neg' : ''}">AED ${fmtAED(v.pgOnlyNet)}</div></div>
            <div class="kpi"><div class="kpi__label">Current Banking Rev</div><div class="kpi__value">AED ${fmtAED(v.bankingRev)}</div></div>
            <div class="kpi"><div class="kpi__label">Floor</div><div class="kpi__value">AED ${fmtAED(v.controllingFloor)}</div></div>
            <div class="kpi"><div class="kpi__label">Revenue Shortfall</div><div class="kpi__value ${v.shortfall > 0 ? 'neg' : ''}">AED ${fmtAED(v.shortfall)}</div></div>
          </div>
        </div>

        <div class="card">
          <h3 class="card__title">Minimum Relationship — Standalone Paths</h3>
          <p class="card__subtitle">Each card shows the AED in a single driver that would close the gap alone.</p>
          ${standalonePathsHTML(v.shortfall, inp)}
          ${loanMatrixHTML(v.shortfall, inp)}
        </div>

        <div class="card">
          <h3 class="card__title">Build-Your-Own Approval Path</h3>
          <p class="card__subtitle">Distribute the shortfall across multiple drivers. AED-based rebalancing.</p>
          ${byoHTML(s.salesPath, v.shortfall, inp, 's-byo')}
        </div>

        <div class="pitch">
          <div class="pitch__title">Sales Pitch</div>
          <div class="pitch__body">${pitchText(v, 'sales')}</div>
        </div>
      </div>
    </div>
  `;

  wireSalesContext(panel);
  panel.querySelector('#f-desiredMdr').addEventListener('input', e => {
    const pct = clampMin(e.target.value, 0) / 100;
    setState({ desiredMdrPct: pct });
    ['balance', 'spend', 'fx', 'loan'].forEach(k => setSalesPath(k, 0));
  });

  wireByo(
    panel,
    () => getState().salesPath,
    () => {
      const cur = getState();
      const verdict = runManualCalculator(buildEngineInput(cur), num(cur.desiredMdrPct, 0));
      return verdict.shortfall;
    },
    () => buildEngineInput(getState()),
    setSalesPath,
    's-byo',
  );
  renderByoStatus(panel, s.salesPath, v.shortfall, inp, 's-byo');
}

// ---------------------------------------------------------------------------
// Backend Assumptions panel — editable defaults from LOGIC_EXTRACT §1
// ---------------------------------------------------------------------------
function pctInput(value, onChange) {
  // Bind an input that edits a percentage (decimal stored, % shown).
  const input = document.createElement('input');
  input.className = 'input mono';
  input.type = 'number';
  input.step = '0.0001';
  input.value = (value * 100).toFixed(4);
  input.addEventListener('input', e => {
    const pct = num(e.target.value, 0) / 100;
    onChange(pct);
  });
  return input;
}

function numInput(value, onChange, step = 1) {
  const input = document.createElement('input');
  input.className = 'input mono';
  input.type = 'number';
  input.step = String(step);
  input.value = value;
  input.addEventListener('input', e => onChange(num(e.target.value, 0)));
  return input;
}

function renderBackendPanel() {
  const panel = document.getElementById('panel-backend');

  panel.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <div>
          <h2 class="card__title">Backend Assumptions</h2>
          <p class="card__subtitle">Edit any value — calculators re-render live across all tabs.</p>
        </div>
        <button class="btn btn--ghost" id="backend-reset">Reset to defaults</button>
      </div>

      <div class="backend-section">
        <div class="section-label">MCC Interchange (debit / credit)</div>
        <table class="backend-table"><thead><tr><th>Industry</th><th>Debit %</th><th>Credit %</th></tr></thead><tbody id="t-interchange"></tbody></table>
      </div>

      <div class="backend-section">
        <div class="section-label">Customer markup (per MCC)</div>
        <table class="backend-table"><thead><tr><th>Industry</th><th>Markup %</th></tr></thead><tbody id="t-markup"></tbody></table>
      </div>

      <div class="backend-section">
        <div class="section-label">Tier MDR matrix (per MCC × tier)</div>
        <table class="backend-table"><thead><tr><th>Industry</th>${tiers.map(t => `<th>${t.name} %</th>`).join('')}</tr></thead><tbody id="t-tierMdr"></tbody></table>
      </div>

      <div class="backend-section">
        <div class="section-label">Banking yields</div>
        <table class="backend-table"><thead><tr><th>Driver</th><th>Rate %</th></tr></thead><tbody id="t-yields"></tbody></table>
      </div>

      <div class="backend-section">
        <div class="section-label">PG cost stack</div>
        <table class="backend-table"><thead><tr><th>Component</th><th>Value</th></tr></thead><tbody id="t-costs"></tbody></table>
      </div>

      <div class="backend-section">
        <div class="section-label">E-com per-txn fee brackets (AED)</div>
        <table class="backend-table"><thead><tr><th>Bracket</th><th>Fee (AED)</th></tr></thead><tbody id="t-ecom"></tbody></table>
      </div>

      <div class="backend-section">
        <div class="section-label">Risk adjustment (additive on MDR)</div>
        <table class="backend-table"><thead><tr><th>Risk</th><th>Adj %</th></tr></thead><tbody id="t-risk"></tbody></table>
      </div>

      <div class="backend-section">
        <div class="section-label">Banking revenue → tier cap (Gate 1)</div>
        <table class="backend-table"><thead><tr><th>Label</th><th>Min AED</th><th>Cap</th></tr></thead><tbody id="t-banking"></tbody></table>
      </div>

      <div class="backend-section">
        <div class="section-label">PG volume → tier cap (Gate 3)</div>
        <table class="backend-table"><thead><tr><th>Label</th><th>Min AED</th><th>Cap</th></tr></thead><tbody id="t-pgScale"></tbody></table>
      </div>

      <div class="backend-section">
        <div class="section-label">Commercial floors</div>
        <table class="backend-table"><thead><tr><th>Floor</th><th>Value</th></tr></thead><tbody id="t-floors"></tbody></table>
      </div>
    </div>
  `;

  // ------- Interchange ----------------------------------------------------
  const tInter = panel.querySelector('#t-interchange');
  Object.entries(industryInterchange).forEach(([k, v]) => {
    const tr = document.createElement('tr');
    const tdLabel = document.createElement('td'); tdLabel.textContent = v.label;
    const tdD = document.createElement('td'); tdD.appendChild(pctInput(v.debit,  x => { industryInterchange[k].debit  = x; notifyMcc(); }));
    const tdC = document.createElement('td'); tdC.appendChild(pctInput(v.credit, x => { industryInterchange[k].credit = x; notifyMcc(); }));
    tr.append(tdLabel, tdD, tdC);
    tInter.appendChild(tr);
  });

  // ------- Markup ---------------------------------------------------------
  const tMark = panel.querySelector('#t-markup');
  Object.entries(mccMarkupTable).forEach(([k, v]) => {
    const tr = document.createElement('tr');
    const tdLabel = document.createElement('td'); tdLabel.textContent = industryInterchange[k]?.label || k;
    const tdV = document.createElement('td'); tdV.appendChild(pctInput(v, x => { mccMarkupTable[k] = x; notifyMcc(); }));
    tr.append(tdLabel, tdV);
    tMark.appendChild(tr);
  });

  // ------- Tier MDR matrix ------------------------------------------------
  const tTierMdr = panel.querySelector('#t-tierMdr');
  Object.entries(mccTierMDR).forEach(([k, arr]) => {
    const tr = document.createElement('tr');
    const tdLabel = document.createElement('td'); tdLabel.textContent = industryInterchange[k]?.label || k;
    tr.appendChild(tdLabel);
    arr.forEach((val, i) => {
      const td = document.createElement('td');
      td.appendChild(pctInput(val, x => { mccTierMDR[k][i] = x; notifyMcc(); }));
      tr.appendChild(td);
    });
    tTierMdr.appendChild(tr);
  });

  // ------- Yields ---------------------------------------------------------
  const tYields = panel.querySelector('#t-yields');
  const yieldLabels = { rBal: 'Balance NIM (rBal)', rXb: 'Cross-border take (rXb)', rDeb: 'Spend interchange (rDeb)', rLoan: 'Loan rate (rLoan)' };
  Object.entries(defaultYields).forEach(([k, v]) => {
    const tr = document.createElement('tr');
    const tdLabel = document.createElement('td'); tdLabel.textContent = yieldLabels[k] || k;
    const tdV = document.createElement('td'); tdV.appendChild(pctInput(v, x => { defaultYields[k] = x; notifyMcc(); }));
    tr.append(tdLabel, tdV);
    tYields.appendChild(tr);
  });

  // ------- Costs ----------------------------------------------------------
  const tCosts = panel.querySelector('#t-costs');
  const costRows = [
    { key: 'pineLabs',  label: 'Pine Labs variable %', kind: 'pct' },
    { key: 'fixedCost', label: 'Fixed cost (AED / txn)', kind: 'num', step: 0.01 },
    { key: 'debitMix',  label: 'Default debit mix %', kind: 'pct' },
  ];
  costRows.forEach(row => {
    const tr = document.createElement('tr');
    const tdLabel = document.createElement('td'); tdLabel.textContent = row.label;
    const tdV = document.createElement('td');
    tdV.appendChild(row.kind === 'pct'
      ? pctInput(defaultCosts[row.key], x => { defaultCosts[row.key] = x; notifyMcc(); })
      : numInput(defaultCosts[row.key], x => { defaultCosts[row.key] = x; notifyMcc(); }, row.step));
    tr.append(tdLabel, tdV);
    tCosts.appendChild(tr);
  });

  // ------- E-com brackets -------------------------------------------------
  const tEcom = panel.querySelector('#t-ecom');
  ['0 – 200', '200 – 500', '500 – 1,000', '1,000+'].forEach((label, i) => {
    const tr = document.createElement('tr');
    const tdL = document.createElement('td'); tdL.textContent = label;
    const tdV = document.createElement('td');
    tdV.appendChild(numInput(CMC_FEE_DEFAULTS[i], x => { CMC_FEE_DEFAULTS[i] = x; notifyMcc(); }, 0.05));
    tr.append(tdL, tdV);
    tEcom.appendChild(tr);
  });

  // ------- Risk -----------------------------------------------------------
  const tRisk = panel.querySelector('#t-risk');
  ['low', 'med', 'high'].forEach(k => {
    const tr = document.createElement('tr');
    const tdL = document.createElement('td'); tdL.textContent = { low: 'Low', med: 'Medium', high: 'High' }[k];
    const tdV = document.createElement('td'); tdV.appendChild(pctInput(riskAdj[k], x => { riskAdj[k] = x; notifyMcc(); }));
    tr.append(tdL, tdV);
    tRisk.appendChild(tr);
  });

  // ------- Banking-rev tiers ---------------------------------------------
  const tBanking = panel.querySelector('#t-banking');
  bankingRevTiers.forEach((b, i) => {
    const tr = document.createElement('tr');
    const tdL = document.createElement('td'); tdL.textContent = b.label;
    const tdMin = document.createElement('td'); tdMin.appendChild(numInput(b.min, x => { bankingRevTiers[i].min = x; notifyMcc(); }, 1000));
    const tdCap = document.createElement('td'); tdCap.textContent = b.cap;
    tr.append(tdL, tdMin, tdCap);
    tBanking.appendChild(tr);
  });

  // ------- PG-scale tiers ------------------------------------------------
  const tPg = panel.querySelector('#t-pgScale');
  pgScaleTiers.forEach((p, i) => {
    const tr = document.createElement('tr');
    const tdL = document.createElement('td'); tdL.textContent = p.label;
    const tdMin = document.createElement('td'); tdMin.appendChild(numInput(p.min, x => { pgScaleTiers[i].min = x; notifyMcc(); }, 10000));
    const tdCap = document.createElement('td'); tdCap.textContent = p.cap;
    tr.append(tdL, tdMin, tdCap);
    tPg.appendChild(tr);
  });

  // ------- Floors ---------------------------------------------------------
  const tFloors = panel.querySelector('#t-floors');
  const floorRows = [
    { key: 'netMdrFloorBps', label: 'Net MDR floor (bps)', step: 1 },
    { key: 'minMonthlyRev',  label: 'Min monthly relationship rev (AED)', step: 100 },
  ];
  floorRows.forEach(row => {
    const tr = document.createElement('tr');
    const tdL = document.createElement('td'); tdL.textContent = row.label;
    const tdV = document.createElement('td');
    tdV.appendChild(numInput(defaultFloors[row.key], x => { defaultFloors[row.key] = x; notifyMcc(); }, row.step));
    tr.append(tdL, tdV);
    tFloors.appendChild(tr);
  });

  panel.querySelector('#backend-reset').addEventListener('click', () => {
    resetMccDefaults();
    // resetMccDefaults() already calls notify(), which fires re-render via subscribe.
  });
}

// ---------------------------------------------------------------------------
// Render dispatcher
// ---------------------------------------------------------------------------
function render() {
  showActiveTab();
  const s = getState();
  if (s.activeTab === 'manual')  renderManualPanel();
  if (s.activeTab === 'sales')   renderSalesPanel();
  if (s.activeTab === 'backend') renderBackendPanel();
}

mountShell();
render();
onChange(render);
subscribeMcc(render);

// Expose for ad-hoc QA in DevTools.
window.__wio = { getState, runManualCalculator, calcTierRevGap };
