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
| 13 | [13_information_geometry.md](13_information_geometry.md) | 정보기하학 | 피셔 정보, 자연 경사법, KL 발산, 시장 상태 추적, 통계 다양체 |
| 14 | [14_finance_management.md](14_finance_management.md) | 재무관리 | 기업가치평가, DCF, 자본구조, 켈리 기준, 위험관리, 성과측정 |
| 15 | [15_advanced_patterns.md](15_advanced_patterns.md) | ML 기반 패턴 인식 및 백테스팅 | CNN/LSTM/Attention 패턴 인식, 전이학습, SHAP 해석, 백테스팅 수학 |
| 16 | [16_pattern_reference.md](16_pattern_reference.md) | 패턴 레퍼런스 가이드 | 42종 패턴 목록, 구현 상태, 색상 체계, 마커 규칙 |
| 17 | [17_regression_backtesting.md](17_regression_backtesting.md) | 회귀 백테스팅 | WLS 회귀, HC3 견고 SE, 다중가설 검정, Walk-Forward |
| 18 | [18_behavioral_market_microstructure.md](18_behavioral_market_microstructure.md) | 행동 미시구조 | Kyle 모형+행동 에이전트, VPIN, 노이즈 필터링, 유동성 비대칭, 스프레드 |
| 19 | [19_social_network_effects.md](19_social_network_effects.md) | 소셜 네트워크 | 정보 폭포, 한국어 감성분석(KR-FinBERT), 네트워크 토폴로지, 군집행동 측정 |
| 20 | [20_krx_structural_anomalies.md](20_krx_structural_anomalies.md) | KRX 구조적 이상 | ±30% 가격제한, T+2 결제, 외국인 흐름, KOSDAQ 개인, 서킷브레이커, 달력효과 |
| 21 | [21_adaptive_pattern_modeling.md](21_adaptive_pattern_modeling.md) | 적응형 패턴 | AMH, HMM 레짐 전환, 전략 반감기, CUSUM/Bai-Perron, 온라인 학습, BMA |

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

[Stage 3] 금융 이론 프레임워크                  → 05, 04 일부
  └── EMH → 적응적 시장 가설 → MPT → CAPM
  └── Black-Scholes, 내재변동성 → 행동금융학(전망이론, 인지편향)

[Stage 4] 패턴 이론 (정성적)                    → 06, 04 일부
  └── 다우이론 → 엘리엇 파동 → 캔들스틱 이론
  └── 지지/저항 → 추세 이론 → 시장 심리 사이클

[Stage 5] 패턴 탐지 알고리즘 (정량적)           → 07 (통합본)
  └── 스윙포인트 탐지 → 추세선 회귀 피팅 → 캔들스틱 수학
  └── 고급 캔들스틱/차트 패턴 → 하모닉 패턴 → 품질 점수
  └── 패턴 조합 확률(마르코프 체인, 정보 이론)

[Stage 6] 위험 관리와 성과 측정                 → 14, 12 일부
  └── 포지션 사이징(켈리 기준) → VaR/CVaR → 스트레스 테스트
  └── 샤프/소르티노/칼마 비율 → 최대 낙폭 → 성과 귀인

[Stage 7] ML 기반 패턴 인식 및 백테스팅         → 15 (개편본)
  └── CNN/LSTM/Attention 패턴 인식 → 전이학습 → SHAP 해석
  └── 워크포워드 검증 → 다중 가설 검정 → 부트스트랩

[Stage 8] 고급 이론                             → 03, 13, 09, 12 일부
  └── 경제물리학(멱법칙, 임계현상) → 정보기하학(KL 발산, 측지선)
  └── 게임 이론(내쉬 균형, 진화 게임) → 극단값 이론(GEV, GPD)

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
| 시장 국면 전환 탐지 | 13_information_geometry.md § KL 발산, 측지선 거리 |
| 포지션 사이징 | 14_finance_management.md § 켈리 기준 |
