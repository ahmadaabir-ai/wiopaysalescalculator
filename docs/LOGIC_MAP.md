# Logic Map

How the modules fit together. The canonical math lives in
`reference/LOGIC_EXTRACT.md`; this file maps that math to the source tree.

---

## 1. Module dependency

```
+---------------------+
|   mccData.js        |  <-- mutable defaults (Backend editor mutates these)
| - industryInterchange
| - mccTierMDR
| - bankingRevTiers
| - pgScaleTiers
| - defaultYields/Costs/Floors
| - helpers (vintageFloor, aovCharge, getMccTierMDR, getMccMarkup)
| - subscribe/notify
+----------+----------+
           |
           v
+---------------------+        +-------------------+
|  pricingEngine.js   |<-------+  approvalPaths.js |
|  runPricingEngine() |        |  revToAed, paths  |
+----------+----------+        |  init, rebalance  |
           ^                   |  loanTenureMatrix |
           |                   +---------+---------+
           |                             |
           |                             |
+----------+----------+                  |
| manualCalculator.js |------------------+
| runManualCalculator |
| calcTierRevGap      |
+----------+----------+
           ^
           |
+----------+----------+
|  main.js            |  <-- DOM only
|  + state.js         |
+---------------------+
```

`mccData.js` is the single mutable store. Every other module *imports* from
it. The Backend editor mutates it in place and calls `notify()`; main.js's
`subscribe(render)` re-renders every panel so all calculators stay in sync.

---

## 2. Pricing-engine flow (§4 of LOGIC_EXTRACT)

```
inp (sales context + yields + costs)
   |
   v
1. weightedInterchange = ic.debit*debitMix + ic.credit*creditMix
2. pgCostPct = weightedInterchange + pineLabs + fixedCost/AOV
3. bankingRev = revBal + revXb + revDeb + revLoan(yr-1)
4. pgYearVol  = aov * txnCount * 12
   aovFeeAnnual = aovCharge(aov) * txnsYear
5. Gate 1 (banking abs)  +  Gate 2 (ratio)  +  Gate 3 (PG scale)
   -> prelimTier = MAX rank of the three
6. floorVal = tlOverride ? 0 : vintageFloor(months, industry)
7. Gate 4 (economics guardrail): step down from prelimTier until
   net/month >= minRev
8. o2Final = mdr at o2FinalTier   ->  o2PgRev, o2Margin, o2Net
```

`runPricingEngine` returns *all* intermediates so callers can render
waterfalls without re-doing the math.

---

## 3. MCC interchange flow (industry-driven)

```
industry (key in industryInterchange)
   -> ic.debit / ic.credit (MCC defaults)
   -> weightedInterchange (debitMix-weighted)
   -> pgCostPct (with pineLabs + fixedCost/AOV)

industry (key in mccTierMDR)
   -> 7-element array indexed by tierRank-1
   -> per-tier MDR for the calculator's nearest-tier lookup

industry (key in mccMarkupTable)
   -> getMccMarkup() used in calcTierRevGap displayed-MDR matching
```

Editing any MCC value in the Backend tab updates `industryInterchange`,
`mccTierMDR`, or `mccMarkupTable` in place and the calculator re-renders.

---

## 4. Requested-MDR reverse logic (§5)

```
reqMdrPct (user input)
   |
   v
calcTierRevGap(r, inp, reqMdrPct):
   - adjTiers   = tiers, but mdr replaced with mccTierMDR[industry][i]
   - dispMarkup = getMccMarkup(industry)
   - dispRisk   = riskAdj[risk]
   - targetTier = adjTiers.reduce(nearest displayed-MDR to reqMdrPct)
   - reqBankEntry = bankingRevTiers (reverse) first cap <= targetTier rank
   - totalReq  = reqBankEntry.min
   - revGap    = max(0, totalReq - bankingRev)

manualCalculator:
   - pgRev      = reqMdrPct * pgYearVol + aovFeeAnnual
   - pgOnlyNet  = pgRev - pgCostAnnual
   - totalRelNet= bankingRev + pgOnlyNet
   - controllingFloor = max(netMdrFloorBps * pgYearVol, minMonthlyRev * 12)
   - status banner based on pgCovers / relCovers / shortfall
   - belowPolicyFloor if reqMdr < vintageFloor + riskAdj (and !tlOverride)
```

The Sales Calculator passes its **desired MDR** through this same function —
no reverse-only code path exists.

---

## 5. Approval-path calculation (§6)

```
shortfall = max(0, controllingFloor - totalRelNet)

Standalone (each path solves the whole gap alone):
   balance = revToAed('balance', shortfall, inp) = shortfall / rBal
   spend   = revToAed('spend',   shortfall, inp) = shortfall / rDeb
   fx      = revToAed('fx',      shortfall, inp) = shortfall / rXb
   loan    = revToAed('loan',    shortfall, inp) = solveLoanPrincipal(
                                                    shortfall, rLoan, loanTenure)

Standalone loan tenure matrix:
   For each tenure in [12, 24, 36, 48]:
      principal = solveLoanPrincipal(shortfall, rLoan, months)
      emi       = standard amortisation EMI at that principal
   Highlight row where months == inp.loanTenure.
```

---

## 6. Rebalancing logic (§6.3)

```
On user input -> rebalanceApprovalPath(state, key, newAed, shortfall, inp):
   1. state[key] = max(0, newAed)
   2. revChanged = pathRevenue(key, state[key], inp)
   3. remaining  = max(0, shortfall - revChanged)
   4. others = ['balance','spend','fx','loan'] minus key,
               filtered by positive yield
   5. if remaining <= 0 OR no others:
         set others to 0
      else:
         revPerPath = remaining / others.length
         each other = ceil(revToAed(key, revPerPath, inp))

Status (§6.4):
   total = pathTotalRev(state, inp)
   isValid = total >= shortfall * 0.999   (0.1% rounding tolerance)
```

AED-based, never percentage. Loan path uses the reducing-balance
`solveLoanPrincipal` so EMI stays consistent with what the customer
actually pays.

---

## 7. Backend-assumptions dependency map

```
Edit in Backend tab            Updates                      Affects
---------------------------    --------------------------   --------------
MCC Interchange debit/credit   industryInterchange[k]       pgCostPct
Customer markup                mccMarkupTable[k]            calcTierRevGap target tier
Tier MDR matrix                mccTierMDR[k][i]             vintageFloor, getMccTierMDR
Banking yields                 defaultYields                bankingRev, all approval paths
PG costs                       defaultCosts                 pgCostPct
E-com brackets                 CMC_FEE_DEFAULTS             aovCharge -> aovFeeAnnual
Risk adjustment                riskAdj                      Final MDR, policy floor
Banking-rev slabs              bankingRevTiers              Gate 1 + revGap
PG volume slabs                pgScaleTiers                 Gate 3
Commercial floors              defaultFloors                controllingFloor
```

Every edit calls `notifyMcc()` from `mccData.js`. `main.js` subscribes once
and triggers a full re-render — Manual, Sales, and Backend tabs all stay in
sync without any extra wiring.
