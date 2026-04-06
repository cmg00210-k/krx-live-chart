# Stage 3: Backtest Methodology -- Sections 3.8-3.10

> ANATOMY V5 -- Backtesting Statistical Framework
> Scope: Per-pattern N-day return statistics, WLS/Ridge regression prediction,
>        HC3 correction, reliability tiers, walk-forward validation, LinUCB adaptive RL
> Standard: CFA Paper Grade annotation (symbol table + constant grading A-E)
> Cross-reference: S2_formula_appendix.md D-5 (WLS+HC3), S2_theoretical_basis.md S-5..S-7, S-14..S-16

---

## Stage Dependencies (WIDE STRUCTURE)

```
Stage 1 (API)         Stage 2 (Theory)           Stage 3.1-3.7
-------------------------------------------------------------
data/backtest/        S2.2 S-5 WLS              patterns.js detect*()
  rl_policy.json      S2.2 S-6 Ridge            signalEngine signals
  calibrated_         S2.2 S-7 HC3              confidence chain
    constants.json    S2.2 S-16 Cornish-Fisher   (adjusted confidence
  capm_beta.json      S2.1 M-1 Bayes              as WLS weight)
  illiq_spread.json   S2.3 CAPM (Doc25)
  survivorship_       S2_formula_appendix
    correction.json     D-3, D-4, D-5, D-8
data/{market}/
  {code}.json (OHLCV)
            |                    |                       |
            v                    v                       v
        ===== Section 3.8-3.10 (HERE) =====
            |
            v
    Stage 4/5 (Display)
    patternPanel.js: WR, n, tier badge
    patternRenderer.js: forecastZone gradient
    financials.js: kellyFraction, expectedReturn
```

---

## 3.8 WLS Regression Backtesting

---

### 3.8.1 Per-Pattern N-Day Return Statistics

The backtester computes forward return distributions for each of 45 pattern types
across five holding-period horizons.

#### Horizons

### [BT-01] Holding Period Horizons

| Horizon h | Trading Days | Calendar ~Days | Use Case |
|-----------|-------------|----------------|----------|
| 1 | 1 | 1-2 | Intraday/scalping signal |
| 3 | 3 | 4-5 | Swing entry confirmation |
| 5 | 5 | 7 | Standard pattern evaluation |
| 10 | 10 | 14 | Medium-term trend |
| 20 | 20 | 28 | Position/monthly cycle |

**Constants:**

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| HORIZONS | [1, 3, 5, 10, 20] | [B] | Standard in empirical finance literature |

**JS Location:** backtester.js:16

**Stage ref:** Self-contained -- feeds into all downstream metrics

---

#### Return Calculation

### [BT-02] Forward Return with Transaction Cost (Aronson 2007)

**Formula:**

$$R_h = \frac{P_{\text{exit}}^{(h)} - P_{\text{entry}}}{P_{\text{entry}}} \times 100 - C(h)$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| P_entry | Entry price | KRW | (0, inf) | candles[occ.idx + 1].open |
| P_exit^(h) | Exit price at horizon h | KRW | (0, inf) | candles[occ.idx + h].close |
| R_h | h-day return net of cost | % | (-30, +30) | -- |
| C(h) | Horizon-scaled transaction cost | % | (0.03, 0.31) | _horizonCost(h) |

**Entry rule:** Pattern completion bar at `occ.idx`, entry at **next bar's open**
(`candles[occ.idx + 1].open`). This eliminates look-ahead bias per Aronson (2007,
Ch.6): "Entry must use the bar following signal generation, not the signal bar itself."

**Fallback:** If `.open` is missing or zero, falls back to `candles[occ.idx].close`.
This introduces ~0.5-2% measurement error for gap-open stocks but prevents data loss.

**JS Location:** backtester.js:1293-1307

**Stage ref:** S1(OHLCV data) -> S3.1-3.7(pattern detection) -> [BT-02](return calc) -> S4(display)

---

#### KRX Cost Structure

### [BT-03] KRX Transaction Cost Components (Kyle 1985, Amihud 2002)

**Static costs (round-trip):**

| Cost Component | Value (%) | Grade | Source |
|----------------|-----------|-------|--------|
| Commission | 0.03 | [C] | KRX standard: 0.015% one-way x 2 |
| Tax | 0.18 | [C] | KOSPI 0.03% + 농특세 0.15% / KOSDAQ 0.18% (2025) |
| Slippage | 0.10 | [C] | KOSPI large-cap bid-ask spread, Amihud (2002) |
| **Total** | **0.31** | | Sum of above |

**JS Location:** backtester.js:19-22

---

### [BT-04] Horizon-Scaled Cost Function (Kyle 1985)

**Formula:**

$$C(h) = \frac{C_{\text{fixed}}}{h} + \frac{C_{\text{variable}}}{\sqrt{h}}$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| C_fixed | Commission + Tax | % | 0.21 | Round-trip, incurred once |
| C_variable | Slippage | % | 0.10 | Market microstructure noise |
| h | Holding period | trading days | [1, 20] | -- |

**Rationale:**
- Fixed costs (tax + commission): incurred once per round-trip, amortized over h days
- Variable costs (slippage): Kyle (1985) sqrt-time scaling of market impact

| h | C(h) | Old Fixed 0.07% |
|---|------|-----------------|
| 1 | 0.310% | 0.310% |
| 5 | 0.087% | 0.070% (was 112% overestimated) |
| 10 | 0.053% | 0.070% |
| 20 | 0.033% | 0.070% |

**JS Location:** backtester.js:44-49

---

### [BT-05] Adaptive Slippage by Market Segment (Amihud 2002)

**Formula:**

$$C_{\text{slippage}}(\text{code}) = f(\text{ILLIQ segment})$$

| Segment | Slippage (%) | Grade | Source |
|---------|-------------|-------|--------|
| kospi_large | 0.04 | [C] | compute_illiq_spread.py |
| kospi_mid | 0.10 | [C] | compute_illiq_spread.py |
| kosdaq_large | 0.15 | [C] | compute_illiq_spread.py |
| kosdaq_small | 0.25 | [C] | compute_illiq_spread.py |

Data source: `data/backtest/illiq_spread.json` from `compute_illiq_spread.py`
(Amihud 2002 ILLIQ = |r| / volume, calibrated per segment).

**JS Location:** backtester.js:27-38

**Stage ref:** S1(illiq_spread.json) -> [BT-05](adaptive cost) -> [BT-04](horizon cost)

---

### 3.8.2 WLS Regression Model

### [BT-06] WLS Design Matrix (5 Features, Reschenhofer et al. 2021)

**Model:**

$$E[R_h] = \beta_0 + \beta_1 \cdot \text{conf} + \beta_2 \cdot \text{trend} + \beta_3 \cdot \ln(\text{volRatio}) + \beta_4 \cdot \text{atrNorm} + \varepsilon$$

| Column | Feature | Description | Scale | Source |
|--------|---------|-------------|-------|--------|
| 0 | intercept | Constant 1 | fixed | -- |
| 1 | confidence | (confidencePred or confidence) / 100 | [0, 1] | Bulkowski (2005) |
| 2 | trendStrength | abs(OLS slope over 10 bars) / ATR | [0, ~5] | Lo, Mamaysky & Wang (2000) |
| 3 | ln(volumeRatio) | ln(max(volume/VMA20, 0.1)) | [-2.3, ~3] | Caginalp & Laurent (1998) |
| 4 | atrNorm | ATR(14) / close | [0, ~0.1] | Cross-stock volatility normalization |

**Removed features (Phase 7 C-1):**
- `wc` (hw * mw): look-ahead bias -- `analyze(full_candles)` hw/mw reflect future data
- `momentum60`: parsimony -- 7->5 columns, reduces overfitting with n=30-200

**Minimum sample:** n >= 30 (CLT requirement for WLS). Below 30, regression is skipped
and only descriptive statistics are reported.

**Constants:**

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| n/k ratio | 30/5 = 6 | [C] | Below ideal 10-20 (Green 1991); mitigated by Ridge |
| Feature count p | 5 | [B] | Parsimony principle |

**JS Location:** backtester.js:1803-1814

**Stage ref:** S3.1-3.7(pattern confidence) -> S2.2(S-5 WLS) -> [BT-06](design matrix) -> [BT-10](prediction)

---

### [BT-07] Exponential Decay Weights (Lo 2004, Reschenhofer et al. 2021)

**Formula:**

$$w_i = \lambda^{n-1-i}, \quad \lambda = 0.995$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| lambda | Decay factor | dimensionless | (0, 1) | Lo (2004) AMH |
| n | Total observations | count | [30, inf) | -- |
| w_i | Weight for i-th observation | dimensionless | (0, 1] | Most recent gets 1.0 |

**Half-life:** t_{1/2} = ln(2) / ln(1/0.995) = 138.3 trading days (~7 months)

**Rationale:** Lo (2004) Adaptive Markets Hypothesis -- market efficiency varies over
time. Recent pattern occurrences better reflect current regime. Reschenhofer et al.
(2021) demonstrate time-dependent WLS outperforms OLS for return prediction.

**Constants:**

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| lambda | 0.995 | [A] | core_data/17 S17.4; Lo (2004) AMH; Reschenhofer et al. (2021) |

**Sensitivity:** HIGH. lambda = 0.990 -> half-life 69 days (too reactive to noise).
lambda = 0.999 -> half-life 693 days (too slow for regime change).

**JS Location:** backtester.js:1805-1816

---

### [BT-08] Column-Wise Feature Normalization (Hoerl & Kennard 1970)

**Formula:**

$$X^{\text{std}}_{ij} = \frac{X_{ij}}{s_j}, \quad s_j = \sqrt{\frac{1}{n}\sum_{i=1}^{n} X_{ij}^2 - \left(\frac{1}{n}\sum_{i=1}^{n} X_{ij}\right)^2}$$

for j = 1, ..., p-1 (intercept j=0 excluded).

**Rationale:** Ridge penalty lambda * ||beta||^2 shrinks all coefficients equally
in the penalized space. Without normalization, atrNorm (scale ~0.02) receives
~278x stronger shrinkage than confidence (scale ~0.5). Marquardt (1970) establishes
variance normalization as the minimum requirement for meaningful Ridge regression.

**Reverse transform (post-estimation):**

$$\hat{\beta}_j^{\text{orig}} = \hat{\beta}_j^{\text{std}} / s_j$$

per Hastie, Tibshirani & Friedman (2009), ESL Ch.3.

**Constants:**

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| Constant feature guard | s_j < 1e-10 -> s_j = 1 | [B] | Prevents division by zero |

**JS Location:** backtester.js:1819-1833

---

### [BT-09] Ridge Lambda Selection via GCV (Golub, Heath & Wahba 1979)

**Formula:**

$$\text{GCV}(\lambda) = \frac{n^{-1} \sum_{i=1}^{n} w_i (y_i - \hat{y}_i^{(\lambda)})^2}{\left(1 - n^{-1} \text{tr}(H_\lambda)\right)^2}$$

$$\lambda^* = \arg\min_\lambda \text{GCV}(\lambda)$$

where $H_\lambda = X(X^TWX + \lambda I)^{-1}X^TW$ is the hat matrix.

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| GCV(lambda) | Generalized cross-validation score | dimensionless | (0, inf) | Golub et al. (1979) |
| H_lambda | Smoothing matrix | dimensionless | eigenvalues in [0,1] | -- |
| lambda* | Optimal Ridge penalty | dimensionless | (0, inf) | Data-driven |

**Implementation:** `selectRidgeLambdaGCV()` in indicators.js uses Jacobi
eigendecomposition for efficient GCV computation across a grid of lambda candidates.
Fallback: lambda = 1.0 when n < 2p or GCV is unreliable.

**Constants:**

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| GCV fallback lambda | 1.0 | [C] | Heuristic fallback |

**JS Location:** indicators.js:826+, called at backtester.js:1836

**Stage ref:** S2.2(S-6 Ridge) -> [BT-09](GCV lambda) -> [BT-06](WLS fit)

---

### [BT-10] Huber-IRLS Robust Estimation (Huber 1964, Street, Carroll & Ruppert 1988)

**Algorithm:**

```
1. Initial WLS regression with Ridge lambda (from GCV)
2. For iter = 1 to HUBER_ITERS:
   a. Compute residuals: e_i = y_i - X_i' * beta
   b. Huber weights:
      hw_i = 1.0                if |e_i| <= delta
      hw_i = delta / |e_i|     if |e_i| > delta
   c. Combined weights: W_i = hw_i * lambda^(n-1-i)
   d. Re-fit WLS: beta = (X'W*X + lambda*I)^{-1} X'W*y
   e. Early stop if no |e_i| > delta
```

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| delta | Huber threshold | % (return units) | 5.8 | 1.345 * sigma; Huber (1964) |
| hw_i | Huber weight | dimensionless | (0, 1] | -- |
| HUBER_ITERS | Maximum iterations | count | 5 | Street et al. (1988) |

**Rationale:** KRX 5-day returns have excess kurtosis from +/-30% price limits.
The limit-up/limit-down regime produces extreme outliers that corrupt OLS/WLS
estimates. Huber loss is 95% efficient at the normal model while being robust
to heavy tails.

**Huber delta derivation:** sigma ~ 4.3% (from KRX 5-day return MAD),
delta = 1.345 * sigma = 5.8%. The 1.345 coefficient achieves 95% asymptotic
relative efficiency at the normal model (Huber 1964, Table 3.1).

**Constants:**

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| HUBER_DELTA | 5.8 | [C] | 1.345 * 4.3; Huber (1964) 95% efficiency |
| HUBER_ITERS | 5 | [B] | Street, Carroll & Ruppert (1988): converges in 3-5 |

**Sensitivity:** HIGH for HUBER_DELTA. Too low (< 3) -> excessive downweighting,
loss of information. Too high (> 10) -> no robustness benefit.

**JS Location:** backtester.js:1839-1864

---

### 3.8.3 HC3 Correction

### [BT-11] HC3 Heteroskedasticity-Consistent Standard Errors (MacKinnon & White 1985)

**Formula (sandwich estimator):**

$$\widehat{\text{Cov}}_{\text{HC3}}(\hat{\beta}) = (X^TWX)^{-1} \left[\sum_{i=1}^{n} \frac{(w_i e_i)^2}{(1 - h_{ii})^2} x_i x_i^T \right] (X^TWX)^{-1}$$

**Hat matrix diagonal (leverage):**

$$h_{ii} = w_i \cdot x_i^T (X^TWX)^{-1} x_i$$

**HC3 standard error for coefficient j:**

$$\text{SE}_j^{\text{HC3}} = \sqrt{\max\left(0, \left[(X^TWX)^{-1} B (X^TWX)^{-1}\right]_{jj}\right)}$$

**HC3 t-statistic:**

$$t_j^{\text{HC3}} = \frac{\hat{\beta}_j}{\text{SE}_j^{\text{HC3}}}$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| h_ii | Leverage of observation i | dimensionless | [0, 1) | Hat matrix |
| B | Meat matrix | varies | positive semi-definite | -- |
| w_i | WLS weight | dimensionless | (0, 1] | Exponential decay |
| e_i | Residual | % | (-inf, inf) | y_i - X_i' beta |

**Leverage guard:** h_ii is clamped to max 0.99 to prevent division by zero
when a single observation has perfect leverage (common with small n and extreme
feature values in KOSDAQ small-cap patterns).

**Why HC3 over HC0/HC1/HC2:**
Long & Ervin (2000, *The American Statistician*) demonstrate via Monte Carlo that
HC3 has the lowest size distortion for n = 30-300. Since pattern backtests typically
have 30 < n < 200, HC3 is optimal. HC0 (White 1980) underestimates SE in small
samples; HC1 (df correction only) is insufficient; HC2 (1/(1-h_ii)) undercorrects
high-leverage points.

**Why HC3 is essential for financial returns:**
1. GARCH effect: volatility clusters create time-varying conditional variance
2. KRX price limit truncation: +/-30% bounds distort the residual distribution
3. Pattern-specific heterogeneity: patterns cluster in specific volatility regimes

Without HC3, standard WLS t-statistics overstate significance (inflated Type I error).

**Constants:**

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| Leverage clamp | 0.99 | [A] | Standard numerical guard |

**JS Location:** indicators.js:636-674 (calcWLSRegression HC3 block)

**Stage ref:** S2.2(S-7 HC3 theory) -> S2_formula_appendix(D-5 derivation) -> [BT-11](implementation)

**Verification:** The meat matrix computation at indicators.js:654-657 was verified
against the canonical WLS HC3 form (Davidson & MacKinnon 1993, Econometric Theory
and Methods, Theorem 5.5). The code computes
`X[i][j] * w^2 * e_i^2 / (1-h_ii)^2 * X[i][k]`, which exactly matches
$(X^TWX)^{-1} [\sum (w_i e_i)^2 (1-h_{ii})^{-2} x_i x_i^T] (X^TWX)^{-1}$.
**VALID.**

---

### 3.8.4 Core Metrics

Each horizon produces the following metrics. Every formula is annotated with its
academic source, implementation location, and downstream display target.

---

### [BT-12] Win Rate (Direction-Adjusted)

**Formula:**

$$\text{WR} = \frac{\text{wins}}{n} \times 100$$

where "win" depends on pattern signal direction:
- Buy patterns: R_h > 0
- Sell patterns: R_h < 0
- Neutral: R_h > 0

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| WR | Win rate | % | [0, 100] | -- |
| wins | Directional win count | count | [0, n] | -- |
| n | Sample size | count | [1, inf) | -- |

**JS Location:** backtester.js:1403-1412
**Stage ref:** [BT-02](returns) -> [BT-12](WR) -> S4/5(patternPanel badge)

---

### [BT-13] Null Win Rate (Sullivan, Timmermann & White 1999)

**Formula:**

$$\text{WR}_{\text{null}} = \frac{1}{T-h-1} \sum_{i=0}^{T-h-2} \mathbf{1}\left[\frac{P_{i+h}^{\text{close}} - P_{i+1}^{\text{open}}}{P_{i+1}^{\text{open}}} \times 100 - C(h) > 0\right] \times 100$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| WR_null | Unconditional base rate | % | (40, 60) typical | Sullivan et al. (1999) |
| T | Total candle count | count | -- | -- |

The null win rate is the probability of a random h-day entry yielding a positive
return (buy null) or negative return (sell null) after transaction costs. This
accounts for market drift: in a rising market, WR_null_buy > 50%, so a pattern
with WR = 55% in a market with WR_null = 53% has only 2pp alpha, not 5pp.

**Caching:** Results cached by `candles.length + '_' + h + '_' + Math.round(lastClose)`
for O(1) re-lookup. KRX integer prices ensure stable cache keys.

**JS Location:** backtester.js:2030-2061
**Stage ref:** [BT-13](null WR) -> [BT-14](alpha) -> S4/5(display)

---

### [BT-14] Win Rate Alpha

**Formula:**

$$\alpha_{\text{WR}} = \text{WR}_{\text{observed}} - \text{WR}_{\text{null}}$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| alpha_WR | Excess win rate over random | pp | (-50, +50) | Sullivan et al. (1999) |

Positive alpha indicates the pattern adds predictive value beyond random entry.
Negative alpha indicates the pattern is anti-predictive (worse than random).

**JS Location:** backtester.js:1419
**Stage ref:** [BT-14](alpha) -> [BT-40](reliability tier) -> S4/5(tier badge)

---

### [BT-15] Survivorship Bias Corrected WR (Elton, Gruber & Blake 1996)

**Formula:**

$$\text{WR}_{\text{corrected}} = \text{WR}_{\text{observed}} - \Delta_{\text{surv}}$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| Delta_surv | Survivorship bias delta | pp | [0, ~2] | Elton et al. (1996) |

**Priority cascade:**
1. Per-pattern per-horizon delta (requires n_delisted >= 30)
2. Per-horizon delta (medium precision)
3. Global median delta (fallback)
4. Zero (no correction data loaded)

**Critical note:** wrAlpha is NOT corrected for survivorship bias because both
observed WR and null WR share the same survivorship bias (they are computed on
the same surviving stock universe). The bias cancels in the difference. Only
absolute WR (correctedWR) needs correction for cross-market comparison.

**JS Location:** backtester.js:1421-1424
**Data source:** S1(`data/backtest/survivorship_correction.json`)

---

### [BT-16] Cohen's h Effect Size (Cohen 1988)

**Formula:**

$$h = 2 \arcsin\left(\sqrt{\frac{\text{WR}}{100}}\right) - 2 \arcsin\left(\sqrt{\frac{\text{WR}_{\text{null}}}{100}}\right)$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| h | Cohen's h | dimensionless | [-pi, pi] | Cohen (1988) |

**Interpretation:**
- |h| > 0.2: small effect
- |h| > 0.5: medium effect
- |h| > 0.8: large effect

Uses market-drift-corrected null (WR_null/100), not hardcoded 0.5.

**JS Location:** backtester.js:1431

---

### [BT-17] Expectancy (Kelly 1956, Lopez de Prado 2018)

**Formula:**

$$E = \frac{\text{wins}}{n} \times \overline{W} - \frac{n - \text{wins}}{n} \times |\overline{L}|$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| E | Expectancy per trade | % | (-inf, inf) | -- |
| W_bar | Average winning return | % | (0, inf) | -- |
| L_bar | Average losing return (absolute) | % | (0, inf) | -- |

**JS Location:** backtester.js:1565

---

### [BT-18] Kelly Fraction (Kelly 1956, Thorp 2006)

**Formula:**

$$\text{edge} = \max\left(0, \frac{\text{wins}}{n} - \frac{\text{WR}_{\text{null}}}{100}\right)$$

$$f^* = \frac{\text{edge} \times (1 + b) - 1}{b}, \quad b = \frac{\overline{W}}{|\overline{L}|}$$

$$f^*_{\text{clamped}} = \text{clamp}(f^*, 0, 1.0)$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| f* | Optimal bet fraction | dimensionless | [0, 1] | Kelly (1956) |
| edge | Excess probability over null | dimensionless | [0, 0.5] | -- |
| b | Payoff ratio (avg win / avg loss) | dimensionless | (0, inf) | -- |

**Critical fix (H-2):** Edge uses observed WR minus null WR (no 0.5 recentering).
Previous formula added 0.5 which created bias when WR_null != 50%.

**Clamping rationale:** f* > 1.0 implies leveraged positions, inappropriate for
unleveraged equity. f* < 0 means don't bet. Full Kelly is reported; production
should use half-Kelly (f*/2) which reduces drawdown ~50% (Thorp 2006).

**Constants:**

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| Kelly clamp upper | 1.0 | [B] | No-leverage constraint |
| Half-Kelly recommendation | 0.5 * f* | [A] | Thorp (2006) |

**JS Location:** backtester.js:1580-1582
**Stage ref:** [BT-18](Kelly) -> S4/5(risk display)

---

### [BT-19] Sharpe Ratio (implied from t-statistic)

The t-statistic for H0: mean = 0 is equivalent to an annualized Sharpe ratio
scaled by sqrt(n):

$$t = \frac{\bar{R}_h}{s / \sqrt{n}}$$

This is not separately computed as a named metric; the t-statistic carries
the same information. See [BT-25] for the actual t-test.

---

### [BT-20] Sortino Ratio (Sortino & van der Meer 1991)

**Formula:**

$$\text{Sortino} = \frac{\bar{R}_h}{\text{DD}} \times \sqrt{\frac{250}{h}}$$

$$\text{DD} = \sqrt{\frac{1}{n} \sum_{i=1}^{n} \min(R_i, 0)^2}$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| DD | Downside deviation | % | [0, inf) | Sortino & van der Meer (1991) |
| 250 | KRX trading days per year | days | fixed | KRX_TRADING_DAYS |

**Critical fix (H-1):** Denominator divides by N_total, NOT N_negative. Per
Sortino & van der Meer (1991), downside deviation uses total sample count to
avoid overestimating risk when few negative returns exist.

**Annualization fix (P0-1):** Uses sqrt(250/h), not sqrt(250/(h-1)). The
(h-1) version inflated the ratio by up to 41% at h=1.

**JS Location:** backtester.js:1395-1400

---

### [BT-21] Information Ratio (Grinold & Kahn 2000)

**Formula:**

$$\text{IR} = \frac{\bar{R}_{\text{excess}}}{\text{TE}} \times \sqrt{\frac{250}{h}}$$

$$R_{\text{excess},i} = R_i - \bar{R}_{\text{null}}$$

$$\text{TE} = \sqrt{\frac{1}{n-1} \sum_{i=1}^{n} (R_{\text{excess},i} - \bar{R}_{\text{excess}})^2}$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| IR | Information Ratio | dimensionless | (-inf, inf) | Grinold & Kahn (2000) |
| TE | Tracking Error | % | (0, inf) | Standard deviation of excess |
| R_null_bar | Unconditional mean h-day return | % | -- | _computeNullMeanReturn() |

**Critical fix (H-2):** Benchmark is the unconditional mean h-day return computed
independently from all candle windows (`_computeNullMeanReturn`), NOT derived from
the pattern's own mean (which would be circular).

**JS Location:** backtester.js:1439-1448

---

### [BT-22] CVaR / Expected Shortfall 5% (Basel Committee)

**Formula:**

$$\text{CVaR}_{5\%} = \frac{1}{\lfloor n \times 0.05 \rfloor} \sum_{i=1}^{\lfloor n \times 0.05 \rfloor} R_{(i)}$$

where R_(i) are returns sorted ascending (worst first).

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| CVaR | Conditional Value-at-Risk | % | (-30, 0) typical | Basel Committee |

CVaR is the mean of the worst 5% of returns. Unlike VaR, it is a coherent risk
measure (satisfies subadditivity). Basel III requires CVaR for internal models.

**JS Location:** backtester.js:1374-1377

---

### [BT-23] Maximum Drawdown (CFA Level III)

**Formula:**

$$\text{MaxDD} = \max_{1 \le i \le n} \left(\text{Peak}_i - \text{Cumulative}_i\right)$$

where Cumulative_i = sum(R_1, ..., R_i) and Peak_i = max(Cumulative_1, ..., Cumulative_i).

**Note:** This is computed over the sequential pattern occurrence returns, not over
a continuous equity curve. It measures the worst peak-to-trough decline across
the pattern's historical performance.

**JS Location:** backtester.js:1365-1371

---

### [BT-24] Profit Factor

**Formula:**

$$\text{PF} = \frac{\sum_{R_i > 0} R_i}{\left|\sum_{R_i < 0} R_i\right|}$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| PF | Profit Factor | dimensionless | [0, inf) | -- |

PF > 1.0: gross profits exceed gross losses (net profitable).
PF >= 1.3: required for reliability tier A.
PF = 999.99: no losing trades (capped sentinel).

**JS Location:** backtester.js:1568

---

### [BT-25] t-Statistic with Fat-Tail Correction (Cont 2001)

**Formula:**

$$t = \frac{\bar{R}_h}{s / \sqrt{n}}, \quad \text{df} = n - 1$$

**Fat-tail adjusted critical value:**

$$K_e = \frac{m_4}{m_2^2} - 3 \quad \text{(excess kurtosis)}$$

$$\nu_{\text{eff}} = \begin{cases} \min\left(\text{df}, \left\lfloor 4 + \frac{6}{K_e} \right\rfloor\right) & \text{if } K_e > 0.5 \\ \text{df} & \text{otherwise} \end{cases}$$

$$t_{\text{crit}} = \text{CornishFisher}(\alpha, \nu_{\text{eff}})$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| K_e | Excess kurtosis | dimensionless | (-2, inf) | Cont (2001) |
| nu_eff | Effective degrees of freedom | count | [1, n-1] | -- |
| t_crit | Fat-tail critical value | dimensionless | (1.96, inf) | -- |

**Rationale (Cont 2001):** Financial returns universally exhibit K > 3
(leptokurtic). Using standard t-distribution critical values underestimates
tail probability. The effective df formula inverts the t-distribution kurtosis
relationship: t-distribution with nu df has kurtosis = 3 + 6/(nu-4), so
nu = 4 + 6/K_e maps observed kurtosis to an equivalent df.

**Significance flag:** `significant = |tStat| > tCrit`

**JS Location:** backtester.js:1004-1034

---

### [BT-26] HLZ Significance Threshold (Harvey, Liu & Zhu 2016)

**Formula:**

$$\text{hlzSignificant} = |t| > 3.0$$

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| HLZ threshold | 3.0 | [A] | Harvey, Liu & Zhu (2016), JFQA |

Harvey, Liu & Zhu (2016) argue that with hundreds of factors tested in the
financial literature, the conventional t > 1.96 threshold produces excessive
false discoveries. They recommend t > 3.0 as the new minimum for claiming
statistical significance in factor research.

**JS Location:** backtester.js:1592

---

### [BT-27] Minimum Detectable Effect (Cohen 1988)

**Formula:**

$$\text{MDE} = t_{\text{crit}} \times \frac{s}{\sqrt{n}}$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| MDE | Smallest reliably detectable mean return | % | (0, inf) | Cohen (1988) |

If |mean| < MDE, the observed effect is statistically indistinguishable from zero.
Uses fat-tail-corrected t_crit rather than naive 1.96.

**JS Location:** backtester.js:1598

---

### [BT-28] Jensen's Alpha (CAPM, Jensen 1968)

**Formula:**

$$\alpha_J = R_{\text{pattern}} - \left[R_f + \beta \times (R_m - R_f)\right]$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| alpha_J | Jensen's Alpha | % | (-inf, inf) | Jensen (1968) |
| R_f | Risk-free rate (period) | % | ~0.014%/day | KTB10Y annual / 250 |
| beta | CAPM beta | dimensionless | (-inf, inf) | compute_capm_beta.py |
| R_m | Market return (same period) | % | (-inf, inf) | KOSPI daily index |

**Period conversion:** R_f(period) = (1 + R_f_annual/100)^(1/250) - 1, then
scaled to nDays.

**Per-occurrence computation:** Each pattern occurrence gets its own Jensen's alpha
using the exact market return over the same calendar window. Results are then
averaged (mean) and median-aggregated for robustness.

**JS Location:** backtester.js:1750-1782
**Stage ref:** S1(capm_beta.json, kospi_daily.json) -> S2.3(CAPM) -> [BT-28](Jensen's alpha)

---

### [BT-29] Bootstrap CI with BCa Correction (Efron 1987)

**Algorithm:**

```
1. Winsorize returns at 1st/99th percentile (Wilcox 2005)
   - Rationale: KRX +/-30% limit produces extreme kurtosis;
     unwinsorized bootstrap CIs are too wide

2. Calendar-time block bootstrap (primary path):
   - Group returns by YYYY-MM (pattern occurrence date)
   - Resample whole months with replacement until n returns
   - Preserves within-month temporal dependence (Carlstein 1986)
   - Requires >= 3 distinct months

3. Index-based block bootstrap (fallback: intraday data):
   - Block size = sqrt(n) (Kunsch 1989)
   - Circular resampling: index wraps around

4. BCa correction (Efron 1987):
   a. Bias correction z0 = Phi^{-1}(#{theta*_b < theta_hat} / B)
   b. Acceleration a_hat from jackknife:
      a_hat = sum(d^3) / (6 * (sum(d^2))^{3/2})
      where d = mean(jackValues) - jackValues[i]
   c. Adjusted percentiles:
      alpha_1 = Phi(z0 + (z0 + z_{alpha/2}) / (1 - a_hat * (z0 + z_{alpha/2})))
      alpha_2 = Phi(z0 + (z0 + z_{1-alpha/2}) / (1 - a_hat * (z0 + z_{1-alpha/2})))
   d. CI = [sorted_boot[floor(alpha_1 * B)], sorted_boot[floor(alpha_2 * B)]]
```

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| B | Bootstrap replicates | count | 500 | Efron & Tibshirani (1993) |
| z0 | Bias correction constant | dimensionless | (-3, 3) | Efron (1987) |
| a_hat | Acceleration constant | dimensionless | (-0.3, 0.3) | Jackknife |

**Constants:**

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| Bootstrap B | 500 | [B] | Efron & Tibshirani (1993): 200-1000 for percentile CIs |
| Min calendar months | 3 | [D] | Heuristic for meaningful calendar resampling |
| Winsorization bounds | 1%/99% | [B] | Wilcox (2005) |
| Min n for bootstrap | 30 | [B] | CLT requirement |

**JS Location:** backtester.js:1457-1549 (bootstrap), backtester.js:1102-1146 (_bcaCI)

**Stage ref:** S2_formula_appendix(S-14 BCa) -> [BT-29](implementation) -> S4/5(CI bands)

---

### [BT-30] Spearman Rank IC (Grinold & Kahn 2000)

**Formula (Pearson-of-ranks):**

$$\rho_s = \frac{n \sum R_i S_i - \sum R_i \sum S_i}{\sqrt{(n \sum R_i^2 - (\sum R_i)^2)(n \sum S_i^2 - (\sum S_i)^2)}}$$

where R_i and S_i are the ranks of predicted and actual returns, with tied
ranks averaged (Kendall & Gibbons 1990).

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| rho_s | Spearman rank correlation | dimensionless | [-1, 1] | Grinold & Kahn (2000) |

**H-1 FIX:** Uses Pearson-of-ranks formula (exact with tied ranks), not the
shortcut d^2 formula which is invalid when ties exist.

**Operational significance (Qian, Hua & Sorensen 2007):**
- IC > 0.05: operationally significant
- IC > 0.10: strong predictive power
- IC < 0: anti-predictive (model inversely correlated with outcomes)

**JS Location:** backtester.js:617-654

---

### [BT-31] Rolling OOS IC (Lo 2002)

**Algorithm:**

```
1. If n < 24: return full-sample IC (flagged isOOS=false)
2. Expanding window with non-overlapping OOS blocks (size = 12):
   - Window k: OOS = pairs[k*12 : (k+1)*12]
   - Compute Spearman IC on OOS window only
3. Average across all OOS windows
4. ICIR = IC / std(IC) via jackknife SE estimation
```

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| IC_OOS | Out-of-sample IC | dimensionless | [-1, 1] | Lo (2002) |
| ICIR | IC Information Ratio | dimensionless | (-inf, inf) | Grinold & Kahn (2000) |
| minWindow | Minimum OOS window size | count | 12 | -- |

**Rationale:** In-sample IC inflates predictive ability (Lo 2002, "The Statistics
of Sharpe Ratios"). Rolling OOS: each window is pure OOS -- model was never fitted
on these observations.

**JS Location:** backtester.js:667-694 (_rollingOOSIC), backtester.js:1947-1990 (IC computation)

---

### [BT-32] MAE/MFE Path Risk (Sweeney 1997)

**Formulas:**

$$\text{MAE}_i = \min_{t \in [\text{entry}, \text{exit}]} \frac{P_t - P_{\text{entry}}}{P_{\text{entry}}} \times 100$$

$$\text{MFE}_i = \max_{t \in [\text{entry}, \text{exit}]} \frac{P_t - P_{\text{entry}}}{P_{\text{entry}}} \times 100$$

Aggregated as:
- medianMAE, medianMFE: median of path-wise values
- mae5: 5th percentile MAE (Hyndman & Fan 1996, Type 7 interpolation)
- mfe95: 95th percentile MFE

**M-1 FIX:** Percentile computation uses linear interpolation:
`index = (n-1)*p`, then interpolate between floor and ceil. Previous
`Math.floor(n*0.05)` gave off-by-one at small n.

**JS Location:** backtester.js:1298-1362

---

### [BT-33] Mincer-Zarnowitz Calibration Regression (Mincer & Zarnowitz 1969)

**Formula:**

$$y_{\text{actual}} = \alpha + \beta \cdot y_{\text{predicted}} + \varepsilon$$

**Null hypothesis:** alpha = 0, beta = 1 (perfect calibration).

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| alpha | Intercept (systematic bias) | % | (-inf, inf) | Mincer & Zarnowitz (1969) |
| beta | Slope (calibration coefficient) | dimensionless | (0, inf) | -- |
| R^2 | Coefficient of determination | dimensionless | [0, 1] | -- |
| bias | Mean prediction error | % | (-inf, inf) | -- |
| TE | Tracking Error (std of pred errors) | % | (0, inf) | -- |

**Minimum sample:** 20 prediction-actual pairs required.

**JS Location:** backtester.js:1642-1678

---

### [BT-34] Calibration Coverage (Gneiting & Raftery 2007)

**Algorithm:**

```
1. Split chronological pairs into first half (training) and second half (test)
2. Compute residual distribution P5/P95 from training half
3. Measure what fraction of test-half residuals fall within [P5, P95]
4. Well-calibrated model: ~90%. Overfit: <80%. Underfit: >95%.
```

**Fix:** Previous implementation tested actuals' P5/P95 against themselves
(tautological ~90%). Corrected to use training residuals as the prediction
interval and test residuals as the evaluation target.

**Minimum:** _halfN >= 10 (total pairs >= 20).

**JS Location:** backtester.js:1680-1701

---

### [BT-35] Composite Pattern Score (Practitioner-Designed)

**Formula:**

$$\text{Score} = \text{clamp}\left(0, 100, \; \text{DA} \times 0.30 + \text{THR} \times 0.25 + \text{MAE}_{\text{inv}} \times 0.25 + \text{PF}_{\text{scaled}} \times 0.20\right)$$

| Component | Weight | Scale | Fallback |
|-----------|--------|-------|----------|
| Directional Accuracy (DA) | 0.30 | 0-100% | -- |
| Target Hit Rate (THR) | 0.25 | 0-100% | DA if null |
| MAE inverse | 0.25 | 100 - MAE*10 | 50 if null |
| Profit Factor scaled | 0.20 | min(PF*20, 100) | -- |

**Grade boundaries:**

| Grade | Score | Grade |
|-------|-------|-------|
| A | >= 80 | [D] Heuristic |
| B | >= 65 | [D] |
| C | >= 50 | [D] |
| D | >= 35 | [D] |
| F | < 35 | [D] |

**Constants:** All weights (0.30/0.25/0.25/0.20), scaling factors (MAE*10, PF*20),
and grade boundaries (80/65/50/35) are practitioner-designed heuristics with no
single published source.

**JS Location:** backtester.js:1618-1637

---

### [BT-36] WLS Prediction and Confidence Interval

**Prediction:**

$$\hat{R}_h = \sum_{j=0}^{p-1} x_j^{\text{new}} \cdot \hat{\beta}_j$$

**95% Prediction Interval (Cont 2001 fat-tail corrected):**

$$\text{SE}_{\text{pred}} = \sqrt{\hat{\sigma}^2 \cdot (1 + x_{\text{new}}^T (X^TWX)^{-1} x_{\text{new}})}$$

$$\text{CI}_{95} = \left[\hat{R}_h - t_{\text{crit}}^{\text{fat-tail}} \cdot \text{SE}_{\text{pred}}, \; \hat{R}_h + t_{\text{crit}}^{\text{fat-tail}} \cdot \text{SE}_{\text{pred}}\right]$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| sigma_hat^2 | Residual variance | %^2 | (0, inf) | SSres / (n-p) |
| t_crit | Fat-tail corrected critical value | dimensionless | (1.96, inf) | Cont (2001) |

**Note:** xNew is transformed to standardized space for the quadratic form
x'(X'WX)^{-1}x, then the prediction uses reverse-transformed coefficients
on original-scale features. This is consistent with the Hastie et al. (2009)
prescription for Ridge regression prediction intervals.

**JS Location:** backtester.js:1886-1938
**Stage ref:** [BT-36](prediction) -> S4/5(forecastZone gradient)

---

### [BT-37] Regime-Conditioned Win Rate (Lo 2004 AMH)

**Formula:**

$$\text{WR}_{\text{regime}} = \frac{\text{wins}_{\text{regime}}}{n_{\text{regime}}} \times 100, \quad n_{\text{regime}} \ge 30$$

**Regime classification (from pattern occurrence hw):**

| Regime | Condition | Interpretation |
|--------|-----------|----------------|
| Trending | hw > 1.1 | Hurst weight indicates persistent series |
| Reverting | hw < 0.9 | Hurst weight indicates mean-reverting series |
| Neutral | 0.9 <= hw <= 1.1 | Random walk regime |

**Constants:**

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| Trending boundary | hw > 1.1 | [D] Heuristic | +/-10% from neutral (1.0) |
| Reverting boundary | hw < 0.9 | [D] | -- |
| Minimum per bucket | 30 | [B] | CLT requirement |

**JS Location:** backtester.js:2104-2138

---

## 3.9 Walk-Forward & Reliability

---

### 3.9.1 Walk-Forward Efficiency

### [BT-38] Walk-Forward Test (Pardo 2008, Bailey & Lopez de Prado 2014)

**Algorithm:**

```
1. Set K = 4 folds (6 if candles >= 500)
2. OOS block size = max(15, floor(len * 0.20 / K))
3. Purge gap = 2 * horizon (AR(1) half-life contamination guard)
4. For each fold f = 0, ..., K-1:
   a. testEnd = len - 1 - (K - 1 - f) * oosSize
   b. testStart = testEnd - oosSize + 1
   c. trainEnd = testStart - purgeGap - 1
   d. Clear _resultCache per fold (H-4 FIX: prevent cross-fold contamination)
   e. IS: backtest(candles[0..trainEnd], pType)
   f. OOS: backtest(candles[testStart..testEnd], pType)
   g. Record IS and OOS mean returns
5. WFE = round(avgOOS / avgIS * 100)
6. If |avgIS| < minISEdge (0.3pp): WFE = 0 (insufficient IS edge)
```

**WFE Labels:**

| WFE | Label | Interpretation |
|-----|-------|----------------|
| >= 50% | robust | Strategy transfers well out-of-sample |
| 30-50% | marginal | Some out-of-sample degradation |
| < 30% | overfit | Strategy is likely curve-fitted |
| both IS & OOS negative | negative | Strategy is not viable in either period |

**Constants:**

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| Default folds | 4 (6 if n>=500) | [B] | Bailey & Lopez de Prado (2014) |
| OOS ratio | 20% | [D] | Practitioner convention |
| Min OOS bars | 15 | [D] | Heuristic minimum |
| Min training bars | 60 | [D] | Heuristic minimum |
| Purge gap | 2 * horizon | [B] | AR(1) half-life 6.5 bars > horizon(5) |
| Min IS edge | 0.3pp | [C] | ~KRX round-trip cost (0.25%+0.015%) |
| Min valid folds | 2 | [B] | -- |

**JS Location:** backtester.js:710-793

**Stage ref:** [BT-38](WFE) -> [BT-40](reliability tier gating)

---

### 3.9.2 Reliability Tiers

### [BT-40] Pattern Reliability Tier Classification

**Tier criteria (pattern backtesting):**

| Tier | Criteria | IC Gate |
|------|----------|---------|
| **A** | adjustedSignificant AND wrAlpha >= 5pp AND n >= 100 AND expectancy > 0 AND PF >= 1.3 | IC > 0.02 |
| **B** | adjustedSignificant AND wrAlpha >= 3pp AND n >= 30 AND expectancy > 0 | IC > 0.01 |
| **C** | wrAlpha > 0 AND n >= 30 | -- |
| **D** | Default (none of above) | -- |

**Signal reliability tier (relaxed thresholds):**

| Tier | Criteria | IC Gate |
|------|----------|---------|
| **A** | adjustedSignificant AND wrAlpha >= 3pp AND n >= 50 AND expectancy > 0 AND PF >= 1.1 | IC > 0.02 |
| **B** | adjustedSignificant AND wrAlpha >= 2pp AND n >= 20 AND expectancy > 0 | IC > 0.01 |
| **C** | wrAlpha > 0 AND n >= 20 | -- |
| **D** | Default | -- |

**IC gate rationale (Grinold & Kahn 2000, Qian, Hua & Sorensen 2007):**
- IC = null passes (insufficient data for IC calculation != IC = 0)
- A-tier: IC > 0.02 (non-trivial predictive power)
- B-tier: IC > 0.01 (minimal non-random signal)
- Prevents noise-fit regressions from achieving high tier

**WFE gating (Pardo 2008):**

$$\text{if WFE} < 30 \text{ and tier} \in \{A, B\}: \quad \text{tier} \leftarrow C$$

Overfit patterns are capped at C regardless of in-sample significance.

**Constants:**

| Constant | Value | Grade | Source |
|----------|-------|-------|--------|
| A wrAlpha threshold | 5pp | [D] Heuristic | CFA sample-size guidance |
| A n threshold | 100 | [D] | CFA minimum for reliable proportions |
| A PF threshold | 1.3 | [D] | Practitioner minimum profitable edge |
| A IC threshold | 0.02 | [C] | Qian, Hua & Sorensen (2007) minimal |
| B wrAlpha threshold | 3pp | [D] | -- |
| B n threshold | 30 | [B] | CLT requirement |
| B IC threshold | 0.01 | [C] | Minimal non-random |
| WFE overfit cutoff | 30% | [B] | Pardo (2008) |

**JS Location:** backtester.js:540-588 (pattern), backtester.js:2492-2529 (signal)

**Stage ref:** [BT-14](alpha) + [BT-25](t-stat) + [BT-38](WFE) + [BT-30](IC) -> [BT-40](tier) -> S4/5(tier badge color)

---

### 3.9.3 Multiple Testing Correction

### [BT-41] Benjamini-Hochberg FDR (Benjamini & Hochberg 1995)

**Algorithm:**

```
1. Collect all (pattern, horizon) test pairs with n >= 2
2. Compute approximate p-value for each (Abramowitz & Stegun 26.7.5)
3. Sort by p-value ascending: p_(1) <= p_(2) <= ... <= p_(m)
4. Find k* = max{k : p_(k) <= k * q / m}  (q = 0.05)
5. Reject H0 for all tests with rank <= k*
6. Set adjustedSignificant = true/false per test
```

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| q | FDR level | dimensionless | 0.05 | [A] Standard |
| m | Total number of tests | count | ~195 (39 patterns x 5 horizons) | -- |
| p_(k) | k-th smallest p-value | dimensionless | [0, 1] | -- |

**Why BH-FDR over Holm (FWER):**
Phase G transition (commit be27600): With 195 tests, Holm step-down is
excessively conservative (alpha/195 = 0.00026 for the first test). BH step-up
controls FDR <= 5% with substantially higher statistical power. For exploratory
pattern analysis, controlling the false discovery rate among rejections is more
appropriate than controlling the probability of any single false positive.

**p-value approximation:** Uses Abramowitz & Stegun 26.7.5 normal approximation
to the t-distribution CDF: `z ~ absT * (1 - 1/(4*df)) / sqrt(1 + absT^2/(2*df))`.
Accurate to ~0.01 for df >= 3, sufficient for BH ranking.

**JS Location:** backtester.js:806-855

---

### [BT-42] Hansen SPA Test (Hansen 2005)

**Algorithm:**

```
1. Collect all (pattern, horizon) t-statistics with n >= 10
2. Record observed maximum: T_SPA = max_k(t_k)
3. Hansen improvement: zero out negative-mean strategies (less conservative
   than White Reality Check)
4. Bootstrap null distribution (B = 500):
   For b = 1, ..., B:
     For each strategy k:
       Generate z ~ N(0, 1) via Box-Muller
       bootT_k = z * sqrt(1 + adjustedT_k^2 / n_k)  (variance calibration)
     bootMax_b = max_k(bootT_k)
5. SPA p-value = #{bootMax >= T_SPA} / B
6. Reject H0 (p < 0.05): at least one strategy genuinely beats random entry
```

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| T_SPA | Observed max studentized excess | dimensionless | (-inf, inf) | Hansen (2005) |
| B | Bootstrap replicates | count | 500 | [B] Politis & Romano (1994) |

**H0:** No pattern beats the benchmark (random entry).
**H1:** At least one pattern has genuine superior predictive ability.

**SPA -> reliability tier linkage:**
If SPA fails to reject H0 (p >= 0.05), ALL tier A and B patterns are demoted to C.
This prevents any individual pattern from claiming significance when the entire
strategy pool fails the omnibus data-snooping test.

**JS Location:** backtester.js:868-940

---

### [BT-43] Cornish-Fisher t-Critical Approximation (Cornish & Fisher 1937)

**Step 1: Standard Normal Quantile (Abramowitz & Stegun 26.2.23)**

$$z_p = t - \frac{c_0 + c_1 t + c_2 t^2}{1 + d_1 t + d_2 t^2 + d_3 t^3}$$

where $t = \sqrt{-2 \ln(1 - p)}$, with coefficients:

| Coefficient | Value | Source |
|-------------|-------|--------|
| c_0 | 2.515517 | Hastings (1955) |
| c_1 | 0.802853 | -- |
| c_2 | 0.010328 | -- |
| d_1 | 1.432788 | -- |
| d_2 | 0.189269 | -- |
| d_3 | 0.001308 | -- |

Accuracy: |error| < 4.5e-4 for all p.

**Step 2: Cornish-Fisher Expansion**

$$t_{\nu} \approx z + \frac{z^3 + z}{4\nu} + \frac{5z^5 + 16z^3 + 3z}{96\nu^2}$$

Accuracy:
- df >= 30: |error| < 0.001 (practically exact)
- df >= 10: |error| < 0.01 (usable)
- df < 3: unreliable (returns Infinity as guard)

**JS Location:** backtester.js:956-992

**Stage ref:** S2_formula_appendix(S-16 Cornish-Fisher) -> [BT-43](implementation) -> [BT-25](t-crit)

---

### 3.9.4 Mincer-Zarnowitz Regression

See [BT-33] above for the full Mincer-Zarnowitz specification. The calibration test
provides three key diagnostics:

1. **slope**: Should be ~1.0. slope < 1 indicates predictions are too extreme
   (pattern overshoots actual outcomes). slope > 1 indicates predictions are
   too conservative.

2. **intercept**: Should be ~0. Non-zero intercept indicates systematic bias
   in the prediction model.

3. **R-squared**: Proportion of actual return variance explained by predictions.
   Per Lo & MacKinlay (1999), R^2 = 0.02-0.03 is economically significant for
   financial returns; R^2 > 0.05 is exceptional.

**JS Location:** backtester.js:1642-1701

---

## 3.10 LinUCB Adaptive RL

---

### 3.10.1 Context Vector and Action Space

### [BT-50] LinUCB 7-Dimensional Context Vector (Li et al. 2010)

**Feature vector:**

| Dim | Feature | Description | Normalization | Source |
|-----|---------|-------------|---------------|--------|
| 0 | ewma_vol | EWMA volatility (lambda=0.94) | z-scored (mu~0.027, sigma~0.018) | RiskMetrics |
| 1 | pred_magnitude | abs(WLS predicted) / pred_std | clamped [0, 3] | -- |
| 2 | signal_dir | buy=1, sell=-1, neutral=0 | discrete | Pattern META |
| 3 | market_type | KOSDAQ=1, KOSPI=0 | binary | Stock market |
| 4 | pattern_tier | Tier1=-1, Tier2=0, Tier3=1 | discrete | _rlTier1/3 sets |
| 5 | confidence_norm | confidencePred / 100 | [0, 1] | Pattern confidence |
| 6 | raw_hurst | R/S Hurst exponent | z-scored (mu~0.612, sigma~0.133) | calcHurst() |

**Normalization source:** `rl_policy.normalization` (trained statistics). If stale
(price-level H mean > 0.80), falls back to hardcoded returns-based statistics.

**EWMA volatility computation (dim 0):**

$$\sigma^2_t = 0.94 \cdot \sigma^2_{t-1} + 0.06 \cdot r_t^2, \quad r_t = \ln(P_t / P_{t-1})$$

Uses last 80 bars. z-scored against training distribution.

**JS Location:** backtester.js:348-407

---

### [BT-51] LinUCB Action Space and Score Function

**Action space (5 multiplicative factors):**

$$K = 5, \quad a_k \in \{0.5, 0.75, 1.0, 1.25, 1.5\} \quad \text{(typical)}$$

**Greedy score (exploration dropped in JS):**

$$\text{score}(a) = \theta_a[0] + \sum_{j=0}^{d-1} \theta_a[j+1] \cdot x[j]$$

$$a^* = \arg\max_a \text{score}(a)$$

$$\hat{R}_{\text{adjusted}} = \hat{R}_{\text{WLS}} \times \text{action\_factors}[a^*]$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| theta_a | Weight vector for action a | dimensionless | -- | rl_policy.json |
| K | Number of actions | count | 5 | -- |
| d | Context dimension | count | 7 | -- |

**Design decision:** Exploration term alpha * sqrt(x' A^{-1} x) is dropped in JS
(greedy-only). Full UCB with exploration is computed in `rl_linucb.py` during
offline training. Rationale: exploitation-only is appropriate for production
inference where exploration cost (real money) is unacceptable.

**LinUCB is a contextual bandit (Li et al. 2010), NOT an MDP.** Single-step
action selection; no Bellman equation or temporal credit assignment.

**JS Location:** backtester.js:413-425

---

### 3.10.2 Policy Loading and Safety Gates

### [BT-52] RL Policy Safety Gates

| Gate | Condition | Action | Grade |
|------|-----------|--------|-------|
| IC threshold | mean_ic_adjusted < 0 | Reject entire policy (anti-predictive) | [A] |
| t_stat_delta | < 2.0 | Skip LinUCB, use Ridge-only | [C] |
| Staleness | trained_date > 90 days | Console warning | [D] |
| Dimension mismatch | policy.d != feature_dim | Console warning | [B] |
| Safety clamp | abs(factor) > 3.0 | Clamp to +/-3.0 | [D] |

**IC rejection rationale:** IC < 0 means the policy's return predictions are
inversely correlated with actual outcomes. All sub-data (isotonic calibration,
Platt scaling, composite windows) were calibrated under the same regime and are
equally suspect. However, win_rates_live (Beta-Binomial posteriors) are
IC-independent empirical observations and are still injected.

**t_stat_delta gate:** The key operational gate. If the RL adjustment's t-statistic
of improvement over Ridge-only is < 2.0, LinUCB context building (computationally
expensive) is skipped entirely. Current status: t_stat_delta = -0.1518
(NOT SIGNIFICANT) -- Ridge-only mode is active.

**JS Location:** backtester.js:244-301 (loading), backtester.js:902-921 (application)

---

### 3.10.3 Beta-Binomial Live Win Rate Update

### [BT-53] Beta-Binomial Posterior Mean (Bayes 1763)

**Formula:**

$$\text{WR}_{\text{live}} = \frac{\alpha}{\alpha + \beta} \times 100$$

where alpha and beta are the posterior parameters of the Beta distribution,
updated from the conjugate Beta-Binomial model:

$$\alpha_{\text{post}} = \alpha_{\text{prior}} + \text{wins}$$
$$\beta_{\text{post}} = \beta_{\text{prior}} + \text{losses}$$

| Symbol | Name | Unit | Range | Source |
|--------|------|------|-------|--------|
| alpha | Beta shape parameter (wins) | count | (0, inf) | rl_policy.win_rates_live |
| beta | Beta shape parameter (losses) | count | (0, inf) | rl_policy.win_rates_live |
| WR_live | Posterior mean win rate | % | (0, 100) | Bayes (1763) |

**Injection:** Even when LinUCB policy is rejected (IC < 0), `win_rates_live`
posteriors are injected into `PatternEngine.PATTERN_WIN_RATES_LIVE` because they
are IC-independent empirical data. The posteriors provide adaptive shrinkage of
pattern win rates toward the prior (uninformative: alpha=beta=1 -> WR=50%).

**JS Location:** backtester.js:263-272, backtester.js:289-298

**Stage ref:** S1(rl_policy.json) -> S2.1(M-1 Bayes) -> [BT-53](posterior) -> S3.1-3.7(pattern WR)

---

### 3.10.4 Survivorship Bias Correction

### [BT-54] Survivorship Bias Correction (Elton, Gruber & Blake 1996)

**Model:**

$$\text{WR}_{\text{corrected}} = \text{WR}_{\text{observed}} - \Delta_{\text{surv}}$$

**Data source:** `data/backtest/survivorship_correction.json`, generated by
`compute_survivorship_correction.py` which:

1. Identifies 308 delisted stocks from KRX historical data (Phase D-1)
2. Runs pattern detection on pre-delisting OHLCV data
3. Computes per-pattern, per-horizon delta_wr between delisted and surviving
   stock universes
4. Reports global median: ~0.10pp (buy patterns biased by +1-11pp depending
   on pattern type)

**Priority cascade:**
1. Per-pattern per-horizon delta (requires n_delisted >= 30 for CLT)
2. Per-horizon delta
3. Global median delta
4. Zero fallback (no correction data loaded)

**Critical distinction:**
- **correctedWR** (absolute): WR_observed - delta_surv. For cross-market comparison.
- **wrAlpha** (relative): WR_observed - WR_null. NOT corrected because both
  WR_observed and WR_null share the same survivorship bias (same stock universe).
  The bias cancels in the difference.

**JS Location:** backtester.js:120-157 (loading), backtester.js:1421-1424 (application)

**Stage ref:** S1(survivorship_correction.json) -> [BT-54](correction) -> [BT-15](correctedWR)

---

## Backtest Findings

### Validated Methodologies (VALID)

1. **[BT-02] Entry at next-bar open:** Correctly eliminates look-ahead bias per Aronson (2007). VALID.

2. **[BT-04] Horizon-scaled costs:** Kyle (1985) sqrt-time slippage scaling is theoretically and empirically justified. Fixed cost amortization over h is correct. The P0 fix (replacing flat 0.07% with horizon-adaptive costs) corrected a 112% overestimate at h=5. VALID.

3. **[BT-11] HC3 implementation:** Verified against canonical WLS HC3 form (Davidson & MacKinnon 1993). The meat matrix computation correctly applies w^2 * e^2 / (1-h_ii)^2 weighting. Long & Ervin (2000) confirm HC3 is optimal for n=30-300. VALID.

4. **[BT-13] Null WR computation:** Sullivan, Timmermann & White (1999) unconditional base rate as proper null hypothesis. Transaction costs correctly deducted. Cache key uses integer-rounded prices (KRX integer price fix). VALID.

5. **[BT-14] wrAlpha = WR - wrNull:** Correctly recenters significance relative to market drift. The distinction between absolute correction (survivorship) and relative alpha is statistically sound. VALID.

6. **[BT-16] Cohen's h:** Uses wrNull/100 as the null proportion (M-3 FIX), not hardcoded 0.5. This is the correct null hypothesis for effect size computation. VALID.

7. **[BT-20] Sortino denominator:** H-1 FIX correctly uses N_total (not N_negative) per Sortino & van der Meer (1991). P0-1 FIX correctly uses h (not h-1) for annualization. VALID.

8. **[BT-21] IR benchmark:** H-2 FIX computes unconditional mean return independently (`_computeNullMeanReturn`), eliminating circular dependence. VALID.

9. **[BT-29] Calendar-time bootstrap:** Fama & French (2010) calendar-month resampling preserves within-month dependence. BCa correction (Efron 1987) improves coverage accuracy. Winsorization at 1%/99% addresses KRX heavy tails. VALID.

10. **[BT-38] WFE purge gap:** 2 * horizon purge (Bailey & Lopez de Prado 2014) prevents AR(1) contamination between IS and OOS periods. H-4 FIX clears result cache per fold. VALID.

11. **[BT-41] BH-FDR:** Correctly implements step-up procedure (Benjamini & Hochberg 1995). FDR control is appropriate for exploratory pattern analysis with 195 simultaneous tests. VALID.

12. **[BT-43] Cornish-Fisher:** 2nd-order expansion is accurate to ~0.001 for df >= 30, which covers the n >= 30 WLS requirement. VALID.

---

### Concerns and Warnings

1. **[WARNING] [BT-06] n/k ratio = 6:** With 5 features and minimum n=30, the n/k ratio of 6 is below the recommended 10-20 (Green 1991). Ridge regularization partially mitigates this, but coefficient estimates may be unstable at n~30. Consider raising the minimum n to 50 for WLS regression.

2. **[WARNING] [BT-10] Huber delta = 5.8 from KRX MAD assumption:** The delta is calibrated assuming sigma ~ 4.3% from KRX 5-day returns. This is an aggregate statistic; individual stock volatilities vary from ~1% (Samsung) to ~15% (KOSDAQ penny stocks). A per-stock MAD-calibrated delta would be more robust but computationally expensive.

3. **[WARNING] [BT-35] Composite score weights lack calibration:** The 0.30/0.25/0.25/0.20 weights and scaling factors (MAE*10, PF*20) are purely heuristic. No optimization, sensitivity analysis, or cross-validation has determined whether these weights produce meaningful grade separations. Grade boundaries (80/65/50/35) are also uncalibrated.

4. **[WARNING] [BT-37] Regime boundaries hw=1.1/0.9:** The +/-10% thresholds for regime classification have no published source. Sensitivity to these thresholds is unknown. The n >= 30 per-bucket requirement may result in null regimeWR for most patterns (few observations in trending/reverting buckets when overall n is modest).

5. **[WARNING] [BT-42] SPA bootstrap calibration:** The Hansen SPA implementation uses a parametric normal bootstrap for the null distribution rather than a time-dependent stationary bootstrap (Politis & Romano 1994). For serially dependent pattern returns, this may understate the SPA p-value. The variance calibration term `sqrt(1 + adjustedT^2/n)` is a practical approximation, not derived from the original Hansen (2005) specification.

---

### Critical Findings

1. **[CRITICAL] [BT-52] LinUCB is inactive:** t_stat_delta = -0.1518 means the RL adjustment provides no statistically significant improvement over Ridge-only. The entire LinUCB pathway (7-dim context, 5 actions) is dead code in production. The IC threshold gate also rejects policies with IC < 0. This is **correctly handled** by the safety gates -- the code gracefully falls back to Ridge-only. Not a bug, but documentation should explicitly state that LinUCB is a research pathway, not a production-active component.

2. **[CRITICAL] [BT-30] Rolling OOS IC limitation:** The OOS IC computation uses non-overlapping windows of 12 pairs. For a pattern with n=30 occurrences, this yields only 1-2 OOS windows, which is insufficient for reliable IC estimation. The fallback to full-sample IC (flagged isOOS=false) reintroduces the in-sample bias that the OOS procedure was designed to eliminate. Recommend requiring minWindow = max(12, n/5) to ensure at least 4-5 OOS windows for meaningful averaging.

3. **[CRITICAL] [BT-54] wrAlpha survivorship cancellation assumption:** The claim that survivorship bias cancels in wrAlpha (WR_observed - WR_null) assumes both WR_observed and WR_null are computed on exactly the same surviving stock universe. This is true within a single stock (both use the same candle array). However, if wrAlpha is ever aggregated across stocks (e.g., "average wrAlpha for bullishEngulfing across all stocks"), the cancellation no longer holds perfectly because different stocks have different survival dates and the null WR is stock-specific. Cross-stock aggregation would require per-stock correction.

---

### Statistical Power Assessment

For the primary evaluation horizon (h=5) with the median candle pattern sample size:

| Pattern Category | Median n | MDE (%) | Power to detect 2pp alpha | Adequate? |
|-----------------|----------|---------|---------------------------|-----------|
| Candle (single) | ~5,000 | 0.06 | > 0.999 | Yes |
| Candle (double) | ~1,500 | 0.11 | > 0.999 | Yes |
| Candle (triple) | ~800 | 0.15 | > 0.99 | Yes |
| Chart patterns | ~50-200 | 0.6-1.4 | 0.30-0.80 | Marginal |
| Rare patterns | ~10-50 | 1.5-4.0 | < 0.30 | No |

Chart patterns and rare patterns have insufficient statistical power to reliably
detect economically meaningful effects. For these, the Bulkowski (2005, 2012)
fallback statistics serve as the primary estimate, with empirical data providing
directional confirmation only.

---

### Constants Sensitivity Summary

| Constant | Value | Sensitivity | Calibration Status |
|----------|-------|-------------|-------------------|
| lambda (decay) | 0.995 | HIGH | [A] Academically justified |
| HUBER_DELTA | 5.8 | HIGH | [C] Aggregate calibration; per-stock preferred |
| Composite weights | 0.30/0.25/0.25/0.20 | HIGH | [D] Uncalibrated heuristic |
| Tier A wrAlpha | 5pp | HIGH | [D] Practitioner convention |
| Tier A n | 100 | MEDIUM | [D] CFA guidance |
| Tier A PF | 1.3 | MEDIUM | [D] Practitioner minimum |
| WFE cutoff | 30% | MEDIUM | [B] Pardo (2008) |
| Ridge GCV fallback | 1.0 | MEDIUM | [C] Heuristic |
| SPA bootstrap B | 500 | LOW | [B] Standard |
| Bootstrap B | 500 | LOW | [B] Standard |
| HLZ threshold | 3.0 | LOW | [A] Published standard |
