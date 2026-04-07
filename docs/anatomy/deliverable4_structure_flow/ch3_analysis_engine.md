# Chapter 3: Analysis Engine -- Detection

> **Deliverable 4** | Structure Flow Document
> **Source**: S3_ta_methods_v7.md, S3_signal_backtester_v7.md, S2_theoretical_basis_v7.md
> **Cross-ref**: D2/P5 Theory Summary Cards (Card 1: Mathematics, Card 2: Finance)

---

## 3.1 Three-Layer Detection Architecture

The analysis engine transforms raw OHLCV candles into trading signals through
three sequentially dependent layers, each raising the abstraction level from
numerical computation to semantic market interpretation.

| Layer | Input | Output | Engine File | Count |
|-------|-------|--------|-------------|-------|
| 1 -- Indicators | OHLCV candles | Numerical series, scalars | indicators.js | 32 (I-01..I-32) |
| 2 -- Patterns | Candles + indicator cache | Pattern objects with confidence | patterns.js | 45 (P-01..P-45) |
| 3 -- Signals | Candles + indicators + patterns | Signal objects, composites, stats | signalEngine.js | 38+ (16 base + 22 composite) |

**Why three layers?** The separation follows classical signal processing:
measurement (indicators), feature extraction (patterns), and decision
(signals). Indicators are market-agnostic pure functions; patterns require
domain-specific recognition; signals require multi-source confluence. The
backtester (`backtester.js`) runs alongside as a validation layer -- its
output feeds the UI and offline calibration, not the detection pipeline.

> D2 source: S3_ta_methods_v7.md SS 3.1, 3.2; S3_signal_backtester_v7.md SS 3.3-3.5.

---

## 3.2 Layer 1: Indicator Summary

### 3.2.1 Five Categories

Every indicator function is pure: same input, same output, no global state.
This purity enables safe memoization in the IndicatorCache.

| Category | IDs | Count | Representatives | Lineage |
|----------|-----|-------|-----------------|---------|
| Classic TA | I-01..I-10 | 10 | MA, EMA, BB, RSI, ATR, OBV, MACD, Ichimoku, Kalman, Stochastic | Wilder (1978), Appel (1979), Bollinger (2001), Hosoda (1969) |
| Extended Oscillators | I-11..I-15 | 5 | StochRSI, CCI, ADX, Williams %R, Theil-Sen | Chande & Kroll (1994), Lambert (1980), Theil (1950) |
| Statistical | I-16..I-22 | 7 | Hurst, Hill, GPD VaR, CAPM Beta, HV, VRP, WLS+Ridge+HC3 | Mandelbrot (1963), Hill (1975), Sharpe (1964), Hoerl & Kennard (1970) |
| Trend / Regime | I-23..I-28 | 6 | OLS Trend, EWMA Vol, Vol Regime, ILLIQ, CUSUM, BinSeg | Lo & MacKinlay (1999), RiskMetrics (1996), Amihud (2002), Page (1954) |
| Utilities | I-29..I-32 | 4 | HAR-RV, Matrix Inversion, Jacobi Eigen, GCV Lambda | Corsi (2009), Golub-Heath-Wahba (1979) |

Every constant carries a CFA-paper grade: [A] academic-fixed (change
invalidates formula), [B] tunable with basis, [C] KRX-adapted, [D]
heuristic, [E] deprecated. Current distribution: A55/B69/C78/D63.

### 3.2.2 IndicatorCache

The cache uses lazy accessors keyed by name and parameters (e.g., `"ma_20"`,
`"bbEVT_20_2"`). First access computes and stores; subsequent accesses return
instantly. **Critical constraint**: the cache stores function references for
lazy-eval, so it cannot cross the Worker boundary via `postMessage()`
(structured clone fails on functions). The Worker builds its own cache.

> D2 source: S3_ta_methods_v7.md SS 3.1.1-3.1.6.

---

## 3.3 Layer 2: Pattern Classification

### 3.3.1 Five Groups

| Group | IDs | Count | Bars | Detection Method |
|-------|-----|-------|------|-----------------|
| Single Candle | P-01..P-11 | 11 | 1 + trend context | Body/shadow geometry ratios |
| Double Candle | P-12..P-19 | 8 | 2 consecutive | Inter-candle relationship |
| Triple Candle | P-20..P-25 | 6 | 3 consecutive | Sequence progression rules |
| Extended Candle | P-26..P-34 | 9 | 1-5 bars | Specialized variants, continuations |
| Chart Patterns | P-35..P-45 | 11 | 5-120 bars | Swing-point structural geometry |

Additionally: S/R clustering (ATR x 0.5 tolerance, min 2 touches, max 10),
52-week high/low anchors (George & Hwang 2004), valuation S/R from BPS/EPS.

### 3.3.2 Dual Confidence Schema

Every pattern carries two confidence scores: `confidence` (0-100, display)
and `confidencePred` (0-95, model input). The separation exists because
visual distinctiveness does not correlate with predictive power -- a
visually striking hammer (high display confidence) may have only 45% win
rate. Chart patterns additionally carry `neckline`, `breakoutConfirmed`,
`trendlines`, and `_swingLookback` (look-ahead bias offset for backtesting).

### 3.3.3 Candle vs Chart Detection

Candle patterns follow a three-step flow: geometry test (body/shadow ratios
vs ATR-normalized thresholds), context test (preceding trend, volume ratio),
and confidence scoring (base + volume boost + Hurst regime adjustment).

Chart patterns operate at structural scale: swing-point identification,
geometric constraint matching (e.g., double bottom = two lows within
ATR x 0.5), trendline fitting (least-squares for triangles/wedges),
breakout confirmation (20-bar lookforward, ATR-scaled penetration), and
volume profile scoring. Unconfirmed patterns receive a 12-15 point penalty
per Bulkowski (2005): confirmed breakouts have ~2.4x the success rate.

> D2 source: S3_ta_methods_v7.md SS 3.2.1-3.2.6.

---

## 3.4 ATR Normalization Philosophy

### 3.4.1 The Problem

KRX stocks range from Samsung Electronics (~60,000 KRW) to KOSDAQ penny
stocks (~1,000 KRW). A "long body" of 1,200 KRW is 2% on Samsung but 120%
on a 1,000 KRW stock. Percentage normalization (body/close) partially solves
this but fails when volatility regimes differ: 2% on a 5% daily ATR stock
is unremarkable, while 2% on a 0.5% ATR stock is extraordinary.

ATR(14) captures each stock's recent volatility regime, making it the natural
denominator. The fallback (`close * 0.02`) handles cold-start when fewer
than 14 candles exist, approximating median KOSPI large-cap ATR/close.

### 3.4.2 Application

```
ATR NORMALIZATION FLOW
======================

   body = abs(close - open)     atr = ATR(14) or
   range = high - low              close * 0.02
   shadows = high/low offsets      (fallback)
        |                       |
        +----------+------------+
                   |
                   v
   bodyRatio = body / atr
   rangeRatio = range / atr
   S/R cluster tolerance = 0.5 * atr
                   |
                   v
   Compare vs thresholds (all ATR-relative):
     SHADOW_BODY_MIN = 2.0
     ENGULF_BODY_MULT = 1.5
     TRIANGLE_BREAK = 0.3 * atr
     S/R confluence within 1.0 * atr
       --> confidence + 3 * S/R strength

```

S/R confluence: when a pattern's stopLoss or priceTarget falls within one ATR
of an existing S/R level, confidence gains `+3 * strength` (normalized touch
count 0-1), rewarding alignment with independently identified structural
levels.

> D2 source: S3_ta_methods_v7.md SS 3.2.1 constants; .claude/rules/patterns.md.

---

## 3.5 Layer 3: Signal Flow

```
SIGNAL ENGINE PIPELINE
======================

   Indicators (cache)    Patterns (Layer 2)
        |                       |
        v                       v
   +-----------------------------------+
   | STAGE A: Base Signal Detection    |
   | 19 detectors (SIG-01..SIG-19)    |
   | 7 indicator categories + deriv   |
   | Each emits 1-4 signal types      |
   +----------------+------------------+
                    |
                    v
   +-----------------------------------+
   | STAGE B: Composite Matching       |
   | 30 definitions in 3 tiers        |
   | Required + Optional in 5-bar win |
   | Anti-predictor WR gate (BLL 92)  |
   +----------------+------------------+
                    |
                    v
   +-----------------------------------+
   | STAGE C: Post-Filters (12)       |
   | Additive: ADX/CCI/OLS (cap +15) |
   | Multiplicative: Entropy, IV/HV,  |
   |   VKOSPI, Expiry, Crisis, HMM   |
   | Floor: max(10, result)           |
   +----------------+------------------+
                    |
                    v
   +-----------------------------------+
   | STAGE D: Sentiment & Statistics   |
   | Weight-avg sentiment [-100,+100] |
   | Shannon entropy (diversity)      |
   +-----------------------------------+

```

**Base signals** (19 detectors): MA cross/alignment, MACD cross, RSI/StochRSI/
Stochastic momentum, BB bounce/squeeze, volume z-score/OBV divergence,
Ichimoku TK/cloud, regime filters (Hurst/Kalman/CUSUM/ATR/VolRegime), and
derivatives/flow signals (basis/PCR/foreign/ERP/ETF/short). Regime filters
carry zero directional weight -- they feed composites and post-filters only.

**Composites** (30 definitions, 3 tiers): Tier 1 (11, strong, 2-3 required
conditions, baseConf 61-75), Tier 2 (16, medium, 1-2 required + optional,
baseConf 48-69), Tier 3 (3, weak, 1 required + optional, baseConf 48-55).
The Anti-Predictor WR Gate (BLL 1992) hard-caps composite confidence when
any required pattern has KRX 5-year win rate below 48% (anti-predictor
threshold, accounting for ~2% round-trip cost). Five buy-side composites
are currently capped by this gate.

**Post-filters** (12 sequential): PF-1..PF-3 additive (ADX/CCI/OLS, max
+/-15 cumulative), PF-6 cap, PF-7..PF-12 multiplicative (entropy 0.80-1.0,
IV/HV 0.50-1.0, VKOSPI regime 0.60-1.0, expiry 0.70, crisis 0.60-1.0,
HMM fallback 0.70-1.0). Worst case: base 70 reduced to ~8, floored at 10.
This aggressive compounding is deliberate: five simultaneous independent
risk factors truly indicate minimal predictive value.

> D2 source: S3_signal_backtester_v7.md SS 3.3.1-3.3.5.

---

## 3.6 Backtester Summary

### 3.6.1 Methodology Stack

The backtester produces 43 metrics per pattern-horizon combination across
303,956 pattern instances (2,768 stocks, 5 years, 2021-03 to 2026-03).

| Framework | Purpose | Key Reference |
|-----------|---------|---------------|
| WLS + Ridge | Return prediction; 5-feature design matrix, lambda=0.995 exponential decay (half-life ~7 months, Lo 2004 AMH), GCV-auto Ridge | Reschenhofer (2021), Hoerl & Kennard (1970), Golub-Heath-Wahba (1979) |
| Huber-IRLS | Fat-tail robustness; delta=5.8 (1.345 * KRX MAD), handles +/-30% limit moves | Huber (1964) |
| HC3 Errors | Heteroskedasticity-consistent inference, jackknife correction for n=30-300 | MacKinnon & White (1985) |
| BCa Bootstrap | Calendar-time block bootstrap (B=500), bias-corrected accelerated CIs | Efron (1987), Fama & French (2010) |
| BH-FDR | Multiple testing correction at q=0.05 across 225 tests (45 patterns x 5 horizons) | Benjamini & Hochberg (1995) |
| Hansen SPA | Data snooping test: does the best strategy genuinely beat random entry? B=500 | Hansen (2005) |

**Design rationale**: WLS over OLS because regime shifts make recent
observations more representative (AMH). Ridge over plain WLS because
n/k=6 at minimum threshold is underpowered. Huber-IRLS because KRX
+/-30% limit moves create extreme kurtosis that inflates OLS coefficients.

### 3.6.2 Walk-Forward Evaluation (WFE)

Expanding-window cross-validation: 4 folds (6 if candles >= 500), 20% OOS
per fold, purge gap = 2 x horizon bars (Bailey & Lopez de Prado 2014).
WFE = round(avgOOS / avgIS x 100). Robust >= 50%, marginal 30-50%,
overfit < 30%. Tier A/B patterns with WFE < 30% demoted to C.

### 3.6.3 Reliability Tiers

| Tier | Statistical | Economic | Predictive |
|------|------------|----------|------------|
| A | BH-FDR sig | wrAlpha >= 5%, n >= 100, PF >= 1.3, expectancy > 0 | OOS IC > 0.02 |
| B | BH-FDR sig | wrAlpha >= 3%, n >= 30, expectancy > 0 | OOS IC > 0.01 |
| C | -- | wrAlpha > 0%, n >= 30 | -- |
| D | -- | default | -- |

Triple-gating prevents false promotion: BH-FDR (multiple testing), WFE
(overfitting), SPA (data snooping). Each addresses a distinct failure mode
-- a pattern can pass BH-FDR yet fail WFE.

> D2 source: S3_signal_backtester_v7.md SS 3.4.2, 3.5.2-3.5.6;
> D2/P5 Card 1 (S-4 BCa, S-5 BH-FDR).

---

## 3.7 Worker Protocol

### 3.7.1 Offload Rationale

A single analysis pass (32 indicators + 45 detectors + 19 signal generators +
backtester) takes 50-200ms. Running on the main thread would block UI
rendering, causing dropped frames during chart interaction.

### 3.7.2 Message Protocol and Safeguards

```
WORKER MESSAGE PROTOCOL
========================

   Main Thread                  Worker Thread
        |                            |
        |--{ type: 'analyze',   ---->|
        |   candles: [...],          |
        |   realtimeMode: bool,      | importScripts: colors,
        |   version: N }             |   indicators, patterns,
        |                            |   signalEngine, backtester
        |                            |
        |                            | Build IndicatorCache
        |                            | Run L1 -> L2 -> L3
        |                            |
        |<---{ type: 'result',  -----|
        |     patterns: [...],       |
        |     signals: [...],        |
        |     stats: {...},          |
        |     version: N }           |
        |                            |
        | if version < current:      |
        |   discard (stale)          |

```

**Version stamping**: Monotonic counter incremented on stock selection.
Results from a previous stock are discarded if a newer request has been sent.

**3-second throttle**: `_lastPatternAnalysis` timestamp enforces minimum
interval between dispatches. Shorter (500ms) would queue overlapping
analyses; longer (10s) would feel stale during volatile moves. The 3s value
reflects observed 95th-percentile completion time plus buffer.

**Cache fingerprinting**: Worker-side `_analyzeCache` keyed by candle length +
last timestamp + last close. Re-selecting an unchanged stock returns the
cached result without re-running the pipeline.

**IndicatorCache isolation**: Because the cache contains function references
(lazy-eval), it cannot be serialized via structured clone. The Worker
constructs its own independent cache from the raw candle data passed in the
message. This duplication is the cost of thread safety.

> D2 source: .claude/rules/patterns.md (Worker Protocol);
> S3_signal_backtester_v7.md SS 3.4.

---

## 3.8 End-to-End Flow

```
END-TO-END ANALYSIS ENGINE
===========================

  dataService.getCandles(stock, tf)
         |
  =======|======= Worker Boundary =====
         |
         v
  +----------------------------------------+
  | L1: INDICATORS (32)                    |
  |  Classic(10) Oscillators(5) Stats(7)   |
  |  Trend/Regime(6) Utilities(4)          |
  |  --> IndicatorCache (lazy, keyed)      |
  +------------------+---------------------+
                     |
                     v
  +----------------------------------------+
  | L2: PATTERNS (45)                      |
  |  Single(11) Double(8) Triple(6)        |
  |  Extended(9) Chart(11) + S/R           |
  |  ATR(14) norm, dual confidence         |
  +-----+-----------------------+----------+
        |                       |
        v                       v
  +-----------------+  +-------------------+
  | L3: SIGNALS     |  | BACKTESTER        |
  | 19 base detect  |  | WLS/Ridge/HC3     |
  | 30 composites   |  | Huber-IRLS        |
  | WR gate, 12 PF  |  | BCa/BH-FDR/SPA   |
  | Sentiment idx   |  | WFE, A/B/C/D tier |
  +--------+--------+  +--------+----------+
           |                     |
  =========|=====================|==========
           v                     v
  +----------------------------------------+
  | UI: patternRenderer, signalRenderer,   |
  |     patternPanel, reliability badges   |
  +----------------------------------------+

```

Backtest empirical basis: 303,956 pattern instances, 2,768 stocks, 5 years.
KRX trading days: 250. BH-FDR q: 0.05. Bootstrap: 500 replicates. WFE
robust threshold: >= 50%. WLS lambda: 0.995. Ridge: GCV auto. ATR period: 14.
