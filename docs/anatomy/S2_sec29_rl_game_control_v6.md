# Section 2.9 — RL, Game Theory, & Adaptive Models

> Production Anatomy v6 — CheeseStock (cheesestock.co.kr)
> CFA Paper Grade Annotation Standard
>
> Scope: Game theory in markets, optimal control (Kalman, HJB/Merton),
> reinforcement learning (LinUCB contextual bandit), and adaptive
> pattern modeling (AMH, HMM regime switching, CUSUM, binary segmentation).
>
> Every formula includes: symbol table, constants table (Grade [A-E]),
> system mapping, and edge cases.

---

## Table of Contents

- 2.9.1 Game Theory in Markets (GT-1 through GT-3)
- 2.9.2 Optimal Control (OC-1 through OC-3)
- 2.9.3 Reinforcement Learning (RL-1 through RL-4)
- 2.9.4 Adaptive Pattern Modeling (AD-1 through AD-5)
- Appendix A: Constants Inventory
- Appendix B: Cross-Reference Map (Theory -> Code)
- References

---

## 2.9.1 Game Theory in Markets

Game theory provides the foundational logic for why technical patterns work,
why they decay, and why the market oscillates between regimes. The three
formulas below are not directly implemented in code but constitute the
intellectual scaffolding for the system's adaptive architecture.

---

### GT-1: Nash Equilibrium Definition and Market Maker Interpretation

**Academic Basis:**
Nash, J.F. (1950). "Equilibrium Points in N-Person Games." *Proceedings of
the National Academy of Sciences*, 36(1), 48-49.

**Definition:**

A strategy profile s* = (s_1*, s_2*, ..., s_n*) is a Nash equilibrium if
no player can unilaterally improve their payoff by deviating:

```
For all i in {1, ..., n}, for all s_i in S_i:

  u_i(s_i*, s_{-i}*) >= u_i(s_i, s_{-i}*)

Where:
  i       = player index
  s_i*    = player i's equilibrium strategy
  s_{-i}* = other players' equilibrium strategies (held fixed)
  u_i     = player i's payoff function
  S_i     = player i's strategy space
```

**Symbol Table:**

| Symbol | Meaning | Domain |
|--------|---------|--------|
| N = {1,...,n} | Player set | Finite |
| S_i | Strategy space of player i | Finite or compact subset of R^k |
| u_i: S -> R | Payoff function of player i | Continuous |
| s* | Equilibrium strategy profile | S_1 x ... x S_n |
| s_{-i} | Strategies of all players except i | Product space |

**Existence Theorem (Nash, 1950):**
Every finite game (finite N, finite S_i for all i) has at least one
Nash equilibrium in mixed strategies.

**Market Maker Interpretation:**

```
The market price P* is the Nash equilibrium of a double auction game:

  Players:     {buyers, sellers, market makers}
  Strategies:  bid/ask quotes, order sizes, timing
  Payoffs:     realized P&L from executed trades

At equilibrium:
  - No buyer wants to raise their bid (already optimal given asks)
  - No seller wants to lower their ask (already optimal given bids)
  - S/R lines = price levels where equilibrium is locally stable

When a technical pattern becomes widely known:
  - Pattern followers crowd into the same strategy
  - Equilibrium shifts (fewer counterparties at the pattern's predicted price)
  - Alpha decays: u_i(s_pattern*, s_{-i}*) decreases over time
```

**System Mapping:**

| Theory Element | System Component | File:Line |
|---------------|-----------------|-----------|
| Equilibrium price | S/R clustering (ATR*0.5 tolerance) | patterns.js _detectSupportResistance() |
| Strategy crowding | Tier-1 crowding set {doubleBottom, doubleTop, risingWedge, threeWhiteSoldiers} | backtester.js:110 (_rlTier1) |
| Alpha decay | LinUCB auto-dampening for Tier-1 patterns | backtester.js:349 (pattern_tier = -1) |
| Equilibrium shift | WLS lambda=0.995 exponential decay weighting | indicators.js calcWLSRegression() |

**Edge Cases:**
- Multiple equilibria: S/R zones often cluster near round numbers (KRX price ticks),
  creating multiple locally stable prices. The system handles this via ATR*0.5
  tolerance clustering in `_detectSupportResistance()`.
- Mixed-strategy equilibria: In financial markets, mixed strategies correspond to
  stochastic order flow. The system does not model mixed strategies explicitly;
  instead, pattern confidence scores (0-100) serve as a probability-like proxy.

**Constants Table:**

| Constant | Value | Grade | Location | Rationale |
|----------|-------|-------|----------|-----------|
| ATR S/R tolerance | 0.5 * ATR(14) | [C][L:GS] | patterns.js | Half-ATR cluster width |
| Tier-1 crowding set | {dB, dT, rW, tWS} | [C][L:EMP] | backtester.js:110 | Empirical alpha decay observed |

---

### GT-2: Information Asymmetry Game (Akerlof 1970 Lemons)

**Academic Basis:**
Akerlof, G.A. (1970). "The Market for 'Lemons': Quality Uncertainty and the
Market Mechanism." *Quarterly Journal of Economics*, 84(3), 488-500.
(2001 Nobel Prize in Economics)

Kyle, A.S. (1985). "Continuous Auctions and Insider Trading." *Econometrica*,
53(6), 1315-1335.

**Kyle Lambda (Price Impact):**

```
Delta_P = lambda * (order_flow)

Where:
  Delta_P    = price change induced by net order flow
  lambda     = Kyle's lambda (information asymmetry measure)
  order_flow = net signed volume (buy volume - sell volume)

Lambda interpretation:
  lambda large  -> severe information asymmetry -> wide spreads
  lambda small  -> informationally efficient market -> tight spreads
```

**Symbol Table:**

| Symbol | Meaning | Domain |
|--------|---------|--------|
| Delta_P | Price impact | R |
| lambda | Information asymmetry coefficient | R+ |
| order_flow | Net signed trading volume | R |

**System Mapping:**

The system operationalizes information asymmetry through the Amihud (2002)
illiquidity measure, which is a discrete approximation to Kyle's lambda:

```
ILLIQ_i = (1/D_i) * sum_{d=1}^{D_i} |r_{i,d}| / v_{i,d}

Where:
  r_{i,d} = daily return of stock i on day d
  v_{i,d} = daily KRW volume of stock i on day d
  D_i     = number of trading days
```

| Theory Element | System Component | File:Line |
|---------------|-----------------|-----------|
| Kyle lambda | Amihud ILLIQ proxy | backtester.js:27-38 (_getAdaptiveSlippage) |
| Spread as adverse selection cost | Segment-based slippage constants | backtester.js:33-36 |
| Information asymmetry in volume | Volume confirmation in pattern signals | signalEngine.js |

**Constants Table:**

| Constant | Value | Grade | Location | Rationale |
|----------|-------|-------|----------|-----------|
| kospi_large slippage | 0.04% | [C] | backtester.js:33 | Amihud ILLIQ-calibrated |
| kospi_mid slippage | 0.10% | [C] | backtester.js:34 | Amihud ILLIQ-calibrated |
| kosdaq_large slippage | 0.15% | [C] | backtester.js:35 | Amihud ILLIQ-calibrated |
| kosdaq_small slippage | 0.25% | [C] | backtester.js:36 | Amihud ILLIQ-calibrated |

**Edge Cases:**
- Zero-volume days: `v_{i,d} = 0` causes division by zero in ILLIQ. The system
  falls back to default `KRX_SLIPPAGE = 0.10%` when segment data is unavailable.
- Extreme ILLIQ values: KOSDAQ micro-caps can have ILLIQ 10-100x higher than
  large-caps. The segment-based bucketing (4 tiers) prevents pathological
  slippage estimates.

---

### GT-3: Signaling Game (Spence 1973) Applied to Corporate Disclosure

**Academic Basis:**
Spence, M. (1973). "Job Market Signaling." *Quarterly Journal of Economics*,
87(3), 355-374. (2001 Nobel Prize in Economics)

**Information Content of Technical Patterns:**

```
I(pattern) = -log_2 P(pattern | random)

Where:
  I(pattern)            = information content in bits
  P(pattern | random)   = probability of pattern occurring under H_0 (no signal)

Example:
  Three White Soldiers (적삼병):
    P ~ (0.5)^3 * conditional_factors ~ 0.02-0.05
    I(threeWhiteSoldiers) ~ -log_2(0.03) ~ 5 bits

Signal strength decomposition:
  Pattern + High Volume = Strong Signal (I + I_volume)
  Pattern + Low Volume  = Weak Signal   (potential noise)
```

**System Mapping:**

| Theory Element | System Component | File:Line |
|---------------|-----------------|-----------|
| Signal value | Pattern confidence score (0-100) | patterns.js _analyzeCandle*() |
| Volume confirmation | Volume factor in composite signals | signalEngine.js volumeConfirmation |
| Signal vs noise | Quality scoring (ATR-normalized) | patterns.js _qualityScore() |
| Credible signal | Multi-factor confluence with S/R | patterns.js _srConfluence() |

**Edge Cases:**
- False signals: Low-volume patterns may be noise rather than informed trading.
  The system addresses this through quality scoring that penalizes low-volume
  patterns.
- Cheap talk: Patterns in seed-generated data have no information content. The
  Data Trust System (3-tier: dart > hardcoded > seed) prevents seed data from
  displaying real metrics.

---

## 2.9.2 Optimal Control

The optimal control framework connects classical technical analysis tools
(moving averages, RSI, stop-loss) to their theoretical optimality conditions.
The Kalman filter is the only optimal control formula directly implemented
in the JavaScript runtime.

---

### OC-1: Kalman Filter State Estimation

**Academic Basis:**
Kalman, R.E. (1960). "A New Approach to Linear Filtering and Prediction
Problems." *Journal of Basic Engineering*, 82(1), 35-45.

Mohamed, A.H. & Schwarz, K.P. (1999). "Adaptive Kalman Filtering for INS/GPS."
*Journal of Geodesy*, 73, 193-203. (Adaptive Q)

**State-Space Model:**

```
State Equation:     x_{t+1} = F * x_t + w_t       (w_t ~ N(0, Q))
Observation Eq:     z_t     = H * x_t + v_t        (v_t ~ N(0, R))

Prediction Step:
  x_hat_{t|t-1} = F * x_hat_{t-1|t-1}
  P_{t|t-1}     = F * P_{t-1|t-1} * F' + Q

Update Step:
  K_t       = P_{t|t-1} * H' * (H * P_{t|t-1} * H' + R)^{-1}    -- Kalman gain
  x_hat_t   = x_hat_{t|t-1} + K_t * (z_t - H * x_hat_{t|t-1})   -- state update
  P_t       = (I - K_t * H) * P_{t|t-1}                          -- covariance update
```

**Symbol Table:**

| Symbol | Meaning | Domain |
|--------|---------|--------|
| x_t | True (hidden) state at time t | R |
| z_t | Observation (noisy measurement) at time t | R |
| F | State transition matrix | In CheeseStock: F=1 (random walk) |
| H | Observation matrix | In CheeseStock: H=1 (direct observation) |
| Q | Process noise covariance | R+ (0.01 base, adaptive) |
| R | Measurement noise covariance | R+ (1.0 default) |
| K_t | Kalman gain at time t | [0, 1] |
| P_t | State estimation error covariance | R+ |

**Simplified Scalar Form (as implemented):**

For CheeseStock's 1D price filter (F=H=1), the recursion simplifies to:

```
x_hat_t = x_hat_{t-1} + K_t * (z_t - x_hat_{t-1})

K_t = P_{pred} / (P_{pred} + R)

P_{pred} = P_{t-1} + Q_t    (adaptive Q)

This is equivalent to EMA with time-varying alpha = K_t.
When Q/R is constant: K_t -> K_steady = Q/(Q + R) as t -> infinity.
```

**Adaptive Process Noise (Mohamed & Schwarz 1999):**

```
Q_t = Q_base * (sigma_t^2 / sigma_bar^2)

Where:
  sigma_t^2 = EWMA variance of returns (alpha = 0.06, ~30-bar half-life)
  sigma_bar^2 = cumulative mean variance
  Q_base    = 0.01 (baseline process noise)

Effect:
  High volatility period: Q_t >> Q_base -> K_t -> 1 -> fast tracking
  Low volatility period:  Q_t << Q_base -> K_t -> 0 -> smooth filtering
```

**System Mapping:**

| Theory Element | Implementation | File:Line |
|---------------|---------------|-----------|
| calcKalman(closes, Q, R) | Scalar Kalman filter on closing prices | indicators.js:170-200 |
| Adaptive Q | EWMA variance ratio | indicators.js:178-188 |
| State = price trend | x_hat = smoothed price | indicators.js:173 |
| Kalman gain K | P_pred / (P_pred + R) | indicators.js:194 |
| IndicatorCache.kalman() | Lazy-eval cache wrapper | indicators.js:1822 |

**Implementation Detail (indicators.js:170-200):**

```javascript
function calcKalman(closes, Q = 0.01, R = 1.0) {
  // x = state estimate, P = estimation error
  let x = closes[0], P = 1.0;

  // Adaptive Q via EWMA variance (alpha=0.06, ~30-bar)
  var ewmaVar = 0, ewmaAlpha = 0.06;
  var varSum = 0, varCount = 0;

  for (let i = 1; i < closes.length; i++) {
    var ret = (closes[i] - closes[i-1]) / closes[i-1];
    ewmaVar = ewmaAlpha * ret*ret + (1 - ewmaAlpha) * ewmaVar;
    varSum += ewmaVar; varCount++;
    var meanVar = varSum / varCount;
    var qAdaptive = meanVar > 0 ? Q * (ewmaVar / meanVar) : Q;

    const xPred = x;
    const PPred = P + qAdaptive;
    const K = PPred / (PPred + R);         // Kalman gain
    x = xPred + K * (closes[i] - xPred);  // State update
    P = (1 - K) * PPred;                  // Covariance update
    result[i] = x;
  }
}
```

**Constants Table:**

| Constant | Value | Grade | Location | Rationale |
|----------|-------|-------|----------|-----------|
| Q (process noise) | 0.01 | [D][L:GS] | indicators.js:170 | Heuristic default; adaptive Q compensates |
| R (measurement noise) | 1.0 | [D][L:GS] | indicators.js:170 | Assumed unit noise |
| EWMA alpha (adaptive Q) | 0.06 | [B][L:GS] | indicators.js:179 | ~2/(30+1), 30-bar EWMA half-life |

**Edge Cases:**
- `closes[i-1] <= 0`: Division by zero in return calculation. Guarded by
  `if (closes[i-1] <= 0) continue;` at line 183.
- Empty input: `if (!closes.length) return [];` at line 171.
- Flat price (all returns = 0): `ewmaVar` stays at 0, `meanVar` stays at 0,
  `qAdaptive` falls back to `Q` (the base value). The Kalman filter degenerates
  to exponential smoothing.
- P convergence: For stationary processes, P converges to steady-state
  P_ss = (-R + sqrt(R^2 + 4QR)) / 2. With Q=0.01, R=1.0: P_ss ~ 0.095,
  K_ss ~ 0.087 (slow tracking, heavy smoothing).

**Connection to EMA:**
Under constant Q and R, the Kalman filter reduces to an EMA with:
```
alpha_EMA = K_steady = Q / (Q + R + sqrt((Q+R)^2 - Q^2)) (approx)
```
For Q=0.01, R=1.0: alpha_EMA ~ 0.087, equivalent to ~22-period EMA.
The adaptive Q extension makes alpha_EMA time-varying, which standard
EMA cannot achieve.

---

### OC-2: Kalman Gain Derivation

**Formula:**

```
K_t = P_{t|t-1} * H' * (H * P_{t|t-1} * H' + R)^{-1}
```

For the scalar case (H=1):

```
K_t = P_{pred} / (P_{pred} + R)
```

**Derivation Sketch:**

The Kalman gain minimizes the posterior estimation error covariance:

```
K_t = argmin_K  E[(x_t - x_hat_t)(x_t - x_hat_t)']

Subject to:
  x_hat_t = x_hat_{t|t-1} + K * (z_t - H * x_hat_{t|t-1})
```

Setting dE[...]/dK = 0 and solving yields the standard Kalman gain.

**Interpretation:**

```
K_t close to 1:  Trust the observation (R small relative to P)
                  -> Fast response to new data
                  -> Appropriate when measurement is reliable

K_t close to 0:  Trust the model prediction (P small relative to R)
                  -> Smooth output, reject observation noise
                  -> Appropriate when model is well-calibrated

In CheeseStock:
  High-volatility regime -> Q_t large -> P_pred large -> K_t -> 1
    (Track rapid price changes closely)
  Low-volatility regime  -> Q_t small -> P_pred small -> K_t -> 0
    (Smooth through noise, extract trend)
```

**System Mapping:**

The Kalman gain computation is at `indicators.js:194`:
```javascript
const K = PPred / (PPred + R);
```
No matrix inversion needed (scalar case). The multivariate Kalman gain
formula (OC-2 general form) is not implemented because the system uses
only 1D price filtering.

---

### OC-3: HJB Equation for Optimal Portfolio (Merton Problem)

**Academic Basis:**
Merton, R.C. (1969). "Lifetime Portfolio Selection under Uncertainty."
*Review of Economics and Statistics*, 51(3), 247-257.

Merton, R.C. (1971). "Optimum Consumption and Portfolio Rules in a
Continuous-Time Model." *Journal of Economic Theory*, 3(4), 373-413.
(1997 Nobel Prize in Economics)

**Portfolio Dynamics (SDE):**

```
dX = X * [r + pi*(mu - r)] dt + X * pi * sigma dW - c dt

Where:
  X(t)  = portfolio value at time t
  r     = risk-free rate
  mu    = risky asset expected return
  sigma = risky asset volatility
  pi(t) = allocation to risky asset (control variable)
  c(t)  = consumption rate (control variable)
  W(t)  = standard Brownian motion
```

**HJB Equation:**

```
0 = dV/dt + max_{pi, c} {
      U(c) +
      [r*x + pi*x*(mu - r) - c] * dV/dx +
      (1/2) * pi^2 * x^2 * sigma^2 * d^2V/dx^2
    }

Boundary condition: V(T, x) = B(x)   (bequest function)
```

**Symbol Table:**

| Symbol | Meaning | Domain |
|--------|---------|--------|
| V(t,x) | Value function (indirect utility) | R |
| U(c) | Instantaneous utility of consumption | Concave, increasing |
| pi(t) | Risky asset allocation fraction | [0,1] or R |
| c(t) | Consumption rate | R+ |
| mu | Expected return on risky asset | R |
| r | Risk-free rate | R+ |
| sigma | Volatility of risky asset | R+ |
| gamma | Relative risk aversion coefficient | R+, gamma != 1 |
| rho | Subjective discount rate | R+ |

**CRRA Solution (Merton's Closed-Form):**

With CRRA utility U(c) = c^{1-gamma} / (1-gamma):

```
Optimal allocation:

  pi* = (mu - r) / (gamma * sigma^2)

Interpretation:
  - Numerator (mu-r): risk premium — higher premium -> more risky allocation
  - Denominator (gamma*sigma^2): risk penalty — higher aversion or vol -> less
  - pi* is CONSTANT over time (myopic optimality under geometric Brownian motion)
  - For gamma=1 (log utility): pi* = (mu-r)/sigma^2 = Kelly criterion

Log utility special case (gamma = 1):
  pi* = (mu - r) / sigma^2    [identical to Kelly criterion]
  c*  = rho * X(t)            [constant proportion consumption]
```

**System Mapping:**

The Merton solution is not directly implemented as a portfolio optimizer in
CheeseStock (the system is a charting tool, not a robo-advisor). However,
its structure appears indirectly in several places:

| Theory Element | System Analog | File:Line |
|---------------|--------------|-----------|
| pi* = (mu-r)/(gamma*sigma^2) | WLS predicted return / ATR-normalized risk | backtester.js _computeStats() |
| Myopic optimality | 5-horizon backtest (1,3,5,10,20 days) | backtester.js:17 HORIZONS |
| Risk premium (mu-r) | Jensen's Alpha = R_pattern - [R_f + beta*(R_m - R_f)] | backtester.js:489-498 |
| Volatility penalty | EWMA vol in LinUCB context -> dampening in high-vol | backtester.js:354-367 |

**Constants Table:**

| Constant | Value | Grade | Location | Rationale |
|----------|-------|-------|----------|-----------|
| KRX_COMMISSION | 0.03% | [C] | backtester.js:19 | Empirical KRX round-trip commission |
| KRX_TAX | 0.18% | [C] | backtester.js:20 | 2025 securities transaction tax |
| KRX_SLIPPAGE | 0.10% | [C] | backtester.js:21 | KOSPI large-cap bid-ask midpoint |
| KRX_COST (total) | 0.31% | [C] | backtester.js:22 | Sum of above three |

**Edge Cases:**
- gamma -> 0 (risk neutral): pi* -> infinity. Not applicable to CheeseStock
  (the system does not lever).
- sigma -> 0: pi* -> infinity. Handled by ATR fallback `close * 0.02` in
  patterns.js when ATR is unavailable.
- mu < r: pi* < 0 (short the risky asset). The system can generate sell
  signals but does not explicitly model short positions.

---

## 2.9.3 Reinforcement Learning

The RL subsystem is the most directly implemented component of Section 2.9.
CheeseStock uses a LinUCB contextual bandit to adaptively calibrate MRA
(Multiple Regression Analysis) predictions. This is a single-step decision
problem (bandit), not a multi-step MDP.

**Critical Architectural Note:**
LinUCB is a contextual bandit — it makes one-shot decisions without
state transitions. The Bellman equation (RL-1) provides theoretical
context but does NOT apply to the implemented system. The system is
explicitly NOT an MDP. See comment at backtester.js:410:
`// LinUCB is a contextual bandit (single-step), not MDP`

---

### RL-1: Bellman Optimality Equation

**Academic Basis:**
Bellman, R. (1957). *Dynamic Programming*. Princeton University Press.
Sutton, R.S. & Barto, A.G. (2018). *Reinforcement Learning: An Introduction*,
2nd ed., MIT Press.

**Bellman Optimality Equation:**

```
V*(s) = max_a [ R(s,a) + gamma * sum_{s'} P(s'|s,a) * V*(s') ]

Q*(s,a) = R(s,a) + gamma * sum_{s'} P(s'|s,a) * max_{a'} Q*(s',a')

Optimal policy:  pi*(s) = argmax_a Q*(s,a)
```

**Symbol Table:**

| Symbol | Meaning | Domain |
|--------|---------|--------|
| V*(s) | Optimal state value function | R |
| Q*(s,a) | Optimal action-value function | R |
| R(s,a) | Immediate reward for action a in state s | R |
| gamma | Discount factor | [0, 1) |
| P(s'\|s,a) | State transition probability | [0, 1] |
| pi*(s) | Optimal policy | A |
| s, s' | States | S |
| a, a' | Actions | A |

**MDP Formulation for Trading (Theoretical Reference):**

```
M = (S, A, P, R, gamma)

S (state space):
  s_t = [OHLCV_{t-n:t}, RSI_14, MACD, BB, position_info, market_state]

A (action space):
  Discrete: {buy, sell, hold}
  Extended: {strong_buy, weak_buy, hold, weak_sell, strong_sell}

P (transition):
  P(s'|s,a) = market dynamics (non-stationary, partially observable)

R (reward):
  r_t = (P_{t+1} - P_t) / P_t * position_t - cost * |Delta_position|

gamma (discount):
  gamma = 0.99 -> ~100-step horizon (5 months on daily bars)
```

**Why Bellman Does NOT Apply to the CheeseStock Implementation:**

The implemented LinUCB (RL-2) is a contextual bandit:
- Single-step: observe context x_t, select action a_t, receive reward r_t
- No state transitions: the reward is immediate, not delayed
- No gamma: there is no future value to discount
- Regret bound is O(sqrt(TdK)), not based on Bellman backup

This is noted explicitly in backtester.js:410:
```javascript
// [C-7] LinUCB is a contextual bandit (single-step), not MDP
// — no Bellman equation applies (Li et al., 2010)
```

**System Mapping:**

| Theory Element | System Status | Notes |
|---------------|--------------|-------|
| Bellman equation | NOT IMPLEMENTED | Theoretical background only |
| V*(s) | N/A | No value function in the system |
| gamma discount | N/A | Bandit has no future states |
| State transitions | N/A | Single-step context, no s' |

**Edge Cases:**
- Non-stationarity: Financial markets violate the Markov property (future
  depends on deep history, not just current state). This is a fundamental
  limitation of MDP formulations for finance.
- Partial observability: The true market state is unobservable. A POMDP
  formulation would be more appropriate but is computationally intractable
  for real-time trading.

---

### RL-2: LinUCB Contextual Bandit (THE CORE IMPLEMENTATION)

**Academic Basis:**
Li, L., Chu, W., Langford, J., & Schapire, R.E. (2010). "A Contextual-Bandit
Approach to Personalized News Article Recommendation." *Proceedings of the
19th International World Wide Web Conference (WWW 2010)*, pp. 661-670.

**LinUCB Action Selection Rule:**

```
a_t = argmax_a [ theta_a^T x_t  +  alpha * sqrt(x_t^T A_a^{-1} x_t) ]
                 |-- exploit --|     |-------- explore ------------|

Where:
  x_t     = context vector (d-dimensional, with bias prepended -> d+1)
  theta_a = A_a^{-1} * b_a           (ridge regression estimate)
  A_a     = sum_{t: a_t=a} x_t x_t^T + I   (accumulated outer products + Ridge)
  b_a     = sum_{t: a_t=a} r_t * x_t       (reward-weighted context sum)
  alpha   = exploration parameter (UCB bonus scale)
```

**Symbol Table:**

| Symbol | Meaning | Domain |
|--------|---------|--------|
| x_t | Context vector at time t | R^{d+1} (with bias) |
| a_t | Selected action at time t | {0,1,2,3,4} |
| theta_a | Estimated coefficient vector for arm a | R^{d+1} |
| A_a | Accumulated design matrix for arm a | R^{(d+1)x(d+1)}, PSD |
| A_a^{-1} | Inverse of A_a | R^{(d+1)x(d+1)} |
| b_a | Accumulated reward-weighted context | R^{d+1} |
| alpha | Exploration-exploitation tradeoff | R+ |
| r_t | Observed reward at time t | R |
| d | Context dimension (before bias) | 7 (JS) or 10 (Python) |
| K | Number of arms (actions) | 5 |

**Sherman-Morrison Incremental Update (O(d^2) per step):**

```
When observation (x, a, r) arrives:

  A_a_new^{-1} = A_a_old^{-1}
                 - (A_a_old^{-1} * x * x^T * A_a_old^{-1})
                   / (1 + x^T * A_a_old^{-1} * x)

  b_a_new = b_a_old + r * x

Numerical stability: re-invert A_a from scratch every 500 updates.
```

**5-Action Space Design (MRA Calibration):**

```
Action Index   Name              Factor   Meaning
-------------------------------------------------------------
0              strong_dampen     0.3      Suppress MRA prediction 70%
1              slight_dampen     0.7      Reduce MRA prediction 30%
2              trust_mra         1.0      Use MRA prediction as-is (default)
3              slight_boost      1.3      Amplify MRA prediction 30%
4              reverse          -0.5      Flip MRA direction, half magnitude
-------------------------------------------------------------

Application: y_adjusted = y_mra * action_factor
```

**7-Dimensional Context Vector (JS Runtime):**

The JS runtime uses a 7-dim context (3 residual dims dropped because
the runtime lacks rolling residual history per stock):

```
Dim  Name              Source              Academic Basis
--------------------------------------------------------------------
0    ewma_vol          EWMA(lambda=0.94)   Bollerslev (1986) GARCH
                       z-scored             RiskMetrics (1996)
1    pred_magnitude    |y_pred|/global_std  Prediction confidence
2    signal_dir        +1/-1/0             Buy/sell/neutral
3    market_type       0=KOSPI, 1=KOSDAQ   Market microstructure
4    pattern_tier      -1/0/+1             Tier1=-1 (crowding risk)
5    confidence_norm   confidence/100       Pattern completion quality
6    raw_hurst         R/S Hurst, z-scored  Hurst (1951) / Peters (1994)
```

**10-Dimensional Context Vector (Python Training):**

The Python training pipeline uses 10 dimensions (3 additional residual dims):

```
Dim  Name              Source              Academic Basis
--------------------------------------------------------------------
0    resid_sign        sign(prev residual)  Lo (2004) AMH
1    resid_mag_z       |resid|/rolling_std  Prediction error magnitude
2    resid_run_len     consecutive count/5  Systematic bias detection
3    ewma_vol          EWMA(lambda=0.94)    Bollerslev (1986)
4    pred_magnitude    |y_pred|/global_std   --
5    signal_dir        +1/-1/0              --
6    market_type       0/1                  --
7    pattern_tier      -1/0/+1              Bulkowski (2005)
8    confidence_norm   [0,1]                --
9    raw_hurst         R/S Hurst, z-scored  Hurst (1951)
```

**System Mapping — Complete Code Trace:**

| Component | Python (Training) | JS (Runtime) |
|-----------|-------------------|-------------|
| Algorithm class | rl_linucb.py:88-222 (LinUCB) | backtester.js:413-425 (_applyLinUCBGreedy) |
| Context builder | rl_context_features.py:10-37 | backtester.js:348-407 (_buildRLContext) |
| Reward function | rl_linucb.py:56-81 (compute_reward) | N/A (training only) |
| Action selection | rl_linucb.py:128-143 (select_action) | backtester.js:413-425 (greedy, no UCB) |
| S-M update | rl_linucb.py:154-181 (update) | N/A (training only) |
| Warm start | rl_linucb.py:224-302 (warm_start_from_data) | N/A |
| Policy export | rl_linucb.py:191-201 (get_policy_json) | backtester.js:244-300 (_loadRLPolicy) |
| Policy file | -- | data/backtest/rl_policy.json |
| Dimension mismatch guard | -- | backtester.js:283-285 |
| IC gate | -- | backtester.js:260-273 (reject IC<0) |
| Staleness guard | -- | backtester.js:277-280 (90-day warning) |
| Tier-1 crowding set | rl_linucb.py via rl_stage_b.py | backtester.js:110 (_rlTier1) |
| Tier-3 set | -- | backtester.js:111 (_rlTier3) |

**JS Runtime Implementation Detail (backtester.js:413-425):**

```javascript
// Greedy-only: exploration term dropped (alpha=0)
// Full UCB is only in Python training (rl_linucb.py)
_applyLinUCBGreedy(context) {
  var p = this._rlPolicy;
  if (!p || context.length !== p.d) return { action: 2, factor: 1.0 };
  var bestA = 2, bestScore = -Infinity;
  for (var a = 0; a < p.K; a++) {
    var score = p.thetas[a][0]; // bias term
    for (var j = 0; j < p.d; j++) {
      score += p.thetas[a][j + 1] * context[j];
    }
    if (score > bestScore) { bestScore = score; bestA = a; }
  }
  return { action: bestA, factor: p.action_factors[bestA] };
}
```

**Known Misalignment (C-8):**

```
RL reward metric:   per-sample directional return (y_adj * y_actual)
Evaluation metric:  Spearman rank IC (cross-sectional)

These are different objectives. The reward maximizes per-sample
directional accuracy; IC measures cross-sectional ranking quality.
A policy optimal for per-sample return is not necessarily optimal for IC.

Documented at backtester.js:411:
  // [C-8] Known misalignment: RL reward (per-sample return)
  //   != evaluation metric (Spearman IC) -- see Doc11 sec 13.3
```

**Constants Table:**

| Constant | Value | Grade | Location | Rationale |
|----------|-------|-------|----------|-----------|
| d (JS context dim) | 7 | [B] | backtester.js:341 | 10-dim minus 3 unavailable residual dims |
| d (Python context dim) | 10 | [B] | rl_context_features.py:9-24 | Full feature set |
| K (actions) | 5 | [B] | rl_linucb.py:49 | 5-level MRA calibration |
| alpha (exploration) | 1.0 initial | [C] | rl_linucb.py:109 | Tuned; scheduled decay in rl_stage_b.py |
| reinvert_every | 500 | [B] | rl_linucb.py:109 | Numerical stability |
| EWMA lambda (vol) | 0.94 | [A][L:GS] | backtester.js:360 | RiskMetrics (1996) standard |
| EWMA alpha (vol) | 0.06 | [A] | backtester.js:360 | = 1 - 0.94 |
| Hurst min window | 10 | [C] | indicators.js:212 | Heuristic minimum |
| Context clamp | [-3, +3] | [B] | rl_linucb.py:123 | Z-score saturation |
| IC rejection threshold | < 0 | [B] | backtester.js:260 | Anti-predictive policy rejection |
| Staleness threshold | 90 days | [D] | backtester.js:278 | ~1 quarterly regime cycle |
| Policy eviction cap | 200 entries | [D] | backtester.js:464 | Memory guard heuristic |
| effective_n (warm start) | 200 | [C] | rl_linucb.py:224 | Bayesian prior strength |
| trust_mra bias prior | 0.01 * effective_n | [D] | rl_linucb.py:295 | Prevents zero-confidence baseline |
| Hurst fallback mean | 0.612 | [B][L:BAY] | backtester.js:392 | 2026-03-31 recalibration |
| Hurst fallback std | 0.133 | [B][L:BAY] | backtester.js:393 | 2026-03-31 recalibration |
| ewma_vol fallback mean | 0.026541 | [B][L:BAY] | backtester.js:365 | Training normalization |
| ewma_vol fallback std | 0.017892 | [B][L:BAY] | backtester.js:366 | Training normalization |

**Edge Cases:**
- Missing rl_policy.json: `_loadRLPolicy()` silently falls back; `_applyLinUCBGreedy`
  returns `{action: 2, factor: 1.0}` (trust MRA as-is).
- Dimension mismatch (d != expected): Warning logged at backtester.js:284-285.
- IC < 0 policy: Rejected entirely at backtester.js:260-273. Win rates still
  injected (Beta-Binomial posteriors are IC-independent empirical data).
- Stale policy (>90 days): Warning logged but policy still used.
- NaN in context: `np.where(np.isfinite(x), x, 0.0)` at rl_linucb.py:125.
- Hurst normalization staleness: Price-level H has mean>0.80; returns-based H
  has mean<0.80. Staleness guard at backtester.js:391 detects and uses fallback.

**Regret Bound (Li et al. 2010):**

```
Regret(T) = O(sqrt(T * d * K * log(T)))

For CheeseStock: d=7, K=5, T ~2000 (daily bars for 8 years):
  Regret ~ O(sqrt(2000 * 7 * 5 * 7.6)) ~ O(sqrt(532,000)) ~ O(730)

Per-step average regret ~ 730/2000 ~ 0.37 (diminishing)
```

---

### RL-3: Thompson Sampling for Pattern Selection

**Academic Basis:**
Thompson, W.R. (1933). "On the Likelihood that One Unknown Probability Exceeds
Another in View of the Evidence of Two Samples." *Biometrika*, 25(3/4), 285-294.

**Beta-Binomial Thompson Sampling:**

```
For each pattern type p:
  theta_p ~ Beta(alpha_p, beta_p)

At time t:
  Draw theta_p^(t) ~ Beta(alpha_p, beta_p)  for each p
  Select: p* = argmax_p theta_p^(t)

After observing outcome (win/loss):
  Win:  alpha_p <- alpha_p + 1
  Loss: beta_p  <- beta_p + 1

Posterior mean (point estimate):
  E[theta_p] = alpha_p / (alpha_p + beta_p)    [= win rate]
```

**Symbol Table:**

| Symbol | Meaning | Domain |
|--------|---------|--------|
| theta_p | True win probability of pattern p | [0, 1] |
| alpha_p | Posterior success count + prior | R+, >= 1 |
| beta_p | Posterior failure count + prior | R+, >= 1 |
| Beta(alpha, beta) | Beta distribution | Conjugate prior for Bernoulli |

**System Mapping:**

Thompson Sampling is partially implemented through the Beta-Binomial posterior
injection system. The RL policy training produces `win_rates_live` containing
posterior (alpha, beta) parameters for each pattern. These are injected into
PatternEngine at runtime:

```javascript
// backtester.js:289-297
if (data.win_rates_live && typeof PatternEngine !== 'undefined') {
  var liveWR = {};
  for (var pKey in data.win_rates_live) {
    var ab = data.win_rates_live[pKey];
    if (ab && ab.alpha > 0 && ab.beta > 0) {
      liveWR[pKey] = +(ab.alpha / (ab.alpha + ab.beta) * 100).toFixed(1);
    }
  }
  PatternEngine.PATTERN_WIN_RATES_LIVE = liveWR;
}
```

| Theory Element | System Component | File:Line |
|---------------|-----------------|-----------|
| Posterior mean | alpha/(alpha+beta)*100 | backtester.js:293 |
| Win rates injection | PatternEngine.PATTERN_WIN_RATES_LIVE | backtester.js:295 |
| Full sampling | NOT IMPLEMENTED | Point estimate only (no stochastic sampling) |
| IC-independent data | win_rates_live preserved even when IC<0 | backtester.js:262-272 |

**Why Not Full Thompson Sampling:**

LinUCB was chosen over Thompson Sampling for CheeseStock because:
1. LinUCB naturally extends the WLS regression framework (linear context model)
2. The 10-dim continuous context maps directly to LinUCB's linear reward model
3. Thompson Sampling with continuous contexts requires more complex posterior
   updates (e.g., Bayesian linear regression with matrix-variate posteriors)

The Beta-Binomial posteriors are used only for win rate point estimates,
not for stochastic action selection.

---

### RL-4: Reward Shaping for Trading

**Academic Basis:**
Grinold, R.C. (1989). "The Fundamental Law of Active Management." *Journal
of Portfolio Management*, 15(3), 30-37.

Mnih, V. et al. (2015). "Human-Level Control through Deep Reinforcement
Learning." *Nature*, 518, 529-533. (Log-compression motivation)

**Reward Function (Directional IC Alignment):**

```
r_raw = y_adjusted * y_actual - y_mra * y_actual
      = y_mra * y_actual * (action_factor - 1)

r_final = sign(r_raw) * log(1 + |r_raw|)  -  KRX_COST * |action_factor - 1|
          |---- log compression ----|          |-- transaction cost penalty --|
```

**Symbol Table:**

| Symbol | Meaning | Domain |
|--------|---------|--------|
| y_mra | MRA predicted return | R |
| y_actual | Realized return | R |
| y_adjusted | y_mra * action_factor | R |
| action_factor | Selected action's multiplier | {0.3, 0.7, 1.0, 1.3, -0.5} |
| r_raw | Raw directional reward | R |
| r_final | Compressed + cost-penalized reward | R |
| KRX_COST | Round-trip transaction cost | 0.0031 (0.31%) |
| turnover | |action_factor - 1.0| | [0, 1.5] |

**Reward Properties:**

```
1. Directional alignment:
   r_raw > 0  when action IMPROVES alignment with actual returns
   r_raw < 0  when action WORSENS alignment
   r_raw = 0  when action = trust_mra (factor=1.0)

2. Log compression:
   Stabilizes extreme rewards from fat-tailed KRX returns (kurtosis ~ 73.5)
   Analogous to Huber loss: linear for large |r|, quadratic for small |r|

3. Transaction cost penalty:
   KRX_COST * |factor - 1| penalizes active intervention
   trust_mra (factor=1.0) has ZERO cost penalty (turnover=0)
   reverse (factor=-0.5) has MAXIMUM penalty (turnover=1.5)

4. Reward table by scenario:
   y_mra > 0, y_actual > 0 (correct direction):
     strong_dampen (0.3):  r_raw < 0   (penalized: suppressed correct signal)
     trust_mra (1.0):      r_raw = 0   (neutral baseline)
     slight_boost (1.3):   r_raw > 0   (rewarded: amplified correct signal)

   y_mra > 0, y_actual < 0 (wrong direction):
     strong_dampen (0.3):  r_raw > 0   (rewarded: suppressed wrong signal)
     trust_mra (1.0):      r_raw = 0   (neutral)
     reverse (-0.5):       r_raw > 0   (rewarded: flipped wrong signal)
```

**Implementation (rl_linucb.py:56-81):**

```python
def compute_reward(y_actual, y_mra, action_factor):
    y_adj = y_mra * action_factor
    r_raw = y_adj * y_actual - y_mra * y_actual
    r_compressed = math.copysign(math.log1p(abs(r_raw)), r_raw)

    # Transaction cost penalty
    KRX_COST = 0.0031  # 0.31% round-trip
    turnover = abs(action_factor - 1.0)
    r_compressed -= KRX_COST * turnover

    return r_compressed
```

**Historical Note — MSE Reward Bug (Stage B-1):**

The initial implementation used MSE-based reward: `r = -(y_adj - y_actual)^2`.
This caused strong_dampen to dominate (49% selection rate) because shrinking
predictions toward zero always reduces squared error. The directional reward
(Stage B-3) fixed this degenerate behavior, reducing strong_dampen to 12%
and achieving diverse action selection.

**Constants Table:**

| Constant | Value | Grade | Location | Rationale |
|----------|-------|-------|----------|-----------|
| KRX_COST (reward) | 0.0031 | [C] | rl_linucb.py:77 | Matches backtester.js:22 |
| Log compression | log1p | [A] | rl_linucb.py:73 | Standard for fat-tailed data |

**Edge Cases:**
- y_mra = 0: r_raw = 0 regardless of action (no signal to calibrate).
  All actions score equally; LinUCB defaults to trust_mra.
- y_actual = 0: r_raw = 0 (flat day). No learning signal.
- Extreme y_actual (circuit breaker, +/-30%): Log compression bounds the
  reward to ~3.4 (log(1+0.3*0.3*1.3) ~ 0.12 for typical; log(1+0.3*1.3) ~ 0.34
  for extreme). Without compression, a single extreme observation could
  dominate the theta estimate.

---

## 2.9.4 Adaptive Pattern Modeling

The adaptive modeling subsystem detects when market conditions change and
adjusts pattern reliability accordingly. It implements the Adaptive Markets
Hypothesis through concrete computational tools: HMM regime detection,
CUSUM change-point monitoring, and binary segmentation breakpoints.

---

### AD-1: Adaptive Markets Hypothesis (AMH)

**Academic Basis:**
Lo, A.W. (2004). "The Adaptive Markets Hypothesis: Market Efficiency from
an Evolutionary Perspective." *Journal of Portfolio Management*, 30(5), 15-29.

Lo, A.W. (2012). "Adaptive Markets and the New World Order." *Financial
Analysts Journal*, 68(2), 18-29.

**Core Propositions (Lo 2004, 2005, 2012):**

```
1. Market efficiency is TIME-VARYING, not absolute:
   Efficiency_t = f(Competition_t, Information_t, Technology_t) in [0, 1]

2. Trading strategies have a LIFE CYCLE:
   Birth -> Growth -> Maturity -> Decay -> (possible Rebirth in new regime)

3. EVOLUTIONARY DYNAMICS govern strategy profitability:
   Replicator equation: dx_i/dt = x_i * [f_i(x) - f_bar(x)]
   Where x_i = fraction of traders using strategy i
         f_i = fitness (profitability) of strategy i
         f_bar = average fitness across all strategies

4. Anomalies (loss aversion, overreaction) are RATIONAL ADAPTATIONS
   to changing environments, not cognitive failures.

Rolling autocorrelation test (Lo 2004):
  rho_t = corr(R_t, R_{t-1} | rolling_window)
  |rho_t| >> 0: market inefficient (patterns have value)
  |rho_t| ~ 0:  market efficient (patterns have no edge)
```

**System Mapping:**

AMH is the master theory that motivates CheeseStock's entire adaptive
architecture. It is not a single formula but a design philosophy:

| AMH Principle | System Implementation | File:Line |
|--------------|----------------------|-----------|
| Time-varying efficiency | WLS lambda=0.995 (exponential decay weighting) | indicators.js calcWLSRegression() |
| Strategy life cycle | Pattern decay monitoring (CUSUM on returns) | indicators.js:1493 (calcOnlineCUSUM) |
| Evolutionary dynamics | LinUCB 5-action: dampens crowded patterns, boosts underused | backtester.js:413-425 |
| Regime-dependent validity | HMM 2-state: bull/bear regime detection | scripts/compute_hmm_regimes.py |
| Rolling autocorrelation | Hurst exponent as persistence measure | indicators.js:212 (calcHurst) |
| Strategy half-life | WLS lambda=0.995 -> half-life ~139 days | indicators.js calcWLSRegression() |

**WLS Lambda as Half-Life:**

```
WLS weighting: w_i = lambda^(n-i)   for i = 1, ..., n

Half-life of weight:
  lambda^h = 0.5
  h = ln(0.5) / ln(lambda)
  h = ln(0.5) / ln(0.995) = 138.6 trading days ~ 6.5 months

Interpretation:
  Observations older than ~139 days carry less than half weight.
  This implements AMH's "strategy decay" principle: patterns that
  worked 6+ months ago may no longer be valid.
```

**Constants Table:**

| Constant | Value | Grade | Location | Rationale |
|----------|-------|-------|----------|-----------|
| WLS lambda | 0.995 | [B] | indicators.js calcWLSRegression() | Half-life ~139 days (McLean & Pontiff 2016) |
| Hurst min data | 4*minWindow+1 = 41 | [B] | indicators.js:214 | Minimum for meaningful R/S analysis |

---

### AD-2: HMM 2-State Regime Switching

**Academic Basis:**
Hamilton, J.D. (1989). "A New Approach to the Economic Analysis of
Nonstationary Time Series and the Business Cycle." *Econometrica*,
57(2), 357-384.

Baum, L.E. et al. (1970). "A Maximization Technique Occurring in the
Statistical Analysis of Probabilistic Functions of Markov Chains."
*Annals of Mathematical Statistics*, 41(1), 164-171.

**Model Specification:**

```
Hidden state: S_t in {Bull(0), Bear(1)}

Transition matrix:
  P = | p_BB   1-p_BB  |     p_BB = P(S_{t+1}=Bull | S_t=Bull)
      | 1-p_RB  p_RB   |     p_RB = P(S_{t+1}=Bear | S_t=Bear)

Emission distribution:
  P(R_t | S_t = s) = N(mu_s, sigma_s^2)

  Bull: R_t ~ N(mu_bull, sigma_bull^2)    -- positive drift, low vol
  Bear: R_t ~ N(mu_bear, sigma_bear^2)    -- negative drift, high vol

State duration (geometric distribution):
  E[duration_Bull] = 1 / (1 - p_BB)
  E[duration_Bear] = 1 / (1 - p_RB)
```

**Symbol Table:**

| Symbol | Meaning | Domain |
|--------|---------|--------|
| S_t | Hidden regime state at time t | {0=Bull, 1=Bear} |
| R_t | Observed daily return at time t | R |
| mu_s | Mean return in state s | R |
| sigma_s | Volatility in state s | R+ |
| p_BB | Bull-to-Bull transition probability | (0, 1) |
| p_RB | Bear-to-Bear transition probability | (0, 1) |
| alpha_t(j) | Forward probability: P(R_1:t, S_t=j) | [0, 1] |
| beta_t(j) | Backward probability: P(R_{t+1:T} | S_t=j) | R+ |
| gamma_t(j) | Posterior state probability: P(S_t=j | R_1:T) | [0, 1] |
| xi_t(i,j) | Transition posterior: P(S_t=i, S_{t+1}=j | R_1:T) | [0, 1] |

**Baum-Welch EM Algorithm:**

```
E-step:
  Forward:  alpha_t(j) = [sum_i alpha_{t-1}(i) * a_{ij}] * b_j(R_t)
  Backward: beta_t(i)  = sum_j a_{ij} * b_j(R_{t+1}) * beta_{t+1}(j)
  Posterior: gamma_t(j) = alpha_t(j) * beta_t(j) / sum_s alpha_t(s) * beta_t(s)

M-step:
  mu_s     = sum_t gamma_t(s) * R_t / sum_t gamma_t(s)
  sigma_s  = sqrt(sum_t gamma_t(s) * (R_t - mu_s)^2 / sum_t gamma_t(s))
  a_{ij}   = sum_t xi_t(i,j) / sum_t gamma_t(i)

Iterate E-M steps until convergence (50 iterations in implementation).
```

**Viterbi Decoding (Most Likely State Sequence):**

```
delta_t(j) = max_i [delta_{t-1}(i) * a_{ij}] * b_j(R_t)
psi_t(j)   = argmax_i [delta_{t-1}(i) * a_{ij}]

Backtrack: S*_T = argmax_j delta_T(j), then S*_t = psi_{t+1}(S*_{t+1})
```

Note: The implementation uses a simplified Viterbi — it assigns states
based on posterior probability `gamma_t(j)` rather than full Viterbi
backtracking (line 171-172 of compute_hmm_regimes.py):
```python
viterbi[t] = 0 if gamma[t][0] > gamma[t][1] else 1
```
This is the MAP (maximum a posteriori) estimate at each time point, which
can differ from the globally optimal Viterbi path.

**System Mapping:**

| Component | Implementation | File:Line |
|-----------|---------------|-----------|
| 2-state Gaussian HMM | fit_hmm_2state() | compute_hmm_regimes.py:84-182 |
| KOSPI proxy returns | load_kospi_returns() (cap-weighted) | compute_hmm_regimes.py:21-76 |
| Forward algorithm | alpha[t][j] loop | compute_hmm_regimes.py:103-115 |
| Backward algorithm | beta[t][i] loop | compute_hmm_regimes.py:118-124 |
| Posterior (gamma) | gamma[t][s] calculation | compute_hmm_regimes.py:127-131 |
| Transition posterior (xi) | xi_sum[i][j] | compute_hmm_regimes.py:134-143 |
| M-step parameter update | mu, sigma, trans update | compute_hmm_regimes.py:146-158 |
| State normalization | Ensure state 0 = Bull | compute_hmm_regimes.py:163-167 |
| Output JSON | data/backtest/hmm_regimes.json | compute_hmm_regimes.py:228-232 |
| JS consumption | _loadBehavioralData() loads hmm_regimes | backtester.js:212 |
| Staleness guard | 30-day check on last entry | backtester.js:226-237 |
| Source guard | Reject sample/seed/demo data | compute_hmm_regimes.py:49-50 |

**Output Schema (hmm_regimes.json):**

```json
{
  "model": "2-state Gaussian HMM (Hamilton 1989)",
  "parameters": {
    "mu_bull_pct": 0.0523,
    "mu_bear_pct": -0.1847,
    "sigma_bull_pct": 0.9234,
    "sigma_bear_pct": 2.4561,
    "transition_matrix": [[0.982, 0.018], [0.047, 0.953]],
    "bull_avg_duration_days": 55.6,
    "bear_avg_duration_days": 21.3
  },
  "daily": [
    {"date": "2025-04-01", "bull_prob": 0.94, "regime": "bull"},
    ...
  ]
}
```

**Constants Table:**

| Constant | Value | Grade | Location | Rationale |
|----------|-------|-------|----------|-----------|
| n_states | 2 | [A] | compute_hmm_regimes.py:84 | Bull/Bear (Hamilton 1989) |
| n_iter (EM) | 50 | [C] | compute_hmm_regimes.py:84 | Convergence empirically verified |
| mu_init | [+0.001, -0.002] | [D] | compute_hmm_regimes.py:96 | Initial guess; EM converges |
| sigma_init | [0.01, 0.02] | [D] | compute_hmm_regimes.py:97 | Initial guess |
| trans_init | [[0.98, 0.02], [0.05, 0.95]] | [D] | compute_hmm_regimes.py:98 | High persistence prior |
| pi_init | [0.6, 0.4] | [D] | compute_hmm_regimes.py:99 | Slight bull bias |
| Staleness cutoff (JS) | 30 days | [D] | backtester.js:233 | Regime shifts resolve within 1 month |
| Daily output length | 252 days | [B] | compute_hmm_regimes.py:198 | 1 trading year |
| Min observations | 100 | [B] | compute_hmm_regimes.py:91 | Minimum for reliable HMM |
| sigma floor | 1e-6 | [B] | compute_hmm_regimes.py:150 | Prevent degenerate states |
| scale floor | 1e-300 | [B] | compute_hmm_regimes.py:108 | Prevent log(0) in forward pass |

**Edge Cases:**
- Degenerate state (sigma_s -> 0): Floored at 1e-6 in M-step (line 150).
- Label switching: States can swap labels across EM restarts. The system
  enforces state 0 = Bull (higher mean) after convergence (line 163-167).
- Insufficient data (N < 100): Returns None (line 91).
- Stale data (>30 days old in JS): hmm_regimes set to null with warning
  (backtester.js:233-237).
- Sample/seed/demo data: Explicitly rejected at compute_hmm_regimes.py:49-50.

---

### AD-3: CUSUM Change-Point Detection

**Academic Basis:**
Page, E.S. (1954). "Continuous Inspection Schemes." *Biometrika*, 41(1/2),
100-115.

Roberts, S.W. (1966). "A Comparison of Some Control Chart Procedures."
*Technometrics*, 8(3), 411-430. (Slack parameter optimization)

**Bilateral CUSUM with Adaptive Statistics:**

```
Two-sided CUSUM:

  S_plus_t  = max(0, S_plus_{t-1}  + z_t - slack)     -- upward shift detection
  S_minus_t = max(0, S_minus_{t-1} - z_t - slack)     -- downward shift detection

Where:
  z_t   = (r_t - mu_running) / sigma_running            -- z-scored return
  slack = 0.5                                            -- ARL-optimal slack (Roberts 1966)

Running statistics (EMA-based):
  mu_running    = alpha * r_t + (1-alpha) * mu_{running,t-1}      (alpha = 2/31)
  var_running   = alpha * (r_t - mu_old)^2 + (1-alpha) * var_{running,t-1}
  sigma_running = sqrt(var_running)

Alarm when S_plus or S_minus exceeds threshold h:
  If S_plus_t > h:  upward breakpoint detected, S_plus reset to 0
  If S_minus_t > h: downward breakpoint detected, S_minus reset to 0
```

**Symbol Table:**

| Symbol | Meaning | Domain |
|--------|---------|--------|
| S_plus_t | Upward CUSUM statistic | R+, >= 0 |
| S_minus_t | Downward CUSUM statistic | R+, >= 0 |
| z_t | Z-scored return at time t | R |
| r_t | Raw return at time t | R |
| mu_running | EMA of returns | R |
| sigma_running | EMA standard deviation of returns | R+ |
| slack | Reference value subtracted each step | R+ (0.5) |
| h | Decision threshold | R+ (default 2.5, adaptive) |
| alpha | EMA smoothing factor | (0, 1), = 2/31 |

**Volatility-Adaptive Threshold:**

```
if volRegime == 'high':  h = max(h, 3.5)    -- raise to reduce false alarms
if volRegime == 'low':   h = min(h, 1.5)    -- lower to increase sensitivity

Rationale (Doc34 section 2.3):
  High volatility: z-scores are noisier -> need larger h for same false alarm rate
  Low volatility:  z-scores are cleaner -> can use smaller h for faster detection
```

**System Mapping:**

| Component | Implementation | File:Line |
|-----------|---------------|-----------|
| calcOnlineCUSUM() | Bilateral CUSUM with EMA stats | indicators.js:1493-1571 |
| Warmup period | 30-bar initial statistics | indicators.js:1512 |
| EMA alpha | 2/31 (~30-bar half-life) | indicators.js:1510 |
| Slack | 0.5 (Roberts 1966 ARL optimal) | indicators.js:1511 |
| Default threshold | 2.5 | indicators.js:1494 |
| Vol-adaptive threshold | high->3.5, low->1.5 | indicators.js:1497-1500 |
| isRecent flag | Last breakpoint within 20 bars | indicators.js:1562 |
| IndicatorCache.onlineCusum() | Lazy-eval cache wrapper | indicators.js:1923 |

**Output Schema:**

```javascript
{
  breakpoints: [
    { index: 142, direction: 'up', magnitude: 3.21 },
    { index: 287, direction: 'down', magnitude: 2.89 },
    ...
  ],
  cusum: { plus: 1.23, minus: 0.45 },   // current CUSUM state
  isRecent: true,                         // breakpoint in last 20 bars
  adaptedThreshold: 2.5                   // threshold actually used
}
```

**Constants Table:**

| Constant | Value | Grade | Location | Rationale |
|----------|-------|-------|----------|-----------|
| Default threshold (h) | 2.5 | [B] | indicators.js:1494 | Standard CUSUM threshold |
| Slack (k) | 0.5 | [B] | indicators.js:1511 | Roberts (1966) ARL-optimal |
| EMA alpha | 2/31 = 0.0645 | [B] | indicators.js:1510 | 30-bar half-life for adaptive stats |
| Warmup period | 30 bars | [B] | indicators.js:1512 | Initial stats stabilization |
| High-vol threshold | 3.5 | [C] | indicators.js:1499 | Reduce false alarms in high vol |
| Low-vol threshold | 1.5 | [C] | indicators.js:1500 | Increase sensitivity in low vol |
| isRecent window | 20 bars | [D] | indicators.js:1562 | Heuristic recency cutoff |
| Min data length | 40 bars | [B] | indicators.js:1503 | warmup + 10 bars minimum |
| var floor | 1e-10 | [B] | indicators.js:1523 | Flat-price stock defense |
| sigma floor | 1e-12 | [B] | indicators.js:1534 | Division by zero guard |

**Edge Cases:**
- Flat prices (all returns = 0): `runVar` stays at initial value, guarded
  by floor 1e-10.
- Short data (< 40 bars): Returns empty result with no breakpoints.
- Consecutive breakpoints: Each alarm resets the CUSUM statistic to 0,
  preventing immediate re-triggering.
- Extreme returns (circuit breaker events): The z-scoring normalizes by
  running sigma, so extreme returns produce large z but are still bounded
  by the CUSUM accumulation dynamics.

**Average Run Length (ARL) Analysis:**

```
For standard bilateral CUSUM with h=2.5, k=0.5:
  ARL_0 (no change) ~ 300-500 observations (low false alarm rate)
  ARL_1 (1-sigma shift) ~ 10-15 observations (fast detection)

NOTE: The adaptive mean/variance variant (EMA-based) modifies the ARL
characteristics. Validation with simulation is recommended but not yet
performed (see comment at indicators.js:1508).
```

---

### AD-4: Binary Segmentation Breakpoints

**Academic Basis:**
Bai, J. & Perron, P. (1998). "Estimating and Testing Linear Models with
Multiple Structural Changes." *Econometrica*, 66(1), 47-78.

Scott, A.J. & Knott, M. (1974). "A Cluster Analysis Method for Grouping
Means in the Analysis of Variance." *Biometrics*, 30(3), 507-512.
(Binary segmentation algorithm)

**Algorithm:**

```
Binary Segmentation for Multiple Breakpoints:

Input: returns R_1, ..., R_T; maxBreaks=3; minSegment=30

repeat up to maxBreaks times:
  For each segment [start, end) in current partition:
    For each candidate split point tau in [start+minSeg, end-minSeg]:
      BIC_before = segmentBIC(start, end)
      BIC_after  = segmentBIC(start, tau) + segmentBIC(tau, end)
      delta_BIC  = BIC_before - BIC_after

    best_tau = argmax_tau delta_BIC

  If best_delta_BIC > 0:
    Insert breakpoint at best_tau
  Else:
    Stop (no further improvement)

Segment BIC:
  BIC(start, end) = n * log(max(RSS/n, 1e-12)) + 2 * log(n)

  Where:
    n   = end - start (segment length)
    RSS = sum_{i=start}^{end-1} (R_i - R_bar)^2  (residual sum of squares)
    R_bar = mean(R_{start:end})                   (segment mean)
```

**Symbol Table:**

| Symbol | Meaning | Domain |
|--------|---------|--------|
| tau | Candidate breakpoint index | {minSeg, ..., T-minSeg} |
| BIC | Bayesian Information Criterion | R |
| RSS | Residual sum of squares within segment | R+ |
| n | Segment length | Z+, >= minSeg |
| maxBreaks | Maximum number of breakpoints | Z+ (default 3) |
| minSegment | Minimum segment length | Z+ (default 30) |

**System Mapping:**

| Component | Implementation | File:Line |
|-----------|---------------|-----------|
| calcBinarySegmentation() | Greedy binary segmentation with BIC | indicators.js:1586-1660 |
| segmentBIC() | BIC computation per segment | indicators.js:1597-1609 |
| segmentStats() | Mean, std, RSS per segment | indicators.js:1612+ |
| IndicatorCache.binarySegmentation() | Lazy-eval cache wrapper | indicators.js:1947 |

**Output Schema:**

```javascript
{
  breakpoints: [
    {
      index: 127,
      leftMean: 0.0012,
      rightMean: -0.0034,
      leftStd: 0.0145,
      rightStd: 0.0287,
      bicDelta: 15.3      // BIC improvement from this split
    },
    ...
  ]
}
```

**Complexity:**

```
Worst case: O(T * maxBreaks * maxSegmentSize)
For T=252 (1 year), maxBreaks=3: ~576 iterations (real-time feasible)
```

**Constants Table:**

| Constant | Value | Grade | Location | Rationale |
|----------|-------|-------|----------|-----------|
| maxBreaks | 3 | [B] | indicators.js:1587 | Typical for annual data |
| minSegment | 30 | [B] | indicators.js:1588 | ~6 weeks minimum regime |
| BIC RSS floor | 1e-12 | [B] | indicators.js:1606 | Prevent log(0) |
| Min data length | 2*minSegment = 60 | [B] | indicators.js:1591 | At least 2 segments |

**Edge Cases:**
- No breakpoints found: All delta_BIC <= 0, returns empty breakpoints array.
- Very short data (< 60 bars): Returns empty result.
- Constant returns: RSS = 0, BIC = n * log(1e-12) + 2*log(n). Technically
  valid but meaningless; no breakpoints will improve BIC.
- Unbalanced segments: minSegment=30 prevents pathologically short segments.

**Relationship to CUSUM (AD-3):**

```
CUSUM (AD-3):
  + Online (processes one observation at a time)
  + Low latency (O(1) per step)
  - Cannot revise past decisions
  - Single-scale sensitivity

Binary Segmentation (AD-4):
  + Offline/batch (sees all data)
  + BIC-optimal segment boundaries
  + Can detect multiple scales of change
  - O(T * maxBreaks) complexity
  - Cannot run in true real-time

Recommended hybrid (from core_data/21 section 4.3):
  CUSUM for fast online alerting + Binary Segmentation for confirmation.
  The system implements both independently.
```

---

### AD-5: Strategy Half-Life Estimation

**Academic Basis:**
McLean, R.D. & Pontiff, J. (2016). "Does Academic Research Destroy Stock
Return Predictability?" *Journal of Finance*, 71(5), 5-32.

Poterba, J.M. & Summers, L.H. (1988). "Mean Reversion in Stock Prices:
Evidence and Implications." *Journal of Financial Economics*, 22(1), 27-59.

**Exponential Decay Model:**

```
alpha_post(t) = alpha_pre * exp(-lambda_decay * t)

Half-life = ln(2) / lambda_decay

Where:
  alpha_pre   = pre-publication alpha (or pre-crowding alpha)
  alpha_post  = post-publication alpha at time t
  lambda_decay = decay rate
  t           = time since publication/crowding onset
```

**Mean-Reversion Half-Life from AR(1):**

```
AR(1): delta_r_t = theta * r_{t-1} + epsilon_t

Half-life h = -ln(2) / ln(1 + theta)     (requires theta < 0)

Interpretation:
  theta < 0:   mean-reverting, h > 0 (well-defined half-life)
  theta = 0:   random walk, h = infinity (no reversion)
  theta > 0:   trend-persistent, h undefined (explosive)
```

**McLean & Pontiff (2016) Empirical Findings:**

```
Study: 97 stock market anomalies, pre- vs post-publication performance

  Post-publication average return decline: 58%
  Post-publication alpha decline: ~32%

  Decay timeline:
    Year 0 (pre-pub):  0% decay   (full alpha)
    Year 1:            15-25% decay (hedge fund adoption)
    Year 2-3:          30-45% decay (retail awareness, ETF launch)
    Year 4-5:          45-58% decay (peak crowding)
    Year 5+:           50-80% decay (strategy commoditization)
```

**System Mapping:**

| Theory Element | System Component | File:Line |
|---------------|-----------------|-----------|
| WLS lambda=0.995 | Exponential decay weighting in prediction | indicators.js calcWLSRegression() |
| Half-life = 139 days | = ln(2)/ln(1/0.995) | Derived from lambda |
| Alpha decay monitoring | LinUCB Tier-1 dampening | backtester.js:110 (_rlTier1) |
| Crowding detection | pattern_tier context dimension | backtester.js:349 |
| Decay score framework | Defined in core_data/21 section 7.2 | NOT YET IMPLEMENTED |

**Decay Score Framework (Defined, Not Implemented):**

```
Decay_Score = 0.4 * (1 - WR) + 0.3 * (1 - IC/0.1) + 0.3 * max(0, -Sharpe/2)

| Score | Stage | Action | Factor |
|-------|-------|--------|--------|
| 0-0.3 | Green (Valid) | Full weight | 1.0 |
| 0.3-0.5 | Yellow (Decay) | Caution | 0.8 |
| 0.5-0.7 | Orange (Fading) | Minimal use | 0.5 |
| 0.7-1.0 | Red (Invalid) | Skip pattern | 0.0 |

Status: Defined in core_data/21 section 7.2. Backtester infrastructure
(winRate, bootstrap CI) exists but the automated decay score + tier
promotion/demotion pipeline is not yet wired.
```

**Constants Table:**

| Constant | Value | Grade | Location | Rationale |
|----------|-------|-------|----------|-----------|
| WLS lambda | 0.995 | [B] | indicators.js | Half-life 139 days ~ McLean & Pontiff |
| Decay score WR weight | 0.4 | [D] | core_data/21 section 7.2 | NOT IMPLEMENTED |
| Decay score IC weight | 0.3 | [D] | core_data/21 section 7.2 | NOT IMPLEMENTED |
| Decay score Sharpe weight | 0.3 | [D] | core_data/21 section 7.2 | NOT IMPLEMENTED |

**Edge Cases:**
- theta >= 0 in AR(1): Half-life is undefined (strategy is not mean-reverting).
  The system does not compute AR(1) half-life; it relies on the fixed WLS
  lambda=0.995 as the decay rate.
- Very young patterns (< 50 observations): Insufficient data for reliable
  decay assessment. The system requires minimum sample sizes (varies by
  pattern type) before computing statistics.

---

## Appendix A: Constants Inventory

All constants from Section 2.9, organized by grade.

### Grade [A] — Academically Standard

| Constant | Value | Formula/Source | Location |
|----------|-------|---------------|----------|
| EWMA lambda (volatility) | 0.94 | RiskMetrics (1996) standard | backtester.js:360 |
| Log compression | log1p | Standard for fat-tailed data | rl_linucb.py:73 |
| HMM n_states | 2 | Hamilton (1989) 2-regime | compute_hmm_regimes.py:84 |

### Grade [B] — Empirically Validated

| Constant | Value | Source | Location |
|----------|-------|--------|----------|
| LinUCB K_actions | 5 | Designed for MRA calibration | rl_linucb.py:49 |
| LinUCB d (JS) | 7 | 10 minus 3 unavailable dims | backtester.js:341 |
| LinUCB reinvert_every | 500 | Numerical stability trade-off | rl_linucb.py:109 |
| CUSUM default threshold | 2.5 | Standard CUSUM h | indicators.js:1494 |
| CUSUM slack | 0.5 | Roberts (1966) ARL-optimal | indicators.js:1511 |
| CUSUM EMA alpha | 2/31 | 30-bar half-life | indicators.js:1510 |
| WLS lambda | 0.995 | McLean & Pontiff half-life analog | indicators.js |
| Hurst fallback mean | 0.612 | 2026-03-31 recalibration | backtester.js:392 |
| Hurst fallback std | 0.133 | 2026-03-31 recalibration | backtester.js:393 |
| Binary seg maxBreaks | 3 | Typical for annual data | indicators.js:1587 |
| Binary seg minSegment | 30 | ~6 weeks minimum | indicators.js:1588 |
| HMM min observations | 100 | Minimum for reliable fit | compute_hmm_regimes.py:91 |
| Context clamp | [-3, +3] | Z-score saturation bound | rl_linucb.py:123 |
| IC rejection gate | < 0 | Anti-predictive rejection | backtester.js:260 |

### Grade [C] — Calibrated from Data

| Constant | Value | Source | Location |
|----------|-------|--------|----------|
| KRX_COMMISSION | 0.03% | Empirical KRX round-trip | backtester.js:19 |
| KRX_TAX | 0.18% | 2025 securities tax law | backtester.js:20 |
| KRX_SLIPPAGE | 0.10% | KOSPI large-cap empirical | backtester.js:21 |
| KRX_COST | 0.31% | Sum of above | backtester.js:22 |
| ILLIQ segment slippages | 0.04-0.25% | Amihud ILLIQ-calibrated | backtester.js:33-36 |
| LinUCB alpha (initial) | 1.0 | Tuned via rl_stage_b.py | rl_linucb.py:109 |
| CUSUM high-vol threshold | 3.5 | Empirical vol-regime test | indicators.js:1499 |
| CUSUM low-vol threshold | 1.5 | Empirical vol-regime test | indicators.js:1500 |
| HMM n_iter | 50 | Convergence verified | compute_hmm_regimes.py:84 |
| effective_n (warm start) | 200 | Bayesian prior strength | rl_linucb.py:224 |
| S/R ATR tolerance | 0.5 * ATR(14) | Pattern clustering width | patterns.js |
| Hurst min window | 10 | Minimum R/S block size | indicators.js:212 |

### Grade [D] — Heuristic / Legacy

| Constant | Value | Source | Location |
|----------|-------|--------|----------|
| Kalman Q (base) | 0.01 | Heuristic default | indicators.js:170 |
| Kalman R | 1.0 | Assumed unit noise | indicators.js:170 |
| LinUCB staleness | 90 days | ~1 quarterly cycle | backtester.js:278 |
| HMM staleness | 30 days | Regime shift duration | backtester.js:233 |
| Cache eviction cap | 200 | Memory guard | backtester.js:464 |
| trust_mra bias prior | 0.01*effective_n | Zero-confidence prevention | rl_linucb.py:295 |
| isRecent window | 20 bars | Recency heuristic | indicators.js:1562 |
| HMM mu_init | [+0.001, -0.002] | Initial guess (EM converges) | compute_hmm_regimes.py:96 |
| HMM sigma_init | [0.01, 0.02] | Initial guess | compute_hmm_regimes.py:97 |
| HMM trans_init | [[0.98,0.02],[0.05,0.95]] | High persistence prior | compute_hmm_regimes.py:98 |
| Decay score weights | 0.4/0.3/0.3 | NOT IMPLEMENTED | core_data/21 |

---

## Appendix B: Cross-Reference Map (Theory -> Code)

### Complete Data Flow

```
[Python Offline Pipeline]

  compute_hmm_regimes.py
    -> data/backtest/hmm_regimes.json     (HMM regime assignments)

  rl_context_features.py
    -> data/backtest/rl_context.csv       (10-dim contexts for training)
    -> data/backtest/rl_context_stats.json (feature statistics)

  rl_linucb.py (via rl_stage_b.py)
    -> data/backtest/rl_policy.json       (theta vectors, normalization, win_rates)

  compute_capm_beta.py
    -> data/backtest/capm_beta.json       (per-stock CAPM beta)


[JS Runtime]

  backtester.js constructor:
    _loadRLPolicy()          -> loads rl_policy.json
    _loadBehavioralData()    -> loads hmm_regimes.json, illiq_spread.json, etc.
    _loadCAPMBeta()          -> loads capm_beta.json
    _loadCalibratedConstants() -> loads calibrated_constants.json

  Per-pattern backtest flow:
    backtest(candles, patternType)
      -> _collectOccurrences()     (sliding-window pattern detection)
      -> _computeStats()           (N-day return statistics, WLS prediction)
         -> _buildRLContext()      (7-dim context vector)
         -> _applyLinUCBGreedy()   (select action, get factor)
         -> y_adjusted = y_mra * factor
      -> _cumulativeCurve()        (equity curve construction)

  indicators.js:
    calcKalman()             -> Scalar Kalman filter (price smoothing)
    calcHurst()              -> R/S Hurst exponent (trend persistence)
    calcOnlineCUSUM()        -> Online bilateral CUSUM (breakpoint detection)
    calcBinarySegmentation() -> BIC-optimal segmentation (regime boundaries)
```

### Theory-to-Implementation Completeness Matrix

| Theory | Implemented | Location | Status |
|--------|-------------|----------|--------|
| GT-1: Nash equilibrium | Indirectly (S/R, crowding) | patterns.js, backtester.js | Conceptual |
| GT-2: Kyle lambda / Akerlof | ILLIQ-based slippage | backtester.js:27-38 | Operational |
| GT-3: Spence signaling | Volume confirmation | signalEngine.js | Operational |
| OC-1: Kalman filter | Full (adaptive Q) | indicators.js:170-200 | Production |
| OC-2: Kalman gain | Scalar form | indicators.js:194 | Production |
| OC-3: HJB/Merton | Not directly | -- | Theoretical only |
| RL-1: Bellman equation | NOT APPLICABLE | -- | Bandit, not MDP |
| RL-2: LinUCB | Full (train + deploy) | rl_linucb.py + backtester.js | Production |
| RL-3: Thompson sampling | Partial (point estimate) | backtester.js:289-297 | Operational |
| RL-4: Reward shaping | Full | rl_linucb.py:56-81 | Production |
| AD-1: AMH | Architecture-level | WLS, Hurst, LinUCB | Design principle |
| AD-2: HMM 2-state | Full (offline + runtime) | compute_hmm_regimes.py | Production |
| AD-3: CUSUM | Full | indicators.js:1493-1571 | Production |
| AD-4: Binary segmentation | Full | indicators.js:1586-1660 | Production |
| AD-5: Strategy half-life | Partial (WLS lambda) | indicators.js | Operational |
| AD-5: Decay score | Defined, NOT wired | core_data/21 section 7.2 | Not implemented |

---

## References

### Game Theory
1. Nash, J.F. (1950). "Equilibrium Points in N-Person Games." *PNAS*, 36(1), 48-49.
2. Akerlof, G.A. (1970). "The Market for 'Lemons'." *QJE*, 84(3), 488-500.
3. Kyle, A.S. (1985). "Continuous Auctions and Insider Trading." *Econometrica*, 53(6), 1315-1335.
4. Spence, M. (1973). "Job Market Signaling." *QJE*, 87(3), 355-374.
5. Vickrey, W. (1961). "Counterspeculation, Auctions, and Competitive Sealed Tenders." *JF*, 16(1), 8-37.
6. Brock, W.A. & Hommes, C.H. (1998). "Heterogeneous Beliefs and Routes to Chaos in a Simple Asset Pricing Model." *JED*, 1(1), 5-44.
7. Taylor, P.D. & Jonker, L.B. (1978). "Evolutionary Stable Strategies and Game Dynamics." *Mathematical Biosciences*, 40(1-2), 145-156.

### Optimal Control
8. Kalman, R.E. (1960). "A New Approach to Linear Filtering and Prediction Problems." *Journal of Basic Engineering*, 82(1), 35-45.
9. Merton, R.C. (1969). "Lifetime Portfolio Selection under Uncertainty." *Review of Economics and Statistics*, 51(3), 247-257.
10. Merton, R.C. (1971). "Optimum Consumption and Portfolio Rules." *Journal of Economic Theory*, 3(4), 373-413.
11. Bellman, R. (1957). *Dynamic Programming*. Princeton University Press.
12. Mohamed, A.H. & Schwarz, K.P. (1999). "Adaptive Kalman Filtering for INS/GPS." *Journal of Geodesy*, 73, 193-203.
13. Almgren, R. & Chriss, N. (2001). "Optimal Execution of Portfolio Transactions." *Journal of Risk*, 3(2), 5-39.

### Reinforcement Learning
14. Li, L., Chu, W., Langford, J., & Schapire, R.E. (2010). "A Contextual-Bandit Approach to Personalized News Article Recommendation." *WWW 2010*, 661-670.
15. Sutton, R.S. & Barto, A.G. (2018). *Reinforcement Learning: An Introduction*, 2nd ed. MIT Press.
16. Watkins, C.J.C.H. & Dayan, P. (1992). "Q-Learning." *Machine Learning*, 8, 279-292.
17. Schulman, J. et al. (2017). "Proximal Policy Optimization Algorithms." arXiv:1707.06347.
18. Thompson, W.R. (1933). "On the Likelihood that One Unknown Probability Exceeds Another." *Biometrika*, 25(3/4), 285-294.
19. Grinold, R.C. (1989). "The Fundamental Law of Active Management." *JPM*, 15(3), 30-37.
20. Mnih, V. et al. (2015). "Human-Level Control through Deep Reinforcement Learning." *Nature*, 518, 529-533.
21. Haarnoja, T. et al. (2018). "Soft Actor-Critic." *ICML-18*.

### Adaptive Pattern Modeling
22. Lo, A.W. (2004). "The Adaptive Markets Hypothesis." *JPM*, 30(5), 15-29.
23. Lo, A.W. (2012). "Adaptive Markets and the New World Order." *FAJ*, 68(2), 18-29.
24. Hamilton, J.D. (1989). "A New Approach to the Economic Analysis of Nonstationary Time Series." *Econometrica*, 57(2), 357-384.
25. Page, E.S. (1954). "Continuous Inspection Schemes." *Biometrika*, 41(1/2), 100-115.
26. Roberts, S.W. (1966). "A Comparison of Some Control Chart Procedures." *Technometrics*, 8(3), 411-430.
27. Bai, J. & Perron, P. (1998). "Estimating and Testing Linear Models with Multiple Structural Changes." *Econometrica*, 66(1), 47-78.
28. McLean, R.D. & Pontiff, J. (2016). "Does Academic Research Destroy Stock Return Predictability?" *JF*, 71(5), 5-32.
29. Hurst, H.E. (1951). "Long-Term Storage Capacity of Reservoirs." *Trans. ASCE*, 116, 770-799.
30. Peters, E. (1994). *Fractal Market Analysis*. Wiley.
31. Amihud, Y. (2002). "Illiquidity and Stock Returns." *JFM*, 5(1), 31-56.
32. Bollerslev, T. (1986). "Generalized Autoregressive Conditional Heteroskedasticity." *JoE*, 31(3), 307-327.
33. Mandelbrot, B.B. (1963). "The Variation of Certain Speculative Prices." *Journal of Business*, 36(4), 394-419.
34. Bulkowski, T.N. (2005). *Encyclopedia of Chart Patterns*, 2nd ed. Wiley.

### Advanced RL (Theoretical Reference)
35. Ng, A.Y. & Russell, S. (2000). "Algorithms for Inverse Reinforcement Learning." *ICML-00*.
36. Finn, C. et al. (2017). "Model-Agnostic Meta-Learning (MAML)." *ICML-17*.
37. Achiam, J. et al. (2017). "Constrained Policy Optimization." *ICML-17*.
38. Spooner, T. et al. (2018). "Market Making via Reinforcement Learning." *AAMAS-18*.

---

*Generated: 2026-04-06 | Anatomy v6 | Section 2.9*
*15 formulas | 60+ constants | 5 production implementations*
