# ANATOMY V8 — Academic Framework

> Theoretical coherence document for CheeseStock KRX Live Chart.
> Maps every implemented formula to its academic discipline, citation, and core_data document.
> Version: V8 (2026-04-08). Consumed by Phase 2 content agents.

---

## 1. Discipline Classification Matrix

### 1.1 Discipline Hierarchy

The 47 core_data documents form a dependency chain from foundational to applied:

```
[L0] Physics (03)
  |
  v
[L1] Mathematics (01, 10, 13)
  |
  v
[L2] Statistics (02, 12, 17, 34)
  |        \
  v         v
[L3] Economics (09, 29-33)    Psychology (04, 18, 19, 24, 39)
  \          |                     |
   \         v                     v
    \     Microstructure (18, 20, 36)
     \       |
      v      v
[L4] Finance Theory (05, 14, 23, 25-28, 35, 42-47)
         |
         v
[L5] Technical Analysis (06, 07, 16)
         |
         v
[L6] Machine Learning & Backtesting (11, 11B, 15, 17, 21, 22)
```

### 1.2 Document-Discipline Assignment (47 docs)

| Doc# | Title | Primary Discipline | Sub-discipline | Key Theories | Downstream Formulas |
|------|-------|--------------------|----------------|--------------|---------------------|
| 01 | Mathematics | Mathematics | Probability, Stochastic Processes, Fractals | Brownian motion, Ito calculus, Mandelbrot fractals, Fourier/Wavelet, Chaos | calcMA, calcEMA, calcBB, calcHurst |
| 02 | Statistics | Statistics | Time Series, Regression, Bayesian | ARIMA, GARCH, OLS/WLS, HC3, Bootstrap, MC simulation | calcWLSRegression, calcOLSTrend, _spearmanCorr |
| 03 | Physics | Physics/Econophysics | Statistical Mechanics, Power Laws, Entropy | Boltzmann, Mandelbrot scaling, SOC, Phase transitions | calcHillEstimator, calcHurst (R/S analysis) |
| 04 | Psychology | Behavioral Psychology | Prospect Theory, Herd Behavior, Cognitive Bias | Kahneman-Tversky (1979), Shiller, Market Psychology Cycles | PATTERN_WR_KRX anti-predictor gate, composite signal weights |
| 05 | Finance Theory | Finance | EMH, MPT, CAPM, BSM | Markowitz (1952), Sharpe (1964), Black-Scholes (1973), Fama (1970) | calcCAPMBeta, KRX_TRADING_DAYS annualization |
| 06 | Technical Analysis | Applied Finance/TA | Dow Theory, Elliott, Candlestick, S/R | Dow (1900), Elliott (1938), Nison (1991), Murphy (1999) | patternEngine.analyze, _detectTrend |
| 07 | Pattern Algorithms | Applied Mathematics | Swing Points, Trendline Fitting, Quality Scores | Harmonic ratios, Markov chain pattern combinations | patternEngine (all pattern detection methods) |
| 08 | References | Bibliography | — | Comprehensive citation list | All formulas (reference only) |
| 09 | Game Theory | Economics/Game Theory | Nash Equilibrium, Auction Theory, Signaling | Nash (1950), Vickrey (1961), Spence (1973) | Not directly implemented (theoretical foundation) |
| 10 | Optimal Control | Mathematics | HJB, Kalman Filter, Pontryagin | Kalman (1960), Merton (1971), Almgren-Chriss (2001) | calcKalman (adaptive Q variant) |
| 11 | Reinforcement Learning | Machine Learning | MDP, Q-learning, DQN, PPO | Sutton-Barto (2018), Li et al. (2010) LinUCB | _applyLinUCBGreedy, _buildRLContext |
| 11B | RL Advanced | Machine Learning | Multi-agent RL, IRL, MAML, Safe RL | Foerster (2018), Finn (2017), Achiam (2017) | Not directly implemented (future roadmap) |
| 12 | Extreme Value Theory | Statistics | GEV, POT/GPD, Black Swans, Tail Risk | Fisher-Tippett-Gnedenko, Pickands (1975), Hill (1975) | calcHillEstimator, calcGPDFit, bbEVT |
| 13 | Information Geometry | Mathematics | Fisher Information, KL Divergence, Transfer Entropy | Amari (1985), Kullback-Leibler, Schreiber (2000) | Not directly implemented (future regime detection) |
| 14 | Finance Management | Finance/Corporate | DCF, Capital Structure, Ergodic Econ, Kelly, Risk Mgmt | MM (1958), Kelly (1956), Sharpe/Sortino/Calmar ratios | updateFinancials (PER/PBR/PSR/ROE), _calcJensensAlpha |
| 15 | Advanced Patterns (ML) | Machine Learning | CNN/LSTM/Attention, Transfer Learning, SHAP | LeCun (1989), Hochreiter (1997), Lundberg (2017) | Not implemented (future ML pipeline) |
| 16 | Pattern Reference | Applied TA | 42-pattern catalog, color system, marker rules | Nison (1991), Bulkowski (2005) | _META mapping, PATTERN_ACADEMIC_META |
| 17 | Regression Backtesting | Statistics | WLS, HC3, Multiple Hypothesis Testing, Walk-Forward | White (1980), MacKinnon-White (1985), Pardo (2008) | calcWLSRegression, walkForwardTest, _applyBHFDR |
| 18 | Behavioral Microstructure | Finance/Microstructure | Kyle Model, VPIN, Liquidity Asymmetry | Kyle (1985), Easley-Lopez de Prado (2012) | calcAmihudILLIQ, _getAdaptiveSlippage |
| 19 | Social Network Effects | Psychology/Sociology | Information Cascades, Sentiment, Herding | Bikhchandani-Hirshleifer-Welch (1992), KR-FinBERT | csad_herding behavioral data loading |
| 20 | KRX Structural Anomalies | Applied Finance/KRX | Price Limits, T+2, Foreign Flow, Calendar | KRX-specific structural features | _SHORT_BAN_PERIODS, KRX_TRADING_DAYS=250 |
| 21 | Adaptive Pattern Modeling | Statistics/ML | AMH, HMM, Strategy Half-life, CUSUM | Lo (2004), Hamilton (1989), Page (1954) | calcOnlineCUSUM, calcBinarySegmentation, hmm_regimes loading |
| 22 | Learnable Constants Guide | Methodology | 5-Tier A/B/C/D/E Classification, Calibration | Constant governance framework | All [A]-[E] tagged constants |
| 23 | APT Factor Model | Finance | Ross APT, Fama-French, CZW MRA | Ross (1976), Fama-French (1993/2015) | FF3 factor construction (#168-#171) |
| 24 | Behavioral Quantification | Behavioral Finance | Fear-Greed Index, Disposition Effect, Herding | Odean (1998), Shefrin-Statman (1985) | disposition_proxy data, CSAD herding |
| 25 | CAPM Delta Covariance | Finance | CAPM Integration, Factor Delta, Covariance | Sharpe (1964), Ledoit-Wolf (2004) | calcCAPMBeta, _loadCAPMBeta |
| 26 | Options Volatility Signals | Derivatives/Finance | BSM Greeks, VKOSPI Regime, IV/HV, PCR, GEX, FG v2 | Whaley (2009), Bollen-Whaley (2004), Simon-Wiggins (2001) | _classifyVolRegimeFromVKOSPI, IV/HV discount, VIX_VKOSPI_PROXY |
| 27 | Futures Basis Program Trading | Derivatives | Cost-of-Carry, Basis, OI, Expiry Effect | Bessembinder-Seguin (1993), Stoll-Whaley (1987) | _detectBasisSignal, _isNearExpiry discount |
| 28 | Cross-Market Correlation | Finance/Macro | DCC-GARCH, VIX Transmission, USD/KRW | Engle (2002), DCC-GARCH, Mundell-Fleming | USD/KRW export channel, crisis severity |
| 29 | Macro Sector Rotation | Economics/Finance | Business Cycle, PMI, MCS, Event Calendar | Stovall (1996), OECD CLI | _STOVALL_CYCLE, MCS v1/v2, _applyMacroConfidence |
| 30 | Macroeconomics IS-LM AD-AS | Economics | IS-LM, Mundell-Fleming, AD-AS, Taylor Rule | Hicks (1937), Mundell (1963), Taylor (1993) | Taylor gap adjustment, rate_diff, cli_cci_gap |
| 31 | Microeconomics Market Signals | Economics | Supply-Demand, Walrasian, Elasticity, Market Structure | Marshall, Walras, Herfindahl-Hirschman | HHI boost, _updateMicroContext |
| 32 | Search Attention Pricing | Economics/Behavioral | Stigler Search, Attention Budget, Network Externalities | Stigler (1961), Peng-Xiong (2006), Barber-Odean (2008) | calcADVLevel, calcAttentionState (planned) |
| 33 | Agency Costs Industry Concentration | Economics/Corporate | Jensen-Meckling, Holmstrom, HHI, Coase | Jensen-Meckling (1976), HHI antitrust | HHI_MEAN_REV_COEFF, eps_stability mediator |
| 34 | Volatility Risk Premium HAR-RV | Statistics/Finance | Bollerslev VRP, Corsi HAR-RV, Merton Jump-Diffusion | Bollerslev (2009), Corsi (2009), Merton (1976) | calcHAR_RV, calcVRP, calcEWMAVol, classifyVolRegime |
| 35 | Bond Signals Yield Curve | Fixed Income/Finance | NSS Yield Curve, Credit Spread, Merton DD, Rate Beta | Nelson-Siegel-Svensson, Gilchrist-Zakrajsek (2012) | Yield curve 4-regime, credit regime, _calcNaiveDD, _RATE_BETA |
| 36 | Futures Microstructure OI | Derivatives/Microstructure | OI-Price 4-Quadrant, Hasbrouck, Expiry | Bessembinder-Seguin (1993), Hasbrouck (1995) | Basis signal (excessBasisPct), OI analysis |
| 37 | Options IV Surface Skew | Derivatives | SVI, Skew, GEX, UOA, Term Structure | Gatheral (2006), CBOE SKEW methodology | IV skew signals, GEX dealer positioning |
| 38 | ETF Ecosystem Fund Flow | Finance/ETF | Creation/Redemption, Leverage Sentiment, Flow | Cheng-Madhavan (2009), Petajisto (2017) | ETF sentiment contrarian, leverage ratio |
| 39 | Investor Flow Information | Finance/Microstructure | Grossman-Stiglitz, Kyle 3-Type, Foreign Flow | Grossman-Stiglitz (1980), Kang-Stulz (1997) | Flow alignment signal, foreignMomentum bonus |
| 40 | Short Selling Securities Lending | Finance | Miller Overvaluation, Diamond-Verrecchia, Short Squeeze | Miller (1977), Diamond-Verrecchia (1987), Lamont-Thaler (2003) | Short ratio regime, _SHORT_BAN_PERIODS |
| 41 | Bond-Equity Relative Value | Finance/Cross-Asset | Fed Model, ERP, RORO, Credit Cycle, BOK Event | Baele-Bekaert-Inghelbrecht (2010), Gilchrist-Zakrajsek | _classifyRORORegime, ERP z-score, credit cycle |
| 42 | Advanced Asset Pricing | Finance Theory | Sharpe Single-Index, Zero-Beta, ICAPM, CCAPM, APT, FF5 | Sharpe (1963), Black (1972), Merton (1973), Ross (1976) | CAPM beta annualization, factor model framework |
| 43 | Corporate Finance Advanced | Corporate Finance | Miller Tax, Agency Cost Capital Structure, Signaling | Miller (1977), Jensen-Meckling (1976), Ross (1977) | EVA display, PI/MIRR/EAA capital budgeting |
| 44 | Bond Pricing Duration | Fixed Income | Coupon Pricing, YTM, Duration, DV01, Convexity, Immunization | Macaulay (1938), Redington (1952), Newton-Raphson | DV01 calculation, bond metrics display |
| 45 | Options Pricing Advanced | Derivatives | CRR Binomial, American Options, Exotic, Heston, Local Vol | Cox-Ross-Rubinstein (1979), Heston (1993), Dupire (1994) | Real options framework (theoretical) |
| 46 | Options Strategies | Derivatives/Applied | Vanilla Payoffs, Greeks Dynamics, Gamma Scalping, Straddle | Black-Scholes Greeks, Straddle Implied Move | straddleImpliedMove confidence adjustment |
| 47 | Credit Risk Models | Credit Risk | Merton Structural, KMV, Jarrow-Turnbull, Basel IRB | Merton (1974), Bharath-Shumway (2008), Vasicek (2002) | _calcNaiveDD, EDF calculation, DD confidence penalty |

### 1.3 Discipline Distribution

| Discipline | Doc Count | Docs |
|------------|-----------|------|
| Mathematics | 3 | 01, 10, 13 |
| Statistics | 4 | 02, 12, 17, 34 |
| Physics/Econophysics | 1 | 03 |
| Psychology/Behavioral | 5 | 04, 18, 19, 24, 39 |
| Economics (Macro/Micro) | 5 | 09, 29, 30, 31, 32, 33 |
| Finance Theory | 9 | 05, 14, 23, 25, 28, 35, 42, 43, 44 |
| Derivatives | 5 | 26, 27, 36, 37, 45, 46 |
| Credit/Fixed Income | 2 | 41, 47 |
| Market Microstructure | 3 | 18, 20, 38, 40 |
| Technical Analysis | 3 | 06, 07, 16 |
| Machine Learning | 4 | 11, 11B, 15, 21 |
| Methodology/Reference | 2 | 08, 22 |

---

## 2. Formula-Discipline Mapping Table

### 2.1 Technical Indicators (indicators.js)

| Formula ID | Name | Function | Academic Discipline | Key Paper | core_data | Tier |
|------------|------|----------|---------------------|-----------|-----------|------|
| I-1 | Simple Moving Average | `calcMA(data, n)` | Mathematics | — (arithmetic mean) | 01 | [A] |
| I-2 | Exponential Moving Average | `calcEMA(data, n)` | Mathematics/Statistics | Brown (1956) exponential smoothing | 01, 02 | [A] |
| I-3 | Bollinger Bands | `calcBB(closes, n, mult)` | Statistics | Bollinger (2001), population sigma /n | 02 | [A] |
| I-3E | EVT-aware Bollinger Bands | `IndicatorCache.bbEVT()` | Statistics/EVT | Gopikrishnan (1999), Hill (1975) | 12 | [B] |
| I-4 | RSI (Wilder) | `calcRSI(closes, period)` | Technical Analysis | Wilder (1978) "New Concepts in TA" | 06 | [A] |
| I-5 | ATR | `calcATR(candles, period)` | Technical Analysis | Wilder (1978) True Range | 06 | [A] |
| I-6 | OBV | `calcOBV(candles)` | Technical Analysis | Granville (1963), Murphy (1999) Ch.7 | 06 | [A] |
| I-7 | Ichimoku Cloud | `calcIchimoku(candles, ...)` | Technical Analysis | Hosoda (1969) Ichimoku Kinko Hyo | 06 | [A] |
| I-8 | Kalman Filter | `calcKalman(closes, Q, R)` | Optimal Control/Engineering | Kalman (1960); adaptive Q: Mohamed-Schwarz (1999) | 10 | [B] |
| I-9 | Hurst Exponent (R/S) | `calcHurst(closes, minWindow)` | Physics/Fractals | Mandelbrot (1963); Peters (1994) Ch.4 | 01, 03 | [A] |
| I-10 | Hill Tail Estimator | `calcHillEstimator(returns, k)` | Statistics/EVT | Hill (1975); Drees-Kaufmann (1998) k-selection | 12 | [A] |
| I-11 | GPD Tail Fit | `calcGPDFit(returns, quantile)` | Statistics/EVT | Pickands (1975); McNeil-Frey (2000) | 12 | [A] |
| I-12 | CAPM Beta | `calcCAPMBeta(stock, market, window, rf)` | Finance Theory | Sharpe (1964), Fama-MacBeth (1973) | 05, 25, 42 | [A] |
| I-13 | Historical Volatility | `calcHV(candles, period)` | Statistics | Parkinson (1980) close-to-close HV | 02, 34 | [A] |
| I-14 | VRP | `calcVRP(vkospi, hvAnnualized)` | Finance/Derivatives | Bollerslev (2009) Variance Risk Premium | 34 | [B] |
| I-15 | WLS Regression | `calcWLSRegression(X, y, w, lambda)` | Statistics | Aitken (1935) GLS; Hoerl-Kennard (1970) Ridge | 02, 17 | [A] |
| I-15a | HC3 Robust SE | (within calcWLSRegression) | Statistics | White (1980); MacKinnon-White (1985) | 17 | [A] |
| I-15b | VIF Diagnostic | (within calcWLSRegression) | Statistics | Marquardt (1970); Belsley-Kuh-Welsch (1980) | 02 | [A] |
| I-16 | GCV Lambda Selection | `selectRidgeLambdaGCV(X, y, w, p)` | Statistics | Golub-Heath-Wahba (1979) | 17 | [A] |
| I-16a | Jacobi Eigendecomposition | `_jacobiEigen(A, p)` | Mathematics/Numerical | Jacobi (1846), Golub-Van Loan (2013) | 01 | [A] |
| I-17 | OLS Trendline | `calcOLSTrend(closes, window, atr)` | Statistics | Lo-MacKinlay (1999) R-squared trend detection | 02, 17 | [B] |
| I-18 | Matrix Inversion | `_invertMatrix(m)` | Mathematics | Gauss-Jordan elimination with partial pivoting | 01 | [A] |
| I-19 | MACD | `calcMACD(closes, fast, slow, sig)` | Technical Analysis | Appel (1979) | 06 | [A] |
| I-20 | Stochastic Oscillator | `calcStochastic(candles, kP, dP, smooth)` | Technical Analysis | Lane (1984) Slow %K/%D | 06 | [A] |
| I-21 | Stochastic RSI | `calcStochRSI(closes, ...)` | Technical Analysis | Chande-Kroll (1994) | 06 | [A] |
| I-22 | CCI | `calcCCI(candles, period)` | Technical Analysis | Lambert (1980) | 06 | [A] |
| I-23 | ADX/+DI/-DI | `calcADX(candles, period)` | Technical Analysis | Wilder (1978) Directional Movement | 06 | [A] |
| I-24 | Williams %R | `calcWilliamsR(candles, period)` | Technical Analysis | Williams (1979) | 06 | [A] |
| I-25 | Theil-Sen Estimator | `calcTheilSen(xValues, yValues)` | Robust Statistics | Theil (1950), Sen (1968) | 07 | [A] |
| I-26 | EWMA Volatility | `calcEWMAVol(closes, lambda)` | Finance/Risk | J.P. Morgan RiskMetrics (1996); Bollerslev (1986) IGARCH | 34 | [B] |
| I-27 | Vol Regime Classification | `classifyVolRegime(ewmaVol)` | Finance/Regime | Long-run EMA ratio (practitioner convention) | 34, 21 | [C] |
| I-28 | Amihud ILLIQ | `calcAmihudILLIQ(candles, window)` | Market Microstructure | Amihud (2002) illiquidity ratio | 18 | [A] |
| I-29 | Online CUSUM | `calcOnlineCUSUM(returns, threshold, volRegime)` | Statistics/Quality Control | Page (1954); Roberts (1966) ARL optimization | 21 | [A] |
| I-30 | Binary Segmentation | `calcBinarySegmentation(returns, maxBreaks, minSeg)` | Statistics | Bai-Perron (1998) BIC-based breakpoints | 21 | [B] |
| I-31 | HAR-RV Model | `calcHAR_RV(candles)` / `IndicatorCache.harRV(idx)` | Finance/Volatility | Corsi (2009) Heterogeneous Autoregressive | 34 | [A] |

### 2.2 Pattern Detection (patterns.js)

| Formula ID | Name | Detection Method | Academic Discipline | Key Paper | core_data |
|------------|------|-----------------|---------------------|-----------|-----------|
| P-1..P-9 | Single Candle (9 types) | Body/shadow ratio + ATR normalization | Technical Analysis | Nison (1991) "Japanese Candlestick Charting" | 06, 07 |
| P-10..P-15 | Double Candle (6 types) | 2-bar relationship + trend context | Technical Analysis | Nison (1991), Bulkowski (2005) | 06, 07 |
| P-16..P-19 | Triple Candle (4 types) | 3-bar reversal patterns | Technical Analysis | Nison (1991), Morris (2006) | 06, 07 |
| P-20..P-28 | Chart Patterns (9 types) | Swing point detection + trendline fitting | Mathematics/TA | Edwards-Magee (1948), Levy (1971) | 07 |
| P-29 | Support/Resistance | ATR*0.5 clustering, min 2 touches | Mathematics/Microstructure | Osler (2000), Doc07 1.3 | 07 |
| P-30 | Confluence (S/R + Pattern) | S/R proximity within ATR | Applied Statistics | Multi-factor confirmation | 07 |
| P-31 | ATR Normalization | All thresholds / ATR(14) | Statistics | Wilder (1978) volatility normalization | 06 |
| P-32 | Quality Score | Trend context + volume + ATR-weighted | Applied Statistics | Bulkowski (2005) pattern quality metrics | 07 |
| P-33..P-40+ | Extended Patterns (8+ types) | Belt Hold, Harami Cross, Abandoned Baby, etc. | Technical Analysis | Nison (1991), Morris (2006) | 06, 16 |

### 2.3 Signal Engine (signalEngine.js)

| Formula ID | Name | Method | Academic Discipline | Key Paper | core_data |
|------------|------|--------|---------------------|-----------|-----------|
| S-1 | MA Crossover | MA(5) vs MA(20) golden/dead cross | Technical Analysis | Murphy (1999) Ch.9 | 06 |
| S-2 | MA Alignment | MA(5) > MA(20) > MA(60) | Technical Analysis | Multiple MA system | 06 |
| S-3 | MACD Crossover | MACD line vs signal line | Technical Analysis | Appel (1979) | 06 |
| S-4 | MACD Divergence | Price-MACD divergence (regular + hidden) | Technical Analysis | Murphy (1999) Ch.10 | 06 |
| S-5 | RSI Zones | Oversold (<30) / Overbought (>70) exit | Technical Analysis | Wilder (1978) | 06 |
| S-6 | RSI Divergence | Price-RSI divergence (regular + hidden) | Technical Analysis | Wilder (1978), Murphy (1999) | 06 |
| S-7 | BB Bounce/Break | Lower bounce, upper break, squeeze | Statistics | Bollinger (2001) | 02 |
| S-8 | Ichimoku Signals | Cloud break, TK cross | Technical Analysis | Hosoda (1969) | 06 |
| S-9 | StochRSI | Oversold/Overbought | Technical Analysis | Chande-Kroll (1994) | 06 |
| S-10 | Stochastic | %K/%D oversold/overbought | Technical Analysis | Lane (1984) | 06 |
| S-11 | Hurst Regime | H>0.6 trending, H<0.4 mean-reverting | Physics/Fractals | Mandelbrot (1963), Peters (1994) | 01, 03 |
| S-12 | Kalman Turn | Slope direction change | Optimal Control | Kalman (1960) | 10 |
| S-13 | CCI Signals | Oversold exit (<-100) / Overbought exit (>100) | Technical Analysis | Lambert (1980) | 06 |
| S-14 | ADX Signals | +DI/-DI crossover with ADX>20 | Technical Analysis | Wilder (1978) | 06 |
| S-15 | Williams %R | Oversold (<-80) / Overbought (>-20) | Technical Analysis | Williams (1979) | 06 |
| S-16 | ATR Expansion | ATR ratio > 1.5 vs 20-bar EMA | Statistics | Wilder (1978), Parkinson (1980) | 06, 34 |
| S-17 | CUSUM Break | Structural breakpoint detection | Statistics | Page (1954), Roberts (1966) | 21 |
| S-18 | Vol Regime Change | EWMA vol regime transition | Finance/Risk | RiskMetrics (1996) | 34 |
| S-19 | Volume Breakout/Selloff | Volume vs 20-bar MA ratio | Technical Analysis | Granville (1963) | 06 |
| S-20 | OBV Divergence | Price-OBV divergence | Technical Analysis | Granville (1963), Murphy (1999) | 06 |
| S-21 | Basis Signal | Contango/Backwardation from basisPct | Derivatives | Bessembinder-Seguin (1993) | 27, 36 |
| S-22 | PCR Signal | Put/Call ratio extreme contrarian | Derivatives/Behavioral | Pan-Poteshman (2006) | 37 |
| S-23 | Flow Signal | Foreign+Institutional alignment | Microstructure | Choe-Kho-Stulz (2005), Kang-Stulz (1997) | 39 |
| S-24 | ERP Signal | Equity Risk Premium z-score | Cross-Asset Finance | Fed Model, Asness (2003) | 41 |
| S-25 | ETF Sentiment | Leverage/Inverse ratio contrarian | ETF/Behavioral | Cheng-Madhavan (2009) | 38 |
| S-26 | Short Interest | Market short ratio regime | Market Microstructure | Desai et al. (2002), Miller (1977) | 40 |
| S-27 | IV/HV Discount | IV/HV > 1.5 confidence dampening | Derivatives | Simon-Wiggins (2001), Doc26 5.3 | 26 |
| S-28 | VKOSPI Regime | Crisis/High/Normal/Low vol classification | Derivatives | Whaley (2009), Doc26 2.3 | 26 |
| S-29 | Expiry Discount | D-2~D+1 confidence x0.70 | Derivatives | Doc27 4, Stoll-Whaley (1987) | 27 |
| S-30 | Crisis Severity | Multi-factor crisis composite | Cross-Market | Doc28 1.2, DCC-GARCH Engle (2002) | 28 |
| S-31 | Entropy Damping | Shannon entropy normalization | Information Theory | Shannon (1948) | 01, 13 |

### 2.4 Composite Signals (COMPOSITE_SIGNAL_DEFS, 30 definitions)

| Tier | ID | Required | Academic Basis | core_data |
|------|----|----------|---------------|-----------|
| 1 | strongBuy_hammerRsiVolume | hammer + rsiOversoldExit | Nison (1991) + Wilder (1978) multi-confirmation | 06 |
| 1 | strongSell_shootingMacdVol | shootingStar + macdBearishCross | Nison (1991) + Appel (1979) | 06 |
| 1 | buy_doubleBottomNeckVol | doubleBottom + volumeBreakout | Edwards-Magee (1948) neckline break volume | 07 |
| 1 | sell_doubleTopNeckVol | doubleTop + volumeSelloff | Edwards-Magee (1948) | 07 |
| 1 | buy_ichimokuTriple | ichimokuCloudBreakout + TK cross | Hosoda (1969) saneki-hoten | 06 |
| 1 | sell_ichimokuTriple | ichimokuCloudBreakdown + TK cross | Hosoda (1969) saneki-gyakuten | 06 |
| 1 | buy_goldenMarubozuVol | goldenCross + bullishMarubozu | Murphy (1999) + Nison (1991) | 06 |
| 1 | sell_deadMarubozuVol | deadCross + bearishMarubozu | Murphy (1999) + Nison (1991) | 06 |
| 1 | buy_adxGoldenTrend | goldenCross + adxBullishCross | Murphy (1999) + Wilder (1978) ADX confirmation | 06 |
| 1 | sell_adxDeadTrend | deadCross + adxBearishCross | Murphy (1999) + Wilder (1978) | 06 |
| 2 | buy_goldenCrossRsi | goldenCross + RSI/volume | Murphy (1999) + Wilder (1978) | 06 |
| 2 | sell_deadCrossMacd | deadCross + MACD/RSI | Murphy (1999) + Appel (1979) | 06 |
| 2 | buy_hammerBBVol | hammer + bbLowerBounce | Nison (1991) + Bollinger (2001) | 06, 02 |
| 2 | sell_shootingStarBBVol | shootingStar + bbUpperBreak | Nison (1991) + Bollinger (2001) | 06, 02 |
| 2 | buy_morningStarRsiVol | morningStar + rsiOversoldExit | Nison (1991) + Wilder (1978) | 06 |
| 2 | buy_engulfingMacdAlign | bullishEngulfing + macdBullishCross | Nison (1991) + Appel (1979) | 06 |
| 2 | buy_cciRsiDoubleOversold | cciOversoldExit + rsiOversoldExit | Lambert (1980) + Wilder (1978) | 06 |
| 2 | neutral_squeezeExpansion | bbSqueeze + atrExpansion | Bollinger (2001) squeeze→expansion | 02, 06 |
| 2 | buy_cusumKalmanTurn | cusumBreak + kalmanUpturn | Page (1954) + Kalman (1960) | 21, 10 |
| 2 | buy_volRegimeOBVAccumulation | volRegimeHigh + obvBullishDiv | RiskMetrics (1996) + Granville (1963) | 34, 06 |
| 2 | buy_flowPcrConvergence | flowAlignedBuy + PCR/basis | Choe-Kho-Stulz (2005) + Pan-Poteshman (2006) | 39, 37 |
| 2 | buy_shortSqueezeFlow | shortSqueeze + flowForeignBuy | Lamont-Thaler (2003) + Kang-Stulz (1997) | 40, 39 |
| 3 | buy_bbBounceRsi | bbLowerBounce + RSI/volume | Bollinger (2001) + Wilder (1978) | 02, 06 |
| 3 | buy_wrStochOversold | williamsROversold + stochOversold | Williams (1979) + Lane (1984) | 06 |

### 2.5 Backtesting Engine (backtester.js)

| Formula ID | Name | Method | Academic Discipline | Key Paper | core_data |
|------------|------|--------|---------------------|-----------|-----------|
| B-1 | Spearman Rank IC | `_spearmanCorr(pairs)` | Statistics | Grinold-Kahn (2000) "Active Portfolio Management" | 17 |
| B-2 | Rolling OOS IC | `_rollingOOSIC(pairs, minWindow)` | Statistics | Lo (2002) "Statistics of Sharpe Ratios" | 17 |
| B-3 | Walk-Forward Test | `walkForwardTest(candles, pType)` | Applied Statistics | Pardo (2008); Bailey-Lopez de Prado (2014) | 17 |
| B-4 | BH-FDR Correction | `_applyBHFDR(results)` | Statistics | Benjamini-Hochberg (1995) JRSS-B 57(1) | 17 |
| B-4a | Cross-Stock Significance | (within _applyBHFDR) | Statistics | Harvey-Liu-Zhu (2016) sqrt(N) correction | 17 |
| B-5 | Hansen SPA Test | `_hansenSPA(results)` | Statistics | Hansen (2005) "Test for Superior Predictive Ability" | 17 |
| B-6 | Jensen's Alpha | `_calcJensensAlpha(...)` | Finance | Jensen (1968), CAPM excess return | 25, 42 |
| B-7 | LinUCB Greedy | `_applyLinUCBGreedy(context)` | Reinforcement Learning | Li et al. (2010) LinUCB contextual bandit | 11 |
| B-8 | Survivorship Correction | `_getSurvivorshipCorrection(...)` | Applied Finance | Elton-Gruber-Blake (1996) survivorship bias | 15 |
| B-9 | Reliability Tier (A/B/C/D) | (within backtestAll) | Applied Statistics | BH-FDR + IC + WFE composite gating | 17 |
| B-10 | Horizon Cost Model | `_horizonCost(h)` | Market Microstructure | Kyle (1985) sqrt(h) slippage scaling | 18 |
| B-11 | Adaptive Slippage | `_getAdaptiveSlippage(code)` | Market Microstructure | Amihud (2002) ILLIQ-based segments | 18 |

---

## 3. IC (Information Coefficient) Emphasis Points

### 3.1 IC Calculation Method

**Implementation**: `backtester._spearmanCorr(pairs)` (line 617)

IC is computed as the Spearman rank correlation between WLS-predicted returns and realized N-day returns. The implementation follows Grinold & Kahn (2000) "Active Portfolio Management":

1. **Rank both columns** with averaged ties (Kendall & Gibbons 1990)
2. **Pearson-of-ranks** formula (exact Spearman with ties, not the 6d^2 shortcut)
3. **Minimum 5 pairs** required for computation

```
IC = corr(rank(predicted), rank(actual))
```

### 3.2 OOS IC Enhancement

**Implementation**: `backtester._rollingOOSIC(pairs, minWindow)` (line 667)

To address in-sample IC inflation (Lo 2002), rolling out-of-sample IC is computed:
- Non-overlapping OOS windows of `minWindow` size (default 12)
- Each window is pure OOS (model never fitted on these observations)
- Average OOS IC is less biased than full-sample IC
- Requires 2x minWindow for meaningful OOS split

### 3.3 IC Significance Thresholds

The reliability tier system uses IC as a gating criterion:

| Tier | IC Requirement | Academic Basis |
|------|---------------|----------------|
| A | IC > 0.02 | Qian, Hua & Sorensen (2007): minimal benchmark for non-trivial predictive power |
| B | IC > 0.01 | Minimal non-random signal threshold |
| C | IC not gated | Alpha > 0 and n >= 30 sufficient |
| D | — | Insufficient statistical evidence |

**Note**: IC = null (insufficient data) is treated as "pass" (distinct from IC = 0).

### 3.4 IC in RL Policy Gating

`_loadRLPolicy()` line 259: If `mean_ic_adjusted < 0`, the entire RL policy is rejected as anti-predictive. Win rate posteriors (Beta-Binomial) are still injected as they are IC-independent empirical data.

### 3.5 Walk-Forward Validation (WFE)

**Implementation**: `backtester.walkForwardTest()` (line 710)

- **WFE = OOS_meanReturn / IS_meanReturn** (Pardo 2008)
- Expanding window, 4-6 folds (6 when n >= 500, Bailey-Lopez de Prado 2014)
- Purge gap = 2x horizon (AR(1) half-life guard)
- OOS ratio: ~20% (practitioner convention)
- **Gating**: WFE < 30 caps reliability at C (overfit suspect)

### 3.6 HC3 Heteroskedasticity Correction

**Implementation**: Within `calcWLSRegression()` (line 636)

HC3 is the most stringent of White's family (MacKinnon & White 1985):

```
Cov_HC3 = (X'WX)^{-1} * M * (X'WX)^{-1}
where M_jk = sum_i { X_ij * w_i^2 * e_i^2 / (1-h_ii)^2 * X_ik }
h_ii = w_i * x_i' * (X'WX)^{-1} * x_i  (leverage)
```

HC3 is preferred over HC0/HC1 because it is approximately pivotal for any sample size, making t-statistics more reliable in the presence of heteroskedastic return distributions.

---

## 4. Confidence Chain Academic Integrity

### 4.1 Confidence Adjustment Pipeline

Pattern confidence flows through 7 sequential adjustment layers, each multiplicative:

```
Base confidence (patternEngine)
  |-- [Layer 1] _applyMacroConfidenceToPatterns()     11 factors, clamp [0.70, 1.25]
  |-- [Layer 2] _applyMicroConfidenceToPatterns()      3 factors, clamp [0.55, 1.15]
  |-- [Layer 3] _applyDerivativesConfidenceToPatterns() 7 factors, clamp [0.70, 1.30]
  |-- [Layer 4] _applyMertonDDToPatterns()             1 factor, clamp [0.75, 1.15]
  |-- [Layer 5] _applyPhase8ConfidenceToPatterns()     4 factors, clamp [10, 100]
  |-- [Layer 6] _applyRORORegimeToPatterns()           1 factor, clamp [0.92, 1.08]
  |-- [Layer 7] _applyMacroConditionsToSignals()       composite-specific adjustments
  --> Final confidence [10, 100]
```

### 4.2 Layer-by-Layer Academic Audit

#### Layer 1: Macro Confidence (11 factors)

| Factor# | Name | Theory | Paper | Magnitude | Empirical Basis | Grade |
|---------|------|--------|-------|-----------|-----------------|-------|
| F1 | Business Cycle Phase | IS-LM aggregate demand | Hicks (1937), Doc30 1 | +/-6-10% | Stovall (1996) sector rotation | [B] |
| F1a | Stovall Sector Rotation | Sector-cycle sensitivity | Stovall (1996) | Sector-specific mult | 0.5x dampening (KRX unvalidated) | [C] |
| F2 | Yield Curve 4-Regime | Term structure signaling | Doc35 3, Harvey (1986) | +/-3-12% | Bull/Bear x Steep/Flat | [B] |
| F3 | Credit Regime | Credit spread stress | Gilchrist-Zakrajsek (2012) | -7 to -18% (buy) | AA- spread thresholds | [B] |
| F4 | Foreign Signal | UIP, Mundell-Fleming capital flows | Mundell (1963), Doc28 8 | +/-5% | foreigner_signal > 0.3 | [C] |
| F5 | Pattern-Specific Override | Cycle-pattern interaction | Nison + IS-LM combined | +6-12% conditional | doubleTop/Bottom/hammer | [D] |
| F6 | MCS v2 | Macro Composite Score | Doc30 4.3, Doc29 6.2 | +/-10% max | MCS 0-100 range | [C] |
| F7 | Taylor Rule Gap | Monetary policy stance | Taylor (1993), Doc30 4.1 | +/-5% | Normalized gap [-1,+1] | [B] |
| F8 | VRP/VIX Level | Volatility risk premium | Carr-Wu (2009), Doc26 3 | -3 to -7% | VIX threshold tiers | [B] |
| F9 | Rate Differential | Mundell-Fleming capital flow | Mundell (1963), Doc30 1.4 | +/-5% | rate_diff threshold | [B] |
| F10 | Rate Beta x Sector | Interest rate sensitivity | Damodaran (2012) | Sector-specific | Taylor gap x sector beta | [C] |
| F11 | KOSIS CLI-CCI Gap | Leading vs coincident index | OECD methodology | +/-4% | gap > 5pp | [C] |

#### Layer 2: Micro Confidence (3 factors)

| Factor# | Name | Theory | Paper | Magnitude | Grade |
|---------|------|--------|-------|-----------|-------|
| M1 | Amihud ILLIQ | Liquidity discount | Amihud (2002), Kyle (1985) | -15% max | [A] |
| M2 | HHI Mean-Reversion Boost | Industry concentration → price discovery | Doc33 6.2, Jensen-Meckling (1976) | +10% x HHI | [C] |
| M3 | Short-Selling Ban | Price discovery impairment | Miller (1977), Diamond-Verrecchia (1987) | -10 to -30% | [B] |

#### Layer 3: Derivatives Confidence (7 factors)

| Factor# | Name | Theory | Paper | Magnitude | Grade |
|---------|------|--------|-------|-----------|-------|
| D1 | Futures Basis | Cost-of-carry sentiment | Bessembinder-Seguin (1993) | +/-4-7% | [B] |
| D2 | PCR Contrarian | Put/Call ratio extreme | Pan-Poteshman (2006) | +/-6% | [B] |
| D3 | Investor Alignment | Foreign+Institutional flow | Choe-Kho-Stulz (2005) | +/-8% | [B] |
| D4 | ETF Sentiment | Leverage ratio contrarian | Cheng-Madhavan (2009) | +/-4% | [C] |
| D5 | Short Ratio | Market short ratio regime | Desai et al. (2002) | +6% (high SIR) | [C] |
| D6 | (ERP — handled in signalEngine) | — | — | — | — |
| D7 | USD/KRW Export Channel | FX-export sensitivity | Doc28 3, beta_FX | +/-5% | [C] |

#### Layer 4: Merton DD (1 factor)

| Factor# | Name | Theory | Paper | Magnitude | Grade |
|---------|------|--------|-------|-----------|-------|
| DD1 | Naive Distance-to-Default | Structural credit model | Merton (1974), Bharath-Shumway (2008) | -5 to -25% (buy) | [A] |

Theory: Equity = European call on firm assets. DD = (ln(V/D) + (r - 0.5*sigma^2)*T) / (sigma*sqrt(T)).
Financial sector excluded (debt = operating assets). EDF = N(-DD).

#### Layer 5: Phase 8 Combined (4 factors)

| Factor# | Name | Theory | Paper | Magnitude | Grade |
|---------|------|--------|-------|-----------|-------|
| P8-1 | MCS v2 (0-100) | Macro context composite | Doc30 4.3 | +5% for strong alignment | [C] |
| P8-2 | HMM Regime | Market-wide regime label | Hamilton (1989) Hidden Markov Model | regime-specific mult | [B] |
| P8-3 | Foreign Momentum (per-stock) | Stock-specific flow alignment | Kang-Stulz (1997) | +3% for alignment | [C] |
| P8-4 | IV/HV Ratio | Implied vs Historical vol | Simon-Wiggins (2001) | -7 to -10% | [B] |

#### Layer 6: RORO Regime (5-factor composite)

| Factor# | Name | Weight | Theory | Paper | Grade |
|---------|------|--------|--------|-------|-------|
| R1 | VKOSPI/VIX Level | 0.30 | Implied volatility | Whaley (2009) | [B] |
| R2a | AA- Credit Spread | 0.05 | Credit stress | Gilchrist-Zakrajsek (2012) | [B] |
| R2b | US HY Spread | 0.10 | Global risk appetite | HY spread proxy | [C] |
| R3 | USD/KRW | 0.20 | Capital flow pressure | Mundell-Fleming | [B] |
| R4 | MCS v1 | 0.15 | Macro context | Doc29 6.2 | [C] |
| R5 | Investor Alignment | 0.15 | Flow direction | Choe-Kho-Stulz (2005) | [B] |

**Hysteresis transition**: Enter thresholds (+/-0.25) differ from exit thresholds (+/-0.10), preventing regime oscillation. Theory: Baele, Bekaert & Inghelbrecht (2010) RFS.

### 4.3 Confidence Integrity Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| No circular adjustments | PASS | Each layer is independent and sequential |
| No double-counting | PARTIAL | F3 (credit) and R2a (credit in RORO) overlap mitigated by R2a weight reduction (0.20->0.05) |
| Clamp prevents runaway | PASS | Each layer has explicit bounds; final clamp [10, 100] |
| Asymmetric adjustments justified | PASS | Buy/sell asymmetry matches empirical findings (KRX sell bias) |
| Seed data protection | PASS | _calcNaiveDD requires dart/hardcoded source, rejects seed |

---

## 5. Cross-Discipline Dependencies

### 5.1 Dependency Graph

```
Physics (Doc 03)
  | Econophysics: power laws, phase transitions, scaling
  |-- Hill tail estimator (I-10) → EVT-aware Bollinger (I-3E)
  |-- Hurst exponent (I-9) → pattern mean-reversion weight
  |-- Self-organized criticality → regime change detection
  v
Mathematics (Docs 01, 10, 13)
  | Probability, stochastic processes, optimal control
  |-- Brownian motion → Black-Scholes (Doc 05) → IV/HV ratio
  |-- Kalman filter (I-8) → trend detection signal (S-12)
  |-- Information geometry → regime distance (planned)
  v
Statistics (Docs 02, 12, 17, 34)
  | Regression, time series, extreme values, volatility
  |-- WLS + HC3 (I-15) → backtester predicted returns
  |-- BH-FDR (B-4) → reliability tier gating
  |-- EWMA vol (I-26) → vol regime classification
  |-- HAR-RV (I-31) → volatility forecasting
  |-- R/S → Hurst (I-9) → trend persistence weighting
  v
Economics (Docs 09, 29-33)
  | Macro theory, micro theory, game theory
  |-- IS-LM → Taylor gap → confidence Factor 7
  |-- Stovall rotation → sector-specific cycle sensitivity
  |-- Mundell-Fleming → rate differential, FX channel
  |-- HHI → mean-reversion boost (micro Factor 2)
  |-- Jensen-Meckling → eps_stability mediator
  v
Behavioral Psychology (Docs 04, 18, 19, 24, 39)
  | Prospect theory, herding, cognitive biases
  |-- Anti-predictor gate (PATTERN_WR_KRX < 48%) → composite confidence
  |-- Disposition effect → planned discount
  |-- CSAD herding → planned extreme-crowd adjustment
  |-- Grossman-Stiglitz paradox → flow information asymmetry
  v
Finance Theory (Docs 05, 14, 23, 25, 42-47)
  | Asset pricing, corporate finance, fixed income, derivatives, credit
  |-- CAPM beta (I-12) → Jensen's alpha (B-6)
  |-- Merton DD (Layer 4) → credit risk penalty
  |-- IV/HV ratio → signal confidence dampening (S-27)
  |-- Fed Model ERP → relative valuation signal (S-24)
  |-- RORO regime → directional bias (Layer 6)
  v
Technical Analysis (Docs 06, 07, 16)
  | Pattern detection, signal generation, composite confirmation
  |-- All patterns (P-1..P-40) ← ATR normalization from Statistics
  |-- All indicator signals (S-1..S-20) ← indicator calculations
  |-- Composite signals ← multi-indicator confluence
```

### 5.2 Key Cross-Discipline Flows

| Source Discipline | Target Discipline | Flow | Mechanism |
|-------------------|-------------------|------|-----------|
| Physics → Statistics | Fat-tail correction | Hill alpha < 4 → Bollinger band multiplier expansion | I-10 → I-3E |
| Statistics → Finance | Regression prediction | WLS regression residuals → IC measurement | I-15 → B-1 |
| Statistics → Finance | Multiple testing | BH-FDR → reliability tier gating | B-4 → B-9 |
| Economics → TA | Cycle-pattern interaction | Business cycle phase → pattern confidence adjustment | F1 → Layer 1 |
| Psychology → TA | Anti-predictor gate | WR < 48% → composite confidence reduction | PATTERN_WR_KRX |
| Derivatives → TA | Vol regime discount | VKOSPI crisis → signal confidence x0.65 | S-28 → all signals |
| Microstructure → TA | Liquidity discount | ILLIQ logIlliq > -1 → confidence x0.85 | M1 → Layer 2 |
| Credit Risk → TA | Default penalty | DD < 1.5 → buy pattern confidence x0.82 | DD1 → Layer 4 |
| Cross-Asset → TA | Risk regime | RORO score → directional bias +/-8% | Layer 6 |

### 5.3 Information Flow Direction Rules

1. **Downstream only**: Physics/Math → Statistics → Economics/Finance → TA. No reverse dependency.
2. **Independence within layers**: Macro (Layer 1), Micro (Layer 2), Derivatives (Layer 3) are independent — no cross-layer variable sharing.
3. **Signal vs. Pattern**: Signal engine adjustments and pattern confidence adjustments operate on separate objects, merged only at rendering.

---

## 6. Academic Gap Analysis

### 6.1 Formulas Lacking Clear Academic Citation

| Formula/Adjustment | Current Status | Gap Description | Recommended Action |
|---------------------|---------------|-----------------|-------------------|
| Vol regime thresholds (0.75, 1.50) | [D] Heuristic | No peer-reviewed source for EMA-ratio cutoffs | Calibrate via HMM classification (Hamilton 1989) |
| Composite signal window=5 | [D] Heuristic | "Nison: several sessions" is vague | Backtest optimal window per composite |
| OLS R-squared > 0.50 trend threshold | [D] Heuristic | Lo-MacKinlay cited but exact threshold is custom | Cross-validate on KRX data |
| Entropy damping range [0.80, 1.0] | [D] Heuristic | Shannon entropy applied to signal diversity | Validate information-theoretic justification |
| Reliability tier cutoffs (alpha>=5, n>=100, pf>=1.3) | [D] Heuristic | "CFA sample-size guidance + practitioner" | Formalize via power analysis |
| RORO hysteresis thresholds (0.25/0.10) | [D] Heuristic | Intuitive but not derived from Baele et al. | Estimate from historical regime transitions |
| HMM staleness 30-day cutoff | [D] Heuristic | "Regime shifts resolve within 1 month" | Empirically measure KRX regime persistence |
| ADX filter +5/-5 confidence adjustment | [D] Heuristic | Wilder (1978) provides no magnitude guidance | Calibrate via conditional win rate |
| CCI filter +3/-5 adjustment | [D] Heuristic | Lambert (1980) provides no magnitude guidance | Same approach |
| MAX_CUMULATIVE_ADJ = 15 | [D] Heuristic | "Maximum ~15% confidence movement" | Analyze independence of ADX/CCI/OLS |

### 6.2 Implementations Diverging from Theory

| Formula | Theory States | Implementation Does | Impact | Severity |
|---------|---------------|---------------------|--------|----------|
| Bollinger Bands sigma | Contested (population vs sample) | Population sigma (divide by n) per Bollinger (2001) | ~2% narrower bands at n=20 | Low — author's explicit choice |
| Hurst R/S analysis | Anis & Lloyd (1976) finite-sample correction | Not applied (James-Stein shrinkage cited as substitute) | H potentially biased for small n | Medium — documented |
| EWMA vol lambda | RiskMetrics recommends G7 calibration | Fixed 0.94 for all KRX stocks | KRX-specific lambda uncalibrated | Low — adequate for large-cap |
| Stovall sector rotation | US S&P 500 empirical | Applied to KRX with 0.5x dampening | Sector dynamics may differ | Medium — dampening mitigates |
| HC3 leverage cap | Theory: no cap on h_ii | Capped at 0.99 to prevent division by near-zero | Extreme leverage points lose influence | Low — numerical stability |
| EVT Bollinger coefficient | Theory: exact quantile mapping | Heuristic 0.45 * (4 - alpha) multiplier | Approximation, not exact EVT quantile | Medium — but practically adequate |

### 6.3 Formulas with Potential for Additional Academic Support

| Area | Current | Potential Enhancement | Source |
|------|---------|----------------------|--------|
| Pattern IC | Spearman IC only | Add IR (Information Ratio) for risk-adjusted IC | Grinold-Kahn (2000) Ch.14 |
| Vol forecasting | EWMA + HAR-RV | Add GARCH(1,1) benchmark comparison | Bollerslev (1986) |
| Regime detection | VKOSPI thresholds + RORO | Add formal HMM with Baum-Welch training | Hamilton (1989), Doc21 |
| Factor model | CAPM single-factor beta | Add Fama-French 3-factor alpha | FF3 (#168-#171 already exist) |
| Tail risk | Hill estimator + GPD VaR | Add Expected Shortfall (CVaR) display | Acerbi-Tasche (2002) |
| Multi-testing | BH-FDR + Hansen SPA | Add Romano-Wolf stepdown for FWER | Romano-Wolf (2005) |
| Covariance | Per-stock beta only | Add Ledoit-Wolf shrinkage portfolio | Ledoit-Wolf (2004), Doc25 |

---

## 7. Theory-Practice Coherence Score

### 7.1 Scoring Methodology

Each discipline is rated on three dimensions (0-100 scale):

- **Coverage**: What fraction of the discipline's theories are implemented in JS code?
- **Fidelity**: How closely does the implementation match the mathematical specification?
- **Citation**: Are primary sources properly referenced in comments and core_data?

### 7.2 Discipline Scorecards

| Discipline | Coverage | Fidelity | Citation | Weighted Avg | Notes |
|------------|----------|----------|----------|-------------|-------|
| **Mathematics** (01, 10, 13) | 65 | 90 | 85 | **80** | Strong: MA/EMA/BB exact. Gap: Information geometry (13) not implemented. Kalman Q-adaptation well-cited. |
| **Statistics** (02, 12, 17, 34) | 85 | 92 | 90 | **89** | Strongest discipline. WLS+HC3 textbook-accurate. GCV lambda selection well-cited. BH-FDR correct. HAR-RV OLS variant adequate. |
| **Physics/Econophysics** (03) | 40 | 85 | 80 | **68** | Hurst R/S implemented faithfully. Hill estimator correct. Gap: SOC, phase transitions, renormalization not implemented (future). |
| **Psychology/Behavioral** (04, 18, 19, 24, 39) | 35 | 70 | 75 | **60** | Anti-predictor gate is novel application. Disposition/herding data loaded but not actively used. KR-FinBERT not implemented. |
| **Economics** (09, 29-33) | 55 | 75 | 80 | **70** | IS-LM → Taylor gap implemented. Stovall rotation with KRX dampening. HHI boost correct. Game theory (09) not implemented. |
| **Finance Theory** (05, 14, 23, 25, 42-47) | 50 | 88 | 85 | **74** | CAPM beta exact. Jensen's alpha correct. DD (Naive Bharath-Shumway) well-cited. Gaps: FF5 not in JS, options pricing (45) theoretical only. |
| **Derivatives** (26, 27, 36, 37, 45, 46) | 45 | 80 | 82 | **69** | VKOSPI regime, PCR, basis signals implemented. IV surface (37) not implemented. Options strategies (46) theoretical. Straddle implied move used for confidence. |
| **Market Microstructure** (18, 20, 38, 40) | 55 | 82 | 85 | **74** | Amihud ILLIQ textbook formula. Short-ban periods well-documented. ETF sentiment basic. VPIN not implemented. |
| **Technical Analysis** (06, 07, 16) | 90 | 88 | 82 | **87** | 40+ patterns implemented. ATR normalization pervasive. Some patterns (harmonics, Elliott) not yet implemented. |
| **Machine Learning** (11, 11B, 15, 21) | 30 | 85 | 78 | **64** | LinUCB (greedy) implemented. HMM regime data consumed but model not in JS. CUSUM/BinSeg correct. CNN/LSTM/MAML not implemented. |

### 7.3 Overall System Coherence

| Metric | Score | Interpretation |
|--------|-------|----------------|
| **Average Coverage** | 55/100 | Roughly half of documented theories are implemented. Many docs serve as future roadmap. |
| **Average Fidelity** | 84/100 | Implementations that exist are generally faithful to theory. |
| **Average Citation** | 82/100 | Good citation practice. Most formulas trace to specific papers. |
| **Composite Coherence** | **74/100** | **Strong theoretical foundation** with identified gaps for future phases. |

### 7.4 Critical Coherence Findings

1. **Statistics is the strongest pillar** (89/100): WLS, HC3, BH-FDR, Hansen SPA, Walk-Forward all textbook-correct with proper citations. This is the engine room of the system.

2. **Technical Analysis has highest coverage** (90/100): 40+ patterns implemented from Nison/Bulkowski/Morris. The main gap is harmonics and Elliott waves (documented in core_data/07 but not yet coded).

3. **Behavioral Psychology is the weakest implementation** (60/100): While 5 documents exist (04, 18, 19, 24, 39), only the anti-predictor gate (PATTERN_WR_KRX), CSAD herding data loading, and disposition_proxy loading are active. KR-FinBERT sentiment, attention-based pricing, and crowd behavior metrics are documented but unimplemented.

4. **Machine Learning has lowest coverage** (30/100): Only LinUCB (greedy variant) is implemented. Full RL (DQN, PPO, MAML), CNN/LSTM pattern recognition, and SHAP interpretability remain in the roadmap.

5. **Cross-discipline integrity is maintained**: No reverse dependencies exist. Each adjustment layer is multiplicatively independent. Double-counting is mitigated by explicit guards (e.g., MCS v2 skip when Phase 8 applies, RORO credit weight reduction).

---

## Appendix A: Constant Tier Reference

Constants referenced in formulas use the 5-tier classification from core_data/22:

| Tier | Meaning | Modification Rule |
|------|---------|-------------------|
| [A] | Academic Fixed | Never modify (pi, sqrt(252), Bollinger k=2) |
| [B] | Academic Tunable | Modify only with peer-reviewed justification |
| [C] | Calibratable | Modify via systematic calibration (GCV, backtest) |
| [D] | Heuristic | No academic basis — replace with evidence-based |
| [E] | Deprecated | Scheduled for removal |

## Appendix B: Anti-Predictor Gate (BLL 1992)

The anti-predictor mechanism (signalEngine.js line 421-448) applies Brock-Lakonishok-LeBaron (1992) logic:

- Source: `PATTERN_WR_KRX` — KRX 5-year empirical win rates
- Threshold: 48% (2pp below coin flip, accounts for bid-ask + transaction cost)
- Effect: Patterns with WR < 48% reduce composite confidence when they are `required` signals
- Inversion gate: If required pattern WR < 48%, the entire composite signal is suspected anti-predictive

Key observations from PATTERN_WR_KRX:
- **KRX sell bias**: Sell patterns consistently outperform (55-74.7% WR) vs buy patterns (39-62%)
- **Strongest**: doubleTop (74.7%), gravestoneDoji (62.0%), risingWedge (59.8%)
- **Weakest**: ascendingTriangle (39.5%), fallingWedge (39.1%), morningStar (40.5%)

## Appendix C: KRX-Specific Adaptations

| Adaptation | Theory | KRX Modification | Rationale |
|------------|--------|-------------------|-----------|
| KRX_TRADING_DAYS = 250 | US: 252 | KRX has fewer holidays | Affects all annualization |
| VIX_VKOSPI_PROXY = 1.12 | Whaley (2009) | VKOSPI ~= VIX * 1.12 | KRX IV structure |
| Stovall 0.5x dampening | US S&P empirical | Half deviation from 1.0 | KRX sector dynamics unvalidated |
| KRX_COST = 0.31% | US: ~0.10% | Higher tax (0.18%) + slippage | KOSDAQ tax rate + spread |
| Short-ban periods | N/A in US | 2020-03, 2023-11 bans | Miller (1977) overpricing during bans |
| Rate differential | Mundell-Fleming | BOK vs Fed rate gap | Capital outflow pressure channel |

---

*This document was generated on 2026-04-08 and reflects the codebase at commit HEAD. It is consumed by Phase 2 content-writing agents to ensure Stage 2 and Stage 3 have correct academic lineage for every formula. Update when new indicators, patterns, or confidence layers are added.*
