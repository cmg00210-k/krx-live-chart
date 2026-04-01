# KRX Live Chart (CheeseStock) — Development Guide v2

> **www.cheesestock.co.kr** | Cloudflare Pages | 2026-03-26

---

## 1. System Overview: Macro to Micro

CheeseStock is a Korean stock market (KOSPI/KOSDAQ) charting web app that layers **academic finance theory** onto **real-time pattern recognition** and **self-validating prediction**. The architecture flows from macro (browser/UI) to micro (mathematical formulas), with each layer feeding the next.

```
[Layer 0] Browser (cheesestock.co.kr)
    ├─ index.html + css/style.css (4-column grid: sidebar | chart | patterns | financials)
    ├─ Service Worker (sw.js) — offline cache
    └─ CDN: TradingView LWC v5.1.0, Pretendard, JetBrains Mono

[Layer 1] Data Pipeline
    ├─ dataService (api.js) — file/ws/demo/koscom modes
    ├─ L1 memory + L2 IndexedDB + L3 network cache
    └─ realtimeProvider.js — Kiwoom OCX WebSocket

[Layer 2] Analysis Engine
    ├─ indicators.js — 9 indicators + WLS regression + Ridge (lambda=2.0)
    ├─ patterns.js — PatternEngine: 30+ patterns (21 candle + 9 chart + S/R)
    ├─ signalEngine.js — 16 indicator signals + 6 composite (3 tiers)
    └─ analysisWorker.js — Web Worker offload (3s throttle)

[Layer 3] Prediction & Validation
    ├─ backtester.js — WLS multi-regression prediction + LinUCB bandit
    ├─ Wc Weight System — hw(Hurst) x mw(MeanReversion) adaptive composite
    └─ Self-backtesting loop: predicted vs actual returns per pattern

[Layer 4] Visualization
    ├─ chart.js — TradingView LWC wrapper, sub-charts (RSI/MACD)
    ├─ patternRenderer.js — ISeriesPrimitive Canvas2D, 9 draw layers
    ├─ signalRenderer.js — diamonds, stars, vbands, divergence lines
    └─ drawingTools.js — trendline, hline, vline, rect, fib, eraser

[Layer 5] Academic Foundation
    ├─ core_data/ (17 academic papers: math, stats, physics, psychology, finance, RL, EVT...)
    └─ pattern_impl/ (5 implementation bridge docs: theory → code mapping)
```

---

## 2. Installed Agent System (8 Specialized + 3 Built-in)

### 2.1 Project Agents (`.claude/agents/`)

| Agent | Role | When to Use |
|-------|------|-------------|
| **technical-pattern-architect** | Pattern detection algorithm design, finance theory validation | New pattern types, accuracy review, Bulkowski validation |
| **code-audit-inspector** | Multi-layer code audit (null/NaN, bias, regression) | Post-refactor verification, bug hunting, pre-deploy |
| **financial-systems-architect** | Real-time data pipelines, brokerage API, market microstructure | WebSocket architecture, Kiwoom/Koscom migration, latency |
| **financial-theory-expert** | Valuation models (PER/PBR/PSR), CAPM, APT, academic finance | Formula validation, DART interpretation, theory alignment |
| **self-verification-protocol** | Cross-file dependency verification, regression detection | After any code edit (proactive), before deploy |
| **pattern-analysis-renderer** | Canvas2D pattern visualization on charts | Pattern markers, necklines, S/R lines, confidence coloring |
| **font-ui-designer** | CSS/typography/responsive design | Font sizing, layout, dark mode, mobile responsive |
| **build-system-architect** | Build tooling, bundlers, CI/CD pipelines | (Reserved — no build system currently) |

### 2.2 Built-in Agents

| Agent | Role |
|-------|------|
| **Explore** | Fast codebase search (files, keywords, architecture questions) |
| **Plan** | Implementation planning, cross-session sequencing |
| **auto-trading-dev** | Kiwoom automated trading, PyQt5 GUI, backtesting engines |

### 2.3 Optimal Agent Deployment (Phase 7 Guide)

```
Layer 0-1 (Data)        → financial-systems-architect (look-ahead bias, time-series integrity)
Layer 2   (Analysis)    → technical-pattern-architect (30+ pattern validation)
Layer 2-5 (Cross-layer) → code-audit-inspector (null/NaN edge cases, global var conflicts)
Layer 3   (Prediction)  → financial-theory-expert (formula accuracy, academic alignment)
Layer 4   (Rendering)   → pattern-analysis-renderer (Canvas2D, ISeriesPrimitive)
Layer 5   (Theory)      → Explore (constant/function usage tracking)
Cross-session           → Plan (sequencing), self-verification-protocol (post-fix)
```

---

## 3. Macro to Micro: The Perspective Chain

### 3.1 Finance Theory (Layer 5 → Layer 3)

The system is grounded in 17 academic papers spanning 6 disciplines:

| Discipline | core_data Files | Key Concepts Applied |
|-----------|----------------|---------------------|
| **Mathematics** | 01_mathematics.md | Stochastic processes, fractal geometry (Hurst exponent), chaos theory |
| **Statistics** | 02_statistics.md | Time series (ARIMA/GARCH), Bayesian inference, James-Stein shrinkage |
| **Physics** | 03_physics.md | Statistical mechanics, power laws, entropy (econophysics) |
| **Psychology** | 04_psychology.md | Prospect theory, cognitive biases, herding, market psychology cycles |
| **Finance** | 05, 14_finance_management.md | EMH, Adaptive Market Hypothesis (AMH), CAPM, Kelly criterion, VaR |
| **Machine Learning** | 11_reinforcement_learning.md, 15_advanced_patterns.md | LinUCB (Li et al. 2010), walk-forward validation, Holm-Bonferroni |

### 3.2 Pattern Detection (Layer 2)

**30+ patterns** with ATR(14) normalization for equal sensitivity across price levels:

| Category | Count | Examples | Detection |
|----------|-------|---------|-----------|
| Candle (single) | 9 | doji, hammer, shootingStar, marubozu | Body/shadow ratio + volume + trend |
| Candle (double) | 6 | engulfing, harami, piercingLine | 2-candle relationship |
| Candle (triple) | 4 | threeWhiteSoldiers, morningStar | 3-candle sequence |
| Chart | 9 | doubleBottom, H&S, triangles, wedges | Swing point + neckline + breakout |
| S/R | dynamic | Support/Resistance clustering | ATR*0.5 tolerance, min 2 touches |

### 3.3 Business Formula: The Wc Weight System (Layer 3)

**8-step adaptive pipeline** from raw OHLCV to prediction:

```
[1] OHLCV → [2] Base Indicators (ATR, MA, Hurst, Volume)
  → [3] Weight Factors:
       hw = clamp(2 x H_shrunk, 0.6, 1.4)    [Hurst — trend persistence]
       mw = clamp(exp(-0.1386 x excess), 0.6, 1.0) [Mean reversion — OU half-life]
       (vw, rw: calculated but EXCLUDED — negative IC)
  → [4] Wc_buy = hw x mw | Wc_sell = (2-hw) x mw
  → [5] WLS Regression: y = Xb (5-col: intercept, confidence, trend, lnVol, atrNorm)
       Ridge lambda=2.0, exponential decay lambda=0.995
  → [6] Prediction: E[return] = x_new' x b, 95% CI
  → [7] LinUCB bandit (7-dim context, 5 actions) — GATED: t_stat >= 2.0
  → [8] Feedback: b auto-updates with new data → W adapts via Bayesian blend
```

### 3.4 Academic Basis for Each Weight

| Weight | Theory | core_data Reference |
|--------|--------|-------------------|
| hw (Hurst) | Fractal market hypothesis, R/S analysis | 01_mathematics.md S4 |
| James-Stein shrinkage | Stein (1956), shrink toward H=0.5 | 02_statistics.md S5 |
| mw (Mean Reversion) | Ornstein-Uhlenbeck process, half-life=5 ATR | 05_finance_theory.md S3 |
| vw (Volatility) | EWMA lambda=0.94 (RiskMetrics) | 05_finance_theory.md S4 |
| rw (Regime) | Jeffrey divergence, information geometry | 13_information_geometry.md S3 |
| WLS + Ridge | Weighted Least Squares + Tikhonov regularization | 17_regression_backtesting.md |
| LinUCB | Contextual bandit (Li et al. 2010) | 11_reinforcement_learning.md S6 |

---

## 4. Predicted vs Actual: Deviation Analysis

### 4.1 Pattern Win Rates (5-day horizon, 2,700+ stocks)

**Backtest data: `data/backtest/pattern_performance.json` — 302,986 occurrences**

| Pattern | Win Rate | Mean Return | Signal | n (significant) |
|---------|----------|-------------|--------|-----------------|
| doubleTop | 73.0% | — | sell | — |
| doubleBottom | 65.6% | — | buy | — |
| risingWedge | 64.5% | — | sell | — |
| threeBlackCrows | 63.6% | — | sell | — |
| gravestoneDoji | 59.1% | — | sell | — |
| bearishEngulfing | 56.4% | +0.053% | sell | 162 |
| threeWhiteSoldiers | 56.2% | — | buy | — |
| bearishMarubozu | 58.1% | — | sell | — |
| **headAndShoulders** | **25.0%** | — | sell | **n=4 (극소!)** |
| **fallingWedge** | **35.5%** | **-2.389%** | buy | **방향 역전** |

### 4.2 Key Deviations from Academic Benchmarks

| Pattern | Our WR | Bulkowski WR | Gap | Root Cause |
|---------|--------|-------------|-----|------------|
| headAndShoulders | 25% | 83% | **-58pp** | n=4, 2 stocks only (M-8) |
| piercingLine | 37.3% | 64% | **-26.7pp** | Threshold too strict? |
| fallingWedge | 35.5% | 68% | **-32.5pp** | **KRX buy→sell anomaly** |
| doubleTop | 73.0% | 72% | +1pp | Aligned |
| threeBlackCrows | 63.6% | 60% | +3.6pp | Aligned |

**Systematic observation**: Bearish patterns outperform bullish on KRX (Korean market structural bias — see `project_fallingwedge_krx_anomaly.md`).

### 4.3 IC (Information Coefficient) Evolution

| Phase | IC | What Changed |
|-------|-----|-------------|
| Stage A-1 (MRA 12-col) | 0.030 | Baseline regression |
| Stage B (LinUCB) | 0.053 (original), 0.046 (adjusted) | Bandit overlay, delta=-0.008 (not significant) |
| Phase 4 (APT+RL) | 0.057 → 0.140 | 2.46x improvement |
| Phase 5 (LinUCB+Ridge) | 0.105 (biased) | t-stat 13.64, but look-ahead bias |
| **Phase 6 (honest audit)** | **0.066** | Bias removed, HC3 robust SE |
| **Phase 8 (current)** | **0.054~0.066** | wc/mom60 removed, KRX tax corrected |
| Phase B (potential) | +0.03~0.08 | Neckline break + DualConf + WR improvement |

### 4.4 WLS Prediction Accuracy

| Metric | Value | Interpretation |
|--------|-------|---------------|
| R-squared range | 0.09~0.21 | **9~21% of return variance explained** |
| 95% CI width | typically +/-3~8% | Wide — reflects market uncertainty |
| Walk-forward IC mean | 0.100 (CV=48%) | Moderate but unstable across periods |
| LinUCB delta IC | -0.008 (t=-0.85) | **Not statistically significant** → disabled |

### 4.5 Self-Backtester Validation Pipeline

```
candles → patternEngine.analyze()
    ├─ Detect patterns (30+ types)
    ├─ Compute Wc weights (hw, mw)
    ├─ Assign Dual Confidence:
    │   confidence = form quality score (UI)
    │   confidencePred = empirical win rate (model input)
    │
backtester.backtest(patternType)
    ├─ Collect occurrences + features (trend, volume, ATR)
    ├─ Compute actual returns: [1, 3, 5, 10, 20]-day horizons
    ├─ t-test per pattern (H0: mean=0)
    ├─ Holm-Bonferroni correction (27 patterns x 5 horizons = 135 tests)
    ├─ WLS regression (5 features, Ridge lambda=2.0)
    │   └─ HC3 heteroskedasticity-robust standard errors
    ├─ Predict latest occurrence: E[return] + 95% CI
    └─ [Gated] LinUCB 7-dim context → 5 actions (if t_stat >= 2.0)
```

**Continuous improvement signals**:
- James-Stein shrinkage: reduces Hurst estimation noise
- Jeffrey Divergence: detects regime changes (D_J > 0.15 → caution)
- Adaptive Q_WEIGHT blending: alpha in [0, 0.5], academic prior preserved

---

## 5. Improvement Potential & Social/Market Factor Integration

### 5.1 Confidence of Current Predictions

| Aspect | Status | Confidence |
|--------|--------|-----------|
| Bearish candle patterns (sell) | Strong backtest data | **High** (n > 1000, t-stat significant) |
| Chart patterns (H&S, triangles) | Tiny samples (n=4~20) | **Low** — needs window expansion |
| WLS regression coefficients | Moderate R-squared (9-21%) | **Medium** — 79-91% unexplained |
| LinUCB bandit overlay | Disabled (t_stat < 2.0) | **Not active** |
| KRX structural bias (bearish > bullish) | Consistently observed | **High** — systemic |

### 5.2 Improvable Areas

| Area | Current State | Improvement Path | IC Potential |
|------|--------------|------------------|-------------|
| Neckline/breakout confirmation | Not implemented (H-3, H-4) | Confidence -15 for unconfirmed | +0.01~0.02 |
| Temperature Scaling | Comments only (C-4) | Guo et al. 2017 calibration | +0.005~0.01 |
| H&S window expansion | 40 bars → 80 bars | n=4 → n=20+ target | +0.01~0.03 |
| Bayesian WR shrinkage | Fixed PATTERN_WIN_RATES | Shrink small-sample toward global mean | +0.01~0.02 |
| Dual Confidence separation | confidencePred = constant per type | Ridge picks up form quality variation | +0.005~0.01 |
| Slippage model | slippage=0 (unrealistic) | KOSPI 1%/mid 3%/small 5% | accuracy fix |
| **Social/sentiment factors** | **Not integrated** | **News API, volume anomaly, herding index** | **+0.02~0.05 (theoretical)** |

### 5.3 Social Matters Integration (Future)

Psychology (core_data/04) identifies cognitive biases that could be quantified:

| Behavioral Signal | Proxy Measurable | Integration Point |
|-------------------|-----------------|------------------|
| Herding | Abnormal volume + price correlation across sector | signalEngine composite |
| Overreaction | Extreme returns + mean reversion speed (mw) | Already partially in mw |
| Disposition effect | Volume at profit/loss reference points | backtester feature |
| Momentum ignition | Volume spike + rapid price move + reversal | patterns.js new detector |
| News sentiment | External API (future: Koscom/DART announcements) | realtimeProvider extension |

---

## 6. Session Management Protocol

### 6.1 Session Efficiency Rules

Each Claude Code session has context limits. To maximize continuity:

```
Session Start:
  1. git pull origin main
  2. Read MEMORY.md → load relevant memory files
  3. Read next_session_guide.md → current phase & priorities
  4. TaskCreate for session goals

Session Work:
  5. Execute tasks sequentially (mark in_progress → completed)
  6. Commit after each logical unit (not batch)
  7. Update memory files if discoveries warrant

Session End (BEFORE context exhaustion):
  8. Commit all changes: git add [specific files] && git commit
  9. Deploy if code changed: wrangler pages deploy
  10. Update next_session_guide.md with:
      - What was completed (with commit hashes)
      - What remains (with priority)
      - IC metrics if changed
      - Version numbers (backtester?v=N, patterns?v=N, SW vN)
  11. Create/update session log: memory/session_MMDD_topic.md
  12. Update MEMORY.md index
```

### 6.2 Memory File Structure

```
memory/
├── MEMORY.md                    ← Index (always loaded, <200 lines)
├── user_preferences.md          ← Communication style, UI preferences
├── feedback_*.md                ← Correction/confirmation rules (10+)
├── project_wc_*.md              ← Wc weight system (5 files)
├── project_phase*_*.md          ← Phase results & plans
├── project_stage_*.md           ← Stage A/B results
├── next_session_guide.md        ← ALWAYS update at session end
├── session_MMDD_topic.md        ← Per-session logs
└── reference_*.md               ← External system pointers
```

### 6.3 Cross-Session Continuity Checklist

| Item | Where | When |
|------|-------|------|
| IC metrics | next_session_guide.md | After any backtester/patterns change |
| Version numbers | next_session_guide.md | After any JS file edit |
| Agent findings | session_MMDD_*.md | After agent exploration |
| Backtest data | data/backtest/*.json | After recalibration |
| Commit hashes | next_session_guide.md | After every commit |
| Deploy status | next_session_guide.md | After wrangler deploy |

### 6.4 Session Size Estimation

| Task Type | Typical Session Cost | Notes |
|-----------|---------------------|-------|
| Single bug fix | 1 session | Fix + verify + commit |
| Pattern addition (1 type) | 1-2 sessions | 7 locations to update |
| Phase execution (3-5 fixes) | 2-3 sessions | Multi-agent verification |
| Full audit (Phase 7 style) | 3-5 sessions | Research only, no code changes |
| Data re-download | Background | Python script, 40+ min |

---

## 7. Current State Summary (2026-03-26)

### 7.1 Phase History

| Phase | Status | Key Result |
|-------|--------|-----------|
| Stages 1-6 (Wc foundation) | Complete | Adaptive weight system |
| Stage A-1 (MRA 12-col) | Complete | Ridge lambda=2.0 |
| Stage B (LinUCB) | Complete | IC 0.211 (Tier-3), delta not significant |
| Phase 4 (APT+RL+UI) | Complete | IC 0.057→0.140, UI 4 fixes |
| Phase 5 (LinUCB+Ridge+JS) | Complete | 7-dim LinUCB, 20-col Ridge, t-stat 13.64 |
| Phase 6 (Honest Audit) | Complete | 4C+5H fixed, honest IC=0.066 |
| Phase 7 (Pattern Audit) | Complete | 4C+5H+10M discovered |
| **Phase 8 (Fix Execution)** | **Complete** | P0 5 fixes, IC 0.054~0.066 |
| **Phase B (next)** | **Pending** | Neckline/triangle breakout + TempScaling |

### 7.2 Version Tracking

Current `?v=N` values are maintained in `index.html` (lines 633-648) and `js/analysisWorker.js` (lines 57-61). The Service Worker `CACHE_NAME` is in `sw.js` line 8. These are the single sources of truth -- do not duplicate version numbers here.

### 7.3 Known Issues (Priority Order)

| Priority | Issue | Status |
|----------|-------|--------|
| P1 | C-3: pykrx adjusted=True (액면분할) | Pending (40min download) |
| P1 | C-4: Temperature Scaling | Pending (comment fix or implement) |
| P1 | H-3: Neckline break confidence -15 | Pending |
| P1 | H-4+: Triangle/wedge 5-pattern breakout | Pending |
| P2 | H-1: Chart pattern window 40→80 bars | Pending |
| P2 | H&S Bayesian WR shrinkage | Pending |
| P2 | CANDLE_TARGET_ATR strong=weak=1.92 | Pending |
| P3 | Slippage model (currently 0) | Pending |
| P3 | equity point-in-time (DART) | Pending |

---

## 8. Quick Reference

### File Ownership
- **Technical analysis**: indicators.js, patterns.js, signalEngine.js, chart.js, patternRenderer.js, signalRenderer.js, backtester.js, analysisWorker.js
- **UI/Design**: css/style.css, index.html
- **Shared (coordinate first)**: app.js, sidebar.js

### Deploy Command
```bash
python scripts/stage_deploy.py
npx wrangler pages deploy deploy --project-name cheesestock --branch main --commit-dirty=true --commit-message="deploy"
```
Note: `wrangler pages deploy` has NO file exclusion mechanism (no .cfignore, no --exclude flag, no .gitignore support). `stage_deploy.py` is the sole gatekeeper — it hard-links deployable files into `deploy/` (zero disk cost on NTFS).

### Verification
```bash
python scripts/verify.py              # 5-category pre-deploy check
python scripts/verify.py --strict     # Fail on warnings
```

### Runtime Health (F12 Console)
- `[KRX] index.json load complete: N stocks`
- `[Worker] analysis Worker init complete`
- Toast `N patterns detected`

---

## 9. GitHub Repository

https://github.com/cmg00210-k/krx-live-chart
