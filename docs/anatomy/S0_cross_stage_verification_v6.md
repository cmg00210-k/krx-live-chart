# Stage 0 -- Cross-Stage Verification (V6)

## Document Metadata

| Field | Value |
|-------|-------|
| Section | 0 |
| Title | Cross-Stage Verification: Pipeline Traces, Formula-Code Fidelity, Consistency Audit |
| Date | 2026-04-06 |
| Version | V6 |
| Agents | 6.1 (Explore), 6.2 (statistical-validation), 6.3 (code-audit) |

---

## Section 0.1: End-to-End Pipeline Traces (5 Pipelines)

### Pipeline 1: ECOS KTB10Y → Bond Display

**Chain:** ECOS API (stat 817Y002) → download_bonds.py → bonds_latest.json → appWorker.js _loadMarketData → financials.js display

| Step | File:Line | Action | Output |
|------|-----------|--------|--------|
| 1 | scripts/download_bonds.py:55-67 | Fetch ECOS 817Y002, item 010210000 (국고채 10년) | bonds_latest.json |
| 2 | data/macro/bonds_latest.json | Schema: yields.ktb_10y=3.747, metrics.duration/convexity/dv01 | JSON on disk |
| 3 | js/appWorker.js:327-389 | _loadMarketData → Promise.allSettled → _bondsLatest global | In-memory |
| 4 | js/financials.js:416-497 | _showBondMetrics → display duration/convexity/spreads/NSS | DOM rendered |

**Verdict:** PASS — 3-level Rf fallback (macro → bonds_latest → 3.5% default)

---

### Pipeline 2: KRX Investor Data → Pattern Confidence

**Chain:** KRX OTP → download_investor.py → investor_summary.json → _loadDerivativesData → _applyDerivativesConfidenceToPatterns

| Step | File:Line | Action | Output |
|------|-----------|--------|--------|
| 1 | scripts/download_investor.py:46-79 | KRX OTP auth, 19 investor types, market-wide + per-ticker | investor_summary.json |
| 2 | data/derivatives/investor_summary.json | alignment.signal_1d: aligned_buy/sell/divergent/neutral | JSON on disk |
| 3 | js/appWorker.js:399-487 | _loadDerivativesData → sample guard (source='sample' → null) | _investorData |
| 4 | js/appWorker.js:711-806 | Alignment channel: aligned_buy → buy *1.08, sell *0.93 | pattern.confidence |

**Verdict:** PASS — Sample guard prevents fake data corruption

---

### Pipeline 3: OHLCV → Hurst → Pattern Target

**Chain:** OHLCV candles → calcHurst() → James-Stein shrinkage → _candleTarget() → priceTarget

| Step | File:Line | Action | Output |
|------|-----------|--------|--------|
| 1 | js/indicators.js:212-265 | R/S analysis (Mandelbrot), log(R/S) = H·log(n) + c | {H, rSquared} |
| 2 | js/patterns.js:645-656 | James-Stein shrinkage: hShrunk = shrinkage*H + (1-shrinkage)*0.5 | ctx.hurstWeight [0.6, 1.4] |
| 3 | js/patterns.js:1352 | _candleTarget(candles, i, signal, strength, atr, hurstWeight, mw) | pattern.priceTarget |
| 4 | js/patternPanel.js:1439 | Display: `목표 ${p.priceTarget.toLocaleString()}` | DOM rendered |

**Verdict:** PASS — Shrinkage prevents overfitting, weight clamped [0.6, 1.4]

---

### Pipeline 4: Pattern → Signal Composite → Renderer

**Chain:** detectHammer() → COMPOSITE_SIGNAL_DEFS match → signalRenderer star/diamond

| Step | File:Line | Action | Output |
|------|-----------|--------|--------|
| 1 | js/patterns.js:1322-1363 | Nison candlestick rules: shadow≥2×body, body≤1/3 range | {type:'hammer', signal:'buy'} |
| 2 | js/signalEngine.js:15-30 | strongBuy_hammerRsiVolume: required=[hammer, rsiOversoldExit] | {type:'composite', tier:1} |
| 3 | js/signalRenderer.js:318-339 | Tier 1 → star marker, wc-scaled size [0.7, 1.5] | Canvas star |
| 4 | js/signalRenderer.js:300-316 | MA cross → diamond marker, strength-scaled size | Canvas diamond |

**Verdict:** PASS — Density limits: MAX_STARS=2, MAX_DIAMONDS=6

---

### Pipeline 5: Backtest → Pattern Panel

**Chain:** backtestAll() → _META → reliability tier → patternPanel.js badge+WR

| Step | File:Line | Action | Output |
|------|-----------|--------|--------|
| 1 | js/backtester.js:52-98 | _META: 31 patterns {name(KO), signal} | Pattern registry |
| 2 | js/backtester.js:516-588 | Per-pattern backtest, BH-FDR correction | {winRate, n, tier} |
| 3 | js/backtester.js:544-587 | Tier assignment: A(sig+α≥5+n≥100), B, C, D + WFE gate | reliabilityTier |
| 4 | js/patternPanel.js:1424-1459 | Badge: `[A] WR 62% (n=145)` + survivorship adj display | DOM rendered |

**Verdict:** PASS — WFE<30% gates overfit patterns to Tier C max

---

### Summary

| Pipeline | Source | Destination | Status |
|----------|--------|-------------|--------|
| 1. KTB10Y | ECOS 817Y002 | financials.js | PASS |
| 2. Investor | KRX OTP | confidence chain | PASS |
| 3. Hurst | OHLCV candles | priceTarget display | PASS |
| 4. Hammer→Signal | patterns.js | signalRenderer star | PASS |
| 5. Backtest | backtester.js | patternPanel badge | PASS |

**All 5 pipelines verified. No broken links detected.**

---

## Section 0.2: Formula-Code Fidelity (Pending — Wave 6.2)

*To be completed: 20 formula spot-checks against JS implementation.*

---

## Section 0.3: Document Internal Consistency (Pending — Wave 6.3)

*To be completed: cross-reference resolution, constant grade consistency, line number verification.*
