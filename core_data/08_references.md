# 08. 참고문헌 — References & Bibliography

> 기술적 분석의 학술적 기반을 구성하는 논문, 저서, 강의, 오픈소스 프로젝트를
> 영역별로 정리한 종합 목록.

---

## I. 수학 & 확률론

### 핵심 저서
- Kolmogorov, A.N. (1933). *Grundbegriffe der Wahrscheinlichkeitsrechnung*. Berlin: Springer.
  → 현대 확률론의 공리적 기초. 모든 확률 계산의 출발점.

- Feller, W. (1968). *An Introduction to Probability Theory and Its Applications*, Vol. I & II. Wiley.
  → 확률론의 고전적 교과서. 랜덤워크, 마르팅게일 이론 포함.

- Shreve, S. (2004). *Stochastic Calculus for Finance I & II*. Springer.
  → 금융 수학 대학원 표준 교재. 이산 및 연속 확률 과정.
  → Carnegie Mellon University 금융공학 프로그램 기반.

### 핵심 논문
- Bachelier, L. (1900). *Théorie de la spéculation*. Annales Scientifiques de l'ENS.
  → 최초의 금융 수학 논문. 랜덤워크 이론의 원전.

- Itô, K. (1944). *Stochastic integral*. Proceedings of the Imperial Academy.
  → 이토 적분의 원전. Black-Scholes 공식의 수학적 기초.

---

## II. 통계학 & 시계열 분석

### 핵심 저서
- Box, G.E.P., Jenkins, G.M. & Reinsel, G.C. (1970/2015). *Time Series Analysis: Forecasting and Control*. Wiley.
  → ARIMA 모형의 원전. 시계열 분석의 바이블.

- Hamilton, J.D. (1994). *Time Series Analysis*. Princeton University Press.
  → 경제 시계열 분석의 대학원 표준 교재.

- Tsay, R.S. (2010). *Analysis of Financial Time Series*. Wiley.
  → 금융 시계열에 특화된 교과서. GARCH, 변동성 모형 상세.
  → University of Chicago Booth 교수.

### 핵심 논문
- Andersen, T.G., Bollerslev, T., Diebold, F.X. & Labys, P. (2003). *Modeling and Forecasting Realized Volatility*. Econometrica, 71(2), 579-625.
  → 실현변동성(RV) 모형의 핵심 참조. [Doc34 §4]

- Andersen, T.G., Bollerslev, T. & Diebold, F.X. (2007). *Roughing It Up: Including Jump Components in the Measurement, Modeling, and Forecasting of Return Volatility*. Review of Economics and Statistics, 89(4), 701-720.
  → 점프 성분을 포함한 변동성 예측. [Doc34 §11]

- Barndorff-Nielsen, O.E. & Shephard, N. (2002). *Econometric Analysis of Realized Volatility and Its Use in Estimating Stochastic Volatility Models*. Journal of the Royal Statistical Society: Series B, 64(2), 253-280.
  → 실현변동성의 확률변동성 모형 추정 적용. [Doc34 §5]

- Barndorff-Nielsen, O.E. & Shephard, N. (2006). *Econometrics of Testing for Jumps in Financial Economics Using Bipower Variation*. Journal of Financial Econometrics, 4(1), 1-30.
  → 이중멱승 변이(Bipower Variation)를 이용한 점프 검정. [Doc34 §6]

- Bollerslev, T. (1986). *Generalized Autoregressive Conditional Heteroskedasticity*. Journal of Econometrics, 31(3).
  → GARCH 모형 원전.

- Bollerslev, T., Tauchen, G. & Zhou, H. (2009). *Expected Stock Returns and Variance Risk Premia*. Review of Financial Studies, 22(11), 4463-4492.
  → 분산위험프리미엄(VRP)과 주식 기대수익률의 관계. [Doc34 §1]

- Corsi, F. (2009). *A Simple Approximate Long-Memory Model of Realized Volatility*. Journal of Financial Econometrics, 7(2), 174-196.
  → HAR-RV 모형 원전. 장기기억 변동성의 간결한 근사. [Doc34 §2]

- Corsi, F., Pirino, D. & Reno, R. (2010). *Threshold Bipower Variation and the Impact of Jumps on Volatility Forecasting*. Journal of Econometrics, 159(2), 276-288.
  → 임계 이중멱승 변이, 점프가 변동성 예측에 미치는 영향. [Doc34 §10]

- Dickey, D.A. & Fuller, W.A. (1979). *Distribution of the Estimators for Autoregressive Time Series with a Unit Root*. JASA, 74.
  → ADF 단위근 검정.

- Engle, R.F. (1982). *Autoregressive Conditional Heteroskedasticity with Estimates of the Variance of United Kingdom Inflation*. Econometrica, 50(4).
  → ARCH 모형 원전. 2003 노벨 경제학상.

- Mehra, R.K. (1970). *On the Identification of Variances and Adaptive Kalman Filtering*. IEEE Transactions on Automatic Control, 15(2), 175-184.
  → 적응적 칼만 필터의 분산 식별 원전.

- Muller, U.A., Dacorogna, M.M., Dave, R.D., Olsen, R.B., Pictet, O.V. & von Weizsacker, J.E. (1997). *Volatilities of Different Time Resolutions — Analyzing the Dynamics of Market Components*. Journal of Empirical Finance, 4(2-3), 213-239.
  → 다중 시간해상도 변동성 분석. HARCH 모형의 근간. [Doc34 §7]

- Parkinson, M. (1980). *The Extreme Value Method for Estimating the Variance of the Rate of Return*. Journal of Business, 53(1), 61-65.
  → Parkinson 변동성(고가-저가 기반 추정). [Doc34 §13]

- Patton, A.J. & Sheppard, K. (2015). *Good Volatility, Bad Volatility: Signed Jumps and the Persistence of Volatility*. Review of Economics and Statistics, 97(3), 683-697.
  → 부호 점프 분해와 변동성 지속성. [Doc34 §9]

---

## III. 물리학 & 경제물리학

### 핵심 저서
- Mandelbrot, B.B. (1982). *The Fractal Geometry of Nature*. W.H. Freeman.
  → 프랙탈 기하학의 고전. 금융 시장의 자기유사성.

- Mandelbrot, B.B. & Hudson, R.L. (2004). *The (Mis)behavior of Markets*. Basic Books.
  → 프랙탈 시장 가설의 대중서. 금융 위험의 과소평가 경고.

- Mantegna, R.N. & Stanley, H.E. (2000). *An Introduction to Econophysics*. Cambridge University Press.
  → 경제물리학의 표준 교과서.
  → Boston University, Palermo University 교수들.

- Bouchaud, J.-P. & Potters, M. (2003). *Theory of Financial Risk and Derivative Pricing*. Cambridge University Press.
  → 물리학적 관점의 금융 위험 이론.
  → Capital Fund Management(CFM) 공동창업자.

- Sornette, D. (2003). *Why Stock Markets Crash: Critical Events in Complex Financial Systems*. Princeton University Press.
  → 로그주기 멱법칙(LPPL)과 시장 붕괴 예측.
  → ETH Zürich 교수.

- Peters, E.E. (1994). *Fractal Market Analysis*. Wiley.
  → 프랙탈 시장 가설과 R/S 분석의 금융 적용.

### 핵심 논문
- Mandelbrot, B.B. (1963). *The Variation of Certain Speculative Prices*. Journal of Business, 36(4).
  → 금융 수익률의 비정규성 최초 실증.

- Gopikrishnan, P. et al. (1999). *Scaling of the Distribution of Fluctuations of Financial Market Indices*. Physical Review E, 60(5).
  → 수익률 분포의 역세제곱 법칙 (α ≈ 3).

- Cont, R. (2001). *Empirical Properties of Asset Returns: Stylized Facts and Statistical Issues*. Quantitative Finance, 1(2).
  → 금융 수익률의 경험적 사실 종합 서베이.

- Bak, P., Tang, C. & Wiesenfeld, K. (1987). *Self-Organized Criticality: An Explanation of 1/f Noise*. Physical Review Letters, 59(4).
  → 자기조직 임계성 원전.

---

## IV. 심리학 & 행동경제학

### 핵심 저서
- Kahneman, D. (2011). *Thinking, Fast and Slow*. Farrar, Straus and Giroux.
  → 행동경제학의 대중적 종합서. 시스템 1&2 의사결정.
  → Princeton University 교수. 2002 노벨 경제학상.

- Thaler, R.H. (2015). *Misbehaving: The Making of Behavioral Economics*. W.W. Norton.
  → 행동경제학의 역사와 실무 적용.
  → University of Chicago 교수. 2017 노벨 경제학상.

- Shiller, R.J. (2000). *Irrational Exuberance*. Princeton University Press.
  → 시장 버블의 심리학적 분석. 닷컴 버블 예측.
  → Yale University 교수. 2013 노벨 경제학상.

- Shefrin, H. (2000). *Beyond Greed and Fear*. Oxford University Press.
  → 행동금융학의 체계적 교과서.
  → Santa Clara University 교수.

### 핵심 논문
- Kahneman, D. & Tversky, A. (1979). *Prospect Theory: An Analysis of Decision under Risk*. Econometrica, 47(2).
  → 전망이론 원전. 경제학에서 가장 많이 인용된 논문 중 하나.

- Tversky, A. & Kahneman, D. (1974). *Judgment under Uncertainty: Heuristics and Biases*. Science, 185(4157).
  → 인지편향(닻 효과, 대표성, 가용성) 원전.

- Shefrin, H. & Statman, M. (1985). *The Disposition to Sell Winners Too Early and Ride Losers Too Long*. Journal of Finance, 40(3).
  → 처분효과 원전.

- DeBondt, W.F.M. & Thaler, R.H. (1985). *Does the Stock Market Overreact?* Journal of Finance, 40(3).
  → 과잉반응(overreaction) 가설.

- Bikhchandani, S., Hirshleifer, D. & Welch, I. (1992). *A Theory of Fads, Fashion, Custom, and Cultural Change as Informational Cascades*. JPE, 100(5).
  → 정보 폭포 이론.

---

## V. 금융 이론 — 자산가격결정 & 포트폴리오

### 핵심 저서
- Back, K. (2017). *Asset Pricing and Portfolio Choice Theory* (2nd Edition). Oxford University Press.
  → 자산가격결정과 포트폴리오 선택의 대학원 교재. [Doc42 §Refs]

- Bodie, Z., Kane, A. & Marcus, A.J. (2021). *Investments*. McGraw-Hill.
  → 투자론의 표준 교과서. CAPM, EMH, MPT 포함.

- Campbell, J.Y., Lo, A.W. & MacKinlay, A.C. (1997). *The Econometrics of Financial Markets*. Princeton University Press.
  → 금융 시장 계량경제학의 대학원 표준. Fama-MacBeth, GMM 등. [Doc42 §Refs]

- Cochrane, J.H. (2005). *Asset Pricing* (Revised Edition). Princeton University Press.
  → 자산가격결정 이론의 대학원 교과서. 할인팩터 통합 프레임워크. [Doc42 §1]

- Hull, J.C. (2018). *Options, Futures, and Other Derivatives*. Pearson.
  → 파생상품의 표준 교과서. Black-Scholes 모형 상세.
  → University of Toronto 교수. [Doc45 §Refs, Doc47 §1.4]

- Ilmanen, A. (2011). *Expected Returns: An Investor's Guide to Harvesting Market Rewards*. Wiley.
  → 기대수익률의 자산군별 종합 가이드. VRP, 캐리 등. [Doc34 §14]

- Lo, A.W. & MacKinlay, A.C. (1999). *A Non-Random Walk Down Wall Street*. Princeton University Press.
  → EMH에 대한 실증적 도전. 기술적 분석의 학문적 정당화.
  → MIT Sloan 교수.

### 핵심 논문 — CAPM & APT
- Amihud, Y. (2002). *Illiquidity and Stock Returns: Cross-Section and Time-Series Effects*. Journal of Financial Markets, 5(1), 31-56.
  → ILLIQ 비유동성 측도와 주식 수익률. [Doc42 §3]

- Banz, R.W. (1981). *The Relationship Between Return and Market Value of Common Stocks*. Journal of Financial Economics, 9(1), 3-18.
  → 소형주 효과의 최초 실증. [Doc42 §6]

- Black, F. (1972). *Capital Market Equilibrium with Restricted Borrowing*. Journal of Business, 45(3), 444-455.
  → Zero-beta CAPM. 차입 제약 하의 균형 모형. [Doc42 §2]

- Breeden, D.T. (1979). *An Intertemporal Asset Pricing Model with Stochastic Consumption and Investment Opportunities*. Journal of Financial Economics, 7(3), 265-296.
  → 소비 기반 CAPM(CCAPM) 원전. [Doc42 §4]

- Carhart, M.M. (1997). *On Persistence in Mutual Fund Performance*. Journal of Finance, 52(1), 57-82.
  → Carhart 4요인 모형(FF3 + 모멘텀). [Doc42 §3]

- Chamberlain, G. & Rothschild, M. (1983). *Arbitrage, Factor Structure, and Mean-Variance Analysis on Large Asset Markets*. Econometrica, 51(5), 1281-1304.
  → APT의 근사적 차익거래 분석. [Doc42 §5]

- Fama, E.F. (1970). *Efficient Capital Markets: A Review of Theory and Empirical Work*. Journal of Finance, 25(2).
  → 효율적 시장 가설 원전. 2013 노벨 경제학상.

- Fama, E.F. & French, K.R. (1992). *The Cross-Section of Expected Stock Returns*. Journal of Finance, 47(2), 427-465.
  → 베타의 설명력 약화, 규모·가치 요인 발견. [Doc42 §3]

- Fama, E.F. & French, K.R. (1993). *Common Risk Factors in the Returns on Stocks and Bonds*. Journal of Financial Economics, 33(1).
  → Fama-French 3요인 모형. [Doc42 §3]

- Fama, E.F. & French, K.R. (2015). *A Five-Factor Asset Pricing Model*. Journal of Financial Economics, 116(1), 1-22.
  → FF5 모형(수익성 + 투자). [Doc42 §3]

- Fama, E.F. & MacBeth, J.D. (1973). *Risk, Return, and Equilibrium: Empirical Tests*. Journal of Political Economy, 81(3), 607-636.
  → Fama-MacBeth 2단계 횡단면 회귀. [Doc42 §3]

- Frazzini, A. & Pedersen, L.H. (2014). *Betting Against Beta*. Journal of Financial Economics, 111(1), 1-25.
  → BAB 팩터. 저베타 이상현상의 실증. [Doc42 §6]

- Huberman, G. (1982). *A Simple Approach to Arbitrage Pricing Theory*. Journal of Economic Theory, 28(1), 183-191.
  → APT의 간결한 도출. [Doc42 §5]

- Jegadeesh, N. & Titman, S. (1993). *Returns to Buying Winners and Selling Losers*. Journal of Finance, 48(1).
  → 모멘텀 효과 실증. [Doc42 §3]

- Lintner, J. (1965). *The Valuation of Risk Assets and the Selection of Risky Investments in Stock Portfolios and Capital Budgets*. Review of Economics and Statistics, 47(1), 13-37.
  → CAPM 독립 도출(Sharpe와 동시). [Doc42 §2]

- Lo, A.W. (2004). *The Adaptive Markets Hypothesis*. Journal of Portfolio Management, 30(5).
  → 적응적 시장 가설.

- Lucas, R.E. (1978). *Asset Prices in an Exchange Economy*. Econometrica, 46(6), 1429-1445.
  → 일반균형 자산가격결정. Lucas Tree 모형. [Doc42 §4]

- Markowitz, H. (1952). *Portfolio Selection*. Journal of Finance, 7(1).
  → 현대 포트폴리오 이론 원전. 1990 노벨 경제학상.

- Merton, R.C. (1973). *An Intertemporal Capital Asset Pricing Model*. Econometrica, 41(5), 867-887.
  → ICAPM 원전. 헤지 수요 포트폴리오. [Doc42 §4]

- Mossin, J. (1966). *Equilibrium in a Capital Asset Market*. Econometrica, 34(4), 768-783.
  → CAPM 독립 도출(Sharpe-Lintner와 동시). [Doc42 §2]

- Novy-Marx, R. (2013). *The Other Side of Value: The Gross Profitability Premium*. Journal of Financial Economics, 108(1), 1-28.
  → 총이익률 프리미엄. FF5 RMW 요인의 전신. [Doc42 §3]

- Ross, S.A. (1976). *The Arbitrage Theory of Capital Asset Pricing*. Journal of Economic Theory, 13(3), 341-360.
  → 차익거래가격결정이론(APT) 원전. [Doc42 §5]

- Sharpe, W.F. (1964). *Capital Asset Prices: A Theory of Market Equilibrium*. Journal of Finance, 19(3).
  → CAPM 원전. 1990 노벨 경제학상. [Doc42 §2]

### 핵심 논문 — 실증 & 이상현상
- Barro, R.J. (2006). *Rare Disasters and Asset Markets in the Twentieth Century*. Quarterly Journal of Economics, 121(3), 823-866.
  → 희귀재난 모형. 주식프리미엄 퍼즐 설명. [Doc42 §4]

- Blume, M.E. (1971). *On the Assessment of Risk*. Journal of Finance, 26(1), 1-10.
  → 베타의 시계열 안정성 분석. [Doc42 §7]

- Blume, M.E. (1975). *Betas and Their Regression Tendencies*. Journal of Finance, 30(3), 785-795.
  → 베타의 평균회귀 성질. Blume 베타 보정(w=0.67). [Doc25 §9.3]

- Campbell, J.Y. & Cochrane, J.H. (1999). *By Force of Habit: A Consumption-Based Explanation of Aggregate Stock Market Behavior*. Journal of Political Economy, 107(2), 205-251.
  → 습관형성(Habit Formation) 모형. 경기순환적 위험회피. [Doc42 §4]

- Epstein, L.G. & Zin, S.E. (1989). *Substitution, Risk Aversion, and the Temporal Behavior of Consumption and Asset Returns*. Econometrica, 57(4), 937-969.
  → Epstein-Zin 재귀적 효용. 위험회피와 시점간 대체 분리. [Doc42 §4]

- Gu, S., Kelly, B. & Xiu, D. (2020). *Empirical Asset Pricing via Machine Learning*. Review of Financial Studies, 33(5), 2223-2273.
  → 머신러닝 기반 자산가격결정. [Doc42 §Refs]

- Harvey, C.R., Liu, Y. & Zhu, H. (2016). *...and the Cross-Section of Expected Returns*. Review of Financial Studies, 29(1), 5-68.
  → 다중검정 보정. 팩터 동물원 문제. [Doc42 §7]

- McLean, R.D. & Pontiff, J. (2016). *Does Academic Research Destroy Stock Return Predictability?*. Journal of Finance, 71(1), 5-32.
  → 논문 발표 후 이상현상 소멸(out-of-sample decay). [Doc42 §7]

- Mehra, R. & Prescott, E.C. (1985). *The Equity Premium: A Puzzle*. Journal of Monetary Economics, 15(2), 145-161.
  → 주식프리미엄 퍼즐 원전. [Doc42 §4]

- Miller, E.M. (1977). *Risk, Uncertainty, and Divergence of Opinion*. Journal of Finance, 32(4), 1151-1168.
  → 의견 분산과 과대평가 이론. 공매도 제약. [Doc42 §6]

- Roll, R. (1977). *A Critique of the Asset Pricing Theory's Tests*. Journal of Financial Economics, 4(2), 129-176.
  → Roll의 비판. 시장 포트폴리오 관측 불가능성. [Doc42 §7]

- Dimson, E. (1979). *Risk Measurement when Shares are Subject to Infrequent Trading*. Journal of Financial Economics, 7(2), 197-226.
  → 비빈번 거래 종목의 Lead-Lag 베타 보정. [Doc25 §9.1]

- Scholes, M. & Williams, J. (1977). *Estimating Betas from Nonsynchronous Data*. Journal of Financial Economics, 5(3), 309-327.
  → 비동시거래 베타 보정. Dimson (1979) K=1의 특수사례. [Doc42 §7, Doc25 §9.1]

- Titman, S., Wei, K.C.J. & Xie, F. (2004). *Capital Investments and Stock Returns*. Journal of Financial and Quantitative Analysis, 39(4), 677-700.
  → 자본적 지출과 주식 수익률의 음의 관계. [Doc42 §6]

- Vasicek, O.A. (1973). *A Note on Using Cross-Sectional Information in Bayesian Estimation of Security Betas*. Journal of Finance, 28(5), 1233-1239.
  → 베이지안 베타 축소 추정(Vasicek shrinkage). [Doc42 §7]

### 핵심 논문 — 한국 시장
- Bae, K.-H., Kang, J.-K. & Kim, J.-M. (2002). *Tunneling or Value Added? Evidence from Mergers by Korean Business Groups*. Journal of Finance, 57(6), 2695-2740.
  → 한국 재벌의 터널링 실증. [Doc42 §8, Doc43 §4, Doc35 §19]

- Choe, H., Kho, B.-C. & Stulz, R. (1999). *Do Foreign Investors Destabilize Stock Markets? The Korean Experience in 1997*. Journal of Financial Economics, 54(2), 227-264.
  → 1997 외환위기 기간 외국인 투자자 행태. [Doc42 §8, Doc27 §9]

---

## VI. 기술적 분석

### 핵심 저서
- Edwards, R.D. & Magee, J. (1948). *Technical Analysis of Stock Trends*. John Magee Inc.
  → 기술적 분석의 "성경". 차트 패턴의 고전.

- Murphy, J.J. (1999). *Technical Analysis of the Financial Markets*. New York Institute of Finance.
  → 기술적 분석의 종합적 교과서. 입문부터 고급까지.

- Nison, S. (1991). *Japanese Candlestick Charting Techniques*. New York Institute of Finance.
  → 캔들스틱 차트를 서양에 소개한 원전.

- Nison, S. (1994). *Beyond Candlesticks*. Wiley.
  → 캔들스틱 고급편. Renko, Kagi, Three-Line Break 등.

- Wilder, J.W. (1978). *New Concepts in Technical Trading Systems*. Trend Research.
  → RSI, ATR, ADX, 파라볼릭 SAR의 원전.

- Appel, G. (1979). *The Moving Average Convergence-Divergence Trading Method*. Systems and Forecasts newsletter.
  → MACD 지표의 원전. 12/26/9 매개변수의 출처.

- Bollinger, J. (2001). *Bollinger on Bollinger Bands*. McGraw-Hill.
  → 볼린저 밴드의 원전. 설계 철학과 활용법.

- Kaufman, P. (1995). *Trading Systems and Methods*. Wiley.
  → 트레이딩 시스템의 백과사전. KAMA 원전.

- Pring, M.J. (2002). *Technical Analysis Explained*. McGraw-Hill.
  → 기술적 분석의 종합 교과서.

- Bulkowski, T.N. (2005). *Encyclopedia of Chart Patterns*. Wiley.
  → 53종 차트 패턴의 통계적 성과 분석.

- Kirkpatrick, C.D. & Dahlquist, J.R. (2010). *Technical Analysis: The Complete Resource for Financial Market Technicians*. FT Press.
  → CMT(공인기술분석사) 시험 공식 교재.

### 핵심 논문
- Lo, A.W., Mamaysky, H. & Wang, J. (2000). *Foundations of Technical Analysis: Computational Algorithms, Statistical Inference, and Empirical Implementation*. Journal of Finance, 55(4).
  → 기술적 분석의 학문적 검증. 자동 패턴 인식으로 통계적 유의성 확인.

- Brock, W., Lakonishok, J. & LeBaron, B. (1992). *Simple Technical Trading Rules and the Stochastic Properties of Stock Returns*. Journal of Finance, 47(5).
  → 이동평균, 지지/저항 전략의 실증적 유효성.

- Caginalp, G. & Laurent, H. (1998). *The Predictive Power of Price Patterns*. Applied Mathematical Finance, 5(3-4).
  → 캔들스틱 패턴의 통계적 예측력 실증.

---

## VII. 머신러닝 & 패턴 인식

### 핵심 저서
- Bishop, C.M. (2006). *Pattern Recognition and Machine Learning*. Springer.
  → 패턴 인식과 머신러닝의 표준 교과서.

- Goodfellow, I., Bengio, Y. & Courville, A. (2016). *Deep Learning*. MIT Press.
  → 딥러닝의 표준 교과서. 무료 온라인 제공.

### 핵심 논문
- Berndt, D.J. & Clifford, J. (1994). *Using Dynamic Time Warping to Find Patterns in Time Series*. KDD Workshop.
  → DTW 기반 시계열 패턴 매칭.

- Hochreiter, S. & Schmidhuber, J. (1997). *Long Short-Term Memory*. Neural Computation, 9(8).
  → LSTM 원전.

- Jiang, W. et al. (2020). *Applications of Deep Learning in Stock Market Prediction*. Journal of Financial Data Science.
  → 딥러닝의 금융 시장 예측 적용 서베이.

---

## VIII. 기업재무 & 자본구조 (Corporate Finance)

### 핵심 저서
- Brealey, R.A., Myers, S.C. & Allen, F. (2020). *Principles of Corporate Finance* (13th ed.). McGraw-Hill.
  → 기업재무의 표준 교과서. MM 이론, NPV, WACC 포함. [Doc43 §Refs]

- Dixit, A.K. & Pindyck, R.S. (1994). *Investment under Uncertainty*. Princeton University Press.
  → 실물옵션과 투자결정의 불확실성. [Doc43 §5, Doc45 §6]

- Tirole, J. (2006). *The Theory of Corporate Finance*. Princeton University Press.
  → 기업재무 이론의 대학원 교과서. 대리인 문제, 계약이론. [Doc43 §1]

- Trigeorgis, L. (1996). *Real Options: Managerial Flexibility and Strategy in Resource Allocation*. MIT Press.
  → 실물옵션의 전략적 적용. [Doc43 §5, Doc45 §6]

### 핵심 논문 — 자본구조
- DeAngelo, H. & Masulis, R.W. (1980). *Optimal Capital Structure under Corporate and Personal Taxation*. Journal of Financial Economics, 8(1), 3-29.
  → 비부채 세금감면과 최적 자본구조. [Doc43 §1]

- Harris, M. & Raviv, A. (1991). *The Theory of Capital Structure*. Journal of Finance, 46(1), 297-355.
  → 자본구조 이론의 종합 서베이. [Doc43 §1]

- Jensen, M.C. (1986). *Agency Costs of Free Cash Flow, Corporate Finance, and Takeovers*. American Economic Review, 76(2), 323-329.
  → 잉여현금흐름의 대리인 비용. [Doc43 §2]

- Jensen, M.C. & Meckling, W.H. (1976). *Theory of the Firm: Managerial Behavior, Agency Costs and Ownership Structure*. Journal of Financial Economics, 3(4), 305-360.
  → 대리인 이론 원전. 기업의 계약적 관점. [Doc43 §2]

- Miller, M.H. (1977). *Debt and Taxes*. Journal of Finance, 32(2), 261-275.
  → MM 이론에 개인세 도입. 세금 균형(tax clientele). [Doc43 §1]

- Modigliani, F. & Miller, M.H. (1958). *The Cost of Capital, Corporation Finance and the Theory of Investment*. American Economic Review, 48(3), 261-297.
  → MM 명제 원전. 자본구조 무관련성. 1985/1990 노벨 경제학상. [Doc43 §1]

- Modigliani, F. & Miller, M.H. (1963). *Corporate Income Taxes and the Cost of Capital: A Correction*. American Economic Review, 53(3), 433-443.
  → MM 명제 법인세 수정. 부채의 세금감면 효과. [Doc43 §1]

- Myers, S.C. (1977). *Determinants of Corporate Borrowing*. Journal of Financial Economics, 5(2), 147-175.
  → 부채과잉(debt overhang) 문제. [Doc43 §2]

- Myers, S.C. (1984). *The Capital Structure Puzzle*. Journal of Finance, 39(3), 575-592.
  → 자본구조 퍼즐. 정적 균형 vs 자본조달순서. [Doc43 §1]

- Myers, S.C. & Majluf, N.S. (1984). *Corporate Financing and Investment Decisions When Firms Have Information That Investors Do Not Have*. Journal of Financial Economics, 13(2), 187-221.
  → 자본조달순서이론(Pecking Order) 원전. [Doc43 §2]

### 핵심 논문 — 배당 & 신호
- Allen, F., Bernardo, A.E. & Welch, I. (2000). *A Theory of Dividends Based on Tax Clienteles*. Journal of Finance, 55(6), 2499-2536.
  → 세금 고객군 기반 배당 이론. [Doc43 §3]

- Bhattacharya, S. (1979). *Imperfect Information, Dividend Policy, and "The Bird in the Hand" Fallacy*. Bell Journal of Economics, 10(1), 259-270.
  → 배당 신호 이론. [Doc43 §2]

- Black, F. (1976). *The Dividend Puzzle*. Journal of Portfolio Management, 2(2), 5-8.
  → 배당 퍼즐. "왜 기업은 배당을 하는가?" [Doc43 §3]

- Elton, E.J. & Gruber, M.J. (1970). *Marginal Stockholder Tax Rates and the Clientele Effect*. Review of Economics and Statistics, 52(1), 68-74.
  → 한계세율과 배당 고객효과의 실증. [Doc43 §3]

- Lintner, J. (1956). *Distribution of Incomes of Corporations among Dividends, Retained Earnings, and Taxes*. American Economic Review, 46(2), 97-113.
  → Lintner의 배당 평활화(smoothing) 모형 원전. [Doc43 §3]

- Miller, M.H. & Modigliani, F. (1961). *Dividend Policy, Growth, and the Valuation of Shares*. Journal of Business, 34(4), 411-433.
  → 배당 무관련성 원전. [Doc43 §3]

- Ross, S.A. (1977). *The Determination of Financial Structure: The Incentive-Signalling Approach*. Bell Journal of Economics, 8(1), 23-40.
  → 자본구조의 신호 이론. [Doc43 §2]

- Spence, M. (1973). *Job Market Signaling*. Quarterly Journal of Economics, 87(3), 355-374.
  → 신호이론 원전. 2001 노벨 경제학상. [Doc43 §2]

### 핵심 논문 — 한국 기업지배구조
- Claessens, S., Djankov, S. & Lang, L.H.P. (2000). *The Separation of Ownership and Control in East Asian Corporations*. Journal of Financial Economics, 58(1-2), 81-112.
  → 동아시아 기업의 소유-경영 분리 실증. [Doc43 §4]

- La Porta, R., Lopez-de-Silanes, F., Shleifer, A. & Vishny, R.W. (2000). *Agency Problems and Dividend Policies around the World*. Journal of Finance, 55(1), 1-33.
  → 투자자 보호와 배당정책의 국제비교. [Doc43 §4]

### 핵심 논문 — 회계 & 가치평가
- Edwards, E.O. & Bell, P.W. (1961). *The Theory and Measurement of Business Income*. University of California Press.
  → 잔여이익모형(RIM)의 이론적 기초. [Doc14 §2.8]

- Feltham, G.A. & Ohlson, J.A. (1995). *Valuation and Clean Surplus Accounting for Operating and Financial Activities*. Contemporary Accounting Research, 11(2), 689-731.
  → Feltham-Ohlson 모형. 영업/재무활동 분리 가치평가. [Doc14 §2.8]

- Gordon, M.J. (1962). *The Investment, Financing, and Valuation of the Corporation*. Irwin.
  → Gordon 성장 모형(GGM) 원전. [Doc14 §2]

- Grinold, R.C. (1989). *The Fundamental Law of Active Management*. Journal of Portfolio Management, 15(3), 30-37.
  → 능동적 운용의 기본법칙. IR = IC × √BR. [Doc14 §8, Doc31 §7]

- Ohlson, J.A. (1995). *Earnings, Book Values, and Dividends in Equity Valuation*. Contemporary Accounting Research, 11(2), 661-687.
  → Ohlson RIM(잔여이익모형). 회계 기반 가치평가. [Doc14 §2.8]

---

## IX. 채권 & 이자율 모형 (Fixed Income)

### 핵심 저서
- Fabozzi, F.J. (2007). *Fixed Income Analysis* (2nd Edition). Wiley.
  → 채권 분석의 표준 교과서. CFA 프로그램 추천 도서. [Doc44 §Refs]

- Tuckman, B. & Serrat, A. (2012). *Fixed Income Securities* (3rd Edition). Wiley.
  → 채권의 가격결정과 리스크 관리. 수익률곡선 모형 상세. [Doc44 §Refs]

### 핵심 논문
- Ang, A. & Piazzesi, M. (2003). *A No-Arbitrage Vector Autoregression of Term Structure Dynamics with Macroeconomic and Latent Variables*. Journal of Monetary Economics, 50(4), 745-787.
  → 거시변수와 기간구조의 무차익 VAR 모형. [Doc35 §16]

- Asness, C.S. (2003). *Fight the Fed Model: The Relationship Between Future Returns and Stock and Bond Market Yields*. Journal of Portfolio Management, 30(1), 11-24.
  → Fed 모형 비판. 주식-채권 수익률 관계. [Doc35 §9]

- Baele, L., Bekaert, G. & Inghelbrecht, K. (2010). *The Determinants of Stock and Bond Return Comovements*. Review of Financial Studies, 23(6), 2374-2428.
  → 주식-채권 수익률 동조/역행 결정요인. [Doc35 §12]

- Bekaert, G. & Engstrom, E. (2010). *Inflation and the Stock Market: Understanding the "Fed Model"*. Journal of Monetary Economics, 57(3), 278-294.
  → 인플레이션과 주식시장. Fed 모형의 이론적 기초. [Doc35 §10]

- Bekaert, G. & Hoerova, M. (2014). *The VIX, the Variance Premium and Stock Market Volatility*. Journal of Econometrics, 183(2), 181-192.
  → VIX와 분산프리미엄, 주식 변동성의 관계. [Doc34 §8]

- Campbell, J.Y. & Ammer, J. (1993). *What Moves the Stock and Bond Markets? A Variance Decomposition for Long-Term Asset Returns*. Journal of Finance, 48(1), 3-37.
  → 주식-채권 수익률의 분산 분해. [Doc35 §15]

- Culbertson, J.M. (1957). *The Term Structure of Interest Rates*. Quarterly Journal of Economics, 71(4), 485-517.
  → 시장분할이론(Market Segmentation). 이자율 기간구조. [Doc44 §Refs]

- Dechow, P.M., Sloan, R.G. & Soliman, M.T. (2004). *Implied Equity Duration: A New Measure of Equity Risk*. Review of Accounting Studies, 9(2-3), 197-228.
  → 주식의 내재 듀레이션. 금리 민감도의 주식 버전. [Doc35 §13]

- Diebold, F.X. & Li, C. (2006). *Forecasting the Term Structure of Government Bond Yields*. Journal of Econometrics, 130(2), 337-364.
  → 동적 Nelson-Siegel 모형. 수익률곡선 예측. [Doc35 §3]

- Estrella, A. & Mishkin, F.S. (1998). *Predicting U.S. Recessions: Financial Variables as Leading Indicators*. Review of Economics and Statistics, 80(1), 45-61.
  → 수익률곡선 역전의 경기침체 예측력. [Doc35 §6]

- Gilchrist, S. & Zakrajsek, E. (2012). *Credit Spreads and Business Cycle Fluctuations*. American Economic Review, 102(4), 1692-1720.
  → GZ 신용스프레드와 경기변동. 금융 상황 지표. [Doc35 §18, Doc47 §1.4]

- Harvey, C.R. (1988). *The Real Term Structure and Consumption Growth*. Journal of Financial Economics, 22(2), 305-333.
  → 실질 기간구조와 소비 성장의 관계. [Doc35 §4]

- Harvey, C.R. (1989). *Forecasts of Economic Growth from the Bond and Stock Markets*. Financial Analysts Journal, 45(5), 38-45.
  → 채권-주식 시장의 경제성장 예측력. [Doc35 §5]

- Ho, T.S.Y. (1992). *Key Rate Durations: Measures of Interest Rate Risks*. Journal of Fixed Income, 2(2), 29-44.
  → Key Rate Duration 원전. 비평행 이동 리스크 측정. [Doc44 §Refs]

- Ilmanen, A. (2003). *Stock-Bond Correlations*. Journal of Fixed Income, 13(2), 55-66.
  → 주식-채권 상관관계의 시변성. [Doc35 §11]

- Kim, D.H. & Wright, J.H. (2005). *An Arbitrage-Free Three-Factor Term Structure Model and the Recent Behavior of Long-Term Yields and Distant-Horizon Forward Rates*. Finance and Economics Discussion Series, 2005-33. Federal Reserve Board.
  → Fed 3요인 무차익 기간구조 모형. [Doc35 §17]

- Leibowitz, M.L. & Weinberger, A. (1982). *Contingent Immunization*. Financial Analysts Journal, 38(6), 17-31.
  → 조건부 면역전략. 적극적/소극적 채권운용의 결합. [Doc44 §Refs]

- Macaulay, F. (1938). *Some Theoretical Problems Suggested by the Movements of Interest Rates, Bond Yields, and Stock Prices in the United States since 1856*. NBER.
  → Macaulay 듀레이션 원전. [Doc44 §1]

- Modigliani, F. & Sutch, R. (1966). *Innovations in Interest Rate Policy*. American Economic Review, 56(1/2), 178-197.
  → 선호유동성이론(Preferred Habitat Theory). [Doc44 §Refs]

- Nelson, C.R. & Siegel, A.F. (1987). *Parsimonious Modeling of Yield Curves*. Journal of Business, 60(4), 473-489.
  → Nelson-Siegel 수익률곡선 모형 원전. [Doc35 §1, Doc44 §4]

- Redington, F.M. (1952). *Review of the Principles of Life-Office Valuations*. Journal of the Institute of Actuaries, 78(3), 286-340.
  → 면역(immunization) 이론 원전. ALM의 기초. [Doc44 §2]

- Svensson, L.E.O. (1994). *Estimating and Interpreting Forward Interest Rates: Sweden 1992-1994*. NBER Working Paper No. 4871.
  → Svensson 확장 모형(NSS). 수익률곡선의 추가 혹(hump). [Doc35 §2]

---

## X. 옵션 가격결정 (Options Pricing)

### 핵심 저서
- Copeland, T.E. & Antikarov, V. (2001). *Real Options: A Practitioner's Guide*. Texere Publishing.
  → 실물옵션의 실무 적용 가이드. [Doc45 §6]

- Gatheral, J. (2006). *The Volatility Surface: A Practitioner's Guide*. Wiley Finance.
  → 변동성 표면의 실무 가이드. 확률변동성, SVI 파라미터화. [Doc34 §16, Doc45 §Refs]

### 핵심 논문
- Bates, D.S. (1996). *Jumps and Stochastic Volatility: Exchange Rate Processes Implicit in Deutsche Mark Options*. Review of Financial Studies, 9(1), 69-107.
  → Bates 모형(Heston + 주가 점프). SVJ 모형. [Doc45 §5.6]

- Black, F. & Scholes, M. (1973). *The Pricing of Options and Corporate Liabilities*. Journal of Political Economy, 81(3), 637-654.
  → Black-Scholes 공식 원전. 1997 노벨 경제학상. [Doc45 §1, Doc47 §2]

- Breeden, D.T. & Litzenberger, R.H. (1978). *Prices of State-Contingent Claims Implicit in Option Prices*. Journal of Business, 51(4), 621-651.
  → 옵션 가격에서 상태가격밀도(SPD) 추출. [Doc45 §Refs]

- Cox, J.C., Ross, S.A. & Rubinstein, M. (1979). *Option Pricing: A Simplified Approach*. Journal of Financial Economics, 7(3), 229-263.
  → CRR 이항트리 모형 원전. BSM의 이산시간 근사. [Doc45 §1]

- Dupire, B. (1994). *Pricing with a Smile*. Risk, 7(1), 18-20.
  → Local Volatility 모형 원전. IV surface에서 로컬 변동성 추출. [Doc45 §7]

- Geske, R. (1979). *The Valuation of Compound Options*. Journal of Financial Economics, 7(1), 63-81.
  → 복합옵션(옵션 위의 옵션) 가격결정. [Doc45 §Refs]

- Goldman, M.B., Sosin, H.B. & Gatto, M.A. (1979). *Path Dependent Options: "Buy at the Low, Sell at the High"*. Journal of Finance, 34(5), 1111-1127.
  → 경로의존형 옵션(Lookback). [Doc45 §4]

- Heston, S.L. (1993). *A Closed-Form Solution for Options with Stochastic Volatility with Applications to Bond and Currency Options*. Review of Financial Studies, 6(2), 327-343.
  → Heston 확률변동성 모형 원전. 특성함수 기반 해석해. [Doc45 §5]

- Margrabe, W. (1978). *The Value of an Option to Exchange One Asset for Another*. Journal of Finance, 33(1), 177-186.
  → 교환옵션(Exchange Option). [Doc45 §Refs]

- McDonald, R. & Siegel, D. (1986). *The Value of Waiting to Invest*. Quarterly Journal of Economics, 101(4), 707-727.
  → 최적 투자 타이밍의 실물옵션 모형. [Doc45 §6]

- Merton, R.C. (1973). *Theory of Rational Option Pricing*. Bell Journal of Economics and Management Science, 4(1), 141-183.
  → BSM의 확장. 연속배당, 미국형 옵션 경계조건. [Doc45 §2]

- Merton, R.C. (1976). *Option Pricing When Underlying Stock Returns Are Discontinuous*. Journal of Financial Economics, 3(1-2), 125-144.
  → 점프확산(Jump-Diffusion) 옵션가격결정. [Doc34 §3, Doc45 §5.6]

---

## XI. 신용위험 모형 (Credit Risk)

### 핵심 논문 — 구조적 모형
- Bharath, S.T. & Shumway, T. (2008). *Forecasting Default with the Merton Distance to Default Model*. Review of Financial Studies, 21(3), 1339-1369.
  → 단순 Merton DD의 부도예측 성과 실증. [Doc35 §8, Doc47 §1.4]

- Black, F. & Cox, J.C. (1976). *Valuing Corporate Securities: Some Effects of Bond Indenture Provisions*. Journal of Finance, 31(2), 351-367.
  → 최초 통과 시간(First Passage Time) 모형. Merton 확장. [Doc47 §2.9]

- Crosbie, P. & Bohn, J. (2003). *Modeling Default Risk*. Moody's KMV Technical Report.
  → KMV 모형. Merton의 실무적 확장(EDF 매핑). [Doc47 §3]

- Leland, H. & Toft, K. (1996). *Optimal Capital Structure, Endogenous Bankruptcy, and the Term Structure of Credit Spreads*. Journal of Finance, 51(3), 987-1019.
  → 내생적 파산과 신용스프레드 기간구조. [Doc47 §2.9]

- Merton, R.C. (1974). *On the Pricing of Corporate Debt: The Risk Structure of Interest Rates*. Journal of Finance, 29(2), 449-470.
  → 구조적 신용위험 모형 원전. 자기자본 = 콜옵션. [Doc35 §7, Doc47 §2]

### 핵심 논문 — 축약형 모형
- Duffie, D. (1999). *Credit Swap Valuation*. Financial Analysts Journal, 55(1), 73-87.
  → CDS 가격결정의 이론적 기초. [Doc47 §5]

- Duffie, D. & Lando, D. (2001). *Term Structures of Credit Spreads with Incomplete Accounting Information*. Econometrica, 69(3), 633-664.
  → 불완전 회계정보 하의 구조적-축약형 혼합 모형. [Doc47 §2.9]

- Duffie, D. & Singleton, K. (1999). *Modeling Term Structures of Defaultable Bonds*. Review of Financial Studies, 12(4), 687-720.
  → 축약형 모형의 일반화. 부도 채권 할인구조. [Doc47 §4]

- Jarrow, R. & Turnbull, S. (1995). *Pricing Derivatives on Financial Securities Subject to Credit Risk*. Journal of Finance, 50(1), 53-85.
  → 축약형 신용위험 모형의 효시. [Doc47 §4]

### 핵심 논문 — 신용스프레드 & 실증
- Collin-Dufresne, P., Goldstein, R. & Martin, J. (2001). *The Determinants of Credit Spread Changes*. Journal of Finance, 56(6), 2177-2207.
  → 구조적 변수의 스프레드 설명력 ≈ 25%. 신용 퍼즐. [Doc47 §6]

- Elton, E.J., Gruber, M.J., Agrawal, D. & Mann, C. (2001). *Explaining the Rate Spread on Corporate Bonds*. Journal of Finance, 56(1), 247-277.
  → 회사채 스프레드의 분해: 부도위험 + 세금 + 리스크프리미엄. [Doc47 §4]

- Longstaff, F., Mithal, S. & Neis, E. (2005). *Corporate Yield Spreads: Default Risk or Liquidity? New Evidence from the Credit Default Swap Market*. Journal of Finance, 60(5), 2213-2253.
  → CDS를 이용한 부도위험 vs 유동성 분리. [Doc47 §1.4]

### 핵심 논문 — 포트폴리오 신용위험
- Li, D.X. (2000). *On Default Correlation: A Copula Function Approach*. Journal of Fixed Income, 9(4), 43-54.
  → Gaussian Copula를 이용한 부도 상관관계 모형. CDO 가격결정. [Doc47 §7]

- Vasicek, O. (1987/2002). *The Distribution of Loan Portfolio Value*. Risk, 15(12), 160-162.
  → Vasicek 단일팩터 신용 포트폴리오 모형. Basel IRB 공식의 기초. [Doc47 §7]

---

## XII. 선물 & 헤지 (Futures & Hedging)

### 핵심 논문
- Anderson, R.W. & Danthine, J.P. (1981). *Cross Hedging*. Journal of Political Economy, 89(6), 1182-1196.
  → 교차헤지 이론 정립. [Doc27 §10]

- Black, F. (1976). *The Pricing of Commodity Contracts*. Journal of Financial Economics, 3(1-2), 167-179.
  → Black 모형. 선물옵션 가격결정. [Doc27 §1]

- Brennan, M.J. & Schwartz, E.S. (1990). *Arbitrage in Stock Index Futures*. Journal of Business, 63(1), S7-S31.
  → 주가지수선물의 차익거래. [Doc27 §7]

- Ederington, L.H. (1979). *The Hedging Performance of the New Futures Markets*. Journal of Finance, 34(1), 157-170.
  → 선물 헤지 성과(효율성) 측정. OLS 헤지비율. [Doc27 §9]

- Figlewski, S. (1984). *Hedging Performance and Basis Risk in Stock Index Futures*. Journal of Finance, 39(3), 657-669.
  → 베이시스 리스크. 체계적/비체계적 위험 분해. [Doc27 §12]

- Johnson, L.L. (1960). *The Theory of Hedging and Speculation in Commodity Futures*. Review of Economic Studies, 27(3), 139-151.
  → 최적 헤지비율의 이론적 기원. 분산최소화 접근. [Doc27 §9]

- Stoll, H.R. & Whaley, R.E. (1987). *Program Trading and Individual Stock Returns: Ingredients of the Triple-Witching Brew*. Journal of Business, 60(1), 73-109.
  → 프로그램 매매와 만기일 효과. [Doc27 §2]

---

## XIII. 대학 강의 및 온라인 자료

### 무료 대학 강좌
- **MIT 18.S096**: Topics in Mathematics with Applications in Finance
  → MIT OpenCourseWare 무료 제공. 확률 과정, Black-Scholes 등.

- **Yale ECON 252**: Financial Markets (Robert Shiller)
  → Yale Open Courses / Coursera. 금융 시장의 심리학적 이해.

- **Stanford CS229**: Machine Learning (Andrew Ng)
  → 머신러닝 기초. 금융 적용의 선행 지식.

- **Columbia E4706**: Foundations of Financial Engineering
  → 금융공학의 수학적 기초.

### 오픈소스 프로젝트 및 라이브러리
- **TA-Lib** (C/Python): 200+ 기술적 지표 구현
  → https://ta-lib.org/

- **TradingView Lightweight Charts**: 본 프로젝트에서 사용
  → https://github.com/nickolay/lightweight-charts

- **Backtrader** (Python): 전략 백테스팅 프레임워크
  → https://www.backtrader.com/

- **Zipline** (Python): Quantopian의 오픈소스 백테스팅 엔진
  → https://github.com/quantopian/zipline

- **QuantLib** (C++/Python): 파생상품 가격 결정 라이브러리
  → https://www.quantlib.org/

---

## XIV. 한국어 자료

### 국내 저서
- 김민구 (2017). *파이썬 증권 데이터 분석*. 한빛미디어.
- 이현열 (2020). *퀀트 투자를 위한 킨디* (한국투자증권 API 활용).

### 한국 시장 데이터 소스
- **한국투자증권 OpenAPI**: 분봉/일봉, 실시간 체결가 (본 프로젝트 연동 대상)
  → https://apiportal.koreainvestment.com/

- **KRX 정보데이터시스템**: 공식 거래소 데이터
  → http://data.krx.co.kr/

- **공공데이터포털**: 금융위원회 API
  → https://www.data.go.kr/

- **FinanceDataReader** (Python): 한국 주식 데이터 라이브러리
  → https://github.com/financedata-org/FinanceDataReader
