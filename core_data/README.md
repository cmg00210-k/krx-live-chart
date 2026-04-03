# Core Data — 기술적 분석 학술 이론 체계

> 금융 차트의 기술적 분석을 학문적으로 뒷받침하는 수학, 통계학, 물리학,
> 심리학, 금융학의 핵심 이론과 공식, 논문 참조를 체계적으로 정리한 자료.

---

## 목차

| # | 파일 | 영역 | 핵심 주제 |
|---|------|------|-----------|
| 1 | [01_mathematics.md](01_mathematics.md) | 수학 | 확률론, 확률과정, 프랙탈 기하, 푸리에/웨이블릿 분석, 카오스 이론 |
| 2 | [02_statistics.md](02_statistics.md) | 통계학 | 시계열 분석, 회귀분석, 베이지안 추론, 몬테카를로 시뮬레이션 |
| 3 | [03_physics.md](03_physics.md) | 물리학 | 경제물리학, 통계역학, 멱법칙, 엔트로피, 임계현상 |
| 4 | [04_psychology.md](04_psychology.md) | 심리학 | 행동경제학, 전망이론, 군중심리, 인지편향, 시장 심리 사이클 |
| 5 | [05_finance_theory.md](05_finance_theory.md) | 금융학 | EMH, MPT, CAPM, Black-Scholes, 위험-수익 모형 |
| 6 | [06_technical_analysis.md](06_technical_analysis.md) | 기술적 분석 | 다우이론, 엘리엇 파동, 캔들스틱 이론, 지지/저항, 추세 이론 |
| 7 | [07_pattern_algorithms.md](07_pattern_algorithms.md) | 패턴 탐지 알고리즘 (통합본) | 스윙포인트, 추세선 피팅, 캔들스틱/차트 패턴 수학, 품질 점수, 하모닉, 패턴 조합 |
| 8 | [08_references.md](08_references.md) | 참고문헌 | 논문, 저서, 대학 강의, 오픈소스 프로젝트 종합 목록 |
| 9 | [09_game_theory.md](09_game_theory.md) | 게임 이론 | 내쉬 균형, 죄수의 딜레마, 경매 이론, 진화 게임, 시그널링 |
| 10 | [10_optimal_control.md](10_optimal_control.md) | 최적 제어 | HJB 방정식, 머튼 포트폴리오, 최적 실행, 칼만 필터, 폰트랴긴 원리 |
| 11 | [11_reinforcement_learning.md](11_reinforcement_learning.md) | 강화학습 기초 | MDP, Q-learning, DQN, 정책 경사, A2C/A3C, PPO, 보상 설계 |
| 11B | [11B_rl_advanced.md](11B_rl_advanced.md) | 강화학습 고급 | 다중 에이전트 RL, 역강화학습, 메타 학습(MAML), 모델 기반 RL, 안전 RL |
| 12 | [12_extreme_value_theory.md](12_extreme_value_theory.md) | 극단값 이론 | GEV 분포, POT/GPD, 블랙 스완, 꼬리 위험, 다변량 극단값 |
| 13 | [13_information_geometry.md](13_information_geometry.md) | 정보기하학 | 피셔 정보, 자연 경사법, KL 발산, 시장 상태 추적, 통계 다양체, 전이 엔트로피 |
| 14 | [14_finance_management.md](14_finance_management.md) | 재무관리 | 기업가치평가, DCF, 자본구조, 에르고딕 경제학, 켈리 기준, 위험관리, 성과측정 |
| 15 | [15_advanced_patterns.md](15_advanced_patterns.md) | ML 기반 패턴 인식 및 백테스팅 | CNN/LSTM/Attention 패턴 인식, 전이학습, SHAP 해석, 백테스팅 수학 |
| 16 | [16_pattern_reference.md](16_pattern_reference.md) | 패턴 레퍼런스 가이드 | 42종 패턴 목록, 구현 상태, 색상 체계, 마커 규칙 |
| 17 | [17_regression_backtesting.md](17_regression_backtesting.md) | 회귀 백테스팅 | WLS 회귀, HC3 견고 SE, 다중가설 검정, Walk-Forward |
| 18 | [18_behavioral_market_microstructure.md](18_behavioral_market_microstructure.md) | 행동 미시구조 | Kyle 모형+행동 에이전트, VPIN, 노이즈 필터링, 유동성 비대칭, 스프레드 |
| 19 | [19_social_network_effects.md](19_social_network_effects.md) | 소셜 네트워크 | 정보 폭포, 한국어 감성분석(KR-FinBERT), 네트워크 토폴로지, 군집행동 측정 |
| 20 | [20_krx_structural_anomalies.md](20_krx_structural_anomalies.md) | KRX 구조적 이상 | ±30% 가격제한, T+2 결제, 외국인 흐름, KOSDAQ 개인, 서킷브레이커, 달력효과 |
| 21 | [21_adaptive_pattern_modeling.md](21_adaptive_pattern_modeling.md) | 적응형 패턴 | AMH, HMM 레짐 전환, 전략 반감기, CUSUM/Bai-Perron, 온라인 학습, BMA |
| 22 | [22_learnable_constants_guide.md](22_learnable_constants_guide.md) | 학습 상수 가이드 | 5-Tier 상수 분류 (A=학술고정~E=폐기), 교정 기준 |
| 23 | [23_apt_factor_model.md](23_apt_factor_model.md) | APT 팩터 모델 | Ross (1976) APT, Fama-French, CZW MRA 연결 |
| 24 | [24_behavioral_quantification.md](24_behavioral_quantification.md) | 행동재무학 계량화 | 공포-탐욕 지수, 처분효과, 군집행동 KRX 버전 |
| 25 | [25_capm_delta_covariance.md](25_capm_delta_covariance.md) | CAPM·Delta·공분산 | CAPM 통합, 팩터 Delta 학습, 대규모 공분산 추정, 잔차 축소 |
| 26 | [26_options_volatility_signals.md](26_options_volatility_signals.md) | 옵션 변동성·파생 신호 | BSM Greeks 심층, VKOSPI 레짐, IV/HV, PCR 역발상, GEX 감마 노출, FG v2 |
| 27 | [27_futures_basis_program_trading.md](27_futures_basis_program_trading.md) | 선물 베이시스·프로그램 매매 | 보유비용 모형, 베이시스 해석, OI 분석, 차익/비차익 프로그램 매매, 만기일 효과, 패턴 신뢰도 연동 |
| 28 | [28_cross_market_correlation.md](28_cross_market_correlation.md) | 글로벌 교차시장 상관 | DCC-GARCH, VIX→VKOSPI 전달, USD/KRW 채널, MSCI 리밸런싱, 야간 갭 예측, 위기 전파 |
| 29 | [29_macro_sector_rotation.md](29_macro_sector_rotation.md) | 거시경제·섹터 회전 | 경기순환 4국면, PMI/CSI/수출, 금리·수익률곡선, 인구구조, EPU, MCS 복합점수, 이벤트 캘린더 |
| 30 | [30_macroeconomics_islm_adas.md](30_macroeconomics_islm_adas.md) | 거시경제학 IS-LM·AD-AS | IS-LM 균형, 먼델-플레밍, AD-AS 충격분석, 케인즈-고전학파 종합, 테일러 준칙, 재정승수, 정책전달 |
| 31 | [31_microeconomics_market_signals.md](31_microeconomics_market_signals.md) | 미시경제학·시장균형 | 수요-공급(호가창), 왈라스 경매, 탄력성(VPE/교차/소득), 시장구조(과점/재벌), 정보비대칭, 한계분석, 외부성 |
| 32 | [32_search_attention_pricing.md](32_search_attention_pricing.md) | 탐색이론·주의 기반 가격결정 | Stigler 탐색비용, Peng-Xiong 주의예산, Barber-Odean 주의점프, Katz-Shapiro 네트워크외부성, Rothschild-Stiglitz 스크리닝, Grossman-Miller 블록마찰 |
| 33 | [33_agency_costs_industry_concentration.md](33_agency_costs_industry_concentration.md) | 대리인 비용·산업 집중도 | Jensen-Meckling 대리인 비용, Holmstrom 최적계약, 재벌 터널링, ARI 지수, HHI-패턴신뢰도, 코즈 거래비용, 규제 포획 |
| 34 | [34_volatility_risk_premium_harv.md](34_volatility_risk_premium_harv.md) | VRP·HAR-RV·점프확산 | Bollerslev VRP, Corsi HAR-RV(일/주/월 RV 분해), Merton 점프-확산, 변동성 기간구조, 분산 트레이딩, GEX 심화, Student-t CI |
| 35 | [35_bond_signals_yield_curve.md](35_bond_signals_yield_curve.md) | 채권시장 신호·수익률 곡선 | NSS 수익률 곡선, 10Y-3Y 기울기 선행성, Fed/BOK Yield Gap, AA-/BBB- 크레딧 스프레드 4체제, Merton DD, Rate Beta, 채권-주식 상관관계 레짐 |
| 36 | [36_futures_microstructure_oi.md](36_futures_microstructure_oi.md) | 선물 미시구조·OI 분석 | OI-Price 4사분면, Bessembinder-Seguin 변동성, 베이시스 미시구조, Hasbrouck 가격발견, 만기일 효과(Stoll-Whaley), 프로그램매매, 사이드카 |
| 37 | [37_options_iv_surface_skew.md](37_options_iv_surface_skew.md) | 옵션 IV 곡면·스큐 분석 | SVI 파라미터화(Gatheral), 무차익 조건, 25δ RR/BF 신호, SKEW 지수, GEX 심화(딜러 핀닝·MM 의무), 옵션 흐름(UOA·블록거래), 스큐 기간구조, 심리 극단치 종합 |
| 38 | [38_etf_ecosystem_fund_flow.md](38_etf_ecosystem_fund_flow.md) | ETF 생태계·자금흐름 분석 | Creation/Redemption 차익, 레버리지/인버스 센티먼트, ETF 자금흐름, ETF-기초자산 피드백 루프, 괴리율 신호, ETF 보유 비중별 패턴 신뢰도, 체계적 위험 |
| 39 | [39_investor_flow_information.md](39_investor_flow_information.md) | 투자자 수급·정보 비대칭 | Grossman-Stiglitz 역설, Kyle 3유형, 외국인 흐름(Kang-Stulz), LSV 군집, 개미 역발상, 복합 수급 신호, 수급-가격 괴리 |
| 40 | [40_short_selling_securities_lending.md](40_short_selling_securities_lending.md) | 공매도·대차거래 분석 | Miller 고평가, Diamond-Verrecchia, SIR/DTC, 숏스퀴즈 탐지(Lamont-Thaler), 대차수수료(D'Avolio), 비선형성, 제도적 이벤트 |
| 41 | [41_bond_equity_relative_value.md](41_bond_equity_relative_value.md) | 채권-주식 상대가치·위험선호 전환 | Fed Model/ERP z-score, RORO 레짐(inflation beta), 듀레이션·볼록성, 크레딧 사이클 4국면(EBP), BOK 이벤트 스터디, 크로스에셋 복합 신호, CRAI |
| 42 | [42_advanced_asset_pricing.md](42_advanced_asset_pricing.md) | 자산가격결정 심화 이론 | Sharpe 단일지수, Zero-Beta CAPM(Black 1972), ICAPM(Merton 1973), CCAPM(Breeden 1979), APT 정식 도출(Ross 1976), FF 5-Factor 심화, 모형 간 계보, SDF 통합 |
| 43 | [43_corporate_finance_advanced.md](43_corporate_finance_advanced.md) | 기업재무론 심화 | Miller(1977) 개인세 모형, Jensen-Meckling 대리인비용 자본구조, Ross/Bhattacharya 시그널링, MM 배당무관련, 고급 자본예산(PI/MIRR/EAA/실물옵션), 배당정책 심화 |
| 44 | [44_bond_pricing_duration.md](44_bond_pricing_duration.md) | 채권 가격결정·듀레이션 이론 | 쿠폰채 가격결정, YTM(Newton-Raphson), Macaulay/Modified Duration, DV01, 볼록성(Convexity), Key Rate Duration, 면역전략, 기간구조 이론, 유효듀레이션, KRX KTB 적용 |
| 45 | [45_options_pricing_advanced.md](45_options_pricing_advanced.md) | 옵션 가격결정 심화 | CRR 이항트리, 미국형 옵션(조기행사), 풋-콜 패리티, 이색옵션(Barrier/Asian/Lookback/Digital/ELS), Heston 확률변동성, Dupire Local Vol, 실물옵션(McDonald-Siegel), KRX 적용 |
| 46 | [46_options_strategies.md](46_options_strategies.md) | 옵션전략 종합 & 실전 | 바닐라 전략 페이오프(8종), Greeks 동역학(4×8 매트릭스), BEP/P/L 곡면, Gamma Scalping, 분산스왑, VKOSPI 전략선택, PCR/GEX 연동, Straddle Implied Move |
| 47 | [47_credit_risk_models.md](47_credit_risk_models.md) | 신용위험 모형 체계 | Merton(1974) 구조적 모형, KMV 확장(EDF), Jarrow-Turnbull/Duffie-Singleton 축약형, 신용스프레드 분해, CDS-Bond Basis, Vasicek/Basel IRB/Gaussian Copula, KRX DD 적용 |

---

## 이 자료의 목적

1. **기술적 분석의 학문적 정당성 확보** — 단순 경험칙이 아닌 수학적·통계적 근거
2. **알고리즘 구현의 이론적 기반** — indicators.js, patterns.js, signalEngine.js의 각 지표·패턴이 어떤 이론에서 도출되었는지
3. **고도화 방향 설계** — 미구현 기능(하모닉 패턴, 엘리엇 파동 등)의 학문적 근거
4. **학습 경로 제시** — 10단계 체계로 수학 기초부터 RL 고급까지의 선행 지식 로드맵
5. **중복 없는 참조 구조** — 동일 내용의 중복 기술을 제거하고, 상호 참조(cross-reference)로 연결
6. **통합과 분리의 원칙** — 패턴 알고리즘(07 통합본), ML/백테스팅(15 개편본), RL 기초/고급(11+11B) 분리

---

## 학습 경로 (10단계 체계)

```
[Stage 1] 수학적 기초                          → 01, 02 일부
  └── 확률론 → 확률과정 → 선형대수 기초
  └── 이동평균·지수평활의 수학적 원리

[Stage 2] 시계열 분석과 변동성                  → 02 일부, 01 일부
  └── 시계열 모형(AR, MA, ARIMA) → 변동성 모형(GARCH)
  └── 회귀분석 → 베이지안 추론 → 몬테카를로

[Stage 3] 금융 이론 프레임워크                  → 05, 04, 25, 26 일부, 42
  └── EMH → 적응적 시장 가설 → MPT → CAPM(CML/SML) → APT
  └── 단일지수 모형 → Zero-Beta CAPM → ICAPM → CCAPM (42번)
  └── Black-Scholes → Greeks → 내재변동성(VKOSPI) → 행동금융학

[Stage 4] 패턴 이론 (정성적)                    → 06, 04 일부
  └── 다우이론 → 엘리엇 파동 → 캔들스틱 이론
  └── 지지/저항 → 추세 이론 → 시장 심리 사이클

[Stage 5] 패턴 탐지 알고리즘 (정량적)           → 07 (통합본)
  └── 스윙포인트 탐지 → 추세선 회귀 피팅 → 캔들스틱 수학
  └── 고급 캔들스틱/차트 패턴 → 하모닉 패턴 → 품질 점수
  └── 패턴 조합 확률(마르코프 체인, 정보 이론)

[Stage 6] 위험 관리와 성과 측정                 → 14, 12, 25, 28 일부, 43, 44, 47
  └── 에르고딕 경제학 → 켈리 기준 → VaR/CVaR → 스트레스 테스트
  └── 샤프/소르티노/칼마 비율 → 공분산·상관 → 성과 귀인
  └── 기업재무론 심화(DDM/RIM/EVA, 자본구조, 시그널링) → 43번
  └── 채권 가격결정(Duration, DV01, Convexity, 면역전략) → 44번
  └── 신용위험 모형(Merton DD, KMV, 축약형, 포트폴리오) → 47번

[Stage 7] ML 기반 패턴 인식 및 백테스팅         → 15 (개편본)
  └── CNN/LSTM/Attention 패턴 인식 → 전이학습 → SHAP 해석
  └── 워크포워드 검증 → 다중 가설 검정 → 부트스트랩

[Stage 8] 고급 이론                             → 03, 13, 09, 12, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 37, 38, 41, 45, 46, 47
  └── 경제물리학(멱법칙, 임계현상) → 정보기하학(KL 발산, 전이 엔트로피)
  └── 게임 이론(내쉬 균형) → 극단값 이론(GEV, GPD)
  └── 파생상품(옵션가격결정 45번, 옵션전략 46번, 선물헤지 27번 §9-13) → 교차시장 상관
  └── IV 곡면(SVI, 스큐, GEX 심화) → 옵션 흐름(UOA, 스마트 머니)
  └── 거시경제학(IS-LM, AD-AS, 테일러 준칙) → 미시경제학(탄력성, 시장구조, 한계분석)
  └── 탐색이론(Stigler, 주의 제한) → 대리인 비용(Jensen-Meckling, HHI)
  └── 채권시장 신호(NSS 수익률 곡선, 크레딧 스프레드, Merton DD)
  └── 채권-주식 상대가치(ERP, RORO 레짐, 크레딧 사이클, BOK 이벤트)
  └── ETF 생태계(레버리지 센티먼트, 자금흐름, 괴리율, 보유 비중 패턴 보정)
  └── 신용위험 모형(Merton DD, KMV, Jarrow-Turnbull, 포트폴리오 신용) → 47번

[Stage 9] 최적 제어와 RL 기초                   → 10, 11
  └── HJB 방정식 → 머튼 포트폴리오 → 최적 실행
  └── MDP → Q-learning → DQN → PPO → 보상 설계

[Stage 10] RL 고급 기법                         → 11B
  └── 다중 에이전트 RL → 역강화학습 → 메타 학습(MAML)
  └── 모델 기반 RL(World Models) → 안전 강화학습(CPO)
```

---

## 현재 시스템과의 매핑

### 구현 완료 (Phase 1-9)

| 시스템 구현 (js/) | 이론적 기반 (core_data/) |
|-------------------|-------------------------|
| indicators.js: calcMA(), calcEMA(), calcBB(), calcRSI(), calcMACD(), calcATR(), calcIchimoku(), calcKalman(), calcHurst() | 01_mathematics, 02_statistics, 03_physics, 05_finance_theory |
| indicators.js: IndicatorCache (Lazy Evaluation) | 07_pattern_algorithms §7 (효율적 지표 관리) |
| patterns.js: PatternEngine (26종 패턴, ATR 정규화, 품질 점수) | 06_technical_analysis, 07_pattern_algorithms |
| signalEngine.js: SignalEngine (16종 지표 시그널 + 6종 복합 시그널) | 06 §2-5, 04_psychology (시장 심리) |
| backtester.js: PatternBacktester (N일 수익률 통계) | 15_advanced_patterns §6 (백테스팅 프레임워크) |
| patterns.js: 지지/저항선 + 컨플루언스 | 07_pattern_algorithms §1.3, §10.4 |
| patterns.js: _stopLoss(), _target() (리스크 관리) | 14_finance_management §켈리, VaR |

### 향후 구현 예정

| 예정 기능 | 이론적 기반 (core_data/) |
|-----------|-------------------------|
| 하모닉 패턴 탐지 | 07_pattern_algorithms.md §9.3 피보나치 비율 검증 |
| 엘리엇 파동 카운팅 | 07_pattern_algorithms.md §9.3 5점 조합 |
| 베이지안 패턴 품질 | 07_pattern_algorithms.md §7.2 사전/사후 확률 |
| ML 기반 패턴 인식 | 15_advanced_patterns.md §5 CNN/LSTM/Attention |
| 최적 매매 타이밍 | 10_optimal_control.md § HJB 방정식, 최적 정지 |
| 자동화 전략 학습 | 11_reinforcement_learning.md § DQN, PPO |
| 극단 하락/급등 대응 | 12_extreme_value_theory.md § 꼬리 위험 측정 |
| 시장 국면 전환 탐지 | 13_information_geometry.md § KL 발산, 측지선 거리, §8 전이 엔트로피 |
| 포지션 사이징 | 14_finance_management.md § 에르고딕 경제학(§4), 켈리 기준(§5) |
| VKOSPI/PCR 기반 신뢰도 조정 | 26_options_volatility_signals.md § VKOSPI 레짐, FG v2, GEX |
| 선물 베이시스 심리 지표 | 27_futures_basis_program_trading.md § 만기일 효과, OI 분석 |
| 글로벌 교차시장 위험 전파 | 28_cross_market_correlation.md § VIX→VKOSPI, 야간 갭 예측 |
| 거시경제 섹터 회전 | 29_macro_sector_rotation.md § MCS 복합점수, 이벤트 캘린더 |
| CAPM 베타 + 공분산 행렬 | 25_capm_delta_covariance.md § Delta 학습, Ledoit-Wolf |
| IS-LM 기반 정책 전달 모형 | 30_macroeconomics_islm_adas.md § 비교정학, 먼델-플레밍, 테일러 준칙 |
| AD-AS 레짐별 패턴 신뢰도 조정 | 30_macroeconomics_islm_adas.md § AD-AS 4충격, 스태그플레이션 감쇠 |
| MCS v2 (테일러 갭 반영) | 30_macroeconomics_islm_adas.md §4.3, Doc 29 §6.2 확장 |
| 거래량-가격 탄력성(VPE) 시그널 정규화 | 31_microeconomics_market_signals.md §2.1 VPE 임계 보정 |
| 재벌 클러스터 전이 효과 | 31_microeconomics_market_signals.md §3.3 재벌 contagion |
| MC=MB 최적 시그널 선택 | 31_microeconomics_market_signals.md §4.3 Ridge 경제학적 해석 |
| VRP-HAR-점프 복합 신뢰도 조정 | 34_volatility_risk_premium_harv.md §8 VRP×HAR×Jump 복합 체계 |
| 변동성 기간구조 레짐 신호 | 34_volatility_risk_premium_harv.md §5 cv_ratio backwardation 감지 |
| 주의 사이클 기반 신뢰도 보정 (calcAttentionState) | 32_search_attention_pricing.md §4 주의점프지표, Barber-Odean 비대칭 |
| ADV 레벨 유동성 보정 (calcADVLevel) | 32_search_attention_pricing.md §5 네트워크 외부성, Amihud ILLIQ |
| 밸류에이션 S/R 감지 (detectValuationSR) | 32_search_attention_pricing.md §6 Rothschild-Stiglitz 스크리닝 균형 |
| 수익률 곡선 레짐 (yieldCurveRegime) | 35_bond_signals_yield_curve.md §3 NSS 기울기 분해, bull/bear steepening |
| Fed/BOK Yield Gap 밸류에이션 | 35_bond_signals_yield_curve.md §4 1/PER - KTB10Y 상대 밸류에이션 |
| 크레딧 스프레드 체제 (creditRegime) | 35_bond_signals_yield_curve.md §5 AA- 4체제 분류, 패턴 신뢰도 조정 |
| Merton DD 부도 위험 경고 | 35_bond_signals_yield_curve.md §6 Distance-to-Default, DART 부채 활용 |
| 섹터별 금리 베타 (rateBetaAdj) | 35_bond_signals_yield_curve.md §7 금리 변화 × 섹터 민감도 |
| IV 곡면 SVI 파라미터화 (ivSurface) | 37_options_iv_surface_skew.md §2 Gatheral SVI, 무차익 조건, KOSPI200 곡면 특성 |
| 스큐 신호 (ivSkewLevel, skewMomentum) | 37_options_iv_surface_skew.md §4 25δ RR/BF, SKEW 지수, 스큐 변화율 |
| GEX 심화 (gexLevel, gexFlipDistance) | 37_options_iv_surface_skew.md §5 딜러 포지셔닝, 핀닝, GEX-VRP 교차 |
| 옵션 흐름 분석 (uoaAlert, pcrAdvanced) | 37_options_iv_surface_skew.md §6 UOA 탐지, 스마트 머니, PCR 고급 분해 |
| 변동성 기간구조 곡면 (volTermRegime) | 37_options_iv_surface_skew.md §7 스큐 기간구조, 복합 레짐 4분류 |
| ETF 센티먼트 레짐 (etfSentiment) | 38_etf_ecosystem_fund_flow.md §3 레버리지 비율, §8 복합 센티먼트 4레짐 |
| ETF 자금흐름 섹터 회전 (etfFlow) | 38_etf_ecosystem_fund_flow.md §4 순설정 흐름, 섹터별 FlowMomentum |
| ETF 괴리율 신호 (etfPremium) | 38_etf_ecosystem_fund_flow.md §6 프리미엄/디스카운트, 국제 ETF FX 프록시 |
| ETF 보유 비중 패턴 보정 (etfOwnership) | 38_etf_ecosystem_fund_flow.md §9 Grade A-D, reliabilityMult |
| ERP z-score 상대가치 (erpSignal) | 41_bond_equity_relative_value.md §2 Fed Model, ERP 정규화, 504일 롤링 |
| 위험선호 레짐 (riskAppetiteRegime) | 41_bond_equity_relative_value.md §3 RORO, inflation beta, CRAI 복합지수 |
| 크레딧 사이클 국면 (creditCyclePhase) | 41_bond_equity_relative_value.md §5 EBP 근사, 7-state 국면 판정 |
| BOK 이벤트 감쇠 (bokEventDamping) | 41_bond_equity_relative_value.md §6 서프라이즈, 반응 비대칭성 |
| 채권-주식 복합 신호 (bondEquitySignal) | 41_bond_equity_relative_value.md §7 ERP+크레딧+RORO 가중 복합, 위기 오버라이드 |
