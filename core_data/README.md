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
| 7 | [07_pattern_algorithms.md](07_pattern_algorithms.md) | 패턴 인식 알고리즘 | 수학적 패턴 탐지, 트렌드라인 피팅, 신호 처리 기반 분석 |
| 8 | [08_references.md](08_references.md) | 참고문헌 | 논문, 저서, 대학 강의, 오픈소스 프로젝트 종합 목록 |
| 9 | [09_game_theory.md](09_game_theory.md) | 게임 이론 | 내쉬 균형, 죄수의 딜레마, 경매 이론, 진화 게임, 시그널링 |
| 10 | [10_optimal_control.md](10_optimal_control.md) | 최적 제어 | HJB 방정식, 머튼 포트폴리오, 최적 실행, 칼만 필터, 폰트랴긴 원리 |
| 11 | [11_reinforcement_learning.md](11_reinforcement_learning.md) | 강화학습 | MDP, Q-learning, DQN, 정책 경사, PPO, 보상 설계, 다중 에이전트 |
| 12 | [12_extreme_value_theory.md](12_extreme_value_theory.md) | 극단값 이론 | GEV 분포, POT/GPD, 블랙 스완, 꼬리 위험, 다변량 극단값 |
| 13 | [13_information_geometry.md](13_information_geometry.md) | 정보기하학 | 피셔 정보, 자연 경사법, KL 발산, 시장 상태 추적, 통계 다양체 |
| 14 | [14_finance_management.md](14_finance_management.md) | 재무관리 | 기업가치평가, DCF, 자본구조, 켈리 기준, 위험관리, 성과측정 |
| 15 | [15_advanced_patterns.md](15_advanced_patterns.md) | 고급 패턴 분석 | 수학적 패턴 정의, 품질 점수, 하모닉 패턴, ML 기반, 백테스팅 |

---

## 이 자료의 목적

1. **기술적 분석의 학문적 정당성 확보** — 단순 경험칙이 아닌 수학적·통계적 근거
2. **알고리즘 구현의 이론적 기반** — patterns.js, chart.js의 각 지표·패턴이 어떤 이론에서 도출되었는지
3. **고도화 방향 설계** — 향후 추가할 분석 기법의 학문적 근거 제시
4. **학습 경로 제시** — 기술적 분석을 깊이 이해하기 위해 필요한 선행 지식 로드맵
5. **재무관리 통합** — 포지션 사이징, 위험관리, 성과측정의 이론적 프레임워크
6. **고급 패턴 분석 기반** — ML/DL 기반 패턴 인식과 백테스팅 수학의 학술적 근거

---

## 학습 경로 (추천 순서)

```
[1단계] 수학 기초
  └── 확률론 → 확률과정 → 시계열 분석

[2단계] 통계적 방법론
  └── 회귀분석 → 베이지안 추론 → 몬테카를로

[3단계] 금융 이론
  └── EMH → MPT → CAPM → 옵션 가격 결정

[4단계] 기술적 분석 이론
  └── 다우이론 → 엘리엇 파동 → 캔들스틱 → 차트 패턴

[5단계] 고급 분석
  └── 프랙탈 시장 가설 → 경제물리학 → 행동금융학
  └── 웨이블릿 분석 → 머신러닝 기반 패턴 인식

[6단계] 전략적 상호작용과 최적화
  └── 게임 이론 → 최적 제어 → 강화학습

[7단계] 위험과 극단 사건
  └── 극단값 이론 → 블랙 스완 모델링 → 꼬리 위험 관리

[8단계] 고급 수학적 프레임워크
  └── 정보기하학 → 통계 다양체 → 시장 상태 추적

[9단계] 재무관리와 실전 통합
  └── 기업가치평가 → 포지션 사이징(켈리) → 위험관리 → 성과측정

[10단계] 고급 패턴 분석 고도화
  └── 수학적 패턴 정의 → 하모닉 패턴 → ML 기반 인식 → 백테스팅
```

---

## 현재 시스템과의 매핑

| 시스템 구현 (js/) | 이론적 기반 (core_data/) |
|-------------------|-------------------------|
| calcMA(), calcEMA() | 01_mathematics.md § 이동평균 이론 |
| calcRSI() | 02_statistics.md § 모멘텀 통계 |
| calcMACD() | 01_mathematics.md § 지수평활법 |
| calcBB() | 02_statistics.md § 정규분포와 표준편차 |
| PatternEngine.detectThreeWhiteSoldiers() | 06_technical_analysis.md § 캔들스틱 이론 |
| PatternEngine.detectAscendingTriangle() | 07_pattern_algorithms.md § 스윙포인트 탐지 |
| PatternEngine.detectRisingWedge() | 07_pattern_algorithms.md § 추세선 회귀 피팅 |
| 지지/저항선 분석 | 09_game_theory.md § 내쉬 균형 = 가격 균형점 |
| 최적 매매 타이밍 | 10_optimal_control.md § HJB 방정식, 최적 정지 |
| 자동화 전략 학습 | 11_reinforcement_learning.md § DQN, PPO |
| 극단 하락/급등 대응 | 12_extreme_value_theory.md § 꼬리 위험 측정 |
| 시장 국면 전환 탐지 | 13_information_geometry.md § KL 발산, 측지선 거리 |
| 포지션 사이징/손절 | 14_finance_management.md § 켈리 기준, 위험관리 |
| 패턴 품질 점수 | 15_advanced_patterns.md § 베이지안 품질 추정 |
