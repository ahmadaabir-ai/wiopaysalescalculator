# Version History

| Version | Tag | Summary |
|---|---|---|
| v0.1.0 | `v0.1.0-init` | Project skeleton: package.json, .gitignore, empty src/ + docs/, README stub. |
| v0.2.0 | `v0.2.0-engine` | Pricing engine + MCC reference data (mccData.js, pricingEngine.js). |
| v0.3.0 | `v0.3.0-manual-calculator` | Manual calculator reverse-MDR logic + state pub/sub (manualCalculator.js, state.js). |
| v0.4.0 | `v0.4.0-approval-paths` | Four approval paths + AED-based rebalancing + loan helpers (approvalPaths.js). |
| v0.5.0 | _untagged_ | Wio-branded vanilla-JS UI: tabs, sales-context panel, Manual + Sales views. |
| v0.6.0 | _untagged_ | Backend Assumptions editor — live mutation of MCC defaults. |
| v0.7.0 | _untagged_ | QA regression test cases. |
| v1.0.0 | `v1.0.0-sales-ready` | Logic map, version history, README — ready for sales rollout. |
| v1.1.0 | `v1.1.0-pnl-summary` | Structural separation of PG and POS economics. |

## v1.1.0-pnl-summary

Restructured the single-file calculator so PG / E-com and POS economics are
calculated independently and rolled up in a new P&L tab.

**What changed**
- Top-level tabs: Manual Calculator · **P&L** (new) · Backend Assumptions.
- Manual Calculator panel hosts two sub-tabs (PG / E-com · POS). Each
  sub-tab owns its own AOV, txnCount, debitMix, requested MDR, plus the
  channel-specific extras (e-com brackets for PG; terminal fields + setup
  fee for POS). Each carries an "Active for this merchant" toggle.
- Per-sub-tab outputs (verdict, KPIs, waterfall) use ONLY that channel's
  inputs. Banking revenue is excluded from sub-tab outputs — it only
  rolls up on the P&L tab.
- P&L tab renders a 3-column table (PG · POS · Total) showing Revenue,
  Cost, Channel P&L. Inactive columns read AED 0. Below the table:
  + Banking Revenue, = Total Relationship Net, verdict pill, sales pitch.
- Approval paths (standalone cards + loan tenure matrix + Build-Your-Own
  grid) moved from the Manual Calculator to the P&L tab. The gap is now
  the total relationship shortfall, not a per-channel deficit. Logic
  (`initApprovalPath`, `rebalanceApprovalPath`, `revToAed`) is unchanged.
- State refactored to `{shared..., pg: {...}, pos: {...}, manualPath,
  activeTab, manualSubTab}`. Storage key bumped from
  `wio-pay-sales-calc-state-v1` → `wio-pay-sales-calc-state-v2`. Existing
  users start fresh; old keys linger harmlessly.
- `runPricingEngine` formulas are unchanged. New helpers
  `buildChannelInput(channel, channelState, sharedState)` and
  `runChannel(channel, channelState, sharedState)` build the right engine
  input shape per channel and return the channel's revenue/cost/net.
- All numeric inputs remain `type="text" inputmode="numeric|decimal"` —
  cursor-preservation fix intact. `↻ Refresh` button and backend
  Reset-to-defaults preserved. Wio brand styling unchanged.
