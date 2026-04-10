# Stage 2: Academic Foundations --- The Intellectual Bedrock

> Part A: Physics, Mathematics, and Statistics
>
> "The market is a complex adaptive system whose emergent patterns arise from the
> interaction of heterogeneous agents under uncertainty. The mathematics of stochastic
> processes, the physics of critical phenomena, and the statistics of extreme events
> form the irreducible foundation upon which all financial analysis rests."

---

## 2.1 Physics --- Econophysics Foundations

> **Core Document:** `core_data/03_physics.md`
> **Discipline Level:** L0 (Root Foundation)
> **Key Scholars:** Mandelbrot (1963), Stanley (1995), Bak (1987), Sornette (2003)

The econophysics program applies the methods of statistical mechanics, scaling theory,
and critical phenomena to financial markets. It provides the deepest explanatory layer
for *why* markets produce the distributional properties that invalidate Gaussian models ---
the very properties that technical analysis must accommodate.

### 2.1.1 Statistical Mechanics and Market Temperature

**Theoretical Foundation**

The Boltzmann distribution, the cornerstone of statistical mechanics, assigns
probabilities to microstates of a physical system in thermal equilibrium:

$$P(E) = \frac{1}{Z} \exp\left(-\frac{E}{k_B T}\right)$$

where $Z = \sum_i \exp(-E_i / k_B T)$ is the partition function (normalization constant),
$E$ is the energy of a microstate, $k_B$ is Boltzmann's constant, and $T$ is the
absolute temperature.

**Key Papers:**

- Boltzmann, L. (1877). "Uber die Beziehung zwischen dem zweiten Hauptsatze der
  mechanischen Warmetheorie und der Wahrscheinlichkeitsrechnung." *Wiener Berichte*, 76.
- Mantegna, R.N. & Stanley, H.E. (2000). *An Introduction to Econophysics:
  Correlations and Complexity in Finance*. Cambridge University Press.

**Financial Analogy**

The physics-to-finance mapping is not a mere metaphor but a structural correspondence:

| Physics | Finance | Correspondence |
|---------|---------|----------------|
| $E$ (energy) | Price deviation from equilibrium | Larger deviations = higher energy states |
| $T$ (temperature) | Market volatility | High volatility = thermal disorder |
| $Z$ (partition function) | Market normalization | Total probability mass across all states |
| Thermal equilibrium | Efficient market steady state | All information priced in |
| Phase transition | Regime change (trend to crash) | Symmetry breaking in order flow |

In a "cold" market (low volatility), the system occupies low-energy states --- prices
cluster near equilibrium with ordered, trend-following behavior. In a "hot" market (high
volatility), the system explores high-energy states --- price movements become disordered,
random, and extreme.

**Implementation Bridge**

The market temperature concept is operationalized through EWMA volatility in
`js/indicators.js`:

```
calcEWMAVol(closes, lambda=0.94)    [line 1336]
  -> sigma_t^2 = lambda * sigma_{t-1}^2 + (1-lambda) * r_{t-1}^2
  -> Returns conditional standard deviation array

classifyVolRegime(ewmaVol)           [line 1385]
  -> Ratio of current EWMA to long-run EMA
  -> Classifies: 'low' (ratio < 0.75), 'mid', 'high' (ratio > 1.50)
```

The volatility regime classification directly implements the "market temperature"
metaphor: low regime corresponds to a cold/ordered market, high regime to a
hot/disordered market. Pattern confidence adjustments flow from this classification
(Stage 3, Section 3.X).

### 2.1.2 The Ising Model and Herding Behavior

**Theoretical Foundation**

Ernst Ising (1925) proposed the simplest model of cooperative phenomena in statistical
mechanics. The Hamiltonian for a system of interacting spins on a lattice is:

$$\mathcal{H} = -J \sum_{\langle i,j \rangle} s_i \cdot s_j - h \sum_i s_i$$

where $s_i = +1$ or $-1$ represents the spin state of particle $i$, $J$ is the
interaction coupling constant, $h$ is the external field strength, and
$\langle i,j \rangle$ denotes nearest-neighbor pairs.

**Key Papers:**

- Ising, E. (1925). "Beitrag zur Theorie des Ferromagnetismus."
  *Zeitschrift fur Physik*, 31, 253--258.
- Bornholdt, S. (2001). "Expectation Bubbles in a Spin Model of Markets."
  *International Journal of Modern Physics C*, 12(5), 667--674.

**Financial Interpretation**

| Ising Parameter | Market Meaning |
|-----------------|----------------|
| $s_i = +1$ | Market participant $i$ is buying |
| $s_i = -1$ | Market participant $i$ is selling |
| $J > 0$ | Herding (participants imitate neighbors) |
| $J < 0$ | Contrarian behavior (mean reversion) |
| $h > 0$ | Bullish external news/information |
| $J > J_c$ (critical coupling) | Spontaneous magnetization = bubble or crash |

When the coupling constant $J$ exceeds the critical value $J_c$, a phase transition
occurs: the system spontaneously magnetizes even without an external field $h$. In
financial terms, this corresponds to a market bubble or crash emerging purely from
endogenous herding dynamics, without any specific news catalyst.

**KRX-Specific Consideration**

The KRX price limit of $\pm 30\%$ acts as a truncation barrier on the Ising model's
tail behavior. Specifically, the critical exponents governing phase transitions in
the market may be underestimated when estimated from KRX data, because the most
extreme observations (those beyond $\pm 30\%$) are censored. Any direct application
of Ising/percolation critical exponents to KRX data requires censoring adjustment
(see `core_data/20_krx_structural_anomalies.md`).

**Forward Reference**

The herding mechanism modeled by the Ising model provides the theoretical foundation
for behavioral pattern signals in Stage 3 (composite signals in `signalEngine.js`),
where CSAD herding measures quantify the degree of cross-sectional return dispersion
collapse --- the empirical fingerprint of Ising-type phase transitions.

### 2.1.3 Power Laws and the Failure of the Gaussian

**Theoretical Foundation**

A power law distribution takes the form:

$$P(x) \sim x^{-\alpha}, \quad x > x_{\min}$$

where $\alpha$ is the tail exponent. On a log-log plot, this relationship appears as
a straight line with slope $-\alpha$:

$$\log P(x) = -\alpha \cdot \log x + C$$

**Key Papers:**

- Mandelbrot, B. (1963). "The Variation of Certain Speculative Prices."
  *Journal of Business*, 36(4), 394--419.
- Gopikrishnan, P. et al. (1999). "Scaling of the Distribution of Fluctuations
  of Financial Market Indices." *Physical Review E*, 60(5), 5305.
- Clauset, A., Shalizi, C.R. & Newman, M.E.J. (2009). "Power-Law Distributions
  in Empirical Data." *SIAM Review*, 51(4), 661--703.

**The Inverse Cubic Law**

Gopikrishnan et al. (1999) established that the cumulative distribution of normalized
returns for major stock indices follows a power law with exponent $\alpha \approx 3$,
known as the "inverse cubic law":

$$P(|r| > x) \sim x^{-\alpha}, \quad \alpha \approx 3$$

This is universal across developed markets (US, Japan, UK, France) and appears
robust across time periods and time scales. The implications are profound:

| Property | Gaussian ($\alpha = \infty$) | Power Law ($\alpha \approx 3$) |
|----------|---------------------------|-------------------------------|
| $\pm 3\sigma$ frequency | 0.27% (once per year) | 1--2% (3--5 times per year) |
| $\pm 5\sigma$ frequency | $6 \times 10^{-7}$ (never) | Observed during crises |
| $\pm 10\sigma$ frequency | $10^{-23}$ (impossible) | 1987 Black Monday actually occurred |
| Variance | Finite | Finite for $\alpha > 2$, infinite moments for higher orders |
| CLT convergence | Fast | Slow (Mandelbrot's "Noah effect") |

**Verification Caveat**

Clauset, Shalizi & Newman (2009) demonstrated that visual linearity on a log-log
plot is insufficient to confirm a power law. Proper verification requires KS test +
maximum likelihood estimation + likelihood ratio testing against alternative
distributions (log-normal, stretched exponential).

**Implementation Bridge**

The power law tail structure is directly measured by the Hill estimator in
`js/indicators.js`:

```
calcHillEstimator(returns, k)    [line 276]
  -> alpha = k / SUM[ln(X_i) - ln(X_{k+1})]
  -> k auto-selected: floor(sqrt(n))  [Drees & Kaufmann 1998]
  -> Returns { alpha, se, isHeavyTail: alpha < 4, k }
```

When $\hat{\alpha} < 4$ (`isHeavyTail = true`), the fourth moment (kurtosis) is
theoretically infinite, and Gaussian-based confidence intervals (including standard
Bollinger Bands) are unreliable. This triggers the EVT-aware Bollinger Band
adjustment in `IndicatorCache.bbEVT()`.

### 2.1.4 Self-Organized Criticality

**Theoretical Foundation**

Per Bak, Chao Tang, and Kurt Wiesenfeld (1987) introduced the concept of
Self-Organized Criticality (SOC) through the "sandpile model" (BTW model):

> A system naturally evolves toward a critical state in which scale-free avalanches
> occur, without any external tuning of parameters.

**Key Papers:**

- Bak, P., Tang, C. & Wiesenfeld, K. (1987). "Self-organized criticality:
  An explanation of the 1/f noise." *Physical Review Letters*, 59(4), 381--384.
- Bak, P. (1996). *How Nature Works: The Science of Self-Organized Criticality*.
  Copernicus/Springer.

**Financial Application**

The SOC framework explains why markets persistently produce crashes and booms
with power-law distributed magnitudes. Unlike a critical point in standard
statistical mechanics (which requires fine-tuning of temperature to $T_c$),
SOC systems drive themselves to criticality through their own dynamics:

1. **Accumulation phase** --- Small perturbations (trades, news) add "grains"
   to the system, building up potential energy (unrealized gains/losses).
2. **Avalanche phase** --- At the critical point, a single grain can trigger
   an avalanche of arbitrary size. The distribution of avalanche sizes follows
   a power law: $P(S) \sim S^{-\tau}$.
3. **Reset phase** --- After the avalanche, the system begins accumulating again.

This maps directly to the market cycle: gradual trend formation (accumulation),
sudden crash or breakout (avalanche), and post-crisis consolidation (reset).
The pattern types detected in `patterns.js` --- ascending triangles, wedges,
head-and-shoulders --- are geometric signatures of the accumulation phase,
while the breakout signals their termination.

**Connection to KRX Patterns**

The SOC model predicts that the magnitude of breakouts from chart patterns should
follow a power-law distribution. This is consistent with the empirical observation
that chart pattern "measured moves" exhibit high variance: a symmetrical triangle
breakout can lead to a 2% move or a 15% move, with the distribution of outcomes
being heavy-tailed rather than Gaussian.

### 2.1.5 Log-Periodic Power Laws and Bubble Detection

**Theoretical Foundation**

Didier Sornette proposed that financial bubbles exhibit a characteristic acceleration
pattern with log-periodic oscillations before a crash at critical time $t_c$:

$$\ln p(t) = A + B(t_c - t)^m + C(t_c - t)^m \cos(\omega \ln(t_c - t) + \phi)$$

where $t_c$ is the critical crash time, $m$ is the power-law exponent ($0 < m < 1$),
$\omega$ is the log-periodic angular frequency, and $\phi$ is the phase.

**Key Papers:**

- Sornette, D. & Johansen, A. (1997). "Large Financial Crashes."
  *Physica A*, 245(3--4), 411--422.
- Sornette, D. (2003). *Why Stock Markets Crash: Critical Events in Complex
  Financial Systems*. Princeton University Press.

**Academic Controversy**

The predictive power of LPPL remains contested:

| Position | Evidence |
|----------|----------|
| **Supportive** | Sornette & Johansen (1997, 2001): Post-hoc explanation of 1929, 1987, 1997 crashes |
| **Critical** | Bree & Joseph (2013): Prospective prediction accuracy approximately 30%, high false-positive rate |
| **Critical** | Fantazzini (2016): $t_c$ estimation instability renders real-time prediction "practically meaningless" |

**Practical Implications for CheeseStock**

LPPL is not directly implemented in the CheeseStock codebase. However, the
*conceptual* insight --- that accelerating price patterns with oscillations precede
reversals --- informs the design of chart pattern detectors (rising/falling wedge,
ascending/descending triangle), which capture the geometric fingerprint of
accumulation and deceleration before a breakout or reversal.

### 2.1.6 Entropy and Information Physics

**Tsallis Entropy**

Constantino Tsallis (1988) proposed a generalization of Boltzmann-Gibbs-Shannon
entropy for systems with long-range correlations:

$$S_q = \frac{1 - \sum_i p_i^q}{q - 1}$$

For $q = 1$, this reduces to Shannon entropy $H = -\sum p_i \ln p_i$. For $q \neq 1$,
the resulting $q$-Gaussian distribution naturally produces power-law tails, providing
a better fit to financial return distributions at $q \approx 1.4$--$1.5$
(Borland, 2002).

**Transfer Entropy**

The directional information flow between time series is quantified by transfer
entropy (Schreiber, 2000):

$$TE(X \to Y) = \sum p(y_{t+1}, y_t, x_t) \cdot \log \frac{p(y_{t+1}|y_t, x_t)}{p(y_{t+1}|y_t)}$$

This measures how much additional information the history of $X$ provides about the
future of $Y$, beyond what $Y$'s own history provides. In financial markets, transfer
entropy reveals sector lead-lag relationships (e.g., semiconductor sector leads
electronics sector in KRX).

**Ergodicity Warning**

Shannon and Tsallis entropies are both based on ensemble averages. In financial
returns, the time average may not equal the ensemble average (non-ergodic process).
Peters (2019), "Ergodicity Economics," *Nature Physics*, demonstrated that this
distinction is particularly severe for small-cap KRX stocks with high idiosyncratic
volatility.

### 2.1.7 Forward Derivation Table: Physics to Stage 3

| Physics Concept | core_data | Stage 3 Formula ID | JS Implementation | Application |
|-----------------|-----------|-------------------|-------------------|-------------|
| Boltzmann distribution / Market temperature | 03 S2.1 | I-26, I-27 | `calcEWMAVol()`, `classifyVolRegime()` | Volatility regime classification |
| Ising model / Herding | 03 S2.2 | CS-1 | `signalEngine` composite signals, CSAD herding | Behavioral pattern filtering |
| Power law tails ($\alpha \approx 3$) | 03 S3 | I-10 | `calcHillEstimator()` | Tail thickness measurement |
| Self-organized criticality | 03 S4.2 | P-* | `patternEngine.analyze()` breakout detection | Chart pattern breakout magnitude |
| Tsallis $q$-Gaussian | 03 S5.1 | I-3E | `IndicatorCache.bbEVT()` | EVT-corrected Bollinger Bands |
| Fractal scaling / Self-similarity | 03 S3.2 | I-9 | `calcHurst()` | Trend persistence measurement |
| Transfer entropy / Lead-lag | 03 S5.2 | --- | Not implemented | Future: sector rotation signals |
| LPPL / Bubble signatures | 03 S4.3 | --- | Conceptual only | Informs wedge/triangle design |

---

## 2.2 Mathematics --- Formal Foundations

> **Core Documents:** `core_data/01_mathematics.md`, `core_data/10_optimal_control.md`,
> `core_data/13_information_geometry.md`
> **Discipline Level:** L1 (First Abstraction Layer)
> **Key Scholars:** Kolmogorov (1933), Bachelier (1900), Ito (1944), Mandelbrot (1963),
> Kalman (1960), Amari (1985)

Mathematics provides the formal language in which every financial model is expressed.
The stochastic processes of Section 2.2.2 give rise to the continuous-time models that
underpin option pricing and risk management. The fractal geometry of Section 2.2.4
explains why financial time series exhibit self-similarity across time scales --- the
foundational reason that technical analysis works at all time frames.

### 2.2.1 Probability Theory

**Kolmogorov Axioms (1933)**

All probability calculations in CheeseStock rest on Kolmogorov's axiomatic foundation:

A probability space is a triple $(\Omega, \mathcal{F}, P)$ where:

- $\Omega$ is the sample space (all possible future price paths),
- $\mathcal{F}$ is a sigma-algebra (the collection of measurable events),
- $P$ is a probability measure satisfying $P(\Omega) = 1$.

**Key Papers:**

- Kolmogorov, A.N. (1933). *Grundbegriffe der Wahrscheinlichkeitsrechnung*.
  Ergebnisse der Mathematik, Springer.

**Conditional Probability and Bayes' Theorem**

$$P(A|B) = \frac{P(B|A) \cdot P(A)}{P(B)}$$

In financial terms: $A$ = "price rises in next 5 bars," $B$ = "RSI is below 30."
Bayes' theorem provides the formal framework for combining pattern signals with
prior market beliefs.

**Application to Pattern Analysis**

The PatternEngine's confidence scoring is, conceptually, a Bayesian posterior update.
When multiple patterns are detected simultaneously:

$$P(\text{rise} | \text{pattern}_1, \text{pattern}_2, \ldots) \propto P(\text{rise}) \cdot \prod_i P(\text{pattern}_i | \text{rise})$$

under the naive Bayes conditional independence assumption. This is the theoretical
basis for composite signal aggregation in `signalEngine.js`.

**Martingale Theory**

A stochastic process $\{X_n\}$ is a martingale if:

$$E[X_{n+1} | X_1, X_2, \ldots, X_n] = X_n$$

The Efficient Market Hypothesis (EMH) states that log-returns form a martingale:
$E[\ln(P_{t+1}/P_t) | \Phi_t] = \mu$ (constant). Technical analysis is fundamentally
a bet against the martingale property --- that past price patterns contain information
about future returns. The empirical evidence (Lo & MacKinlay, 1999) suggests that
markets exhibit autocorrelation structures inconsistent with the pure martingale,
validating the premise of pattern-based prediction.

**Precision Note on Martingale vs. EMH**

Price levels $P_t$ are *not* martingales even under EMH, because by Jensen's inequality:
$E[P_{t+1} | \Phi_t] = P_t \cdot \exp(\mu + \sigma^2/2) \neq P_t$. The distinction
between testing price-level patterns (not inconsistent with EMH) and return-level
prediction (directly tests EMH) is critical for interpreting backtesting results.

### 2.2.2 Stochastic Processes

**Random Walk --- Bachelier (1900)**

$$S_t = S_{t-1} + \varepsilon_t, \quad \varepsilon_t \sim N(0, \sigma^2)$$

Louis Bachelier's 1900 doctoral thesis *Theorie de la speculation* was the first
mathematical model of financial prices, predating Einstein's Brownian motion paper by
five years. If prices follow a pure random walk, technical analysis is futile.

**Key Papers:**

- Bachelier, L. (1900). "Theorie de la speculation." *Annales Scientifiques de
  l'Ecole Normale Superieure*, 17, 21--86.
- Lo, A.W. & MacKinlay, A.C. (1999). *A Non-Random Walk Down Wall Street*.
  Princeton University Press.

Lo & MacKinlay (1999) provided the definitive statistical rebuttal: autocorrelation
and heteroskedasticity in return series demonstrate that the random walk model is
rejected at conventional significance levels.

**Geometric Brownian Motion (GBM)**

$$dS_t = \mu S_t \, dt + \sigma S_t \, dW_t$$

with solution:

$$S_t = S_0 \cdot \exp\left((\mu - \sigma^2/2)t + \sigma W_t\right)$$

where $\mu$ is the drift (expected return), $\sigma$ is the volatility, and $W_t$ is
a standard Wiener process. GBM is the foundation of the Black-Scholes model and
provides the theoretical price simulation model used in `api.js` demo data generation.

**Sigma Disambiguation**

In this document, $\sigma$ carries different meanings depending on context:

| Symbol | Context | Unit | Example |
|--------|---------|------|---------|
| $\sigma_{\text{GBM}}$ | GBM diffusion coefficient | Dimensionless (annualized return vol) | 0.30 = 30% per year |
| $\sigma_{\text{price}}$ | Price standard deviation (Bollinger Bands) | KRW | Used in `calcBB()` |
| $\sigma_{\text{return}}$ | Return standard deviation | Dimensionless | 0.02 = 2% per day |

Daily conversion: $\sigma_{\text{daily}} = \sigma_{\text{annual}} / \sqrt{250}$
(using KRX trading days, not the US convention of 252).

**Jump-Diffusion --- Merton (1976)**

$$\frac{dS_t}{S_t} = (\mu - \lambda k) \, dt + \sigma \, dW_t + J \, dN_t$$

where $N_t$ is a Poisson process with intensity $\lambda$, and $J$ is the jump size
(log-normally distributed). This model captures gap-up/gap-down behavior in
candlestick patterns (abandoned baby, star patterns). The rarity of gap patterns in
KRX data, compared to US markets, is partly attributable to the $\pm 30\%$ price limit
acting as a natural jump-size truncation.

### 2.2.3 Ito Calculus

**Ito's Lemma**

For a twice-differentiable function $f(S, t)$ where $dS = \mu S \, dt + \sigma S \, dW$:

$$df = \left(\frac{\partial f}{\partial t} + \mu S \frac{\partial f}{\partial S} + \frac{1}{2}\sigma^2 S^2 \frac{\partial^2 f}{\partial S^2}\right) dt + \sigma S \frac{\partial f}{\partial S} \, dW$$

**Key Paper:**

- Ito, K. (1944). "Stochastic integral." *Proceedings of the Imperial Academy*, 20(8), 519--524.

**Application to Finance**

Ito's lemma is the chain rule of stochastic calculus. Its applications include:

1. **Black-Scholes derivation** --- Setting $f = C(S,t)$ (option price) and applying
   delta-hedging yields the Black-Scholes PDE.
2. **Log-price dynamics** --- Applying Ito's lemma to $f(S) = \ln S$ yields
   $d(\ln S) = (\mu - \sigma^2/2) dt + \sigma dW$, explaining the $-\sigma^2/2$ drift
   correction in GBM.
3. **HJB equation derivation** --- The Hamilton-Jacobi-Bellman equation of optimal
   control (Section 2.2.6) requires Ito's lemma to handle the stochastic term.

### 2.2.4 Fractal Mathematics

**Self-Similarity and Fractal Dimension**

Benoit Mandelbrot introduced fractal geometry to finance, demonstrating that price
series exhibit statistical self-similarity across time scales:

$$X(ct) \stackrel{d}{=} c^H \cdot X(t)$$

where $H$ is the Hurst exponent and $\stackrel{d}{=}$ denotes equality in distribution.
The fractal dimension $D$ of a price series is related to $H$ by $D = 2 - H$.

**Key Papers:**

- Mandelbrot, B. (1963). "The Variation of Certain Speculative Prices."
  *Journal of Business*, 36(4), 394--419.
- Mandelbrot, B. (1982). *The Fractal Geometry of Nature*. W.H. Freeman.
- Peters, E. (1994). *Fractal Market Analysis*. Wiley.

**The Hurst Exponent**

Harold Edwin Hurst (1951) discovered long-range dependence in the Nile river flood
data using Rescaled Range (R/S) analysis:

$$E\left[\frac{R(n)}{S(n)}\right] = C \cdot n^H$$

where $R(n)$ is the range of cumulative deviations from the mean over a window of
size $n$, $S(n)$ is the standard deviation over the same window, and $H$ is the
Hurst exponent:

| $H$ value | Interpretation | Optimal Strategy Type |
|-----------|---------------|----------------------|
| $H = 0.5$ | Random walk (independent increments) | No edge |
| $H > 0.5$ | Persistent / trending | Trend-following (MA crossover, breakout) |
| $H < 0.5$ | Anti-persistent / mean-reverting | Mean-reversion (Bollinger, RSI) |

**Precision on H vs. alpha**

The relationship $H = 1/\alpha$ holds only for Levy stable processes. For financial
returns (power-law tails with $\alpha \approx 3$ but $H \approx 0.5$--$0.6$), the
Levy relationship fails. The two parameters measure orthogonal properties:
$\alpha$ measures static distributional thickness (tail behavior), while $H$ measures
dynamic temporal dependence (memory structure). They must be estimated independently
--- $H$ via R/S analysis, $\alpha$ via the Hill estimator (Samorodnitsky & Taqqu, 1994).

**Implementation Bridge**

```
calcHurst(closes, minWindow=10)    [indicators.js line 212]
  -> Converts prices to log-returns: r_t = ln(P_{t+1}/P_t)
  -> Computes R/S for geometrically spaced windows: w, 1.5w, 2.25w, ...
  -> Population sigma (1/n) per Mandelbrot & Wallis (1969) convention
  -> Linear regression: log(R/S) = H * log(n) + c
  -> Returns { H: slope, rSquared: regression quality }
  -> S=0 blocks excluded (flat-price guard, M-9 fix)
```

The Hurst exponent output feeds into pattern confidence adjustments: when $H > 0.5$
(persistent), trend-following patterns (ascending triangle, three white soldiers)
receive confidence boosts; when $H < 0.5$ (anti-persistent), mean-reversion patterns
(Bollinger Band squeeze, RSI divergence) are favored.

**Why Technical Analysis Works Across Timeframes**

The self-similarity property $X(ct) \stackrel{d}{=} c^H X(t)$ is the mathematical
foundation for why the same pattern types appear on 1-minute, hourly, daily, and
weekly charts. The statistical structure of price series is preserved under time-scale
transformation, so a head-and-shoulders pattern on a 5-minute chart has the same
probabilistic meaning as one on a daily chart.

### 2.2.5 Linear Algebra

**Matrix Operations**

Linear algebra provides the computational backbone for regression analysis, factor
models, and portfolio optimization. The critical operations implemented in
`js/indicators.js` are:

**Matrix Inversion via Gauss-Jordan Elimination**

```
_invertMatrix(m)    [indicators.js line 950]
  -> Augmented matrix [m | I]
  -> Partial pivoting: max absolute value row selection
  -> Singular matrix detection: |pivot| < 1e-12 -> returns null
  -> Returns n x n inverse matrix
```

This function is the foundation of the entire WLS regression pipeline: it computes
$(X^T W X + \lambda I)^{-1}$ in `calcWLSRegression()`.

**Ridge Regression**

The Ridge regression estimator (Hoerl & Kennard, 1970) adds L2 regularization to
prevent singular or ill-conditioned design matrices:

$$\hat{\beta} = (X^T W X + \lambda I)^{-1} X^T W y$$

where $\lambda > 0$ is the regularization parameter. In `calcWLSRegression()`,
the intercept column (j=0) is exempt from penalization, following standard
statistical practice.

**Key Papers:**

- Hoerl, A.E. & Kennard, R.W. (1970). "Ridge Regression: Biased Estimation for
  Nonorthogonal Problems." *Technometrics*, 12(1), 55--67.
- Golub, G.H., Heath, M. & Wahba, G. (1979). "Generalized Cross-Validation as a
  Method for Choosing a Good Ridge Parameter." *Technometrics*, 21(2), 215--223.

**Jacobi Eigendecomposition**

The GCV lambda selection function `selectRidgeLambdaGCV()` requires eigenvalues of the
$X^T X$ matrix, computed by Jacobi eigendecomposition (`_jacobiEigen()`). This implements
the classical Jacobi rotation algorithm (Jacobi, 1846) for symmetric matrices, with
convergence guaranteed for any real symmetric input.

### 2.2.6 Optimal Control Theory

**Hamilton-Jacobi-Bellman Equation**

The HJB equation is the fundamental PDE of stochastic optimal control:

$$\frac{\partial V}{\partial t} + \max_u \left[ f(x,u) + \mu(x,u) \frac{\partial V}{\partial x} + \frac{1}{2} \sigma^2(x,u) \frac{\partial^2 V}{\partial x^2} \right] = 0$$

with boundary condition $V(T, x) = g(x)$.

**Key Papers:**

- Bellman, R. (1957). *Dynamic Programming*. Princeton University Press.
- Fleming, W.H. & Rishel, R.W. (1975). *Deterministic and Stochastic Optimal Control*.
  Springer.

**The Kalman Filter**

The Kalman filter (Kalman, 1960) is the optimal state estimator for a linear Gaussian
system. It emerges as the solution to the Linear-Quadratic-Gaussian (LQG) control
problem, a special case of the HJB framework where the state dynamics are linear and
the cost functional is quadratic:

$$\hat{x}_t = \hat{x}_{t-1} + K_t (z_t - \hat{x}_{t-1})$$

$$K_t = \frac{P_{t|t-1}}{P_{t|t-1} + R}$$

$$P_{t|t-1} = P_{t-1} + Q$$

where $\hat{x}_t$ is the state estimate (smoothed price), $K_t$ is the Kalman gain,
$P_t$ is the estimation error covariance, $Q$ is the process noise (how much the true
state changes per step), $R$ is the measurement noise (observation uncertainty), and
$z_t$ is the observed price.

**Key Paper:**

- Kalman, R.E. (1960). "A New Approach to Linear Filtering and Prediction Problems."
  *Transactions of the ASME, Journal of Basic Engineering*, 82(1), 35--45.

**Implementation Bridge**

```
calcKalman(closes, Q=0.01, R=1.0)    [indicators.js line 170]
  -> State initialization: x = closes[0], P = 1.0
  -> Adaptive Q: Mohamed & Schwarz (1999)
     Q_t = Q_base * (ewmaVar_t / meanVar)
     -> Low volatility: smoother output (smaller Q)
     -> High volatility: more responsive (larger Q)
  -> EWMA variance: alpha = 0.06 (~30-bar half-life)
  -> Returns smoothed price array
```

The adaptive Q modification is a departure from the classical constant-parameter
Kalman filter. It implements the insight of Mohamed & Schwarz (1999), "Adaptive Kalman
Filtering for INS/GPS," that the process noise covariance should scale with the
observed volatility regime. This connects the optimal control theory of Section 2.2.6
to the statistical mechanics "market temperature" concept of Section 2.1.1.

### 2.2.7 Information Geometry

**Fisher Information Matrix**

The Fisher Information Matrix is the Riemannian metric tensor on the statistical
manifold --- the space of probability distributions:

$$I(\theta)_{ij} = E\left[ \frac{\partial \log p(x;\theta)}{\partial \theta_i} \cdot \frac{\partial \log p(x;\theta)}{\partial \theta_j} \right]$$

**Key Papers:**

- Fisher, R.A. (1922). "On the Mathematical Foundations of Theoretical Statistics."
  *Philosophical Transactions of the Royal Society A*, 222, 309--368.
- Rao, C.R. (1945). "Information and the Accuracy Attainable in the Estimation of
  Statistical Parameters." *Bulletin of the Calcutta Mathematical Society*, 37, 81--91.
- Amari, S. (1985). *Differential-Geometrical Methods in Statistics*. Lecture Notes
  in Statistics 28, Springer.

**Cramer-Rao Lower Bound**

$$\text{Var}(\hat{\theta}) \geq I(\theta)^{-1}$$

No unbiased estimator can have variance smaller than the inverse Fisher information.
This establishes the *theoretical floor* for estimation precision in all technical
indicators: no matter how sophisticated the algorithm, there is a fundamental
information-theoretic limit to how precisely volatility, trend strength, or Hurst
exponent can be estimated from a finite sample.

**KL Divergence and Regime Detection**

$$D_{KL}(P \| Q) = \int p(x) \cdot \log \frac{p(x)}{q(x)} \, dx$$

The infinitesimal form of KL divergence equals the Fisher metric:
$D_{KL}(p(x;\theta) \| p(x;\theta+d\theta)) \approx \frac{1}{2} d\theta^T I(\theta) d\theta$.

In the CheeseStock context, information geometry provides the theoretical basis for
regime change detection: a rapid increase in the "distance" between consecutive return
distributions on the statistical manifold signals a regime shift. While not directly
implemented as a stand-alone indicator, this concept underpins the HMM regime
classification loaded from `data/backtest/flow_signals.json`.

### 2.2.8 Forward Derivation Table: Mathematics to Stage 3

| Math Concept | core_data | Stage 3 Formula ID | JS Implementation | Application |
|--------------|-----------|-------------------|-------------------|-------------|
| Probability (Kolmogorov axioms) | 01 S1.1 | --- | All statistical functions | Foundational framework |
| Bayes' theorem | 01 S1.2 | CS-* | `signalEngine` composite aggregation | Multi-pattern confidence fusion |
| Martingale theory | 01 S1.4 | --- | Conceptual (EMH counterfactual) | Justification for pattern analysis |
| Random walk / GBM | 01 S2 | --- | `api.js` demo data generator | Price simulation |
| Ito calculus | 01 (implicit) | I-26 | `calcEWMAVol()` (discrete Ito) | Volatility estimation |
| Fractal geometry / Hurst | 01 S5 | I-9 | `calcHurst()` | Trend persistence, strategy selection |
| SMA (FIR filter) | 01 S3.1 | I-1 | `calcMA(data, n)` | Moving average |
| EMA (IIR filter) | 01 S3.2 | I-2 | `calcEMA(data, n)` | Exponential moving average |
| Fourier / Wavelet | 01 S4 | --- | Not implemented | Future: multi-scale decomposition |
| Chaos / Lyapunov | 01 S6 | --- | Conceptual | Short-term vs. long-term prediction bounds |
| Shannon entropy | 01 S7 | --- | Not implemented | Future: uncertainty quantification |
| Matrix inversion | 01 (applied) | I-18 | `_invertMatrix(m)` | WLS regression backbone |
| Ridge regression | 01+17 | I-15 | `calcWLSRegression()` | Pattern return prediction |
| Eigendecomposition | 01 (applied) | I-16a | `_jacobiEigen(A, p)` | GCV lambda selection |
| Kalman filter (LQG) | 10 S5 | I-8 | `calcKalman(closes, Q, R)` | Adaptive price smoothing |
| HJB equation | 10 S2 | --- | Theoretical (Merton portfolio) | Optimal control framework |
| Fisher information | 13 S2 | --- | Theoretical (Cramer-Rao bound) | Estimation precision limits |
| KL divergence | 13 S4 | --- | Implicit (HMM regime) | Regime change detection |

---

## 2.3 Statistics --- Empirical Methods

> **Core Documents:** `core_data/02_statistics.md`, `core_data/12_extreme_value_theory.md`,
> `core_data/17_regression_backtesting.md`, `core_data/34_volatility_risk_premium_harv.md`
> **Discipline Level:** L2 (Empirical Methods Layer)
> **Key Scholars:** Bollerslev (1986), Hill (1975), Hoerl & Kennard (1970),
> MacKinnon & White (1985), Theil (1950), Corsi (2009), Page (1954)

Statistics provides the empirical toolkit that transforms raw market data into
actionable measurements. Every technical indicator in CheeseStock is, at its core, a
statistical estimator --- RSI estimates momentum probability, Bollinger Bands estimate
a confidence interval, and the Hill estimator measures tail thickness. This section
traces the statistical lineage of each computational method.

### 2.3.1 Time Series Analysis

**Stationarity and Differencing**

Financial price series $P_t$ are non-stationary (unit root process), but log-returns
$r_t = \ln(P_t/P_{t-1})$ are approximately stationary. Weak stationarity requires:

1. $E[X_t] = \mu$ (constant mean)
2. $\text{Var}(X_t) = \sigma^2$ (constant variance)
3. $\text{Cov}(X_t, X_{t+h}) = \gamma(h)$ (autocovariance depends only on lag $h$)

**Key Paper:**

- Dickey, D.A. & Fuller, W.A. (1979). "Distribution of the Estimators for
  Autoregressive Time Series with a Unit Root." *JASA*, 74, 427--431.

**Autocorrelation Function (ACF)**

$$\rho(h) = \frac{\gamma(h)}{\gamma(0)} = \frac{\text{Cov}(X_t, X_{t+h})}{\text{Var}(X_t)}$$

The critical empirical observation for financial returns is:

- ACF of raw returns $r_t \approx 0$ (consistent with weak-form EMH)
- ACF of $|r_t|$ and $r_t^2 > 0$ with slow decay (volatility clustering)

This slow decay of the absolute-return ACF is the empirical fingerprint of GARCH
effects and long memory in volatility --- the phenomenon that the HAR-RV model
(Section 2.3.5) is designed to capture.

**Implementation Bridge**

Every moving average function in `indicators.js` is implicitly a time-series filter
operating on the stationarity assumption:

```
calcMA(data, n)    [line 15]  -> FIR filter, uniform weights 1/n
calcEMA(data, n)   [line 26]  -> IIR filter, exponential decay k=2/(n+1)
calcRSI(closes, period=14) [line 63] -> Wilder smoothing (EMA variant)
```

### 2.3.2 GARCH and Conditional Volatility

**GARCH(1,1) --- Bollerslev (1986)**

$$\sigma_t^2 = \omega + \alpha \cdot \varepsilon_{t-1}^2 + \beta \cdot \sigma_{t-1}^2$$

where $\omega > 0$, $\alpha \geq 0$, $\beta \geq 0$, and $\alpha + \beta < 1$ for
stationarity.

**Key Papers:**

- Engle, R.F. (1982). "Autoregressive Conditional Heteroskedasticity with Estimates
  of the Variance of United Kingdom Inflation." *Econometrica*, 50(4), 987--1007.
  (2003 Nobel Prize)
- Bollerslev, T. (1986). "Generalized Autoregressive Conditional Heteroskedasticity."
  *Journal of Econometrics*, 31(3), 307--327.

**EWMA as IGARCH Special Case**

The EWMA volatility model is the IGARCH (Integrated GARCH) special case with
$\omega = 0$ and $\alpha + \beta = 1$:

$$\sigma_t^2 = \lambda \cdot \sigma_{t-1}^2 + (1 - \lambda) \cdot r_{t-1}^2$$

where $\lambda = \beta / (\alpha + \beta)$.

**Key Paper:**

- J.P. Morgan/Reuters. (1996). *RiskMetrics --- Technical Document*. 4th edition.

The RiskMetrics convention of $\lambda = 0.94$ for daily data (half-life $\approx$ 11.2
trading days) is the default in `calcEWMAVol()`. The formula derivation connects
directly to the statistical mechanics framework: EWMA variance tracks the
"instantaneous temperature" of the market.

**Implementation Bridge**

```
calcEWMAVol(closes, lambda=0.94)    [indicators.js line 1336]
  -> Log-returns: r_t = ln(P_t / P_{t-1})
  -> Initial variance: sample variance of first min(20, n-1) returns
  -> Recursion: variance = lambda * variance + (1-lambda) * r_t^2
  -> Returns: sqrt(variance) array (conditional standard deviation)
  -> Flat-price guard: initVar = max(initVar, 1e-8)
```

### 2.3.3 Extreme Value Theory

**The Failure of the Normal Distribution**

The fundamental motivation for EVT in finance is the catastrophic inadequacy of
Gaussian tail probabilities:

| Event Size | Gaussian Predicted Frequency | Observed Frequency |
|------------|-----------------------------|--------------------|
| $\pm 3\sigma$ | 0.27% (once per year) | 1--2% (3--5 times per year) |
| $\pm 5\sigma$ | $6 \times 10^{-7}$ (once in 14,000 years) | Multiple times during crises |
| $\pm 10\sigma$ | $10^{-23}$ (never in the universe's lifetime) | 1987 Black Monday: actually occurred |

**Generalized Extreme Value Distribution**

The Fisher-Tippett-Gnedenko theorem (Fisher & Tippett, 1928; Gnedenko, 1943) states
that properly normalized block maxima converge to the GEV distribution:

$$G(x; \mu, \sigma, \xi) = \exp\left\{-\left[1 + \xi \frac{x - \mu}{\sigma}\right]^{-1/\xi}\right\}$$

where the shape parameter $\xi$ determines the tail type:

| $\xi$ | Distribution Type | Tail Behavior | Relevance |
|-------|-------------------|---------------|-----------|
| $\xi = 0$ | Gumbel (Type I) | Exponential decay (thin tail) | Normal distribution extremes |
| $\xi > 0$ | Frechet (Type II) | Power-law decay (fat tail) | **Financial returns** |
| $\xi < 0$ | Weibull (Type III) | Finite upper bound | Not relevant to finance |

Financial returns are empirically Frechet-type with $\xi \approx 0.2$--$0.4$,
confirming the power-law tail structure.

**Hill Tail Estimator**

$$\hat{\alpha} = \frac{k}{\sum_{i=1}^{k} [\ln X_{(i)} - \ln X_{(k+1)}]}$$

where $X_{(1)} \geq X_{(2)} \geq \ldots$ are the order statistics (sorted absolute
returns), and $k$ is the number of upper-order statistics used.

**Key Papers:**

- Hill, B.M. (1975). "A Simple General Approach to Inference About the Tail of a
  Distribution." *Annals of Statistics*, 3(5), 1163--1174.
- Drees, H. & Kaufmann, E. (1998). "Selecting the Optimal Sample Fraction in
  Univariate Extreme Value Estimation." *Stochastic Processes and their
  Applications*, 75, 149--172.

**Implementation Bridge**

```
calcHillEstimator(returns, k)    [indicators.js line 276]
  -> Absolute values sorted descending: |r_1| >= |r_2| >= ...
  -> k auto-selection: max(2, floor(sqrt(n)))  [Drees & Kaufmann 1998]
  -> Hill formula: alpha = k / sum[ln|r_i| - ln|r_{k+1}|]
  -> Asymptotic SE: se = alpha / sqrt(k)
  -> NOTE: SE assumes IID; dependent data requires declustering
  -> Returns { alpha, se, isHeavyTail: alpha < 4, k }
```

**Generalized Pareto Distribution (POT Method)**

The Pickands-Balkema-de Haan theorem states that for a sufficiently high threshold $u$,
the conditional distribution of exceedances follows the GPD:

$$H(y; \sigma, \xi) = 1 - \left(1 + \xi \frac{y}{\sigma}\right)^{-1/\xi}, \quad y > 0$$

**Key Papers:**

- Pickands, J. (1975). "Statistical Inference Using Extreme Order Statistics."
  *Annals of Statistics*, 3(1), 119--131.
- Balkema, A.A. & de Haan, L. (1974). "Residual Life Time at Great Age."
  *Annals of Probability*, 2, 792--804.
- Hosking, J.R.M. & Wallis, J.R. (1987). "Parameter and Quantile Estimation for
  the Generalized Pareto Distribution." *Technometrics*, 29(3), 339--349.

**EVT-Based VaR**

$$\text{VaR}_p = u + \frac{\sigma}{\xi} \left[ \left(\frac{n}{N_u} (1-p)\right)^{-\xi} - 1 \right]$$

where $u$ is the threshold, $n$ is total observations, and $N_u$ is the number of
threshold exceedances.

**Implementation Bridge**

```
calcGPDFit(returns, quantile=0.99)    [indicators.js line 323]
  -> Minimum 500 returns (2+ years daily)
  -> Threshold: top 5% of absolute returns (core_data/12 S3.4)
  -> Minimum 30 exceedances required
  -> PWM estimation: Hosking & Wallis (1987)
     xi_hat = 2 - b0/(b0 - 2*b1)
     sigma_hat = 2*b0*b1/(b0 - 2*b1)
  -> PWM validity guard: xi clamped to < 0.5
  -> VaR: u + (sigma/xi) * [((n/Nu)*(1-p))^(-xi) - 1]
  -> Returns { VaR, xi, sigma, u, Nu }
```

The GPD VaR estimate is used in stop-loss optimization: when EVT data is available,
the GPD-based tail quantile replaces the Gaussian approximation for setting pattern
invalidation levels, providing more conservative (and empirically correct) stop
placement for heavy-tailed KRX stocks.

### 2.3.4 Regression Methods

**Ordinary Least Squares (OLS) --- Gauss (1809)**

$$\hat{\beta} = (X^T X)^{-1} X^T y$$

**Weighted Least Squares (WLS) --- Aitken (1935)**

$$\hat{\beta} = (X^T W X)^{-1} X^T W y$$

where $W = \text{diag}(w_1, \ldots, w_n)$ is the weight matrix. In CheeseStock, the
weights implement exponential time-decay ($w_i = \lambda^{T-t_i}$, $\lambda = 0.995$,
half-life $\approx$ 139 trading days), following Lo (2004) Adaptive Markets Hypothesis:
more recent patterns deserve higher weight because market efficiency varies over time.

**Key Papers:**

- Lo, A.W. (2004). "The Adaptive Markets Hypothesis." *Journal of Portfolio
  Management*, 30(5), 15--29.
- Reschenhofer, E. et al. (2021). "Time-dependent WLS for Stock Returns."
  *Journal of Financial Econometrics*.

**Ridge Regression --- Hoerl & Kennard (1970)**

$$\hat{\beta}_{\text{Ridge}} = (X^T W X + \lambda I)^{-1} X^T W y$$

The Ridge penalty $\lambda I$ serves two purposes:

1. **Numerical stability** --- Prevents singular matrix when $X^T W X$ is
   ill-conditioned (which occurs when features are highly collinear).
2. **Bias-variance tradeoff** --- Introduces small bias in exchange for reduced
   variance, improving out-of-sample prediction.

The intercept column (column 0) is exempt from penalization, following the standard
convention (centering equivalence).

**HC3 Heteroskedasticity-Consistent Standard Errors**

$$\text{Cov}_{\text{HC3}}(\hat{\beta}) = (X^T X)^{-1} \left[\sum_i \frac{e_i^2}{(1-h_{ii})^2} x_i x_i^T \right] (X^T X)^{-1}$$

where $h_{ii} = x_i^T (X^T X)^{-1} x_i$ is the leverage (hat matrix diagonal) and
$e_i$ is the OLS residual.

**Key Papers:**

- White, H. (1980). "A Heteroskedasticity-Consistent Covariance Matrix Estimator."
  *Econometrica*, 48(4), 817--838.
- MacKinnon, J.G. & White, H. (1985). "Some Heteroskedasticity-Consistent
  Covariance Matrix Estimators with Improved Finite Sample Properties."
  *Journal of Econometrics*, 29, 305--325.

HC3 is preferred over HC0 (White's original) because the $(1-h_{ii})^2$ scaling
corrects for leverage-induced underestimation of the true error variance at
high-leverage points.

**Implementation Bridge**

```
calcWLSRegression(X, y, weights, ridgeLambda)    [indicators.js line 558]
  -> Minimum sample: n >= p + 2
  -> Constructs X^T W X and X^T W y
  -> Ridge: XtWX[j][j] += ridgeLambda for j >= 1 (intercept exempt)
  -> Inverse: _invertMatrix(XtWX)
  -> Coefficients: inv * XtWy
  -> Weighted R-squared: 1 - SS_res_w / SS_tot_w
  -> Adjusted R-squared: Theil (1961) formula
  -> HC3 sandwich estimator: meat = sum[w^2 * e_i/(1-h_ii)^2 * x_i x_i^T]
  -> VIF diagnostics: auxiliary OLS for each feature [Marquardt 1970]
  -> Returns { coeffs, rSquared, stdErrors, tStats, hcStdErrors, hcTStats, vifs, ... }
```

**R-squared Interpretation in Finance**

Lo & MacKinlay (1999) established that in financial return prediction, $R^2$ values
must be interpreted differently from cross-sectional regressions:

| $R^2$ | Interpretation | Practical Significance |
|-------|---------------|----------------------|
| 0.02--0.03 | Economically meaningful | Hundreds of basis points annually |
| 0.05+ | Trading strategy grade | Actionable for systematic strategies |
| $> 0.10$ | Extremely rare | Likely overfitting or look-ahead bias |

### 2.3.5 Robust Statistics

**Theil-Sen Estimator**

$$\hat{\beta}_{\text{slope}} = \text{median}\left\{\frac{y_j - y_i}{x_j - x_i} : i < j\right\}$$

$$\hat{\beta}_{\text{intercept}} = \text{median}\{y_i - \hat{\beta}_{\text{slope}} \cdot x_i\}$$

**Key Papers:**

- Theil, H. (1950). "A Rank-Invariant Method of Linear and Polynomial Regression
  Analysis." *Proceedings of the Royal Netherlands Academy of Sciences*, 53.
- Sen, P.K. (1968). "Estimates of the Regression Coefficient Based on Kendall's Tau."
  *JASA*, 63(324), 1379--1389.

The Theil-Sen estimator has a 29.3% breakdown point (tolerates up to 29.3% arbitrary
outliers), compared to 0% for OLS. This makes it ideal for fitting trendlines in
pattern detection, where a single extreme candle (gap, spike) can devastate OLS.

**Implementation Bridge**

```
calcTheilSen(xValues, yValues)    [indicators.js line 1287]
  -> All-pairs slopes: (y_j - y_i) / (x_j - x_i) for i < j
  -> Median slope from sorted array
  -> Median intercept: median{y_k - slope * x_k}
  -> Returns { slope, intercept }
  -> Used in pattern trendline fitting (wedge, triangle detection)
```

**Huber-IRLS**

While not a separate function in `indicators.js`, the Huber-IRLS (Iteratively
Reweighted Least Squares) concept informs the IC (Information Coefficient) calculation
in the backtesting pipeline, where outlier pattern returns would otherwise dominate
the correlation estimate.

### 2.3.6 Hypothesis Testing and Multiple Comparisons

**Benjamini-Hochberg FDR (1995)**

When testing multiple patterns simultaneously (33+ pattern types, each tested for
positive expected return), the probability of at least one false positive rises
dramatically. The BH procedure controls the False Discovery Rate:

1. Sort p-values: $p_{(1)} \leq p_{(2)} \leq \ldots \leq p_{(m)}$
2. Find largest $k$ such that $p_{(k)} \leq (k/m) \cdot q$
3. Reject hypotheses $1, \ldots, k$

where $q$ is the target FDR (typically 0.05).

**Key Paper:**

- Benjamini, Y. & Hochberg, Y. (1995). "Controlling the False Discovery Rate:
  A Practical and Powerful Approach to Multiple Testing." *JRSS-B*, 57(1), 289--300.

The BH-FDR correction is applied in the pattern validation pipeline (`_applyBHFDR`)
to prevent the "data snooping" problem: testing 33 patterns on the same data and
reporting only the significant ones without correction.

### 2.3.7 Bayesian Inference and Hidden Markov Models

**Bayesian Update**

$$P(\theta | D) \propto P(D | \theta) \cdot P(\theta)$$

where $P(\theta)$ is the prior, $P(D|\theta)$ is the likelihood, and $P(\theta|D)$
is the posterior.

**Key Papers:**

- Bayes, T. (1763). "An Essay towards solving a Problem in the Doctrine of Chances."
  *Philosophical Transactions*, 53, 370--418.
- James, W. & Stein, C. (1961). "Estimation with Quadratic Loss." *Proceedings of
  the Fourth Berkeley Symposium on Mathematical Statistics*, 1, 361--379.

**James-Stein Shrinkage**

For $p \geq 3$ simultaneous estimates, the James-Stein estimator dominates the MLE
under quadratic loss:

$$\hat{\theta}_{JS} = \left(1 - \frac{(p-2)\sigma^2}{\|X\|^2}\right) X + \frac{(p-2)\sigma^2}{\|X\|^2} \mu_{\text{prior}}$$

This is the theoretical justification for the Hurst exponent shrinkage applied in
`patternEngine`: individual stock Hurst estimates (noisy, small-sample) are shrunk
toward the cross-sectional mean, reducing variance at the cost of small bias.

**Hidden Markov Models**

The HMM framework (Baum et al., 1970; Hamilton, 1989) models the market as switching
between unobserved regimes (bull, bear, sideways) with Markov transition dynamics.
The Baum-Welch algorithm (a special case of EM) estimates the transition and emission
matrices.

**Key Paper:**

- Hamilton, J.D. (1989). "A New Approach to the Economic Analysis of Nonstationary
  Time Series and the Business Cycle." *Econometrica*, 57(2), 357--384.

**Implementation Bridge**

HMM regime labels are pre-computed by the Python pipeline (`scripts/compute_flow_signals.py`)
and loaded from `data/backtest/flow_signals.json` by `appWorker.js`. The JS codebase
consumes the regime output but does not re-estimate the HMM parameters at runtime.

### 2.3.8 HAR-RV Model

**Heterogeneous Autoregressive Realized Volatility --- Corsi (2009)**

$$RV_{t+1}^{(d)} = \beta_0 + \beta_d \cdot RV_t^{(d)} + \beta_w \cdot RV_t^{(w)} + \beta_m \cdot RV_t^{(m)} + \varepsilon_{t+1}$$

where:

- $RV_t^{(d)} = r_t^2$ is the daily realized variance (1-day),
- $RV_t^{(w)} = \frac{1}{5} \sum_{i=0}^{4} r_{t-i}^2$ is the weekly component (5-day average),
- $RV_t^{(m)} = \frac{1}{M} \sum_{i=0}^{M-1} r_{t-i}^2$ is the monthly component ($M = 21$ for KRX).

**Key Papers:**

- Corsi, F. (2009). "A Simple Approximate Long-Memory Model of Realized Volatility."
  *Journal of Financial Econometrics*, 7(2), 174--196.
- Muller, U.A. et al. (1997). "Volatilities of Different Time Resolutions ---
  Analyzing the Dynamics of Market Components." *Journal of Empirical Finance*,
  4(2--3), 213--239.

**Heterogeneous Market Hypothesis**

The HAR model is grounded in the Heterogeneous Market Hypothesis (Muller et al., 1997):
market participants operate on different time horizons (daily traders, weekly swing
traders, monthly portfolio managers), and each horizon's activity generates a distinct
volatility component. The three-scale decomposition captures the "cascade" of
information from longer to shorter horizons.

**Connection to Hurst Exponent**

The long-memory property of volatility ($H_{\text{vol}} > 0.5$, slow ACF decay) can
be modeled either by fractional integration (ARFIMA) or by the HAR's discrete
approximation. Corsi (2009) showed that HAR-RV matches ARFIMA prediction accuracy
while being dramatically simpler to estimate.

**KRX Calendar Adjustment**

The KRX has approximately 250 trading days per year (vs. US 252), and the monthly
window is set to $M = 21$ (vs. 22 for US markets). Annualization uses
$\sqrt{250}$ consistently throughout the codebase.

### 2.3.9 Sequential Analysis and Change-Point Detection

**CUSUM --- Page (1954)**

The Cumulative Sum control chart detects shifts in the mean of a process:

$$S_t^+ = \max(0, \, S_{t-1}^+ + z_t - k)$$
$$S_t^- = \max(0, \, S_{t-1}^- - z_t - k)$$

where $z_t$ is the standardized observation, $k$ is the slack parameter (allowance),
and an alarm is triggered when $S_t^+ > h$ or $S_t^- > h$ (threshold $h$).

**Key Papers:**

- Page, E.S. (1954). "Continuous Inspection Schemes." *Biometrika*, 41(1/2), 100--115.
- Roberts, S.W. (1966). "A Comparison of Some Control Chart Procedures."
  *Technometrics*, 8(3), 411--430.

**Volatility-Adaptive Threshold**

The CheeseStock implementation extends the classical CUSUM with volatility-regime
adaptation (documented in `core_data/34_volatility_risk_premium_harv.md`):

| Vol Regime | Threshold $h$ | Rationale |
|------------|---------------|-----------|
| High | $\max(h, 3.5)$ | Reduce false alarms when baseline noise is elevated |
| Mid/Null | Default ($h = 2.5$) | Standard sensitivity |
| Low | $\min(h, 1.5)$ | Increase sensitivity when small shifts are meaningful |

**Implementation Bridge**

```
calcOnlineCUSUM(returns, threshold=2.5, volRegime)    [indicators.js line 1493]
  -> Warmup: first 30 bars for initial mean/variance
  -> EMA running statistics: alpha = 2/31 (~30-bar half-life)
  -> Slack parameter: k = 0.5 [Roberts 1966 ARL optimization]
  -> Bidirectional CUSUM: S_plus (upward), S_minus (downward)
  -> Alarm -> record breakpoint, reset CUSUM to 0
  -> Returns { breakpoints[], cusum, isRecent (last 20 bars), adaptedThreshold }
```

**Binary Segmentation --- Bai-Perron (1998)**

For detecting multiple structural breakpoints, the binary segmentation algorithm
greedily partitions the return series to minimize the total BIC:

$$\text{BIC}_{\text{segment}} = n \cdot \ln\left(\max\left(\frac{\text{RSS}}{n}, 10^{-12}\right)\right) + 2 \ln(n)$$

```
calcBinarySegmentation(returns, maxBreaks=3, minSegment=30)    [indicators.js line 1586]
  -> Greedy binary segmentation with BIC criterion
  -> Complexity: O(n * maxBreaks * maxSegmentSize)
  -> 252-bar, maxBreaks=3 -> ~576 iterations (real-time feasible)
```

### 2.3.10 Forward Derivation Table: Statistics to Stage 3

| Statistical Method | core_data | Stage 3 Formula ID | JS Implementation | Application |
|--------------------|-----------|-------------------|-------------------|-------------|
| Population standard deviation | 02 S1 | I-3 | `calcBB(closes, n, mult)` | Bollinger Bands ($\div n$, not $\div(n-1)$) |
| GARCH / EWMA volatility | 02 S2.4 | I-26 | `calcEWMAVol(closes, lambda)` | Conditional volatility |
| Wilder smoothing (RSI) | 02 S3.1 | I-4 | `calcRSI(closes, period)` | Momentum ratio estimation |
| Hill tail index | 12 S5 | I-10 | `calcHillEstimator(returns, k)` | Fat-tail detection |
| GPD tail fit | 12 S3 | I-11 | `calcGPDFit(returns, quantile)` | EVT-based VaR |
| WLS + Ridge regression | 17 S17.4 | I-15 | `calcWLSRegression(X, y, w, lambda)` | Pattern return prediction |
| HC3 robust SE | 17 S17.10 | I-15a | (within `calcWLSRegression`) | Heteroskedasticity correction |
| VIF diagnostic | 02 S4 | I-15b | (within `calcWLSRegression`) | Multicollinearity check |
| GCV lambda selection | 17 S17.13 | I-16 | `selectRidgeLambdaGCV()` | Ridge hyperparameter |
| Theil-Sen robust estimator | 02+07 | I-25 | `calcTheilSen(xValues, yValues)` | Outlier-resistant trendlines |
| OLS trend detection | 02 S4 | I-17 | `calcOLSTrend(closes, window, atr)` | Trend strength + R-squared |
| James-Stein shrinkage | 02 S8 | --- | Hurst shrinkage in `patternEngine` | Small-sample H stabilization |
| BH-FDR correction | 02+17 | --- | `_applyBHFDR()` in backtester | Multiple testing correction |
| HMM (Baum-Welch) | 02+21 | --- | Python pre-computed, loaded at runtime | Market regime classification |
| HAR-RV (Corsi 2009) | 34 S3 | I-30 | `calcHAR_RV()` | Multi-scale volatility forecast |
| VRP proxy | 34 S2 | I-14 | `calcVRP()`, `signalEngine.calcVolRegime()` | Risk-on/risk-off regime |
| Online CUSUM | 21 S2 | I-29 | `calcOnlineCUSUM(returns, h, vol)` | Change-point detection |
| Binary segmentation | 21 S3 | I-31 | `calcBinarySegmentation()` | Structural breakpoints |
| Block bootstrap | 02 S6 | --- | Future implementation | CI estimation preserving autocorrelation |

---

## 2.A Appendix: Complete Indicator Function Catalog

The following table maps every `calc*` function in `js/indicators.js` to its academic
discipline, primary citation, and the core_data document containing its theoretical
derivation.

| Function | Line | Academic Root | Primary Citation | core_data |
|----------|------|---------------|------------------|-----------|
| `calcMA(data, n)` | 15 | Mathematics (FIR filter) | Arithmetic mean | 01 S3.1 |
| `calcEMA(data, n)` | 26 | Mathematics/Statistics | Brown (1956) | 01 S3.2 |
| `calcBB(closes, n, mult)` | 50 | Statistics | Bollinger (2001) | 02 S1.2 |
| `calcRSI(closes, period)` | 63 | Technical Analysis | Wilder (1978) | 06 |
| `calcATR(candles, period)` | 87 | Technical Analysis | Wilder (1978) | 06 |
| `calcOBV(candles)` | 115 | Technical Analysis | Granville (1963) | 06 |
| `calcIchimoku(candles, ...)` | 135 | Technical Analysis | Hosoda (1969) | 06 |
| `calcKalman(closes, Q, R)` | 170 | Optimal Control | Kalman (1960) | 10 |
| `calcHurst(closes, minWindow)` | 212 | Physics/Fractals | Mandelbrot (1963) | 01+03 |
| `calcHillEstimator(returns, k)` | 276 | Statistics/EVT | Hill (1975) | 12 |
| `calcGPDFit(returns, quantile)` | 323 | Statistics/EVT | Pickands (1975) | 12 |
| `calcCAPMBeta(stock, market, w, rf)` | 391 | Finance Theory | Sharpe (1964) | 05+25 |
| `calcWLSRegression(X, y, w, lambda)` | 558 | Statistics | Aitken (1935) | 02+17 |
| `_invertMatrix(m)` | 950 | Mathematics | Gauss-Jordan | 01 |
| `_jacobiEigen(A, p)` | --- | Mathematics | Jacobi (1846) | 01 |
| `calcTheilSen(xValues, yValues)` | 1287 | Robust Statistics | Theil (1950) | 07 |
| `calcEWMAVol(closes, lambda)` | 1336 | Finance/Risk | RiskMetrics (1996) | 34 |
| `classifyVolRegime(ewmaVol)` | 1385 | Finance/Regime | Practitioner convention | 34+21 |
| `calcOnlineCUSUM(returns, h, vol)` | 1493 | Statistics/QC | Page (1954) | 21 |
| `calcBinarySegmentation(returns, ...)` | 1586 | Statistics | Bai-Perron (1998) | 21 |

---

## 2.B Appendix: Discipline Dependency Graph

The following diagram shows how the three foundational disciplines of this document
feed forward into the applied finance and technical analysis layers:

```
                    [L0] PHYSICS (doc 03)
                     |
                     | Boltzmann -> Market Temperature
                     | Power Laws -> Fat Tails
                     | SOC -> Crash Dynamics
                     | Ising -> Herding
                     |
         +-----------+-----------+
         |                       |
    [L1] MATHEMATICS        [L1] MATHEMATICS
    (doc 01)                (docs 10, 13)
         |                       |
         | Probability           | Kalman Filter
         | Stochastic Proc.      | HJB Equation
         | Ito Calculus           | Fisher Information
         | Fractal/Hurst          | KL Divergence
         | Linear Algebra         |
         |                       |
         +-----------+-----------+
                     |
               [L2] STATISTICS
               (docs 02, 12, 17, 34)
                     |
                     | GARCH/EWMA -> Volatility
                     | EVT/Hill/GPD -> Tail Risk
                     | WLS/Ridge/HC3 -> Regression
                     | Theil-Sen -> Robust Trends
                     | HAR-RV -> Vol Forecast
                     | CUSUM -> Change Detection
                     | HMM -> Regime Classification
                     |
         +-----------+-----------+
         |           |           |
      [L3]        [L3]       [L3]
   ECONOMICS   PSYCHOLOGY  MICROSTRUCTURE
   (Part B)     (Part B)    (Part B)
         |           |           |
         +-----------+-----------+
                     |
               [L4] FINANCE THEORY
               (Part B -> Stage 3)
                     |
               [L5] TECHNICAL ANALYSIS
               (Stage 3)
                     |
               [L6] MACHINE LEARNING
               (Stage 3)
```

Each arrow represents a logical dependency: the downstream discipline *requires* the
upstream discipline's concepts and methods. For example, EVT (L2 Statistics) requires
power-law theory (L0 Physics) and fractal mathematics (L1 Mathematics) to be
well-defined. The Ridge regression (L2 Statistics) requires matrix algebra (L1
Mathematics). And the HAR-RV model (L2 Statistics) requires GARCH theory (L2
Statistics) and the heterogeneous market hypothesis (L3 Economics, covered in Part B).

---

> **End of Stage 2 Part A**
>
> Part B (Finance, Economics, Psychology) continues from Section 2.4 onward.
> The Forward Derivation Tables in Sections 2.1.7, 2.2.8, and 2.3.10 provide the
> complete mapping from this document's foundational theories to their Stage 3
> implementations.
