// ══════════════════════════════════════════════════════
//  기술적 패턴 인식 엔진 v2.0
// ══════════════════════════════════════════════════════
//
//  Phase 2: 거래량확인, ATR정규화, 추세맥락, 품질점수
//  Phase 3: 손절가, 목표가, 리스크리워드
//  Phase 4: 교수형, 유성형, 잉태형, 머리어깨, 지지/저항, 컨플루언스
//  Phase 8: 관통형, 먹구름형, 잠자리도지, 비석도지, 족집게바닥/천장
//  Phase 9: 마루보주(강세/약세), 팽이형
//
// ══════════════════════════════════════════════════════

class PatternEngine {

  // ══════════════════════════════════════════════════
  //  임계값 상수 (매직 넘버 제거)
  //  학술 참조: Nison (1991), Morris (2006), Bulkowski (2005)
  // ══════════════════════════════════════════════════

  /** 도지 body/range 비율 상한 — Nison 표준 */
  static DOJI_BODY_RATIO = 0.05;

  /** 꼬리/body 최소 비율 — 해머/유성형 하한 (Morris: 2x body) */
  static SHADOW_BODY_MIN = 2.0;

  /** 반대쪽 꼬리/body 상한 — 해머/유성형 (Morris: <=0.15) */
  static COUNTER_SHADOW_MAX_STRICT = 0.15;  // 해머용
  static COUNTER_SHADOW_MAX_LOOSE = 0.3;    // 역해머/교수형/유성형용

  /** body/range 최소 비율 — 유의미한 body 존재 확인 */
  static MIN_BODY_RANGE = 0.1;

  /** body/range 최대 비율 — 해머 계열 상한 (Nison: body는 range의 상/하 1/3 이내, ~33%)
   *  [T-8] 0.45→0.40: 0.45는 과관대, Nison 원전(0.33) + KRX tick-size 여유 = 0.40 */
  static MAX_BODY_RANGE_HAMMER = 0.40;

  /** ATR 대비 최소 body 크기 — 적삼병/흑삼병 개별 봉
   *  [T-5] 0.3→0.5: Nison (1991) "long real body" 기준. 0.3은 과감지 유발 (n=103K) */
  static THREE_SOLDIER_BODY_MIN = 0.5;

  /** ATR 대비 최소 body — 장악형 이전 봉 / 현재 봉 */
  static ENGULF_PREV_BODY_MIN = 0.1;
  static ENGULF_CURR_BODY_MIN = 0.2;

  /** 장악 봉의 body 배율 — KRX 가격제한폭(30%) 고려
   *  [T-4] 1.2→1.5: 1.2x는 과감지 (n=103K). Nison "clearly engulfs" → 1.5x가 KRX 적정 */
  static ENGULF_BODY_MULT = 1.5;

  /** 잉태형 이전 봉 최소 / 현재 봉 body 비율 상한 */
  static HARAMI_PREV_BODY_MIN = 0.3;
  static HARAMI_CURR_BODY_MAX = 0.5;
  static HARAMI_CURR_BODY_MIN = 0.05;

  /** 샛별/석별형 별(2봉) body 상한, 양끝 봉 body 하한
   *  [T-6] STAR_END_BODY_MIN 0.3→0.5: 양끝 봉은 "long body" 필수 (Nison 1991) */
  static STAR_BODY_MAX = 0.2;
  static STAR_END_BODY_MIN = 0.5;

  /** 관통형/먹구름형 봉 body 하한 */
  static PIERCING_BODY_MIN = 0.3;

  /** 잠자리/비석 도지 그림자 비율 */
  static SPECIAL_DOJI_SHADOW_MIN = 0.70;
  /** [Phase1-D] 0.10→0.15: dragonfly/gravestone 반대꼬리 허용 확대 (n=20-22→35-45 목표)
   *  Nison 원칙 "거의 없는 반대꼬리" 유지하면서, 5%→15% 범위의 미세 꼬리 허용 */
  static SPECIAL_DOJI_COUNTER_MAX = 0.15;

  /** 족집게 봉 body 하한 / 가격 일치 허용오차 (ATR 배수)
   *  [T-7] 0.15→0.25: 0.15는 도지급 봉까지 포함하여 과감지. Nison: "visible real body" */
  static TWEEZER_BODY_MIN = 0.25;
  static TWEEZER_TOLERANCE = 0.1;

  /** 마루보주 body/range 하한 — Nison: 실체가 range의 85% 이상 */
  static MARUBOZU_BODY_RATIO = 0.85;
  /** 마루보주 꼬리/body 상한 — Morris: 양끝 꼬리 거의 없음 (2% 이하) */
  static MARUBOZU_SHADOW_MAX = 0.02;

  /** 팽이형 body/range 범위 — 도지(5%)와 보통 봉(30%) 사이 */
  static SPINNING_BODY_MIN = 0.05;
  static SPINNING_BODY_MAX = 0.30;
  /** 팽이형 꼬리/body 하한 — 양쪽 꼬리가 body의 75% 이상
   *  [E-2] 0.50→0.75: Morris(2006) "shadow > body" 기준에 근접, n=137k/303k 과감지 억제 */
  static SPINNING_SHADOW_RATIO = 0.75;

  /** 삼내형(Three Inside) 3봉 확인 body/ATR 최소 — Nison (1991) 확인 봉 유의미 크기 */
  static THREE_INSIDE_CONFIRM_MIN = 0.2;

  /** 버림받은아기 도지 body/range 상한 — 표준 도지(0.05)보다 관대 (Bulkowski 2008)
   *  [Phase1-B] 0.10→0.15: 준도지(near-doji) 포함, 캔들 body 임계(0.30) 대비 충분히 엄격 */
  static ABANDONED_BABY_DOJI_MAX = 0.15;
  /** 버림받은아기 갭 최소 ATR 비율 — KRX 갭 빈도 낮아 관대 설정
   *  [Phase1-B] 0.05→0.03: KRX 연속매매 구조에서 near-gap 포착 (n=10-12→18-30 목표) */
  static ABANDONED_BABY_GAP_MIN = 0.03;

  /** 긴다리도지 양쪽 꼬리/range 최소 — Nison: 양쪽 30% 이상 */
  static LONG_DOJI_SHADOW_MIN = 0.30;
  /** 긴다리도지 range/ATR 최소 — 유의미한 크기 (일반 도지 0.3보다 엄격) */
  static LONG_DOJI_RANGE_MIN = 0.80;

  /** 띠두름(Belt Hold) body/range 하한 — Morris (2006): 강한 몸통 60%+ */
  static BELT_BODY_RATIO_MIN = 0.60;
  /** 띠두름 시가측 꼬리/body 상한 — 시가에서 갭 반전이므로 거의 없어야 함 */
  static BELT_OPEN_SHADOW_MAX = 0.05;
  /** 띠두름 종가측 꼬리/body 상한 — 마루보주(0.02)와 구분 */
  static BELT_CLOSE_SHADOW_MAX = 0.30;
  /** 띠두름 body/ATR 최소 — 유의미한 크기 */
  static BELT_BODY_ATR_MIN = 0.40;

  /** 잉태십자(Harami Cross) 2봉째 도지 body/range 상한 — Nison (1991): "harami cross = harami with doji"
   *  표준 도지(0.05)보다 관대: 준도지(near-doji)도 십자형 인정 */
  static HARAMI_CROSS_DOJI_MAX = 0.08;

  /** 스틱샌드위치(Stick Sandwich) 종가 일치 허용오차 — ATR 배수
   *  Bulkowski (2008): 1봉과 3봉의 종가가 "거의 동일"해야 함
   *  KRX 호가 단위(tick) 고려: ATR*0.05 = ~50원(ATR 1000원 기준) */
  static STICK_SANDWICH_CLOSE_TOL = 0.05;
  /** 스틱샌드위치 반대 방향 봉(2봉) body/ATR 최소 */
  static STICK_SANDWICH_MID_BODY_MIN = 0.3;

  /** 유의미한 범위 (range/ATR) 하한 */
  static MIN_RANGE_ATR = 0.3;

  /** 추세 감지 정규화 방향 임계값
   *  [D-Heuristic] core_data/07 SS3.4: |T|>1 = "strong trend". 0.3은 느슨한 하한 —
   *  가격이 lookback당 0.3 ATR 이동하는 추세. Brock et al. (1992)는 raw cross 사용. */
  static TREND_THRESHOLD = 0.3;

  /** 품질 점수 가중치 (Nison/Morris 원칙 기반) */
  static Q_WEIGHT = Object.freeze({
    body: 0.25, volume: 0.25, trend: 0.20, shadow: 0.15, extra: 0.15,
  });

  /** 손절가 ATR 배수 (기본) */
  static STOP_LOSS_ATR_MULT = 2;

  /** ATR fallback: 가격의 2% (일봉 기준)
   *  [D-Heuristic] ATR(14) 불가 시 근사값. KRX 대형주 일봉 median ATR/close ≈ 2.1%.
   *  주기적으로 실제 median ATR/close 비율 대조 권장. */
  static ATR_FALLBACK_PCT = 0.02;

  /** 타임프레임별 ATR fallback — 분봉 ATR/close 비율은 일봉 대비 작음
   *  5m: ~0.3-0.5%, 15m: ~0.5-0.7%, 30m: ~0.7-1.0%, 1h: ~1.0-1.5%
   *  주봉/월봉: √5≈2.24×일봉, √22≈4.69×일봉 (random walk scaling) */
  static ATR_FALLBACK_BY_TF = Object.freeze({
    '1m': 0.002, '5m': 0.004, '15m': 0.006, '30m': 0.008,
    '1h': 0.012, '1d': 0.020, '1w': 0.044, '1M': 0.090,
  });

  /** 타임프레임별 패턴 활성화 맵
   *  CFA + Chart Expert 합의: 분봉은 제한적, 일봉은 전수, 주봉/월봉은 차트 패턴 중심
   *  candle: 'all' | 'limited' | Set of types | null (비실행)
   *  chart: 'all' | 'all_except_hs' | Set of types | null
   *  sr: boolean (지지/저항 탐지 여부) */
  static TF_PATTERN_MAP = Object.freeze({
    '1m':  { candle: null, chart: null, sr: false },
    '5m':  { candle: new Set(['hammer','shootingStar','bullishEngulfing','bearishEngulfing',
              'bullishMarubozu','bearishMarubozu','piercingLine','darkCloud']), chart: null, sr: false },
    '15m': { candle: 'all', chart: new Set(['ascendingTriangle','descendingTriangle',
              'symmetricTriangle','risingWedge','fallingWedge','channel']), sr: true },
    '30m': { candle: 'all', chart: new Set(['ascendingTriangle','descendingTriangle',
              'symmetricTriangle','risingWedge','fallingWedge','channel',
              'doubleBottom','doubleTop']), sr: true },
    '1h':  { candle: 'all', chart: 'all_except_hs', sr: true },
    '1d':  { candle: 'all', chart: 'all', sr: true },
    '1w':  { candle: 'limited', chart: 'all', sr: true },
    '1M':  { candle: null, chart: new Set(['doubleBottom','doubleTop','channel']), sr: true },
  });

  /** 주봉 캔들 패턴 제한 목록 — 장악형/마루보주/관통형/먹구름만 (주봉에서 유의미) */
  static _WEEKLY_CANDLE_TYPES = new Set([
    'bullishEngulfing','bearishEngulfing','bullishMarubozu','bearishMarubozu',
    'piercingLine','darkCloud','hammer','shootingStar',
  ]);

  /** 캔들스틱 패턴 목표가 ATR 배수 — KRX 76,443건 Theil-Sen calibration (calibrated_constants.json D1)
   *  strong: 1.88 (n=55,469, CI95=[1.86,1.91]), medium: 2.31 (n=5,403, CI95=[2.23,2.39]),
   *  weak: 2.18 (n=1,392, CI95=[2.09,2.28])
   *  KW p=2.22e-61
   *  [T-13] medium(2.31) > weak(2.18) > strong(1.88) 비단조 관계:
   *  - "strength"는 방향 신뢰도(hit rate)이지 가격 이동 크기가 아님
   *  - medium = 반전 패턴(hammer, shootingStar 등) → 추세 전환 시 stop-cascade + 평균회귀 오버슈트로 큰 이동
   *  - strong = 확인 패턴(engulfing, 3soldiers 등) → 이미 진행 중인 움직임 확인, 잔여 이동 상대적으로 작음
   *  - Bulkowski (2008) 개별 패턴 순위도 비단조(non-monotonic) 관계 확인 */
  static CANDLE_TARGET_ATR = { strong: 1.88, medium: 2.31, weak: 2.18 };

  /** 차트 패턴 목표가 ATR 상한 — EVT 99.5% VaR 경계 (core_data/12_extreme_value_theory.md §4.3) */
  static CHART_TARGET_ATR_CAP = 6;

  /** 차트 패턴 목표가 raw 배율 상한 — Bulkowski P80 (패턴 높이의 2배 초과 = 상위 20%) */
  static CHART_TARGET_RAW_CAP = 2.0;

  /** [C] Prospect Theory 비대칭 손절/목표 — Kahneman & Tversky (1979)
   *  손실 회피 계수 λ=2.25, sqrt(λ)=1.50 → KRX 호가 단위 적응 1.15 (dampened)
   *  손절: 더 넓게 (whipsaw 방지), 목표: 더 보수적 (disposition effect 반영) */
  static PROSPECT_STOP_WIDEN = 1.15;
  /** [C] 1/PROSPECT_STOP_WIDEN — disposition effect 보수주의 */
  static PROSPECT_TARGET_COMPRESS = 0.87;

  /** 넥라인 돌파 확인 — lookforward bar 수 상한
   *  Bulkowski (2005): 패턴 완성 후 평균 돌파 시점은 5~15일.
   *  20 bar 이후 돌파는 패턴 효력 소멸로 판단 (time decay). */
  static NECKLINE_BREAK_LOOKFORWARD = 20;

  /** 넥라인 돌파 ATR 필터 배수 — 노이즈 돌파 제거 (0.5 ATR 이상 이탈 시 확인)
   *  Edwards & Magee (2018): 유의미한 돌파는 일정 거리 이상 이격 필요 */
  static NECKLINE_BREAK_ATR_MULT = 0.5;

  /** 넥라인 미확인 감산 — Bulkowski (2005): 미확인 H&S 35% vs 확인 83% (차이 -48pp) */
  static NECKLINE_UNCONFIRMED_PENALTY = 15;
  static NECKLINE_UNCONFIRMED_PRED_PENALTY = 20;

  /** 삼각형/쐐기 돌파 확인 — Bulkowski (2005): 미확인 삼각형 40-50% vs 확인 70-80%
   *  사선 트렌드라인 특성상 넥라인(0.5)보다 낮은 임계값 적용 */
  static TRIANGLE_BREAK_ATR_MULT = 0.3;
  static TRIANGLE_BREAK_LOOKFORWARD = 15;
  static TRIANGLE_UNCONFIRMED_PENALTY = 12;
  static TRIANGLE_UNCONFIRMED_PRED_PENALTY = 15;

  /** 채널 탐지 상수 — ATR*k 기반, Murphy (1999) + Edwards & Magee (2018)
   *  평행 추세선 쌍으로 가격 움직임을 포착, 삼각형/쐐기와 상호배타 */
  static CHANNEL_TOUCH_TOL = 0.3;        // ATR*0.3: 추세선 터치 허용 오차
  static CHANNEL_PARALLELISM_MAX = 0.020; // 봉당 ATR 비율: 기울기 차이 임계값
  static CHANNEL_WIDTH_MIN = 1.5;         // ATR 배수: 최소 채널 폭
  static CHANNEL_WIDTH_MAX = 8.0;         // ATR 배수: 최대 채널 폭
  static CHANNEL_CONTAINMENT = 0.80;      // 봉 포함율: 80% 이상 채널 내
  static CHANNEL_MIN_SPAN = 15;           // 최소 봉 수
  static CHANNEL_MIN_TOUCHES = 3;         // 상하선 합계 최소 터치 수

  /** H&S 스윙 포인트 검색 윈도우 — Bulkowski (2005): 평균 65일, P75=85일
   *  [Phase1-A] 80→120: P75(85일) + 여유. KRX 낮은 변동성 레짐에서 장기 형성 포착 (n=4→15-25 목표) */
  static HS_WINDOW = 120;

  /** H&S 어깨 대칭 허용 — Bulkowski: 유효 H&S 중 40%가 >5% 비대칭. Murphy: 완벽 대칭은 이론적 이상
   *  [Phase1-A] 0.10→0.15: Bulkowski 40% 비대칭 포착, 실전 유효 H&S 커버리지 확대 */
  static HS_SHOULDER_TOLERANCE = 0.15;

  /** [Phase2-E] 패턴별 실측 5일 승률 — 5년 데이터 2,768종목 545,307건 (2021-03~2026-03)
   *  confidence(형태점수, UI용)와 confidencePred(예측승률, 모델용) 분리
   *  이전: 1년 302,986건. 갱신: 5년 545,307건 — 소표본 해소, WR 안정화 */
  static PATTERN_WIN_RATES = Object.freeze({
    hammer: 45.2, invertedHammer: 48.9, shootingStar: 59.2, hangingMan: 59.4,
    doji: 42.0, dragonflyDoji: 45.0, gravestoneDoji: 62.0, spinningTop: 43.1,
    bullishEngulfing: 41.3, bearishEngulfing: 57.2, bullishHarami: 44.1, bearishHarami: 58.7,
    piercingLine: 50.2, darkCloud: 58.5, tweezerBottom: 46.5, tweezerTop: 56.8,
    threeWhiteSoldiers: 47.6, threeBlackCrows: 57.5, morningStar: 40.5, eveningStar: 56.7,
    bullishMarubozu: 41.8, bearishMarubozu: 57.7,
    bullishBeltHold: 51.4, bearishBeltHold: 57.4,
    threeInsideUp: 42.4, threeInsideDown: 55.1,
    abandonedBabyBullish: 51.8, abandonedBabyBearish: 64.8,
    bullishHaramiCross: 46.0, bearishHaramiCross: 57.5,
    stickSandwich: 52.0,
    longLeggedDoji: 45.0, channel: 58.0,
    doubleBottom: 62.1, doubleTop: 74.7,
    headAndShoulders: 56.9, inverseHeadAndShoulders: 44.0,
    ascendingTriangle: 39.5, descendingTriangle: 54.3,
    symmetricTriangle: 32.3, risingWedge: 59.8, fallingWedge: 39.1,
  });

  /** [Phase2-E] 패턴별 실측 표본 크기 — 5년 545,307건 기준
   *  James-Stein shrinkage + Beta-Binomial posterior 계산에 필요 */
  static PATTERN_SAMPLE_SIZES = Object.freeze({
    hammer: 4293, invertedHammer: 6710, shootingStar: 4472, hangingMan: 5554,
    doji: 42031, dragonflyDoji: 1180, gravestoneDoji: 1107, spinningTop: 559149,
    bullishEngulfing: 103287, bearishEngulfing: 113066, bullishHarami: 52880, bearishHarami: 47269,
    piercingLine: 3753, darkCloud: 3093, tweezerBottom: 9024, tweezerTop: 5994,
    threeWhiteSoldiers: 4811, threeBlackCrows: 4812, morningStar: 29550, eveningStar: 26229,
    bullishMarubozu: 30796, bearishMarubozu: 41696,
    bullishBeltHold: 3930, bearishBeltHold: 3355,
    threeInsideUp: 14275, threeInsideDown: 13760,
    abandonedBabyBullish: 137, abandonedBabyBearish: 71,
    bullishHaramiCross: 8500, bearishHaramiCross: 7200,
    stickSandwich: 420,
    longLeggedDoji: 36690, channel: 125,
    doubleBottom: 1939, doubleTop: 1539, headAndShoulders: 1156,
    inverseHeadAndShoulders: 1280, ascendingTriangle: 352, descendingTriangle: 503,
    symmetricTriangle: 2678, risingWedge: 1054, fallingWedge: 2380,
  });

  /** Beta-Binomial 켤레 사전분포 사후 평균 — 카테고리별 grand mean으로 수축
   *  공식: θ_post = (n·θ + N0·μ_grand) / (n + N0)
   *  이는 Beta(α0,β0) 사전분포의 사후 평균과 대수적으로 동일 (α0=N0·μ, β0=N0·(1-μ))
   *  [Fix] 이전 명칭 수정: "James-Stein shrinkage"는 가우시안 평균 이론 — 이항 비율(win rate)엔
   *        Beta-Binomial 켤레 사전이 올바른 명칭. 공식 자체는 동일하므로 수치 변경 없음.
   *        (James-Stein 1961은 Gaussian 동시 추정; 이항 비율엔 Efron & Morris 1975 EB가 적합)
   *  [Phase2-E-2] N0=50→35: Empirical Bayes 최적화 (5년 545K건, N0_hat=34.5)
   *  N0 의미: 사전분포의 가상 표본 수. n<<N0 → grand mean에 강하게 수축; n>>N0 → 원시값 유지
   *  candle/chart 별도 grand mean — spinningTop(n=559K)이 H&S(n=1156)를 지배하는 문제 해소
   *  차트 패턴 grand mean ~45%, 캔들 패턴 grand mean ~43% (독립 추정) */
  static PATTERN_WIN_RATES_SHRUNK = (() => {
    const raw = PatternEngine.PATTERN_WIN_RATES;
    const sizes = PatternEngine.PATTERN_SAMPLE_SIZES;
    const N0 = 35; // [Phase2-E-2] Empirical Bayes optimal (was 50, N0_hat=34.5 from 5yr data)

    // 차트 패턴 카테고리 (chart grand mean 별도 계산)
    const chartSet = new Set([
      'doubleBottom', 'doubleTop', 'headAndShoulders', 'inverseHeadAndShoulders',
      'ascendingTriangle', 'descendingTriangle', 'symmetricTriangle',
      'risingWedge', 'fallingWedge', 'channel'
    ]);

    // 카테고리별 가중 평균
    let sumWN_candle = 0, sumN_candle = 0;
    let sumWN_chart = 0, sumN_chart = 0;
    for (const k in raw) {
      // [Fix] || 1 → || N0: PATTERN_SAMPLE_SIZES 누락 시 n=1이면 수축 계수=97.2%로
      //        패턴 WR이 grand mean에 거의 완전히 묻힘. N0(=35)를 기본값으로 하면
      //        수축 50%로 완화 — 누락 패턴에 "보통 표본" 수준의 신뢰도 부여.
      //        누락 발생 시 콘솔 경고로 추적 가능하게 함.
      if (!(k in sizes)) { if (typeof console !== 'undefined') console.warn('[PatternEngine] PATTERN_SAMPLE_SIZES 누락 패턴:', k, '→ n=N0 폴백'); }
      const n = sizes[k] || N0;
      if (chartSet.has(k)) { sumWN_chart += raw[k] * n; sumN_chart += n; }
      else { sumWN_candle += raw[k] * n; sumN_candle += n; }
    }
    const grandMeanCandle = sumN_candle > 0 ? sumWN_candle / sumN_candle : 50;
    const grandMeanChart = sumN_chart > 0 ? sumWN_chart / sumN_chart : 50;

    const shrunk = {};
    for (const k in raw) {
      const n = sizes[k] || N0;  // [Fix] || 1 → || N0 (50% 수축, 이전 97.2% 과수축 방지)
      const gm = chartSet.has(k) ? grandMeanChart : grandMeanCandle;
      shrunk[k] = +((n * raw[k] + N0 * gm) / (n + N0)).toFixed(1);
    }
    return Object.freeze(shrunk);
  })();

  /** Beta-Binomial 사후 승률 — rl_policy.json win_rates_live에서 로드
   *  null이면 PATTERN_WIN_RATES_SHRUNK 폴백 (Beta-Binomial 사전 기반 수축 추정)
   *  Phase G-2: conjugate prior → posterior mean = alpha/(alpha+beta) */
  static PATTERN_WIN_RATES_LIVE = null;

  /** 전역 학습 가중치 (Worker에서 주입) */
  static _globalLearnedWeights = null;

  /** 백테스트 기준시점 (ms) — AMH 시변 감쇠 계산용. Worker에서 주입.
   *  Lo (2004): 패턴 알파는 exp(-λ×days)로 감쇠. null이면 감쇠 미적용. */
  static _backtestEpochMs = null;
  /** [FLAG-3] 현재 분석 중인 시장 — analyze() 호출 시 opts.market으로 설정
   *  AMH lambda 시장별 분화에 사용. 'KOSPI'|'KOSDAQ'|null */
  static _currentMarket = null;

  /** 밸류에이션 S/R 가격 필터 범위 — 현재가 ±30% 이내만 포함
   *  Rothschild & Stiglitz (1976) 정보 비대칭 하 스크리닝 이론:
   *  펀더멘털 밸류에이션 임계점은 시장 참여자의 매수/매도 의사결정 앵커로 작용.
   *  ±30% = KRX 일일 가격제한폭(±30%)과 일치, 합리적 밸류에이션 판단 범위. */
  static VALUATION_SR_RANGE = 0.30;

  /** 밸류에이션 S/R 최대 수준 수 — 과밀 방지 (기술적 S/R 최대 10개 대비 보수적) */
  static VALUATION_SR_MAX_LEVELS = 5;

  /** 밸류에이션 S/R 기본 강도 — 기술적 S/R(최대 1.0) 대비 보수적
   *  단일 접촉(touches=1)이므로 기술적 S/R의 다중 접촉 강도를 초과할 수 없음 */
  static VALUATION_SR_STRENGTH = 0.6;

  /** [C] AMH lambda 시장별 상수 — core_data/20 §10 KRX 패턴 반감기 실증 */
  static AMH_LAMBDA = Object.freeze({
    KOSDAQ: 0.00367,  // 반감기 189일(~9개월) — 소형주 빠른 효율화
    KOSPI:  0.00183,  // 반감기 378일(~18개월) — 대형주 느린 효율화
    DEFAULT: 0.00275, // 반감기 252일(~1년) — 시장 미지정 시 보수적 기본값
  });

  /**
   * AMH 시변 감쇠 인자 — Lo (2004), McLean & Pontiff (2016)
   * 학습된 가중치의 신뢰도를 백테스트 기준시점 이후 경과 일수에 따라 감쇠.
   * decayFactor = exp(-λ × daysSince)
   *
   * [FLAG-3] 시장별 λ 런타임 분화:
   *   KOSDAQ: λ=0.00367 (반감기 189일, 소형주 빠른 효율화)
   *   KOSPI:  λ=0.00183 (반감기 378일, 대형주 느린 효율화)
   *   기본값: λ=0.00275 (반감기 252일)
   *
   * @returns {number} 0~1 감쇠 인자 (1=감쇠 없음, 0에 수렴=완전 감쇠)
   */
  static _temporalDecayFactor() {
    if (PatternEngine._backtestEpochMs == null) return 1.0;
    var daysSince = (Date.now() - PatternEngine._backtestEpochMs) / 86400000;
    if (daysSince <= 0) return 1.0;
    var mkt = PatternEngine._currentMarket;
    var lambda = (mkt === 'KOSDAQ') ? PatternEngine.AMH_LAMBDA.KOSDAQ
               : (mkt === 'KOSPI')  ? PatternEngine.AMH_LAMBDA.KOSPI
               : PatternEngine.AMH_LAMBDA.DEFAULT;
    return Math.exp(-lambda * daysSince);
  }

  /**
   * 회귀 계수를 Q_WEIGHT 구조로 정규화
   * [FLAG-2] shadow 독립 추정: 회귀에 shadow 전용 계수가 없으므로,
   * body(confidence) 계수를 prior 비율(Q_WEIGHT body:shadow = 0.25:0.15)로 분배.
   * 기존 hardcode 0.6 → prior 기반 비율 = shadow/(body+shadow) = 0.15/0.40 = 0.375
   */
  static _normalizeCoeffsToWeights(coeffs) {
    const fc = [Math.abs(coeffs[1] || 0), Math.abs(coeffs[2] || 0), Math.abs(coeffs[3] || 0), Math.abs(coeffs[4] || 0)];
    const s = fc.reduce((a, b) => a + b, 0.001);
    // body와 shadow는 regression의 confidence 계수(fc[0])를 prior 비율로 분할
    var priorBody = PatternEngine.Q_WEIGHT.body;
    var priorShadow = PatternEngine.Q_WEIGHT.shadow;
    var splitRatio = priorShadow / (priorBody + priorShadow);  // 0.375
    var bodyShare = fc[0] / s * (1 - splitRatio);
    var shadowShare = fc[0] / s * splitRatio;
    const raw = { body: bodyShare, volume: fc[2] / s, trend: fc[1] / s, shadow: shadowShare, extra: fc[3] / s };
    const sum = Object.values(raw).reduce((a, b) => a + b, 0.001);
    return { body: raw.body / sum, volume: raw.volume / sum, trend: raw.trend / sum, shadow: raw.shadow / sum, extra: raw.extra / sum };
  }

  // ══════════════════════════════════════════════════
  //  유틸리티
  // ══════════════════════════════════════════════════

  /** Theil-Sen 로버스트 추세 감지 — ATR 기반 정규화
   *  Sen (1968), Theil (1950): 이상치(스파이크/급락)에 강건한 추세선.
   *  Breakdown point ≈ 29.3% — 데이터의 ~29%가 이상치여도 왜곡되지 않음.
   *  core_data/07_pattern_algorithms.md S2.3 구현.
   *
   *  Murphy (1999): "Trend identification should be normalized against
   *  recent volatility for consistent sensitivity across market regimes."
   *  @param {Array} candles - OHLCV 배열
   *  @param {number} endIndex - 분석 끝 인덱스 (exclusive)
   *  @param {number} [lookback=10] - 회귀 윈도우
   *  @param {number} [atrVal] - 미리 계산된 ATR 값 (없으면 가격 평균 2% fallback)
   *  @returns {{ slope: number, strength: number, r2: number, direction: string }}
   */
  _detectTrend(candles, endIndex, lookback = 10, atrVal = null) {
    const start = Math.max(0, endIndex - lookback);
    if (endIndex - start < 3) return { slope: 0, strength: 0, r2: 0, direction: 'neutral' };
    const seg = candles.slice(start, endIndex);
    const n = seg.length;

    // --- Theil-Sen 기울기: 모든 쌍의 기울기(slope)의 중앙값 ---
    // O(n^2) — n <= lookback (보통 10~20), 쌍 수 최대 190개로 성능 무관
    const pairSlopes = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        // x는 등간격 인덱스이므로 x_j - x_i = j - i (항상 양수, 0 나눔 불가)
        pairSlopes.push((seg[j].close - seg[i].close) / (j - i));
      }
    }
    pairSlopes.sort((a, b) => a - b);
    const mid = pairSlopes.length >> 1;
    const slope = pairSlopes.length % 2 === 1
      ? pairSlopes[mid]
      : (pairSlopes[mid - 1] + pairSlopes[mid]) / 2;

    // --- 절편: median(y_i - slope * x_i) ---
    const intercepts = [];
    for (let i = 0; i < n; i++) intercepts.push(seg[i].close - slope * i);
    intercepts.sort((a, b) => a - b);
    const imid = intercepts.length >> 1;
    const intercept = intercepts.length % 2 === 1
      ? intercepts[imid]
      : (intercepts[imid - 1] + intercepts[imid]) / 2;

    // --- R² (결정계수) — 추세 선형성 신뢰도 ---
    let ssRes = 0, ssTot = 0, sy = 0;
    for (let i = 0; i < n; i++) sy += seg[i].close;
    const yBar = sy / n;
    for (let i = 0; i < n; i++) {
      const y = seg[i].close;
      const yHat = intercept + slope * i;
      ssRes += (y - yHat) * (y - yHat);
      ssTot += (y - yBar) * (y - yBar);
    }
    const r2 = ssTot > 0 ? Math.max(0, Math.min(1 - ssRes / ssTot, 1)) : 0;

    // --- ATR 기반 정규화: 나머지 엔진과 일관된 변동성 기준 사용 ---
    // atrVal이 없으면 가격 평균의 N%를 fallback (타임프레임별 ATR_FALLBACK_BY_TF)
    var _fbPct = PatternEngine.ATR_FALLBACK_BY_TF[PatternEngine._currentTimeframe || '1d'] || PatternEngine.ATR_FALLBACK_PCT;
    const divisor = (atrVal && atrVal > 0 ? atrVal : (sy / n * _fbPct)) || 1e-10;
    const norm = slope / divisor;
    const T = PatternEngine.TREND_THRESHOLD;
    // strength에 R² 반영: (0.5 + 0.5·R²) → R²=1 영향 없음, R²=0 → 50% 감쇄 (floor)
    const rawStrength = Math.abs(norm);
    return {
      slope,
      strength: rawStrength * (0.5 + 0.5 * r2),
      r2,
      direction: norm > T ? 'up' : norm < -T ? 'down' : 'neutral',
    };
  }

  /** 거래량 비율 (현재 / MA) */
  _volRatio(candles, idx, vma) {
    if (!vma || !vma[idx] || vma[idx] === 0) return 1;
    return candles[idx].volume / vma[idx];
  }

  /** 다요인 품질 점수 (0-100)
   *  extra 기본값 0.3: 확인 요인 부재 시 보수적 평가 (Nison/Morris 원칙)
   *  0.5는 "추가 확인 없이도 절반 점수"를 의미하여 신뢰도 인플레이션 유발
   */
  _quality({ body = 0.5, volume = 0.5, trend = 0.5, shadow = 0.5, extra = 0.3 }) {
    const W = PatternEngine.Q_WEIGHT;
    const raw = W.body * body + W.volume * volume + W.trend * trend + W.shadow * shadow + W.extra * extra;
    return Math.round(Math.min(100, Math.max(0, raw * 100)));
  }

  /**
   * 적응형 품질 평가 — 학술 기본값(prior) + 데이터 학습(posterior)
   * 차트 패턴(9종) 전용. 캔들 패턴은 기존 _quality() 유지.
   * @param {string} patternType
   * @param {Object} features - { body, volume, trend, shadow, extra }
   * @returns {number} confidence 0-100
   */
  _adaptiveQuality(patternType, features) {
    let W = PatternEngine.Q_WEIGHT;
    const lw = PatternEngine._globalLearnedWeights;

    if (lw && lw[patternType] && lw[patternType].confidence > 0.05) {
      const learned = lw[patternType];
      // [P2-8] alpha: R²>0.3이면 최대 70% 적응, 아니면 50% 유지
      // 근거: 높은 R²는 학습된 가중치의 신뢰성이 충분함을 의미
      const alphaCap = (learned.rSquared && learned.rSquared > 0.3) ? 0.7 : 0.5;
      // [AMH] Lo (2004) 시변 감쇠: 오래된 백테스트 결과일수록 exp(-λ×days) 비율로
      // confidence를 축소. decayedConfidence ≈ 0이면 alpha ≈ 0 → Q_WEIGHT 유지.
      const decayedConfidence = learned.confidence * PatternEngine._temporalDecayFactor();
      const alpha = Math.max(0, Math.min(decayedConfidence * 2, alphaCap));
      const W_learned = PatternEngine._normalizeCoeffsToWeights(learned.beta);
      W = {
        body: (1 - alpha) * W.body + alpha * W_learned.body,
        volume: (1 - alpha) * W.volume + alpha * W_learned.volume,
        trend: (1 - alpha) * W.trend + alpha * W_learned.trend,
        shadow: (1 - alpha) * W.shadow + alpha * W_learned.shadow,
        extra: (1 - alpha) * W.extra + alpha * W_learned.extra,
      };
      const sum = Object.values(W).reduce((a, b) => a + b, 0.001);
      Object.keys(W).forEach(k => W[k] /= sum);
    }

    const { body = 0.5, volume = 0.5, trend = 0.5, shadow = 0.5, extra = 0.3 } = features;
    const raw = W.body * body + W.volume * volume + W.trend * trend + W.shadow * shadow + W.extra * extra;
    return Math.round(Math.min(100, Math.max(0, raw * 100)));
  }

  /** ATR 기반 손절가 — [GAP-3] Prospect Theory 비대칭 적용
   *  Kahneman & Tversky (1979): 손실 회피로 손절 거리를 PROSPECT_STOP_WIDEN만큼 확대.
   *  넓은 손절 = whipsaw 감소, 심리적 손실 감내 여유 증가. */
  _stopLoss(candles, idx, signal, atr, mult = PatternEngine.STOP_LOSS_ATR_MULT) {
    const p = candles[idx].close;
    const a = this._atr(atr, idx, candles);
    var adjMult = mult * PatternEngine.PROSPECT_STOP_WIDEN;
    return signal === 'buy' ? +(p - a * adjMult).toFixed(0)
         : signal === 'sell' ? +(p + a * adjMult).toFixed(0) : null;
  }

  /** 캔들스틱 패턴 전용 목표가 — ATR × strength 배수 × context weights
   *  학술 근거: Nison (1991) — 캔들 패턴은 목표가를 제시하지 않음.
   *  Bulkowski (2012) 5일 평균 수익률 기반 ATR 배수로 보수적 추정.
   *  차트 패턴의 measured move와 명시적으로 분리.
   *  [Batch 2-4] hw×mw weight 통합 — 차트 패턴과 동일한 레짐 보정 적용
   *  [GAP-3] Prospect Theory 목표가 압축 — disposition effect로 목표 보수적 설정 */
  _candleTarget(candles, idx, signal, strength, atr, hw, mw) {
    const entry = candles[idx].close;
    const a = this._atr(atr, idx, candles);
    const mult = PatternEngine.CANDLE_TARGET_ATR[strength] || 0.7;
    const w = (hw || 1) * (mw || 1) * PatternEngine.PROSPECT_TARGET_COMPRESS;
    return signal === 'buy'  ? +(entry + a * mult * w).toFixed(0)
         : signal === 'sell' ? +(entry - a * mult * w).toFixed(0) : null;
  }

  /** ATR 값 (fallback 포함, 타임프레임 인식) */
  _atr(atr, idx, candles) {
    if (atr[idx]) return atr[idx];
    var tf = PatternEngine._currentTimeframe || '1d';
    var pct = PatternEngine.ATR_FALLBACK_BY_TF[tf] || PatternEngine.ATR_FALLBACK_PCT;
    return candles[idx].close * pct;
  }

  // ══════════════════════════════════════════════════
  //  전체 분석
  // ══════════════════════════════════════════════════

  analyze(candles, opts) {
    if (!candles || candles.length < 10) return [];
    // [FLAG-3] 시장별 AMH lambda 설정 — opts.market = 'KOSPI'|'KOSDAQ'
    PatternEngine._currentMarket = (opts && opts.market) ? opts.market : null;
    // [TF-AWARE] 타임프레임 인식 — 패턴 활성화/ATR fallback 분기
    const _timeframe = (opts && opts.timeframe) || '1d';
    const _tfMap = PatternEngine.TF_PATTERN_MAP[_timeframe] || PatternEngine.TF_PATTERN_MAP['1d'];
    PatternEngine._currentTimeframe = _timeframe;
    // indicators.js 전역 함수 직접 호출 (불필요한 래퍼 제거)
    const closes = candles.map(c => c.close);
    var hurstResult = calcHurst(closes);
    var hurst = hurstResult ? hurstResult.H : null;
    // f(hurst): James-Stein shrinkage — 데이터 부족 시 H→0.5(랜덤워크) 수축
    let hurstWeight = 1.0;
    if (hurst != null && isFinite(hurst)) {
      var nEff = Math.max(2, Math.floor(Math.log(closes.length / 20) / Math.log(1.5)));
      var shrinkage = nEff / (nEff + 20);
      var hShrunk = shrinkage * hurst + (1 - shrinkage) * 0.5;
      hurstWeight = Math.max(0.6, Math.min(2 * hShrunk, 1.4));
    }
    // k(vol): 변동성 레짐 보정 — ATR_14/ATR_50 비율 (경제물리학 멱법칙 기반)
    const atr14 = calcATR(candles, 14);
    const atr50 = calcATR(candles, 50);
    const lastATR14 = atr14[atr14.length - 1] || 1;
    // [Note] 50봉 미만 데이터에서 atr50[last]는 null → lastATR50=lastATR14 → ratio=1.0
    //        → volWeight=1.0 (보정 없음). 데이터 부족 시 레짐 보정 비활성화는 의도된 폴백.
    //        충분한 데이터가 없으면 ATR14/ATR50 비율 자체가 무의미하기 때문.
    const lastATR50 = atr50[atr50.length - 1] || lastATR14;
    const volWeight = Math.max(0.7, Math.min(1 / Math.sqrt(lastATR14 / lastATR50), 1.4));

    // m(meanRev): 평균 회귀 보정 — OU 과정 반감기 기반 (core_data/12_extreme_value_theory.md)
    const ma50 = calcMA(closes, 50);
    const lastMA50 = ma50[ma50.length - 1] || closes[closes.length - 1];
    const moveATR = lastATR14 > 0 ? Math.abs(closes[closes.length - 1] - lastMA50) / lastATR14 : 0;
    const excess = Math.max(0, moveATR - 3);
    const meanRevWeight = Math.max(0.6, Math.min(Math.exp(-0.1386 * excess), 1.0));

    // r(regime): Jeffrey 발산 기반 레짐 변화 보정 — 대칭 KL (core_data/13_information_geometry.md §4.3)
    // [Phase I-L2] HMM regime override — Hamilton (1989), core_data/21 §2
    // HMM 고변동 레짐(bull_prob > 0.5, σ=3.4%) → regimeWeight 감산
    // Fallback: Mahalanobis 거리 (core_data/13 §6.4)
    let regimeWeight = 1.0;
    var _hmmData = (typeof backtester !== 'undefined' && backtester._behavioralData
      && backtester._behavioralData['hmm_regimes']) ? backtester._behavioralData['hmm_regimes'] : null;
    if (_hmmData && _hmmData.daily && _hmmData.daily.length > 0) {
      // Use most recent regime assignment
      var lastRegime = _hmmData.daily[_hmmData.daily.length - 1];
      if (lastRegime && lastRegime.bull_prob > 0.5) {
        // High-volatility episode (KRX "bull" = high-vol, σ=3.4x normal)
        regimeWeight = 0.7 + 0.3 * (1 - lastRegime.bull_prob);
      }
    } else if (closes.length >= 80) {
      const returns60 = [], returns20 = [];
      for (let ri = closes.length - 80; ri < closes.length - 20; ri++) {
        if (closes[ri] > 0) returns60.push((closes[ri + 1] - closes[ri]) / closes[ri]);
      }
      for (let ri = closes.length - 20; ri < closes.length - 1; ri++) {
        if (closes[ri] > 0) returns20.push((closes[ri + 1] - closes[ri]) / closes[ri]);
      }
      if (returns60.length > 10 && returns20.length > 5) {
        const mu1 = returns60.reduce((s, v) => s + v, 0) / returns60.length;
        const mu2 = returns20.reduce((s, v) => s + v, 0) / returns20.length;
        const s1sq = returns60.reduce((s, v) => s + (v - mu1) ** 2, 0) / returns60.length || 1e-10;
        const s2sq = returns20.reduce((s, v) => s + (v - mu2) ** 2, 0) / returns20.length || 1e-10;
        // [Phase I] Fisher anomaly score — Amari (1985), core_data/13 §6.4
        // Jeffrey divergence (dj*0.15) → Mahalanobis 거리 + sigmoid 대체
        var dMaha = Math.sqrt(
          (mu1 - mu2) * (mu1 - mu2) / Math.max(s1sq, 1e-10) +
          2 * Math.pow(Math.sqrt(s1sq) / Math.max(Math.sqrt(s2sq), 1e-5) - 1, 2)
        );
        regimeWeight = 0.7 + 0.3 / (1 + Math.exp(dMaha - 2));
      }
    }

    // Hill 꼬리 지수 → ATR cap 동적화 — Hill (1975), core_data/12_extreme_value_theory.md
    // alpha < 3 (heavy tail) → cap 축소 (목표가 보수적), alpha >= 4 (정규 근사) → 기본 cap
    let dynamicATRCap = PatternEngine.CHART_TARGET_ATR_CAP; // default 6
    const hillResult = (typeof calcHillEstimator === 'function') ? calcHillEstimator(
      closes.slice(1).map((c, i) => closes[i] > 0 ? (c - closes[i]) / closes[i] : 0)
    ) : null;
    if (hillResult && hillResult.alpha < 3) {
      dynamicATRCap = 4; // heavy tail → 보수적 cap
    } else if (hillResult && hillResult.alpha < 4) {
      dynamicATRCap = 5; // moderate tail
    }

    // [PERF] UI 분석 시 lookback 윈도우 제한 — 분봉(5m/1m)에서 8-20x 속도 향상
    // detectFrom: 패턴 감지 루프 시작 인덱스. 지표 사전계산(ATR/MA/Hurst 등)은 전체 데이터 유지.
    // 백테스트는 opts 없이 호출하므로 전체 이력 분석 유지.
    const _detectFrom = (opts && opts.detectFrom != null) ? Math.max(0, opts.detectFrom) : 0;
    const ctx = { atr: atr14, vma: calcMA(candles.map(c => c.volume), 20), hurstWeight, volWeight, meanRevWeight, regimeWeight, dynamicATRCap, candles, detectFrom: _detectFrom };
    const patterns = [];

    // [TF-AWARE] 캔들 패턴 — 타임프레임별 활성화 맵 적용
    // _tfMap.candle: 'all' | 'limited' | Set | null
    var _candleEnabled = _tfMap.candle;
    var _canAll = (_candleEnabled === 'all');
    var _canLimited = (_candleEnabled === 'limited');  // 주봉용
    var _canSet = (_candleEnabled instanceof Set);
    // 캔들 패턴 실행 여부 판단 헬퍼
    var _cc = function(type) {
      if (_canAll) return true;
      if (_canLimited) return PatternEngine._WEEKLY_CANDLE_TYPES.has(type);
      if (_canSet) return _candleEnabled.has(type);
      return false;
    };

    // 1봉 패턴
    if (_cc('hammer'))         patterns.push(...this.detectHammer(candles, ctx));
    if (_cc('invertedHammer')) patterns.push(...this.detectInvertedHammer(candles, ctx));
    if (_cc('hangingMan'))     patterns.push(...this.detectHangingMan(candles, ctx));
    if (_cc('shootingStar'))   patterns.push(...this.detectShootingStar(candles, ctx));
    if (_cc('doji'))           patterns.push(...this.detectDoji(candles, ctx));
    if (_cc('dragonflyDoji'))  patterns.push(...this.detectDragonflyDoji(candles, ctx));
    if (_cc('gravestoneDoji')) patterns.push(...this.detectGravestoneDoji(candles, ctx));
    if (_cc('longLeggedDoji')) patterns.push(...this.detectLongLeggedDoji(candles, ctx));
    if (_cc('spinningTop'))    patterns.push(...this.detectSpinningTop(candles, ctx));
    if (_cc('bullishMarubozu')) patterns.push(...this.detectMarubozu(candles, ctx));
    if (_cc('beltHold'))       patterns.push(...this.detectBeltHold(candles, ctx));
    // 2봉 패턴
    if (_cc('bullishEngulfing')) patterns.push(...this.detectEngulfing(candles, ctx));
    if (_cc('bullishHarami'))  patterns.push(...this.detectHarami(candles, ctx));
    if (_cc('piercingLine'))   patterns.push(...this.detectPiercingLine(candles, ctx));
    if (_cc('darkCloud'))      patterns.push(...this.detectDarkCloud(candles, ctx));
    if (_cc('tweezerBottom'))  patterns.push(...this.detectTweezerBottom(candles, ctx));
    if (_cc('tweezerTop'))     patterns.push(...this.detectTweezerTop(candles, ctx));
    if (_cc('haramiCross'))    patterns.push(...this.detectHaramiCross(candles, ctx));
    if (_cc('stickSandwich'))  patterns.push(...this.detectStickSandwich(candles, ctx));
    // 3봉 패턴
    if (_cc('threeWhiteSoldiers')) patterns.push(...this.detectThreeWhiteSoldiers(candles, ctx));
    if (_cc('threeBlackCrows'))   patterns.push(...this.detectThreeBlackCrows(candles, ctx));
    if (_cc('morningStar'))    patterns.push(...this.detectMorningStar(candles, ctx));
    if (_cc('eveningStar'))    patterns.push(...this.detectEveningStar(candles, ctx));
    if (_cc('threeInsideUp'))  patterns.push(...this.detectThreeInsideUp(candles, ctx));
    if (_cc('threeInsideDown'))patterns.push(...this.detectThreeInsideDown(candles, ctx));
    if (_cc('abandonedBaby'))  patterns.push(...this.detectAbandonedBaby(candles, ctx));

    // [PERF] 스윙 포인트 탐지 — 차트 패턴 + S/R 모두 사용
    const swingFrom = Math.max(0, (_detectFrom || 0) - PatternEngine.HS_WINDOW - 10);
    const swH = (_tfMap.chart || _tfMap.sr) ? this._findSwingHighs(candles, 3, swingFrom) : [];
    const swL = (_tfMap.chart || _tfMap.sr) ? this._findSwingLows(candles, 3, swingFrom) : [];

    // [TF-AWARE] 차트 패턴 — 타임프레임별 활성화 맵 적용
    // _tfMap.chart: 'all' | 'all_except_hs' | Set | null
    var _chartEnabled = _tfMap.chart;
    if (_chartEnabled) {
      var _chAll = (_chartEnabled === 'all');
      var _chExHS = (_chartEnabled === 'all_except_hs');
      var _chSet = (_chartEnabled instanceof Set);
      var _chk = function(type) {
        if (_chAll) return true;
        if (_chExHS) return type !== 'headAndShoulders' && type !== 'inverseHeadAndShoulders';
        if (_chSet) return _chartEnabled.has(type);
        return false;
      };
      if (_chk('doubleBottom'))         patterns.push(...this.detectDoubleBottom(candles, swL, ctx));
      if (_chk('doubleTop'))            patterns.push(...this.detectDoubleTop(candles, swH, ctx));
      if (_chk('ascendingTriangle'))    patterns.push(...this.detectAscendingTriangle(candles, swH, swL, ctx));
      if (_chk('descendingTriangle'))   patterns.push(...this.detectDescendingTriangle(candles, swH, swL, ctx));
      if (_chk('risingWedge'))          patterns.push(...this.detectRisingWedge(candles, swH, swL, ctx));
      if (_chk('fallingWedge'))         patterns.push(...this.detectFallingWedge(candles, swH, swL, ctx));
      if (_chk('symmetricTriangle'))    patterns.push(...this.detectSymmetricTriangle(candles, swH, swL, ctx));
      if (_chk('headAndShoulders'))     patterns.push(...this.detectHeadAndShoulders(candles, swH, swL, ctx));
      if (_chk('inverseHeadAndShoulders')) patterns.push(...this.detectInverseHeadAndShoulders(candles, swH, swL, ctx));
      if (_chk('channel'))              patterns.push(...this.detectChannel(candles, swH, swL, ctx));

      // 넥라인 돌파 확인 — H&S, 역H&S, doubleBottom, doubleTop
      for (let ni = 0; ni < patterns.length; ni++) {
        const pt = patterns[ni].type;
        if (pt === 'headAndShoulders' || pt === 'inverseHeadAndShoulders' ||
            pt === 'doubleBottom' || pt === 'doubleTop') {
          this._checkNecklineBreak(candles, patterns[ni], atr14);
        }
      }

      // 삼각형/쐐기 돌파 확인 — ascending/descending/symmetric triangle, rising/falling wedge
      for (let ni = 0; ni < patterns.length; ni++) {
        const pt = patterns[ni].type;
        if (pt === 'ascendingTriangle' || pt === 'descendingTriangle' ||
            pt === 'symmetricTriangle' || pt === 'risingWedge' || pt === 'fallingWedge') {
          this._checkTriangleBreakout(candles, patterns[ni], atr14);
        }
      }

      // 넥라인/삼각형 미확인 패턴 confidence 감산 — Bulkowski (2005)
      for (let ni = 0; ni < patterns.length; ni++) {
        const p = patterns[ni];
        if (p.necklineBreakConfirmed === false) {
          p.confidence = Math.max(10, p.confidence - PatternEngine.NECKLINE_UNCONFIRMED_PENALTY);
        }
        if (p.breakoutConfirmed === false) {
          p.confidence = Math.max(10, p.confidence - PatternEngine.TRIANGLE_UNCONFIRMED_PENALTY);
        }
      }
    } // end if (_chartEnabled)

    // [TF-AWARE] 지지/저항 + 컨플루언스 — _tfMap.sr로 활성화 제어
    const sr = _tfMap.sr ? this.detectSupportResistance(candles, swH, swL, ctx) : [];

    // 밸류에이션 기반 S/R 병합 — opts.financialData가 유효한 bps/eps를 포함할 때
    // Rothschild & Stiglitz (1976): 펀더멘털 밸류에이션 앵커가 기술적 S/R 레이어에 추가됨
    // 기존 기술적 S/R은 불변, 밸류에이션 S/R은 추가 레이어로 concat
    if (opts && opts.financialData) {
      const fd = opts.financialData;
      if ((fd.bps && fd.bps > 0) || (fd.eps && fd.eps > 0)) {
        const currentPrice = candles[candles.length - 1].close;
        const valSR = this.detectValuationSR(currentPrice, fd);
        if (valSR.length > 0) {
          // valuation S/R을 기술적 S/R 배열 뒤에 병합
          // _applyConfluence는 type 'support'/'resistance'만 검사하므로
          // 'valuation_support'/'valuation_resistance'는 자연스럽게 무시됨
          // — 밸류에이션 S/R은 컨플루언스 부스트에는 미참여 (의도적)
          // — 다만 _srLevels에 포함되어 downstream(ProspectBoost, UI 표시)에서 활용 가능
          for (let vi = 0; vi < valSR.length; vi++) {
            sr.push(valSR[vi]);
          }
        }
      }
    }

    this._applyConfluence(patterns, sr, ctx);

    // CZW 가중치를 패턴 객체에 기록
    // sell hw 반전(2-hw) 제거: R²=0.0008, corr_current=corr_new=0.0286 (calibrated_constants.json D2)
    // 선형 변환은 상관관계를 변경하지 못함 (단조 변환 불변성)
    // buy/sell 동일하게 hw 직접 사용, MRA hw_x_signal(-5.303)이 방향 차이를 처리
    // 향후: docs/sell_hw_scenarios.md SIM-A(sell 전용 다변수) 검토
    for (var pi = 0; pi < patterns.length; pi++) {
      patterns[pi].hw = hurstWeight;
      // [L-1] vw는 wc에 미포함 (IC=-0.083, E-grade deprecated). 메타데이터 전용 보존
      // 향후 Option B: 검출 임계값(detection threshold) 단계로 역할 전환 검토
      patterns[pi].vw = volWeight;
      patterns[pi].mw = meanRevWeight;
      patterns[pi].rw = regimeWeight;
      // [Phase I-L0] regimeWeight 버그 수정: rw 계산 후 wc에 미반영 → 곱셈 추가
      // 근거: Hamilton (1989) HMM 레짐 가중치는 wc 복합 인자에 포함되어야 함
      patterns[pi].wc = +(hurstWeight * meanRevWeight * regimeWeight).toFixed(4);
      // Dual Confidence: confidencePred = Beta-Binomial 사후 승률 (모델 입력용)
      // confidence(형태점수)는 UI 표시용으로 불변 유지
      var wr = (PatternEngine.PATTERN_WIN_RATES_LIVE && PatternEngine.PATTERN_WIN_RATES_LIVE[patterns[pi].type] != null)
        ? PatternEngine.PATTERN_WIN_RATES_LIVE[patterns[pi].type]
        : PatternEngine.PATTERN_WIN_RATES_SHRUNK[patterns[pi].type];
      // [CRITICAL FIX] Direction-aware confidencePred — Lo (2004) AMH
      // WR = P(price UP). Buy: confidencePred = WR. Sell: confidencePred = 100 - WR.
      // 5년 실증: sell 16종 WR=58.6% (상승 예측) — 레이블 역전 수정
      // 근거: confidencePred는 "방향 정확도"여야 함, "상승 확률"이 아님
      var dirWr = (wr != null) ? wr : patterns[pi].confidence;
      if (patterns[pi].signal === 'sell' && wr != null) {
        dirWr = 100 - wr;
      }
      var pred = Math.round(dirWr);
      // 형태 품질 반영 — Kirkpatrick & Dahlquist (2011): body ratio + ATR 비율 → 신뢰도 조정
      // scaling = confidence/50, clamp [0.88, 1.12] (±12%, Caginalp 1998 실증 3~7%p 정합)
      // [E-2] 0.85/1.15→0.88/1.12: WR>55% 패턴에서 Caginalp 7%p 상한 준수 (fin-theory 교차검증)
      // Beta-Binomial 사후 추정과 양립: 소표본 패턴에서도 과도한 역전 방지
      // [이론 한계] 확률값에 곱셈 스케일링은 경계 위반 가능(pred*1.12>100). min(95,...) 클램프로
      //             방어하나, 이상적으로는 logit 공간 가산 보정이 수학적으로 더 엄밀함.
      //             현재 범위(WR 43~65%)에서 실용 오차 <2%p 이내로 허용 수준 판단.
      var qualityScaling = Math.min(1.12, Math.max(0.88, patterns[pi].confidence / 50));
      pred = Math.round(pred * qualityScaling);
      pred = Math.min(95, Math.max(10, pred));
      // 미확인 패턴 confidencePred 감산 (모델 입력에도 반영)
      if (patterns[pi].necklineBreakConfirmed === false) {
        pred = Math.max(10, pred - PatternEngine.NECKLINE_UNCONFIRMED_PRED_PENALTY);
      }
      if (patterns[pi].breakoutConfirmed === false) {
        pred = Math.max(10, pred - PatternEngine.TRIANGLE_UNCONFIRMED_PRED_PENALTY);
      }
      patterns[pi].confidencePred = pred;
    }

    // R:R 검증 게이트 — KRX calibration 기반 (calibrated_constants.json C1+D3)
    this._applyRRGate(patterns, candles);

    // [P2-RR] Bayesian sigmoid R:R → confidencePred 연속 감산
    // Phase0-D 고정 -15/-7 → sigmoid 연속 함수로 불연속 점프 제거
    // penalty = max_pen * sigmoid(-k*(rr - rr_mid))  [rr↑ → penalty↓, 단조]
    // rl_policy.rr_bayesian 있으면 데이터 기반, 없으면 이론 기본값
    // 근거: Gelman et al. (2013) BDA3, smooth prior → posterior transition
    var rrParams = (typeof backtester !== 'undefined' && backtester._rlPolicy && backtester._rlPolicy.rr_bayesian)
      ? backtester._rlPolicy.rr_bayesian : null;
    var rrMaxPen = rrParams ? rrParams.max_pen : 15;
    var rrK      = rrParams ? rrParams.k       : 8;
    var rrMid    = rrParams ? rrParams.rr_mid   : 2.375;
    for (var ri = 0; ri < patterns.length; ri++) {
      var rp = patterns[ri];
      if (rp.riskReward == null || rp.confidencePred == null) continue;
      // sigmoid: rr < rr_mid → penalty > max_pen/2, rr > rr_mid → penalty < max_pen/2
      var rrPen = Math.round(rrMaxPen / (1 + Math.exp(rrK * (rp.riskReward - rrMid))));
      if (rrPen > 0) {
        rp.confidencePred = Math.max(10, rp.confidencePred - rrPen);
      }
    }

    // [Phase I-L1] 시장 군집행동 맥락 조정 — CSAD + HMM 연계
    // 극단 군집(herding_flag=2) + 하락장(r_market<0) → 매수 패턴 신뢰도 하향 보정
    this._applyHerdingAdjust(patterns);

    // [Phase I-L2] 구조 변화점 근접 패턴 신뢰도 감산 — Page (1954) CUSUM
    this._applyBreakpointAdjust(patterns, candles);

    var deduped = this._dedup(patterns);
    // [Phase I] S/R levels 첨부 — applyProspectBoost 등 후처리에서 활용
    deduped._srLevels = sr;
    return deduped;
  }

  /**
   * [Phase I-L1] CSAD 군집행동 × HMM 레짐 연계 신뢰도 조정
   * Chang, Cheng & Khorana (2000) 군집행동 지표 + Hamilton (1989) HMM
   *
   * [GAP-4] CCK Bilateral + Continuous:
   *  - 3일 평균 CSAD로 단일일 노이즈 감소 (>= 3일 데이터 시, 미달 시 1일 폴백)
   *  - 하락장 군집 → 매수 패턴 감산 (기존)
   *  - 상승장 군집 → 매도(반전) 패턴 감산 (신규 bilateral)
   *  - HMM 고변동 레짐 → 매수 패턴 감산 (CSAD 미적용 시만)
   *
   * 근거:
   *  - 극단 군집 + 하락장(r_market<0): 패닉 매도 동조 → 매수 반전 오신호
   *  - 극단 군집 + 상승장(r_market>0): 유포리아 동조 → 매도 반전 오신호
   *  - HMM 고변동 레짐(bull_prob>0.7, σ=3.4x): 급반전 위험 상승
   *  조합 페널티 = 군집 ×0.76, HMM 고변동 ×0.75 (별도 조건 — 중복 불적용)
   *  clamp: 조정 후 confidence 최소 10
   */
  _applyHerdingAdjust(patterns) {
    if (typeof backtester === 'undefined' || !backtester._behavioralData) return;
    var bd = backtester._behavioralData;

    // [GAP-4] CSAD herding flag — 3일 평균으로 단일일 노이즈 감소
    // Chang, Cheng & Khorana (2000): CSAD 일별 변동성이 크므로 3일 이동 평균이 더 안정적
    var herdingFlag = 0, rMarket = 0;
    var csadDaily = (bd['csad_herding'] && bd['csad_herding'].daily) ? bd['csad_herding'].daily : [];
    if (csadDaily.length >= 3) {
      var hfSum = 0, rmSum = 0;
      for (var di = csadDaily.length - 3; di < csadDaily.length; di++) {
        hfSum += (csadDaily[di].herding_flag || 0);
        rmSum += (csadDaily[di].r_market || 0);
      }
      herdingFlag = hfSum / 3;
      rMarket = rmSum / 3;
    } else if (csadDaily.length > 0) {
      var lastCSAD = csadDaily[csadDaily.length - 1];
      herdingFlag = lastCSAD.herding_flag || 0;
      rMarket = lastCSAD.r_market || 0;
    }

    // HMM 고변동 레짐
    var hmmBullProb = 0;
    if (bd['hmm_regimes'] && bd['hmm_regimes'].daily && bd['hmm_regimes'].daily.length > 0) {
      var lastHMM = bd['hmm_regimes'].daily[bd['hmm_regimes'].daily.length - 1];
      hmmBullProb = lastHMM.bull_prob || 0;
    }

    for (var ci = 0; ci < patterns.length; ci++) {
      var p = patterns[ci];
      // 극단 군집 + 하락장 → 매수 패턴 신뢰도 ×0.76
      // 근거: KRX CSAD 실증, 극단 군집 하락일 매수 반전 성공률 -24%p (core_data/20 §3.4)
      // [GAP-4] 3일 평균: herdingFlag >= 1.67 (3일 중 2일 이상 flag=2 + 부분)
      if (p.signal === 'buy' && herdingFlag >= 1.67 && rMarket < 0) {
        p.confidence = Math.max(10, Math.round(p.confidence * 0.76));
        if (p.confidencePred != null) p.confidencePred = Math.max(10, Math.round(p.confidencePred * 0.76));
      }
      // [GAP-4] 극단 군집 + 상승장 → 매도(반전) 패턴 신뢰도 ×0.76
      // CCK Bilateral: 상승장 군집행동 시 역추세 매도 패턴도 과잉 동조에 의한 오신호 위험
      // bearishMarubozu 제외: 강한 방향성 지속 신호이므로 페널티 부적합
      else if (p.signal === 'sell' && herdingFlag >= 1.67 && rMarket > 0 && p.type !== 'bearishMarubozu') {
        p.confidence = Math.max(10, Math.round(p.confidence * 0.76));
        if (p.confidencePred != null) p.confidencePred = Math.max(10, Math.round(p.confidencePred * 0.76));
      }
      // [H-3 FIX] else if → CSAD 조건과 중복 적용 방지 (이중 페널티 ×0.57 해소)
      // HMM 고변동 레짐(bull_prob>0.7) → 매수 패턴 신뢰도 ×0.75 (CSAD 미적용 + marubozu 제외)
      // 근거: KRX HMM σ=3.4% 레짐에서 단기 반전 패턴 오신호 급증 (core_data/21 §2)
      // bullishMarubozu 제외: 고변동 레짐에서 강한 방향성 지속 신호이므로 페널티 부적합
      else if (p.signal === 'buy' && hmmBullProb > 0.7 && p.type !== 'bullishMarubozu') {
        p.confidence = Math.max(10, Math.round(p.confidence * 0.75));
        if (p.confidencePred != null) p.confidencePred = Math.max(10, Math.round(p.confidencePred * 0.75));
      }
    }
  }

  // ── 구조 변화점 근접 패턴 신뢰도 감산 — Page (1954), Bai-Perron (1998) ──
  // 최근 20봉 이내 CUSUM breakpoint → 레짐 전환 중 패턴 근거 불충분 → 감산
  _applyBreakpointAdjust(patterns, candles) {
    if (!candles || candles.length < 60 || typeof calcOnlineCUSUM !== 'function') return;
    var closes = candles.map(function(c) { return c.close; });
    var returns = [];
    for (var ri = 1; ri < closes.length; ri++) {
      if (closes[ri - 1] > 0 && closes[ri] > 0) {
        returns.push(Math.log(closes[ri] / closes[ri - 1]));
      } else {
        returns.push(0);
      }
    }
    var cusum = calcOnlineCUSUM(returns, 2.5);
    if (!cusum.isRecent || cusum.breakpoints.length === 0) return;
    var lastBP = cusum.breakpoints[cusum.breakpoints.length - 1];
    var barsSince = returns.length - 1 - lastBP.index;
    // 선형 회복: 0봉→×0.70, 30봉+→×1.0
    var discount = 0.70 + 0.30 * Math.min(1.0, barsSince / 30);
    for (var bi = 0; bi < patterns.length; bi++) {
      var p = patterns[bi];
      var pIdx = (p.endIndex != null ? p.endIndex : p.startIndex) || 0;
      // returns 인덱스는 candles 인덱스 - 1
      if (Math.abs((pIdx - 1) - lastBP.index) < 20) {
        p.confidence = Math.max(10, Math.round(p.confidence * discount));
        if (p.confidencePred != null) {
          p.confidencePred = Math.max(10, Math.round(p.confidencePred * discount));
        }
      }
    }
  }

  // ══════════════════════════════════════════════════
  //  적삼병 (Three White Soldiers) — 강한 매수
  // ══════════════════════════════════════════════════
  detectThreeWhiteSoldiers(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [], hurstWeight: hw = 1, meanRevWeight: mw = 1 } = ctx;
    for (let i = Math.max(2, ctx.detectFrom || 0); i < candles.length; i++) {
      const c0 = candles[i - 2], c1 = candles[i - 1], c2 = candles[i];
      if (c0.close <= c0.open || c1.close <= c1.open || c2.close <= c2.open) continue;
      if (c1.close <= c0.close || c2.close <= c1.close) continue;
      if (c1.open < c0.open || c1.open > c0.close) continue;
      if (c2.open < c1.open || c2.open > c1.close) continue;

      const a = this._atr(atr, i, candles);
      const b0 = c0.close - c0.open, b1 = c1.close - c1.open, b2 = c2.close - c2.open;
      const bodyMin = PatternEngine.THREE_SOLDIER_BODY_MIN;
      if (b0 < a * bodyMin || b1 < a * bodyMin || b2 < a * bodyMin) continue;

      const w0 = c0.high - c0.close, w1 = c1.high - c1.close, w2 = c2.high - c2.close;
      if (w0 > b0 * 0.5 || w1 > b1 * 0.5 || w2 > b2 * 0.5) continue;

      const bodyScore = Math.min((b0 + b1 + b2) / 3 / a, 1);
      const shadowScore = 1 - Math.min((w0 / b0 + w1 / b1 + w2 / b2) / 3, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trend = this._detectTrend(candles, i - 2, 10, a);
      if (trend.direction === 'up') continue;  // Nison: 반전 패턴이므로 상승추세에서는 무효
      const trendScore = trend.direction === 'down' ? Math.min(trend.strength, 1) : 0.3;
      // [Phase I-L0] extra: 연속 거래량 증가 — 3봉 연속 거래량 증가 시 신뢰도 상승 (Nison 거래량 원칙)
      // 연속 증가: 1.0, 2봉만 증가: 0.6, 1봉만 또는 불일치: 0.2
      const v0 = candles[i - 2].volume, v1 = candles[i - 1].volume, v2 = candles[i].volume;
      const volIncExtra = (v1 >= v0 && v2 >= v1) ? 1.0 : (v1 >= v0 || v2 >= v1) ? 0.6 : 0.2;
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: volIncExtra });
      const stopLoss = this._stopLoss(candles, i, 'buy', atr);
      const priceTarget = this._candleTarget(candles, i, 'buy', 'strong', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'threeWhiteSoldiers', name: '적삼병 (Three White Soldiers)', nameShort: '적삼병',
        signal: 'buy', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `3연속 양봉 상승 — 강한 매수 신호. 형태 점수 ${confidence}%`,
        startIndex: i - 2, endIndex: i,
        marker: { time: c2.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  흑삼병 (Three Black Crows) — 강한 매도
  // ══════════════════════════════════════════════════
  detectThreeBlackCrows(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [], hurstWeight: hw = 1, meanRevWeight: mw = 1 } = ctx;
    for (let i = Math.max(2, ctx.detectFrom || 0); i < candles.length; i++) {
      const c0 = candles[i - 2], c1 = candles[i - 1], c2 = candles[i];
      if (c0.close >= c0.open || c1.close >= c1.open || c2.close >= c2.open) continue;
      if (c1.close >= c0.close || c2.close >= c1.close) continue;
      if (c1.open > c0.open || c1.open < c0.close) continue;
      if (c2.open > c1.open || c2.open < c1.close) continue;

      const a = this._atr(atr, i, candles);
      const b0 = c0.open - c0.close, b1 = c1.open - c1.close, b2 = c2.open - c2.close;
      const bodyMin = PatternEngine.THREE_SOLDIER_BODY_MIN;
      if (b0 < a * bodyMin || b1 < a * bodyMin || b2 < a * bodyMin) continue;

      // Nison: "각 음봉의 아래꼬리가 짧아야 한다" — 적삼병 윗꼬리 검증의 대칭
      // 아래꼬리가 길면 해당 가격대에서 매수세 저항을 의미 → 하락 신뢰도 저하
      // [Fix-MED] bodyMin(=0.3, ATR 배수 상수)을 꼬리/몸통 비율에 재사용 → 0.5로 통일 (적삼병 윗꼬리 기준과 대칭)
      const ls0 = c0.close - c0.low, ls1 = c1.close - c1.low, ls2 = c2.close - c2.low;
      if (ls0 > b0 * 0.5 || ls1 > b1 * 0.5 || ls2 > b2 * 0.5) continue;

      const bodyScore = Math.min((b0 + b1 + b2) / 3 / a, 1);
      const shadowScore = 1 - Math.min((ls0 / b0 + ls1 / b1 + ls2 / b2) / 3, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trend = this._detectTrend(candles, i - 2, 10, a);
      if (trend.direction === 'down') continue;  // [Fix-HIGH] Nison: 반전 패턴 — 하락추세에서 무효 (적삼병 대칭)
      const trendScore = trend.direction === 'up' ? Math.min(trend.strength, 1) : 0.3;
      // [H-2 FIX] extra: 거래량 단계적 증가 (적삼병 volIncExtra 대칭)
      // Edwards & Magee: 하락 가속 음봉 시 거래량 증가 = 매도 확신
      const v0 = c0.volume, v1 = c1.volume, v2 = c2.volume;
      const volIncExtra = (v1 >= v0 && v2 >= v1) ? 1.0 : (v1 >= v0 || v2 >= v1) ? 0.6 : 0.2;
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: volIncExtra });
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._candleTarget(candles, i, 'sell', 'strong', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'threeBlackCrows', name: '흑삼병 (Three Black Crows)', nameShort: '흑삼병',
        signal: 'sell', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `3연속 음봉 하락 — 강한 매도 신호. 형태 점수 ${confidence}%`,
        startIndex: i - 2, endIndex: i,
        marker: { time: c2.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  해머 (Hammer) — 하락 추세 반전 매수
  // ══════════════════════════════════════════════════
  detectHammer(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(5, ctx.detectFrom || 0); i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      const lowerShadow = Math.min(c.open, c.close) - c.low;
      const upperShadow = c.high - Math.max(c.open, c.close);
      if (body > range * PatternEngine.MAX_BODY_RANGE_HAMMER) continue;  // Nison: body는 range의 1/3 이내
      if (lowerShadow < body * PatternEngine.SHADOW_BODY_MIN ||
          upperShadow > body * PatternEngine.COUNTER_SHADOW_MAX_STRICT ||
          body < range * PatternEngine.MIN_BODY_RANGE) continue;

      // 하락 추세 확인 (ATR 기반 정규화)
      const a = this._atr(atr, i, candles);
      const trend = this._detectTrend(candles, i, 10, a);
      if (trend.direction !== 'down') continue;

      const bodyScore = Math.min(body / a, 1);
      const shadowScore = Math.min(lowerShadow / range, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      // [Phase I-L0] extra: 거래량 급등 — 저가 반전 시 매수세 유입 확인 (Odean 1998)
      // vol/vma > 1.5 (surge threshold) → extra 1.0, vol/vma < 1 → extra 하락
      const volSurge = Math.min(this._volRatio(candles, i, vma) / 1.5, 1);
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: volSurge });
      const stopLoss = this._stopLoss(candles, i, 'buy', atr);
      const priceTarget = this._candleTarget(candles, i, 'buy', 'medium', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'hammer', name: '해머 (Hammer)', nameShort: '해머',
        signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `긴 아래꼬리 — 하락 반전 신호. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  역해머 (Inverted Hammer) — 하락 추세 반전 가능
  // ══════════════════════════════════════════════════
  detectInvertedHammer(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(5, ctx.detectFrom || 0); i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      const upperShadow = c.high - Math.max(c.open, c.close);
      const lowerShadow = Math.min(c.open, c.close) - c.low;
      if (body > range * PatternEngine.MAX_BODY_RANGE_HAMMER) continue;  // Nison: body는 range의 1/3 이내
      if (upperShadow < body * PatternEngine.SHADOW_BODY_MIN ||
          lowerShadow > body * PatternEngine.COUNTER_SHADOW_MAX_LOOSE ||
          body < range * PatternEngine.MIN_BODY_RANGE) continue;

      const a = this._atr(atr, i, candles);
      const trend = this._detectTrend(candles, i, 10, a);
      if (trend.direction !== 'down') continue;

      const bodyScore = Math.min(body / a, 1);
      const shadowScore = Math.min(upperShadow / range, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore });
      const stopLoss = this._stopLoss(candles, i, 'buy', atr);
      const priceTarget = this._candleTarget(candles, i, 'buy', 'weak', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'invertedHammer', name: '역해머 (Inverted Hammer)', nameShort: '역해머',
        signal: 'buy', strength: 'weak', confidence, stopLoss, priceTarget,  // Bulkowski: 승률 ~50%
        description: `긴 윗꼬리 — 하락 반전 가능 신호. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  교수형 (Hanging Man) — 상승 추세 반전 매도
  // ══════════════════════════════════════════════════
  detectHangingMan(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(5, ctx.detectFrom || 0); i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      const lowerShadow = Math.min(c.open, c.close) - c.low;
      const upperShadow = c.high - Math.max(c.open, c.close);
      if (body > range * PatternEngine.MAX_BODY_RANGE_HAMMER) continue;  // Nison: body는 range의 1/3 이내
      if (lowerShadow < body * PatternEngine.SHADOW_BODY_MIN ||
          upperShadow > body * PatternEngine.COUNTER_SHADOW_MAX_LOOSE ||
          body < range * PatternEngine.MIN_BODY_RANGE) continue;

      // 상승 추세 확인 (해머와 반대, ATR 기반 정규화)
      const a = this._atr(atr, i, candles);
      const trend = this._detectTrend(candles, i, 10, a);
      if (trend.direction !== 'up') continue;

      // [FIX] look-ahead bias 제거: candles[i+1] 미래 참조 삭제
      // Nison: 교수형은 확인 캔들(다음 봉 하락)로 신뢰도가 높아지나,
      // 실시간 감지 시 미래 데이터를 사용하면 백테스트 결과가 왜곡됨.
      // 확인 없이는 보수적으로 평가 (extra=0.15, strength='weak')
      const bodyScore = Math.min(body / a, 1);
      const shadowScore = Math.min(lowerShadow / range, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: 0.15 });
      const strength = 'weak';  // 확인 캔들 없이는 약한 신호 (look-ahead bias 방지)
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._candleTarget(candles, i, 'sell', 'weak', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'hangingMan', name: '교수형 (Hanging Man)', nameShort: '교수형',
        signal: 'sell', strength, confidence, stopLoss, priceTarget,
        description: `상승 후 긴 아래꼬리 — 하락 반전 경고 (확인 필요). 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  유성형 (Shooting Star) — 상승 추세 반전 매도
  // ══════════════════════════════════════════════════
  detectShootingStar(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(5, ctx.detectFrom || 0); i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      const upperShadow = c.high - Math.max(c.open, c.close);
      const lowerShadow = Math.min(c.open, c.close) - c.low;
      if (body > range * PatternEngine.MAX_BODY_RANGE_HAMMER) continue;  // Nison: body는 range의 1/3 이내
      if (upperShadow < body * PatternEngine.SHADOW_BODY_MIN ||
          lowerShadow > body * PatternEngine.COUNTER_SHADOW_MAX_LOOSE ||
          body < range * PatternEngine.MIN_BODY_RANGE) continue;

      // 상승 추세 확인 (역해머와 반대, ATR 기반 정규화)
      const a = this._atr(atr, i, candles);
      const trend = this._detectTrend(candles, i, 10, a);
      if (trend.direction !== 'up') continue;

      const bodyScore = Math.min(body / a, 1);
      const shadowScore = Math.min(upperShadow / range, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      // [H-2 FIX] extra: 거래량 급증 (해머 volSurge 대칭) — Morris: 고점 반전은 거래량 증가로 확인
      const volSurge = Math.min(this._volRatio(candles, i, vma) / 1.5, 1);
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: volSurge });
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._candleTarget(candles, i, 'sell', 'medium', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'shootingStar', name: '유성형 (Shooting Star)', nameShort: '유성형',
        signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `상승 후 긴 윗꼬리 — 하락 반전 경고. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  도지 (Doji) — 추세 전환 가능
  // ══════════════════════════════════════════════════
  detectDoji(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(1, ctx.detectFrom || 0); i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;
      if (body > range * PatternEngine.DOJI_BODY_RATIO) continue;

      const a = this._atr(atr, i, candles);
      if (range < a * PatternEngine.MIN_RANGE_ATR) continue;

      // 추세 맥락으로 신호 방향 결정 (ATR 기반 정규화)
      const trend = this._detectTrend(candles, i, 10, a);
      const signal = trend.direction === 'up' ? 'sell' : trend.direction === 'down' ? 'buy' : 'neutral';
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = trend.direction !== 'neutral' ? Math.min(trend.strength, 1) : 0.3;
      const shadowScore = Math.min(range / a, 1);
      // [FIX] Doji 품질: 저변동성 도지 패널티 제거 — 도지 품질은 꼬리/추세 점수가 결정
      // 천장/바닥의 작은 range 도지가 유효한 반전 신호이므로 감산하면 안됨
      const confidence = Math.round(this._quality({ body: 0.5, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: 0.5 }));

      results.push({
        type: 'doji', name: '도지 (Doji)', nameShort: '도지',
        signal, strength: 'weak', confidence,
        stopLoss: signal !== 'neutral' ? this._stopLoss(candles, i, signal, atr) : null,
        priceTarget: signal !== 'neutral' ? this._candleTarget(candles, i, signal, 'weak', atr, ctx.hurstWeight, ctx.meanRevWeight) : null,
        description: `시가 ≈ 종가 — 추세 전환 가능. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'aboveBar', color: KRX_COLORS.PTN_NEUTRAL, shape: 'circle', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  장악형 (Engulfing) — 강한 반전
  // ══════════════════════════════════════════════════
  detectEngulfing(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(1, ctx.detectFrom || 0); i < candles.length; i++) {
      const prev = candles[i - 1], curr = candles[i];
      const prevBody = Math.abs(prev.close - prev.open);
      const currBody = Math.abs(curr.close - curr.open);
      const a = this._atr(atr, i, candles);
      if (prevBody < a * PatternEngine.ENGULF_PREV_BODY_MIN ||
          currBody < a * PatternEngine.ENGULF_CURR_BODY_MIN) continue;

      // Bulkowski: 장악 봉의 body가 이전 봉 body보다 유의미하게 커야 유효
      // KRX 가격제한폭(30%) 고려하여 1.2배로 설정 (국제 기준 1.3배보다 보수적)
      if (currBody < prevBody * PatternEngine.ENGULF_BODY_MULT) continue;

      const trend = this._detectTrend(candles, i - 1, 10, a);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const bodyScore = Math.min(currBody / a, 1);

      // 상승 장악형
      if (prev.close < prev.open && curr.close > curr.open) {
        if (curr.open <= prev.close && curr.close >= prev.open) {
          if (trend.direction === 'up') continue;  // [Fix-MED] 상승 추세에서 상승 반전 불필요 — 반전 패턴 원칙
          const trendScore = trend.direction === 'down' ? Math.min(trend.strength, 1) : 0.3;
          // [Phase I-L0] extra: 장악 비율 초과분 — ENGULF_BODY_MULT(1.2) 이상 얼마나 더 큰지
          // currBody = prevBody * 1.2 → extra 0, currBody = prevBody * 3.2 → extra 1.0
          const engulfExtra = Math.max(0, Math.min((currBody / prevBody - PatternEngine.ENGULF_BODY_MULT) / 2, 1));
          let confidence = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore, extra: engulfExtra });
          // [ACC] 거래량 확인: 장악 봉의 거래량이 이전 봉 대비 1.2배 이상이면 +10%
          // Cap at 90: system-wide confidence ceiling (Taleb 2007 — overconfidence bias)
          if (curr.volume > prev.volume * 1.2) confidence = Math.min(confidence + 10, 90);
          results.push({
            type: 'bullishEngulfing', name: '상승장악형 (Bullish Engulfing)', nameShort: '상승장악',
            signal: 'buy', strength: 'strong', confidence,
            stopLoss: this._stopLoss(candles, i, 'buy', atr),
            priceTarget: this._candleTarget(candles, i, 'buy', 'strong', atr, ctx.hurstWeight, ctx.meanRevWeight),
            description: `양봉이 음봉을 감싸 — 강한 상승 반전. 형태 점수 ${confidence}%`,
            startIndex: i - 1, endIndex: i,
            marker: { time: curr.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
          });
        }
      }

      // 하락 장악형
      if (prev.close > prev.open && curr.close < curr.open) {
        if (curr.open >= prev.close && curr.close <= prev.open) {
          if (trend.direction === 'down') continue;  // [Fix-MED] 하락 추세에서 하락 반전 불필요 — 반전 패턴 원칙
          const trendScore = trend.direction === 'up' ? Math.min(trend.strength, 1) : 0.3;
          // [H-1 FIX] extra: 장악 비율 초과분 (상승장악형 engulfExtra 대칭)
          // currBody = prevBody * 1.2 → extra 0, currBody = prevBody * 3.2 → extra 1.0
          const engulfExtra = Math.max(0, Math.min((currBody / prevBody - PatternEngine.ENGULF_BODY_MULT) / 2, 1));
          let confidence = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore, extra: engulfExtra });
          // [ACC] 거래량 확인: 장악 봉의 거래량이 이전 봉 대비 1.2배 이상이면 +10%
          // Cap at 90: system-wide confidence ceiling (Taleb 2007 — overconfidence bias)
          if (curr.volume > prev.volume * 1.2) confidence = Math.min(confidence + 10, 90);
          results.push({
            type: 'bearishEngulfing', name: '하락장악형 (Bearish Engulfing)', nameShort: '하락장악',
            signal: 'sell', strength: 'strong', confidence,
            stopLoss: this._stopLoss(candles, i, 'sell', atr),
            priceTarget: this._candleTarget(candles, i, 'sell', 'strong', atr, ctx.hurstWeight, ctx.meanRevWeight),
            description: `음봉이 양봉을 감싸 — 강한 하락 반전. 형태 점수 ${confidence}%`,
            startIndex: i - 1, endIndex: i,
            marker: { time: curr.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
          });
        }
      }
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  잉태형 (Harami) — 반전 가능
  // ══════════════════════════════════════════════════
  detectHarami(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(1, ctx.detectFrom || 0); i < candles.length; i++) {
      const prev = candles[i - 1], curr = candles[i];
      const prevBody = Math.abs(prev.close - prev.open);
      const currBody = Math.abs(curr.close - curr.open);
      const a = this._atr(atr, i, candles);
      if (prevBody < a * PatternEngine.HARAMI_PREV_BODY_MIN ||
          currBody > prevBody * PatternEngine.HARAMI_CURR_BODY_MAX) continue;
      if (currBody < a * PatternEngine.HARAMI_CURR_BODY_MIN) continue;

      const trend = this._detectTrend(candles, i - 1, 10, a);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);

      // 상승 잉태형 (하락 추세 → 큰 음봉 → 작은 양봉 내포)
      if (prev.close < prev.open && curr.close > curr.open) {
        if (curr.open > prev.close && curr.close < prev.open) {
          const trendScore = trend.direction === 'down' ? Math.min(trend.strength, 1) : 0.2;
          const bodyScore = Math.min(1 - currBody / prevBody, 1);
          // [FIX] look-ahead bias 제거: candles[i+1] 미래 참조 삭제
          // 잉태형은 본질적으로 미확인 패턴 — 항상 보수적으로 평가 (20% 감산 적용)
          let quality = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore });
          quality = Math.round(quality * 0.8);  // 미확인 상태가 기본 (look-ahead bias 방지)
          results.push({
            type: 'bullishHarami', name: '상승잉태형 (Bullish Harami)', nameShort: '상승잉태',
            signal: 'buy', strength: 'medium', confidence: quality,
            stopLoss: this._stopLoss(candles, i, 'buy', atr),
            priceTarget: this._candleTarget(candles, i, 'buy', 'medium', atr, ctx.hurstWeight, ctx.meanRevWeight),
            description: `작은 양봉이 음봉 내에 — 반전 가능 (확인 필요). 형태 점수 ${quality}%`,
            startIndex: i - 1, endIndex: i,
            marker: { time: curr.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
          });
        }
      }

      // 하락 잉태형 (상승 추세 → 큰 양봉 → 작은 음봉 내포)
      if (prev.close > prev.open && curr.close < curr.open) {
        if (curr.open < prev.close && curr.close > prev.open) {
          const trendScore = trend.direction === 'up' ? Math.min(trend.strength, 1) : 0.2;
          const bodyScore = Math.min(1 - currBody / prevBody, 1);
          // [FIX] look-ahead bias 제거: candles[i+1] 미래 참조 삭제
          // 잉태형은 본질적으로 미확인 패턴 — 항상 보수적으로 평가 (20% 감산 적용)
          let quality = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore });
          quality = Math.round(quality * 0.8);  // 미확인 상태가 기본 (look-ahead bias 방지)
          results.push({
            type: 'bearishHarami', name: '하락잉태형 (Bearish Harami)', nameShort: '하락잉태',
            signal: 'sell', strength: 'medium', confidence: quality,
            stopLoss: this._stopLoss(candles, i, 'sell', atr),
            priceTarget: this._candleTarget(candles, i, 'sell', 'medium', atr, ctx.hurstWeight, ctx.meanRevWeight),
            description: `작은 음봉이 양봉 내에 — 반전 가능 (확인 필요). 형태 점수 ${quality}%`,
            startIndex: i - 1, endIndex: i,
            marker: { time: curr.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
          });
        }
      }
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  샛별형 (Morning Star) — 바닥 반전
  // ══════════════════════════════════════════════════
  detectMorningStar(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(2, ctx.detectFrom || 0); i < candles.length; i++) {
      const c0 = candles[i - 2], c1 = candles[i - 1], c2 = candles[i];
      const a = this._atr(atr, i, candles);

      // Nison (1991): 1봉은 반드시 긴 음봉, 3봉은 반드시 긴 양봉
      if (c0.close >= c0.open) continue;   // 1봉 음봉 확인 (Bug fix)
      if (c2.close <= c2.open) continue;   // 3봉 양봉 확인

      const body0 = c0.open - c0.close;    // 음봉이므로 양수
      const body1 = Math.abs(c1.close - c1.open);
      const body2 = c2.close - c2.open;    // 양봉이므로 양수

      if (body0 < a * PatternEngine.STAR_END_BODY_MIN) continue;   // 1봉: 유의미한 크기
      if (body1 > a * PatternEngine.STAR_BODY_MAX) continue;     // 2봉: 작은 몸통 (별)
      if (body2 < a * PatternEngine.STAR_END_BODY_MIN) continue; // 3봉: 유의미한 크기
      // [T-2] 갭 조건 강화 OR→AND — Nison (1991): 2봉 body 전체가 1봉 close 이하
      // KRX 5년 실증: 과관대 갭으로 WR 40.5%, AND 적용 시 46-48% 기대
      if (c1.close > c0.close || c1.open > c0.close) continue;  // 2봉 갭다운 확인 (AND)

      // Nison: "3봉 종가가 1봉 몸통의 50% 이상 회복해야"
      const c0Mid = c0.close + body0 * 0.5;
      if (c2.close < c0Mid) continue;

      const trend = this._detectTrend(candles, i - 2, 10, a);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const bodyScore = Math.min((body0 + body2) / 2 / a, 1);
      const trendScore = trend.direction === 'down' ? Math.min(trend.strength, 1) : 0.2;
      const starScore = 1 - Math.min(body1 / a, 1);
      // [Phase I-L0] extra: 3봉 회복 깊이 — 50% 이상 회복한 정도 (Nison: 더 깊은 회복=신뢰도 상승)
      // c0Mid 기준 초과분 / (body0 * 0.5): 0=정확히 50%, 1=100% 회복 (c2.close=c0.open)
      const recoveryDepth = Math.min((c2.close - c0Mid) / Math.max(body0 * 0.5, 1), 1);
      const confidence = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore, shadow: starScore, extra: recoveryDepth });
      const stopLoss = this._stopLoss(candles, i, 'buy', atr);
      const priceTarget = this._candleTarget(candles, i, 'buy', 'strong', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'morningStar', name: '샛별형 (Morning Star)', nameShort: '샛별형',
        signal: 'buy', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `음봉 → 소형봉 → 양봉 — 3봉 바닥 반전. 형태 점수 ${confidence}%`,
        startIndex: i - 2, endIndex: i,
        marker: { time: c2.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  석별형 (Evening Star) — 천장 반전
  // ══════════════════════════════════════════════════
  detectEveningStar(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(2, ctx.detectFrom || 0); i < candles.length; i++) {
      const c0 = candles[i - 2], c1 = candles[i - 1], c2 = candles[i];
      const a = this._atr(atr, i, candles);

      // Nison (1991): 1봉은 반드시 긴 양봉, 3봉은 반드시 긴 음봉
      if (c0.close <= c0.open) continue;   // 1봉 양봉 확인 (Bug fix)
      if (c2.close >= c2.open) continue;   // 3봉 음봉 확인

      const body0 = c0.close - c0.open;    // 양봉이므로 양수
      const body1 = Math.abs(c1.close - c1.open);
      const body2 = c2.open - c2.close;    // 음봉이므로 양수

      if (body0 < a * PatternEngine.STAR_END_BODY_MIN) continue;   // 1봉: 유의미한 크기
      if (body1 > a * PatternEngine.STAR_BODY_MAX) continue;     // 2봉: 작은 몸통 (별)
      if (body2 < a * PatternEngine.STAR_END_BODY_MIN) continue; // 3봉: 유의미한 크기
      // [T-3] 갭 조건 강화 OR→AND — Nison (1991): 2봉 body 전체가 1봉 close 이상
      if (c1.close < c0.close || c1.open < c0.close) continue;  // 2봉 갭업 확인 (AND)

      // Nison: "3봉 종가가 1봉 몸통의 50% 이하로 하락해야"
      const c0Mid = c0.open + body0 * 0.5;
      if (c2.close > c0Mid) continue;

      const trend = this._detectTrend(candles, i - 2, 10, a);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const bodyScore = Math.min((body0 + body2) / 2 / a, 1);
      const trendScore = trend.direction === 'up' ? Math.min(trend.strength, 1) : 0.2;
      const starScore = 1 - Math.min(body1 / a, 1);
      // [H-2 FIX] extra: 3봉 하락 침투 깊이 (샛별형 recoveryDepth 대칭)
      // Nison: 3봉이 1봉 몸통 중간 이하로 더 많이 하락할수록 반전 신뢰도 상승
      // c0Mid 기준 하락분 / (body0 * 0.5): 0=정확히 50%, 1=100% 침투(c2.close=c0.open)
      const penetrationDepth = Math.min((c0Mid - c2.close) / Math.max(body0 * 0.5, 1), 1);
      const confidence = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore, shadow: starScore, extra: penetrationDepth });
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._candleTarget(candles, i, 'sell', 'strong', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'eveningStar', name: '석별형 (Evening Star)', nameShort: '석별형',
        signal: 'sell', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `양봉 → 소형봉 → 음봉 — 3봉 천장 반전. 형태 점수 ${confidence}%`,
        startIndex: i - 2, endIndex: i,
        marker: { time: c2.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  관통형 (Piercing Line) — 하락 후 강세 반전
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 전일 강한 하락 후, 당일 갭다운 시가에서 매수세가 유입되어
  //  전일 음봉 몸통의 50% 이상을 회복하며 마감. 매도 세력의 약화와
  //  저가 매수 세력의 등장을 의미 (Nison, 1991; Bulkowski 승률 ~64%).
  //
  detectPiercingLine(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(5, ctx.detectFrom || 0); i < candles.length; i++) {
      const prev = candles[i - 1], curr = candles[i];

      // 전봉: 음봉 (하락)
      if (prev.close >= prev.open) continue;
      // 현봉: 양봉 (상승)
      if (curr.close <= curr.open) continue;

      const prevBody = prev.open - prev.close;  // 음봉이므로 양수
      const currBody = curr.close - curr.open;   // 양봉이므로 양수
      const a = this._atr(atr, i, candles);

      // ATR 정규화: 두 봉 모두 유의미한 크기
      if (prevBody < a * PatternEngine.PIERCING_BODY_MIN ||
          currBody < a * PatternEngine.PIERCING_BODY_MIN) continue;

      // 현봉 시가가 전봉 종가(저가 쪽) 이하에서 시작 (갭다운 또는 동일 수준)
      if (curr.open > prev.close) continue;

      // 현봉 종가가 전봉 몸통의 50% 이상 회복
      const prevMid = prev.close + prevBody * 0.5;
      if (curr.close < prevMid) continue;

      // 현봉 종가가 전봉 시가(고가 쪽)를 넘지 않아야 (넘으면 장악형)
      if (curr.close >= prev.open) continue;

      // 하락 추세 확인 — 하락 추세에서만 반전 의미 (ATR 기반 정규화)
      const trend = this._detectTrend(candles, i - 1, 10, a);
      if (trend.direction !== 'down') continue;

      // 품질 점수 산출
      const penetration = (curr.close - prev.close) / prevBody; // 관통 비율 (0.5~1.0)
      const bodyScore = Math.min((prevBody + currBody) / 2 / a, 1);
      const shadowScore = Math.min(penetration, 1);  // 관통 깊이가 깊을수록 신뢰
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      // [Phase I-L0] extra: 반전봉 거래량 우세 — 관통 봉 거래량 > 전봉 거래량 시 매수 유입 확인
      // curr.volume / prev.volume / 1.5: ratio 1.5x → extra 1.0 (강한 매수 유입)
      const volConfirm = (prev.volume > 0) ? Math.min(curr.volume / prev.volume / 1.5, 1) : 0.3;
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: volConfirm });
      const stopLoss = this._stopLoss(candles, i, 'buy', atr);
      const priceTarget = this._candleTarget(candles, i, 'buy', 'medium', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'piercingLine', name: '관통형 (Piercing Line)', nameShort: '관통형',
        signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `갭다운 후 전봉 50% 이상 회복 — 강세 반전 신호. 형태 점수 ${confidence}%`,
        startIndex: i - 1, endIndex: i,
        marker: { time: curr.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  먹구름형 (Dark Cloud Cover) — 상승 후 약세 반전
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 전일 강한 상승 후, 당일 갭업 시가에서 매도세가 등장하여
  //  전일 양봉 몸통의 50% 이하로 하락 마감. 매수 세력의 소진과
  //  차익 실현 또는 신규 매도의 등장을 의미 (Nison, 1991; Bulkowski 승률 ~60%).
  //  관통형의 약세 대칭 패턴.
  //
  detectDarkCloud(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(5, ctx.detectFrom || 0); i < candles.length; i++) {
      const prev = candles[i - 1], curr = candles[i];

      // 전봉: 양봉 (상승)
      if (prev.close <= prev.open) continue;
      // 현봉: 음봉 (하락)
      if (curr.close >= curr.open) continue;

      const prevBody = prev.close - prev.open;  // 양봉이므로 양수
      const currBody = curr.open - curr.close;   // 음봉이므로 양수
      const a = this._atr(atr, i, candles);

      // ATR 정규화: 두 봉 모두 유의미한 크기
      if (prevBody < a * PatternEngine.PIERCING_BODY_MIN ||
          currBody < a * PatternEngine.PIERCING_BODY_MIN) continue;

      // 현봉 시가가 전봉 종가(고가 쪽) 이상에서 시작 (갭업 또는 동일 수준)
      if (curr.open < prev.close) continue;

      // 현봉 종가가 전봉 몸통의 50% 이하로 하락
      const prevMid = prev.open + prevBody * 0.5;
      if (curr.close > prevMid) continue;

      // 현봉 종가가 전봉 시가(저가 쪽)를 넘지 않아야 (넘으면 장악형)
      if (curr.close <= prev.open) continue;

      // 상승 추세 확인 — 상승 추세에서만 반전 의미 (ATR 기반 정규화)
      const trend = this._detectTrend(candles, i - 1, 10, a);
      if (trend.direction !== 'up') continue;

      // 품질 점수 산출
      const penetration = (prev.close - curr.close) / prevBody; // 관통 비율 (0.5~1.0)
      const bodyScore = Math.min((prevBody + currBody) / 2 / a, 1);
      const shadowScore = Math.min(penetration, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      // [H-2 FIX] extra: 거래량 확인 (관통형 volConfirm 대칭)
      // Nison/Edwards: 먹구름형은 현봉 거래량이 전봉 대비 증가해야 신뢰도 높음
      const volConfirm = (prev.volume > 0) ? Math.min(curr.volume / prev.volume / 1.5, 1) : 0.3;
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: volConfirm });
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._candleTarget(candles, i, 'sell', 'medium', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'darkCloud', name: '먹구름형 (Dark Cloud Cover)', nameShort: '먹구름',
        signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `갭업 후 전봉 50% 이하 하락 — 약세 반전 신호. 형태 점수 ${confidence}%`,
        startIndex: i - 1, endIndex: i,
        marker: { time: curr.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  잠자리 도지 (Dragonfly Doji) — 하락 반전 강세
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 장중 큰 폭으로 하락했으나 매수세가 강하게 유입되어
  //  시가 근처까지 회복. T자 형태. 하락 추세 바닥에서 나타나면
  //  강력한 반전 신호 (Nison: "dragonfly doji is more bullish than
  //  a regular doji at a market bottom"). 해머보다 더 극단적인 형태.
  //
  detectDragonflyDoji(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(5, ctx.detectFrom || 0); i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      // 도지 조건: body가 range의 5% 이하 (Nison 표준)
      if (body > range * PatternEngine.DOJI_BODY_RATIO) continue;

      const lowerShadow = Math.min(c.open, c.close) - c.low;
      const upperShadow = c.high - Math.max(c.open, c.close);

      // 잠자리 도지: 하단 그림자가 range의 70% 이상, 상단 그림자 거의 없음
      if (lowerShadow < range * PatternEngine.SPECIAL_DOJI_SHADOW_MIN) continue;
      if (upperShadow > range * PatternEngine.SPECIAL_DOJI_COUNTER_MAX) continue;

      const a = this._atr(atr, i, candles);
      // 유의미한 범위 확인
      if (range < a * PatternEngine.MIN_RANGE_ATR) continue;

      // 하락 추세에서 발생 시 강세 반전 (상승 추세에서는 무시, ATR 기반 정규화)
      const trend = this._detectTrend(candles, i, 10, a);
      if (trend.direction !== 'down') continue;

      const shadowScore = Math.min(lowerShadow / range, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const rangeScore = Math.min(range / a, 1);
      const confidence = this._quality({ body: 0.6, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: rangeScore });
      const stopLoss = this._stopLoss(candles, i, 'buy', atr);
      const priceTarget = this._candleTarget(candles, i, 'buy', 'medium', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'dragonflyDoji', name: '잠자리 도지 (Dragonfly Doji)', nameShort: '잠자리도지',
        signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `긴 하단꼬리 T형 도지 — 바닥 반전 신호. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  비석 도지 (Gravestone Doji) — 상승 반전 약세
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 장중 큰 폭으로 상승했으나 매도세에 밀려 시가 근처까지
  //  하락. 역T자(⊥) 형태. 상승 추세 천장에서 나타나면 강력한
  //  반전 신호 (Nison: "gravestone doji at a top is a bearish signal").
  //  유성형보다 더 극단적인 형태.
  //
  detectGravestoneDoji(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(5, ctx.detectFrom || 0); i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      // 도지 조건: body가 range의 5% 이하 (Nison 표준)
      if (body > range * PatternEngine.DOJI_BODY_RATIO) continue;

      const upperShadow = c.high - Math.max(c.open, c.close);
      const lowerShadow = Math.min(c.open, c.close) - c.low;

      // 비석 도지: 상단 그림자가 range의 70% 이상, 하단 그림자 거의 없음
      if (upperShadow < range * PatternEngine.SPECIAL_DOJI_SHADOW_MIN) continue;
      if (lowerShadow > range * PatternEngine.SPECIAL_DOJI_COUNTER_MAX) continue;

      const a = this._atr(atr, i, candles);
      // 유의미한 범위 확인
      if (range < a * PatternEngine.MIN_RANGE_ATR) continue;

      // 상승 추세에서 발생 시 약세 반전 (하락 추세에서는 무시, ATR 기반 정규화)
      const trend = this._detectTrend(candles, i, 10, a);
      if (trend.direction !== 'up') continue;

      const shadowScore = Math.min(upperShadow / range, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const rangeScore = Math.min(range / a, 1);
      const confidence = this._quality({ body: 0.6, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: rangeScore });
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._candleTarget(candles, i, 'sell', 'medium', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'gravestoneDoji', name: '비석 도지 (Gravestone Doji)', nameShort: '비석도지',
        signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `긴 상단꼬리 역T형 도지 — 천장 반전 신호. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  족집게 바닥 (Tweezer Bottom) — 강세 반전
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 2일 연속 동일 저가 수준에서 지지를 받음. 첫째 날 음봉으로
  //  하락했지만 둘째 날 같은 가격대에서 반등하며 양봉으로 마감.
  //  동일 가격대의 반복 지지는 해당 수준이 강력한 수요 영역임을 시사
  //  (Nison, 1991; Bulkowski: tweezer 바닥의 반전 성공률 ~57%).
  //
  detectTweezerBottom(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(5, ctx.detectFrom || 0); i < candles.length; i++) {
      const prev = candles[i - 1], curr = candles[i];

      // 전봉: 음봉 (하락), 현봉: 양봉 (상승)
      if (prev.close >= prev.open) continue;
      if (curr.close <= curr.open) continue;

      const a = this._atr(atr, i, candles);

      // 두 봉 모두 유의미한 크기
      const prevBody = prev.open - prev.close;
      const currBody = curr.close - curr.open;
      if (prevBody < a * PatternEngine.TWEEZER_BODY_MIN ||
          currBody < a * PatternEngine.TWEEZER_BODY_MIN) continue;

      // 두 봉의 저가가 거의 동일 (ATR * 0.1 이내)
      const lowDiff = Math.abs(prev.low - curr.low);
      if (lowDiff > a * PatternEngine.TWEEZER_TOLERANCE) continue;

      // 하락 추세 확인 (ATR 기반 정규화)
      const trend = this._detectTrend(candles, i - 1, 10, a);
      if (trend.direction !== 'down') continue;

      // 품질 점수
      const matchScore = 1 - Math.min(lowDiff / (a * PatternEngine.TWEEZER_TOLERANCE), 1); // 저가 일치도
      const bodyScore = Math.min((prevBody + currBody) / 2 / a, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      // [Phase I-L0] extra: 반전봉 우세도 — 2봉 중 반전 양봉(currBody)이 클수록 신뢰 상승 (Nison)
      // currBody / (prevBody + currBody): 0.5=동등, 1.0=반전봉이 전봉 압도
      const reversalDominance = Math.min(currBody / Math.max(prevBody + currBody, 1), 1);
      const confidence = this._quality({ body: bodyScore, shadow: matchScore, volume: volumeScore, trend: trendScore, extra: reversalDominance });
      const stopLoss = +(Math.min(prev.low, curr.low) - a).toFixed(0);
      const priceTarget = this._candleTarget(candles, i, 'buy', 'medium', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'tweezerBottom', name: '족집게 바닥 (Tweezer Bottom)', nameShort: '족집게바닥',
        signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `동일 저가 반복 지지 — 바닥 반전 신호. 형태 점수 ${confidence}%`,
        startIndex: i - 1, endIndex: i,
        marker: { time: curr.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  족집게 천장 (Tweezer Top) — 약세 반전
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 2일 연속 동일 고가 수준에서 저항을 받음. 첫째 날 양봉으로
  //  상승했지만 둘째 날 같은 가격대에서 매도 압력을 받아 음봉으로 마감.
  //  동일 가격대의 반복 저항은 해당 수준이 강력한 공급 영역임을 시사.
  //  족집게 바닥의 약세 대칭 패턴 (Nison, 1991).
  //
  detectTweezerTop(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(5, ctx.detectFrom || 0); i < candles.length; i++) {
      const prev = candles[i - 1], curr = candles[i];

      // 전봉: 양봉 (상승), 현봉: 음봉 (하락)
      if (prev.close <= prev.open) continue;
      if (curr.close >= curr.open) continue;

      const a = this._atr(atr, i, candles);

      // 두 봉 모두 유의미한 크기
      const prevBody = prev.close - prev.open;
      const currBody = curr.open - curr.close;
      if (prevBody < a * PatternEngine.TWEEZER_BODY_MIN ||
          currBody < a * PatternEngine.TWEEZER_BODY_MIN) continue;

      // 두 봉의 고가가 거의 동일 (ATR * 0.1 이내)
      const highDiff = Math.abs(prev.high - curr.high);
      if (highDiff > a * PatternEngine.TWEEZER_TOLERANCE) continue;

      // 상승 추세 확인 (ATR 기반 정규화)
      const trend = this._detectTrend(candles, i - 1, 10, a);
      if (trend.direction !== 'up') continue;

      // 품질 점수
      const matchScore = 1 - Math.min(highDiff / (a * PatternEngine.TWEEZER_TOLERANCE), 1); // 고가 일치도
      const bodyScore = Math.min((prevBody + currBody) / 2 / a, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      // [H-2 FIX] extra: 반전봉 우세도 (족집게바닥 reversalDominance 대칭)
      // Nison: 2봉 중 반전 음봉(currBody)이 클수록 매도 압력 신뢰 상승
      const reversalDominance = Math.min(currBody / Math.max(prevBody + currBody, 1), 1);
      const confidence = this._quality({ body: bodyScore, shadow: matchScore, volume: volumeScore, trend: trendScore, extra: reversalDominance });
      const stopLoss = +(Math.max(prev.high, curr.high) + a).toFixed(0);
      const priceTarget = this._candleTarget(candles, i, 'sell', 'medium', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'tweezerTop', name: '족집게 천장 (Tweezer Top)', nameShort: '족집게천장',
        signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
        description: `동일 고가 반복 저항 — 천장 반전 신호. 형태 점수 ${confidence}%`,
        startIndex: i - 1, endIndex: i,
        marker: { time: curr.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  마루보주 (Marubozu) — 강한 추세 지속
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 시가부터 종가까지 한 방향으로만 움직여 꼬리가
  //  거의 없는 봉. 매수(양봉) 또는 매도(음봉) 압력이 장 전체를
  //  지배했음을 의미. Nison(1991): "Marubozu represents one of
  //  the strongest single-candle continuation signals."
  //
  //  Bulkowski 통계:
  //    양봉 마루보주: 상승 지속 확률 ~72%
  //    음봉 마루보주: 하락 지속 확률 ~71%
  //

  detectMarubozu(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(1, ctx.detectFrom || 0); i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      // 마루보주 핵심 조건: body가 range의 85% 이상, 양끝 꼬리 각각 body의 2% 이하
      if (body < range * PatternEngine.MARUBOZU_BODY_RATIO) continue;

      const upperShadow = c.high - Math.max(c.open, c.close);
      const lowerShadow = Math.min(c.open, c.close) - c.low;
      if (upperShadow > body * PatternEngine.MARUBOZU_SHADOW_MAX) continue;
      if (lowerShadow > body * PatternEngine.MARUBOZU_SHADOW_MAX) continue;

      const a = this._atr(atr, i, candles);
      // ATR 대비 유의미한 크기인지 확인 (MIN_RANGE_ATR 재활용)
      if (range < a * PatternEngine.MIN_RANGE_ATR) continue;

      const isBullish = c.close > c.open;
      const signal = isBullish ? 'buy' : 'sell';
      const type = isBullish ? 'bullishMarubozu' : 'bearishMarubozu';

      // 추세 맥락 (ATR 기반 정규화) — Nison (1991): 마루보주는 추세 지속 신호
      // [T-1] 추세 필터: bullish는 down/neutral에서만, bearish는 up/neutral에서만 유의
      // KRX 5년 실증: 무차별 WR 41.8% → 추세 필터 적용 시 51-53% 기대
      const trend = this._detectTrend(candles, i, 10, a);
      if (isBullish && trend.direction === 'up' && trend.strength > 0.5) continue;
      if (!isBullish && trend.direction === 'down' && trend.strength > 0.5) continue;

      // 품질 점수 산출
      const bodyScore = Math.min(body / a, 1);
      const shadowScore = 1 - Math.min((upperShadow + lowerShadow) / range, 1); // 꼬리 없을수록 높음
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      // 추세 일치 시 높은 점수, 반대 시 보수적
      const trendScore = (isBullish && trend.direction === 'up') || (!isBullish && trend.direction === 'down')
        ? Math.min(trend.strength, 1) : 0.3;

      // [Phase I-L0] extra: 마루보주 순도 — body/range가 0.85 초과 얼마나 순수한지
      // 0.85=최소 (extra 0), 1.0=완전 마루보주 (extra 1.0)
      const purity = Math.min((body / range - PatternEngine.MARUBOZU_BODY_RATIO) / Math.max(1 - PatternEngine.MARUBOZU_BODY_RATIO, 0.001), 1);
      let confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore, extra: purity });
      // [ACC] 거래량 확인: 전일 대비 1.2배 이상이면 +10% (Nison 거래량 원칙)
      // Cap at 90: system-wide confidence ceiling (Taleb 2007 — overconfidence bias)
      if (i > 0 && c.volume > candles[i - 1].volume * 1.2) confidence = Math.min(confidence + 10, 90);

      // 손절가/목표가: body 높이 기반 (마루보주는 body ≈ range)
      const stopLoss = isBullish
        ? +(c.low - a * 1.5).toFixed(0)
        : +(c.high + a * 1.5).toFixed(0);
      const priceTarget = this._candleTarget(candles, i, signal, 'strong', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type, name: isBullish ? '양봉 마루보주 (Bullish Marubozu)' : '음봉 마루보주 (Bearish Marubozu)',
        nameShort: isBullish ? '양봉마루보주' : '음봉마루보주',
        signal, strength: 'strong', confidence, stopLoss, priceTarget,
        description: isBullish
          ? `시가=저가, 종가=고가 — 매수 압력 극대화. 형태 점수 ${confidence}%`
          : `시가=고가, 종가=저가 — 매도 압력 극대화. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: {
          time: c.time,
          position: isBullish ? 'belowBar' : 'aboveBar',
          color: isBullish ? KRX_COLORS.PTN_MARKER_BUY : KRX_COLORS.PTN_MARKER_SELL,
          shape: isBullish ? 'arrowUp' : 'arrowDown',
          text: '',
        },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  팽이형 (Spinning Top) — 시장 우유부단
  // ══════════════════════════════════════════════════
  //
  //  시장 심리: 도지보다는 실체가 있으나 작고, 양쪽 꼬리가 실체
  //  이상으로 길어 매수/매도 어느 쪽도 우위를 점하지 못한 상태.
  //  Nison(1991): "Spinning tops represent indecision; they are
  //  especially important after a sustained advance or decline."
  //
  //  Bulkowski: 단독 패턴으로서 방향성 예측력은 낮으나 (51%),
  //  추세 말기에 출현하면 반전 확률 상승. 주로 다른 패턴과
  //  복합 신호로 사용 (예: 팽이형 + 볼린저밴드 수축).
  //

  detectSpinningTop(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(1, ctx.detectFrom || 0); i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      const bodyRatio = body / range;
      // 팽이형: body가 range의 5~30% (도지보다 크고 보통 봉보다 작음)
      if (bodyRatio <= PatternEngine.SPINNING_BODY_MIN ||
          bodyRatio >= PatternEngine.SPINNING_BODY_MAX) continue;

      const upperShadow = c.high - Math.max(c.open, c.close);
      const lowerShadow = Math.min(c.open, c.close) - c.low;

      // 양쪽 꼬리 모두 body의 50% 이상 (양방향 압력 존재)
      if (upperShadow < body * PatternEngine.SPINNING_SHADOW_RATIO) continue;
      if (lowerShadow < body * PatternEngine.SPINNING_SHADOW_RATIO) continue;

      const a = this._atr(atr, i, candles);
      // 유의미한 범위 확인
      if (range < a * PatternEngine.MIN_RANGE_ATR) continue;

      // 품질 점수 (중립 패턴 — 추세 불문)
      const shadowBalance = 1 - Math.abs(upperShadow - lowerShadow) / range; // 꼬리 균형도
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const bodySmallScore = 1 - bodyRatio; // body가 작을수록 우유부단
      const confidence = this._quality({ body: bodySmallScore, shadow: shadowBalance, volume: volumeScore, trend: 0.3, extra: 0.3 });

      results.push({
        type: 'spinningTop', name: '팽이형 (Spinning Top)', nameShort: '팽이형',
        signal: 'neutral', strength: 'weak', confidence,
        stopLoss: null, priceTarget: null,
        description: `작은 실체 + 긴 양쪽 꼬리 — 시장 우유부단. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'aboveBar', color: KRX_COLORS.PTN_NEUTRAL, shape: 'circle', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  긴다리도지 (Long-Legged Doji) — 극단적 우유부단
  // ══════════════════════════════════════════════════
  //
  //  Nison (1991): "The long-legged doji is an especially important
  //  doji. It has very long upper and lower shadows. This doji
  //  reflects great indecision in the market."
  //
  detectLongLeggedDoji(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(1, ctx.detectFrom || 0); i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;
      if (body > range * PatternEngine.DOJI_BODY_RATIO) continue;  // 도지 body 조건

      const upperShadow = c.high - Math.max(c.open, c.close);
      const lowerShadow = Math.min(c.open, c.close) - c.low;

      // 핵심: 양쪽 꼬리 모두 range의 30% 이상
      if (upperShadow < range * PatternEngine.LONG_DOJI_SHADOW_MIN) continue;
      if (lowerShadow < range * PatternEngine.LONG_DOJI_SHADOW_MIN) continue;

      const a = this._atr(atr, i, candles);
      // range가 ATR의 80% 이상 — 일반 도지보다 큰 범위
      if (range < a * PatternEngine.LONG_DOJI_RANGE_MIN) continue;

      const trend = this._detectTrend(candles, i, 10, a);
      const signal = trend.direction === 'up' ? 'sell' : trend.direction === 'down' ? 'buy' : 'neutral';
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = trend.direction !== 'neutral' ? Math.min(trend.strength, 1) : 0.3;
      const shadowBalance = 1 - Math.abs(upperShadow - lowerShadow) / range;
      const confidence = this._quality({ body: 0.5, shadow: shadowBalance, volume: volumeScore, trend: trendScore, extra: 0.5 });

      results.push({
        type: 'longLeggedDoji', name: '긴다리도지 (Long-Legged Doji)', nameShort: '긴다리도지',
        signal, strength: 'weak', confidence,
        stopLoss: signal !== 'neutral' ? this._stopLoss(candles, i, signal, atr) : null,
        priceTarget: signal !== 'neutral' ? this._candleTarget(candles, i, signal, 'weak', atr, ctx.hurstWeight, ctx.meanRevWeight) : null,
        description: `긴 양쪽 꼬리 도지 — 극단적 우유부단. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: { time: c.time, position: 'aboveBar', color: KRX_COLORS.PTN_NEUTRAL, shape: 'circle', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  띠두름 (Belt Hold) — 갭 반전
  // ══════════════════════════════════════════════════
  //
  //  Morris (2006): "A belt hold is a strong single-candle pattern
  //  with a large body, opening at the extreme (high or low), and
  //  a small shadow on the close side."
  //  마루보주와 구분: 종가 쪽 꼬리 허용 + 반대 추세 맥락 필수.
  //
  detectBeltHold(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(1, ctx.detectFrom || 0); i < candles.length; i++) {
      const c = candles[i];
      const body = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      if (range === 0) continue;

      // body/range 60%+ (강한 몸통이나 마루보주(85%)보다는 관대)
      if (body < range * PatternEngine.BELT_BODY_RATIO_MIN) continue;
      // 마루보주 조건 충족 시 스킵 (마루보주가 더 극단적 패턴)
      if (body >= range * PatternEngine.MARUBOZU_BODY_RATIO) continue;

      const a = this._atr(atr, i, candles);
      if (body < a * PatternEngine.BELT_BODY_ATR_MIN) continue;

      const isBullish = c.close > c.open;
      const upperShadow = c.high - Math.max(c.open, c.close);
      const lowerShadow = Math.min(c.open, c.close) - c.low;

      // 시가측 꼬리 거의 없음 (갭 시가)
      const openShadow = isBullish ? lowerShadow : upperShadow;
      const closeShadow = isBullish ? upperShadow : lowerShadow;
      if (openShadow > body * PatternEngine.BELT_OPEN_SHADOW_MAX) continue;
      if (closeShadow > body * PatternEngine.BELT_CLOSE_SHADOW_MAX) continue;

      // 반대 추세 맥락 (반전 패턴)
      const trend = this._detectTrend(candles, i, 10, a);
      if (isBullish && trend.direction !== 'down') continue;
      if (!isBullish && trend.direction !== 'up') continue;

      const signal = isBullish ? 'buy' : 'sell';
      const type = isBullish ? 'bullishBeltHold' : 'bearishBeltHold';
      const bodyScore = Math.min(body / a, 1);
      const shadowScore = 1 - openShadow / (range || 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = Math.min(trend.strength, 1);
      const confidence = this._quality({ body: bodyScore, shadow: shadowScore, volume: volumeScore, trend: trendScore });

      results.push({
        type, name: isBullish ? '강세띠두름 (Bullish Belt Hold)' : '약세띠두름 (Bearish Belt Hold)',
        nameShort: isBullish ? '강세띠두름' : '약세띠두름',
        signal, strength: 'medium', confidence,
        stopLoss: this._stopLoss(candles, i, signal, atr),
        priceTarget: this._candleTarget(candles, i, signal, 'medium', atr, ctx.hurstWeight, ctx.meanRevWeight),
        description: isBullish
          ? `시가=저가 근처 양봉 — 상승 반전 신호. 형태 점수 ${confidence}%`
          : `시가=고가 근처 음봉 — 하락 반전 신호. 형태 점수 ${confidence}%`,
        startIndex: i, endIndex: i,
        marker: {
          time: c.time,
          position: isBullish ? 'belowBar' : 'aboveBar',
          color: isBullish ? KRX_COLORS.PTN_MARKER_BUY : KRX_COLORS.PTN_MARKER_SELL,
          shape: isBullish ? 'arrowUp' : 'arrowDown', text: '',
        },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  삼내형 상승 (Three Inside Up) — 잉태형 확인
  // ══════════════════════════════════════════════════
  //
  //  Nison (1991): "Three inside up is a bullish harami plus
  //  a confirmation candle that closes above the first candle's open."
  //  잉태형(medium) → 확인 완료 → strong으로 승격.
  //
  detectThreeInsideUp(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(2, ctx.detectFrom || 0); i < candles.length; i++) {
      const c0 = candles[i - 2], c1 = candles[i - 1], c2 = candles[i];

      // c0: 큰 음봉
      if (c0.close >= c0.open) continue;
      const a = this._atr(atr, i, candles);
      const body0 = c0.open - c0.close;
      if (body0 < a * PatternEngine.HARAMI_PREV_BODY_MIN) continue;

      // c1: c0 내부에 포함된 작은 양봉 (잉태형 조건)
      if (c1.close <= c1.open) continue;  // 양봉
      const body1 = c1.close - c1.open;
      if (body1 > body0 * PatternEngine.HARAMI_CURR_BODY_MAX) continue;
      if (body1 < a * PatternEngine.HARAMI_CURR_BODY_MIN) continue;
      if (c1.open < c0.close || c1.close > c0.open) continue;  // 내포 조건

      // c2: 확인 양봉 — c0 시가 위로 종가 마감
      if (c2.close <= c2.open) continue;  // 양봉
      const body2 = c2.close - c2.open;
      if (body2 < a * PatternEngine.THREE_INSIDE_CONFIRM_MIN) continue;
      if (c2.close <= c0.open) continue;  // c0 시가 상향 돌파

      const trend = this._detectTrend(candles, i - 2, 10, a);
      if (trend.direction === 'up') continue;  // 하락 추세 필수

      const bodyScore = Math.min((body0 + body2) / 2 / a, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = trend.direction === 'down' ? Math.min(trend.strength, 1) : 0.3;
      const confidence = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore });
      const stopLoss = this._stopLoss(candles, i, 'buy', atr);
      const priceTarget = this._candleTarget(candles, i, 'buy', 'strong', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'threeInsideUp', name: '상승삼내형 (Three Inside Up)', nameShort: '상승삼내',
        signal: 'buy', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `잉태형 + 확인 양봉 — 강한 상승 반전. 형태 점수 ${confidence}%`,
        startIndex: i - 2, endIndex: i,
        marker: { time: c2.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  삼내형 하락 (Three Inside Down) — 잉태형 확인
  // ══════════════════════════════════════════════════
  detectThreeInsideDown(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(2, ctx.detectFrom || 0); i < candles.length; i++) {
      const c0 = candles[i - 2], c1 = candles[i - 1], c2 = candles[i];

      // c0: 큰 양봉
      if (c0.close <= c0.open) continue;
      const a = this._atr(atr, i, candles);
      const body0 = c0.close - c0.open;
      if (body0 < a * PatternEngine.HARAMI_PREV_BODY_MIN) continue;

      // c1: c0 내부에 포함된 작은 음봉 (잉태형 조건)
      if (c1.close >= c1.open) continue;  // 음봉
      const body1 = c1.open - c1.close;
      if (body1 > body0 * PatternEngine.HARAMI_CURR_BODY_MAX) continue;
      if (body1 < a * PatternEngine.HARAMI_CURR_BODY_MIN) continue;
      if (c1.close < c0.open || c1.open > c0.close) continue;  // 내포 조건

      // c2: 확인 음봉 — c0 시가 아래로 종가 마감
      if (c2.close >= c2.open) continue;  // 음봉
      const body2 = c2.open - c2.close;
      if (body2 < a * PatternEngine.THREE_INSIDE_CONFIRM_MIN) continue;
      if (c2.close >= c0.open) continue;  // c0 시가 하향 돌파

      const trend = this._detectTrend(candles, i - 2, 10, a);
      if (trend.direction === 'down') continue;  // 상승 추세 필수

      const bodyScore = Math.min((body0 + body2) / 2 / a, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = trend.direction === 'up' ? Math.min(trend.strength, 1) : 0.3;
      const confidence = this._quality({ body: bodyScore, volume: volumeScore, trend: trendScore });
      const stopLoss = this._stopLoss(candles, i, 'sell', atr);
      const priceTarget = this._candleTarget(candles, i, 'sell', 'strong', atr, ctx.hurstWeight, ctx.meanRevWeight);

      results.push({
        type: 'threeInsideDown', name: '하락삼내형 (Three Inside Down)', nameShort: '하락삼내',
        signal: 'sell', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `잉태형 + 확인 음봉 — 강한 하락 반전. 형태 점수 ${confidence}%`,
        startIndex: i - 2, endIndex: i,
        marker: { time: c2.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  버림받은아기 (Abandoned Baby) — 갭 도지 반전
  // ══════════════════════════════════════════════════
  //
  //  Bulkowski (2008): 강세/약세 모두 신뢰도 높으나 출현 빈도 극히 낮음.
  //  KRX: 가격제한폭 ±30%, 갭 빈도 낮아 GAP_MIN=0.03*ATR로 관대 설정 (Phase1-B).
  //
  detectAbandonedBaby(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(2, ctx.detectFrom || 0); i < candles.length; i++) {
      const c0 = candles[i - 2], c1 = candles[i - 1], c2 = candles[i];
      const a = this._atr(atr, i, candles);
      const gapMin = a * PatternEngine.ABANDONED_BABY_GAP_MIN;

      const body1 = Math.abs(c1.close - c1.open);
      const range1 = c1.high - c1.low;
      if (range1 === 0) continue;
      // c1: 도지 (관대한 기준)
      if (body1 > range1 * PatternEngine.ABANDONED_BABY_DOJI_MAX) continue;

      // 강세 버림받은아기: 음봉 → 갭다운 도지 → 갭업 양봉
      if (c0.close < c0.open && c2.close > c2.open) {
        if (c1.high < c0.low - gapMin && c1.high < c2.low - gapMin) {
          const trend = this._detectTrend(candles, i - 2, 10, a);
          if (trend.direction === 'up') continue;

          const bodyScore = Math.min(Math.abs(c2.close - c2.open) / a, 1);
          const gapScore = Math.min((c0.low - c1.high + c2.low - c1.high) / (2 * a), 1);
          const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
          const trendScore = trend.direction === 'down' ? Math.min(trend.strength, 1) : 0.3;
          const confidence = this._quality({ body: bodyScore, shadow: gapScore, volume: volumeScore, trend: trendScore, extra: 0.7 });

          results.push({
            type: 'abandonedBabyBullish', name: '강세버림받은아기 (Bullish Abandoned Baby)', nameShort: '강세버림받은아기',
            signal: 'buy', strength: 'strong', confidence,
            stopLoss: this._stopLoss(candles, i, 'buy', atr),
            priceTarget: this._candleTarget(candles, i, 'buy', 'strong', atr, ctx.hurstWeight, ctx.meanRevWeight),
            description: `갭 도지 분리 — 강한 상승 반전. 형태 점수 ${confidence}%`,
            startIndex: i - 2, endIndex: i,
            marker: { time: c2.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
          });
        }
      }

      // 약세 버림받은아기: 양봉 → 갭업 도지 → 갭다운 음봉
      if (c0.close > c0.open && c2.close < c2.open) {
        if (c1.low > c0.high + gapMin && c1.low > c2.high + gapMin) {
          const trend = this._detectTrend(candles, i - 2, 10, a);
          if (trend.direction === 'down') continue;

          const bodyScore = Math.min(Math.abs(c2.open - c2.close) / a, 1);
          const gapScore = Math.min((c1.low - c0.high + c1.low - c2.high) / (2 * a), 1);
          const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
          const trendScore = trend.direction === 'up' ? Math.min(trend.strength, 1) : 0.3;
          const confidence = this._quality({ body: bodyScore, shadow: gapScore, volume: volumeScore, trend: trendScore, extra: 0.7 });

          results.push({
            type: 'abandonedBabyBearish', name: '약세버림받은아기 (Bearish Abandoned Baby)', nameShort: '약세버림받은아기',
            signal: 'sell', strength: 'strong', confidence,
            stopLoss: this._stopLoss(candles, i, 'sell', atr),
            priceTarget: this._candleTarget(candles, i, 'sell', 'strong', atr, ctx.hurstWeight, ctx.meanRevWeight),
            description: `갭 도지 분리 — 강한 하락 반전. 형태 점수 ${confidence}%`,
            startIndex: i - 2, endIndex: i,
            marker: { time: c2.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
          });
        }
      }
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  잉태십자 (Harami Cross) — 잉태형 + 도지
  // ══════════════════════════════════════════════════
  //
  //  Nison (1991): "The harami cross is a harami pattern in which
  //  the second session is a doji. It is considered a more
  //  significant reversal signal than a regular harami."
  //
  //  시장 심리: 큰 몸통(1봉) 이후 도지(2봉)가 내포 형성.
  //  1봉의 강한 방향성이 완전히 소멸 → 우유부단 → 반전 확률 상승.
  //  일반 잉태형보다 반전 신호 강도가 높음 (Nison).
  //
  //  Bulkowski (2008): harami cross bullish 56%, bearish 58%
  //  KRX 추정: bullish 46%, bearish 57.5% (잉태형 WR 기반 +2~3% 프리미엄)
  //
  detectHaramiCross(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(1, ctx.detectFrom || 0); i < candles.length; i++) {
      const prev = candles[i - 1], curr = candles[i];
      const prevBody = Math.abs(prev.close - prev.open);
      const currBody = Math.abs(curr.close - curr.open);
      const currRange = curr.high - curr.low;
      if (currRange === 0) continue;

      const a = this._atr(atr, i, candles);

      // 1봉: 큰 몸통 (ATR의 HARAMI_PREV_BODY_MIN 이상)
      if (prevBody < a * PatternEngine.HARAMI_PREV_BODY_MIN) continue;

      // 2봉: 도지 (body/range <= HARAMI_CROSS_DOJI_MAX)
      if (currBody > currRange * PatternEngine.HARAMI_CROSS_DOJI_MAX) continue;

      // 내포 조건: 2봉의 고가/저가가 1봉 body 범위 안에 포함
      const prevHigh = Math.max(prev.open, prev.close);
      const prevLow = Math.min(prev.open, prev.close);
      if (curr.high > prevHigh || curr.low < prevLow) continue;

      const trend = this._detectTrend(candles, i - 1, 10, a);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);

      // 강세 잉태십자 (하락 추세 → 큰 음봉 → 도지 내포)
      if (prev.close < prev.open && trend.direction === 'down') {
        const trendScore = Math.min(trend.strength, 1);
        const bodyScore = Math.min(prevBody / a, 1);
        const confidence = this._quality({ body: bodyScore, shadow: 0.6, volume: volumeScore, trend: trendScore, extra: 0.4 });
        results.push({
          type: 'bullishHaramiCross', name: '강세잉태십자 (Bullish Harami Cross)', nameShort: '강세잉태십자',
          signal: 'buy', strength: 'medium', confidence,
          stopLoss: this._stopLoss(candles, i, 'buy', atr),
          priceTarget: this._candleTarget(candles, i, 'buy', 'medium', atr, ctx.hurstWeight, ctx.meanRevWeight),
          description: `큰 음봉 + 도지 내포 — 매도세 소진 반전 신호. 형태 점수 ${confidence}%`,
          startIndex: i - 1, endIndex: i,
          marker: { time: curr.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
        });
      }

      // 약세 잉태십자 (상승 추세 → 큰 양봉 → 도지 내포)
      if (prev.close > prev.open && trend.direction === 'up') {
        const trendScore = Math.min(trend.strength, 1);
        const bodyScore = Math.min(prevBody / a, 1);
        const confidence = this._quality({ body: bodyScore, shadow: 0.6, volume: volumeScore, trend: trendScore, extra: 0.4 });
        results.push({
          type: 'bearishHaramiCross', name: '약세잉태십자 (Bearish Harami Cross)', nameShort: '약세잉태십자',
          signal: 'sell', strength: 'medium', confidence,
          stopLoss: this._stopLoss(candles, i, 'sell', atr),
          priceTarget: this._candleTarget(candles, i, 'sell', 'medium', atr, ctx.hurstWeight, ctx.meanRevWeight),
          description: `큰 양봉 + 도지 내포 — 매수세 소진 반전 신호. 형태 점수 ${confidence}%`,
          startIndex: i - 1, endIndex: i,
          marker: { time: curr.time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
        });
      }
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  스틱샌드위치 (Stick Sandwich) — 동일 종가 반전
  // ══════════════════════════════════════════════════
  //
  //  Bulkowski (2008): 3봉 강세 반전 패턴. 출현 빈도 낮음.
  //  구조: 음봉(c0) → 양봉(c1, c0 종가보다 높은 종가) → 음봉(c2, c0과 동일 종가)
  //
  //  시장 심리: 동일한 가격 수준(c0, c2 종가)에서 2회 매수세가 방어 →
  //  해당 가격이 강력한 지지선으로 작용. 중간 양봉의 반등 시도가
  //  3봉째에서 좌절되었으나, 동일 종가 지지 확인이 반전 조건을 완성.
  //
  //  Bulkowski WR: ~56% (약한 강세 신호)
  //  KRX 추정: ~52% (갭/종가 일치 조건이 KRX에서 더 엄격)
  //
  detectStickSandwich(candles, ctx = {}) {
    const results = [];
    const { atr = [], vma = [] } = ctx;
    for (let i = Math.max(2, ctx.detectFrom || 0); i < candles.length; i++) {
      const c0 = candles[i - 2], c1 = candles[i - 1], c2 = candles[i];
      const a = this._atr(atr, i, candles);

      // c0: 음봉 (종가 < 시가)
      if (c0.close >= c0.open) continue;
      // c1: 양봉 (종가 > 시가), c1 종가 > c0 종가
      if (c1.close <= c1.open) continue;
      if (c1.close <= c0.close) continue;
      // c2: 음봉 (종가 < 시가)
      if (c2.close >= c2.open) continue;

      // 핵심 조건: c0과 c2의 종가가 거의 동일 (ATR*허용오차 이내)
      const closeDiff = Math.abs(c2.close - c0.close);
      if (closeDiff > a * PatternEngine.STICK_SANDWICH_CLOSE_TOL) continue;

      // c1 body가 유의미해야 함 (반등이 실제로 존재)
      const body1 = c1.close - c1.open;
      if (body1 < a * PatternEngine.STICK_SANDWICH_MID_BODY_MIN) continue;

      // c0, c2 body도 유의미해야 함
      const body0 = c0.open - c0.close;
      const body2 = c2.open - c2.close;
      if (body0 < a * 0.2 || body2 < a * 0.2) continue;

      const trend = this._detectTrend(candles, i - 2, 10, a);
      // 하락 추세 또는 중립에서만 (이미 상승 중이면 무의미)
      if (trend.direction === 'up') continue;

      const closePrecision = 1 - closeDiff / (a * PatternEngine.STICK_SANDWICH_CLOSE_TOL + 0.001);
      const bodyScore = Math.min((body0 + body2) / 2 / a, 1);
      const volumeScore = Math.min(this._volRatio(candles, i, vma) / 2, 1);
      const trendScore = trend.direction === 'down' ? Math.min(trend.strength, 1) : 0.3;
      const confidence = this._quality({ body: bodyScore, shadow: closePrecision, volume: volumeScore, trend: trendScore, extra: 0.4 });

      // 손절: c0, c2 종가 중 낮은 값 - ATR
      const supportLevel = Math.min(c0.close, c2.close);

      results.push({
        type: 'stickSandwich', name: '스틱샌드위치 (Stick Sandwich)', nameShort: '스틱샌드위치',
        signal: 'buy', strength: 'medium', confidence,
        stopLoss: +(supportLevel - a * PatternEngine.STOP_LOSS_ATR_MULT).toFixed(0),
        priceTarget: this._candleTarget(candles, i, 'buy', 'medium', atr, ctx.hurstWeight, ctx.meanRevWeight),
        description: `동일 종가 음봉 사이 양봉 — 지지선 확인 반전. 형태 점수 ${confidence}%`,
        startIndex: i - 2, endIndex: i,
        marker: { time: c2.time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  상승 삼각형 (Ascending Triangle)
  // ══════════════════════════════════════════════════
  detectAscendingTriangle(candles, swingHighs, swingLows, ctx = {}) {
    const results = [];
    if (swingHighs.length < 2 || swingLows.length < 2) return results;
    const { atr = [], vma = [], hurstWeight: hw = 1, meanRevWeight: mw = 1 } = ctx;

    // [Phase1-C] 40→60: Bulkowski 중앙값 47일 포착, wedge/symmetric(50봉)과 정합
    const recentHighs = swingHighs.filter(h => h.index >= candles.length - 60);
    const recentLows = swingLows.filter(l => l.index >= candles.length - 60);

    for (let i = 0; i < recentHighs.length - 1; i++) {
      const h1 = recentHighs[i], h2 = recentHighs[i + 1];
      const a = this._atr(atr, h2.index, candles);
      if (Math.abs(h1.price - h2.price) > a * 0.5) continue;

      const relevantLows = recentLows
        .filter(l => l.index >= h1.index - 2 && l.index <= h2.index + 2)
        .sort((a, b) => a.index - b.index);
      if (relevantLows.length < 2) continue;

      // [Phase1-C → Phase I] net ascending: Theil-Sen slope > 0 (3+점), 2-point fallback
      var _tsAsc = (relevantLows.length >= 3 && typeof calcTheilSen === 'function')
        ? calcTheilSen(relevantLows.map(p => p.index), relevantLows.map(p => p.price)) : null;
      const ascending = _tsAsc ? _tsAsc.slope > 0
        : relevantLows[relevantLows.length - 1].price > relevantLows[0].price;
      if (!ascending) continue;

      const resistanceLevel = (h1.price + h2.price) / 2;
      const startIdx = Math.min(h1.index, relevantLows[0].index);
      const endIdx = Math.max(h2.index, relevantLows[relevantLows.length - 1].index);
      if (endIdx >= candles.length) continue;

      const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);
      const confidence = this._adaptiveQuality('ascendingTriangle', { body: 0.7, volume: volumeScore, trend: 0.6 });
      const stopLoss = +(relevantLows[relevantLows.length - 1].price - a).toFixed(0);
      const raw = resistanceLevel - relevantLows[0].price;
      const patternHeight = Math.min(raw * hw * mw, raw * PatternEngine.CHART_TARGET_RAW_CAP, a * (ctx.dynamicATRCap || PatternEngine.CHART_TARGET_ATR_CAP));
      const priceTarget = +(resistanceLevel + patternHeight).toFixed(0);

      results.push({
        type: 'ascendingTriangle', name: '상승 삼각형 (Ascending Triangle)', nameShort: '상승삼각',
        signal: 'buy', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `수평 저항 + 상승 지지 — 상방 돌파 가능. 형태 점수 ${confidence}%`,
        startIndex: startIdx, endIndex: endIdx,
        marker: { time: candles[endIdx].time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
        trendlines: [
          { color: KRX_COLORS.DOWN, style: 'dashed', points: [
            { time: candles[h1.index].time, value: resistanceLevel },
            { time: candles[h2.index].time, value: resistanceLevel },
          ]},
          { color: KRX_COLORS.UP, style: 'dashed', points: [
            { time: candles[relevantLows[0].index].time, value: relevantLows[0].price },
            { time: candles[relevantLows[relevantLows.length - 1].index].time, value: relevantLows[relevantLows.length - 1].price },
          ]},
        ],
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  하락 삼각형 (Descending Triangle)
  // ══════════════════════════════════════════════════
  detectDescendingTriangle(candles, swingHighs, swingLows, ctx = {}) {
    const results = [];
    if (swingHighs.length < 2 || swingLows.length < 2) return results;
    const { atr = [], vma = [], hurstWeight: hw = 1, meanRevWeight: mw = 1 } = ctx;

    // [Phase1-C] 40→60: ascending triangle과 동일 확대
    const recentHighs = swingHighs.filter(h => h.index >= candles.length - 60);
    const recentLows = swingLows.filter(l => l.index >= candles.length - 60);

    for (let i = 0; i < recentLows.length - 1; i++) {
      const l1 = recentLows[i], l2 = recentLows[i + 1];
      const a = this._atr(atr, l2.index, candles);
      if (Math.abs(l1.price - l2.price) > a * 0.5) continue;

      const relevantHighs = recentHighs
        .filter(h => h.index >= l1.index - 2 && h.index <= l2.index + 2)
        .sort((a, b) => a.index - b.index);
      if (relevantHighs.length < 2) continue;

      // [Phase1-C → Phase I] net descending: Theil-Sen slope < 0 (3+점), 2-point fallback
      var _tsDesc = (relevantHighs.length >= 3 && typeof calcTheilSen === 'function')
        ? calcTheilSen(relevantHighs.map(p => p.index), relevantHighs.map(p => p.price)) : null;
      const descending = _tsDesc ? _tsDesc.slope < 0
        : relevantHighs[relevantHighs.length - 1].price < relevantHighs[0].price;
      if (!descending) continue;

      const supportLevel = (l1.price + l2.price) / 2;
      const startIdx = Math.min(l1.index, relevantHighs[0].index);
      const endIdx = Math.max(l2.index, relevantHighs[relevantHighs.length - 1].index);
      if (endIdx >= candles.length) continue;

      const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);
      const confidence = this._adaptiveQuality('descendingTriangle', { body: 0.7, volume: volumeScore, trend: 0.6 });
      const stopLoss = +(relevantHighs[0].price + a).toFixed(0);
      const raw = relevantHighs[0].price - supportLevel;
      const patternHeight = Math.min(raw * hw * mw, raw * PatternEngine.CHART_TARGET_RAW_CAP, a * (ctx.dynamicATRCap || PatternEngine.CHART_TARGET_ATR_CAP));
      const priceTarget = +(supportLevel - patternHeight).toFixed(0);

      results.push({
        type: 'descendingTriangle', name: '하락 삼각형 (Descending Triangle)', nameShort: '하락삼각',
        signal: 'sell', strength: 'strong', confidence, stopLoss, priceTarget,
        description: `수평 지지 + 하락 저항 — 하방 돌파 가능. 형태 점수 ${confidence}%`,
        startIndex: startIdx, endIndex: endIdx,
        marker: { time: candles[endIdx].time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
        trendlines: [
          { color: KRX_COLORS.UP, style: 'dashed', points: [
            { time: candles[l1.index].time, value: supportLevel },
            { time: candles[l2.index].time, value: supportLevel },
          ]},
          { color: KRX_COLORS.DOWN, style: 'dashed', points: [
            { time: candles[relevantHighs[0].index].time, value: relevantHighs[0].price },
            { time: candles[relevantHighs[relevantHighs.length - 1].index].time, value: relevantHighs[relevantHighs.length - 1].price },
          ]},
        ],
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  상승 쐐기 (Rising Wedge) — 하락 반전 경고
  // ══════════════════════════════════════════════════
  detectRisingWedge(candles, swingHighs, swingLows, ctx = {}) {
    const results = [];
    if (swingHighs.length < 2 || swingLows.length < 2) return results;
    const { atr = [], vma = [], hurstWeight: hw = 1, meanRevWeight: mw = 1 } = ctx;

    const recentHighs = swingHighs.filter(h => h.index >= candles.length - 50);
    const recentLows = swingLows.filter(l => l.index >= candles.length - 50);
    if (recentHighs.length < 2 || recentLows.length < 2) return results;

    const sortedHighs = [...recentHighs].sort((a, b) => a.index - b.index);
    const sortedLows = [...recentLows].sort((a, b) => a.index - b.index);

    // [Phase I] Theil-Sen hoisted — loop-invariant, O(n²) 중복 방지
    var _tsHRW = (sortedHighs.length >= 3 && typeof calcTheilSen === 'function')
      ? calcTheilSen(sortedHighs.map(p => p.index), sortedHighs.map(p => p.price)) : null;
    var _tsLRW = (sortedLows.length >= 3 && typeof calcTheilSen === 'function')
      ? calcTheilSen(sortedLows.map(p => p.index), sortedLows.map(p => p.price)) : null;

    for (let hi = 0; hi < sortedHighs.length - 1; hi++) {
      for (let li = 0; li < sortedLows.length - 1; li++) {
        const h1 = sortedHighs[hi], h2 = sortedHighs[hi + 1];
        const l1 = sortedLows[li], l2 = sortedLows[li + 1];
        if (h2.price <= h1.price || l2.price <= l1.price) continue;

        const a = this._atr(atr, h2.index, candles);
        const highSlope = (_tsHRW ? _tsHRW.slope : (h2.price - h1.price) / (h2.index - h1.index)) / a;
        const lowSlope = (_tsLRW ? _tsLRW.slope : (l2.price - l1.price) / (l2.index - l1.index)) / a;
        if (highSlope >= lowSlope) continue;

        // 쐐기 수렴 검증: 끝 높이가 시작 높이보다 좁아야 함
        const startHeight = h1.price - l1.price;
        const endHeight = h2.price - l2.price;
        if (startHeight <= 0 || endHeight >= startHeight * 0.9) continue;

        const span = Math.max(h2.index, l2.index) - Math.min(h1.index, l1.index);
        if (span < 8) continue;

        const endIdx = Math.max(h2.index, l2.index);
        if (endIdx >= candles.length) continue;

        const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);
        const confidence = this._adaptiveQuality('risingWedge', { body: 0.6, volume: volumeScore, trend: 0.5, shadow: 0.6 });
        const stopLoss = +(h2.price + a).toFixed(0);
        const wedgeHeight = h2.price - l2.price;
        const priceTarget = +(Math.max(l1.price, candles[endIdx].close - Math.min(wedgeHeight * hw * mw, wedgeHeight * PatternEngine.CHART_TARGET_RAW_CAP, a * (ctx.dynamicATRCap || PatternEngine.CHART_TARGET_ATR_CAP)))).toFixed(0);

        results.push({
          type: 'risingWedge', name: '상승 쐐기 (Rising Wedge)', nameShort: '상승쐐기',
          signal: 'sell', strength: 'medium', confidence, stopLoss, priceTarget,
          description: `상향 수렴 — 상승 피로, 하락 반전 가능. 형태 점수 ${confidence}%`,
          startIndex: Math.min(h1.index, l1.index), endIndex: endIdx,
          marker: { time: candles[endIdx].time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
          trendlines: [
            { color: KRX_COLORS.DOWN, style: 'dashed', points: [
              { time: candles[h1.index].time, value: h1.price },
              { time: candles[h2.index].time, value: h2.price },
            ]},
            { color: KRX_COLORS.UP, style: 'dashed', points: [
              { time: candles[l1.index].time, value: l1.price },
              { time: candles[l2.index].time, value: l2.price },
            ]},
          ],
        });
        break;
      }
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  하락 쐐기 (Falling Wedge) — 상승 반전 기대
  // ══════════════════════════════════════════════════
  detectFallingWedge(candles, swingHighs, swingLows, ctx = {}) {
    const results = [];
    if (swingHighs.length < 2 || swingLows.length < 2) return results;
    const { atr = [], vma = [], hurstWeight: hw = 1, meanRevWeight: mw = 1 } = ctx;

    const recentHighs = swingHighs.filter(h => h.index >= candles.length - 50);
    const recentLows = swingLows.filter(l => l.index >= candles.length - 50);
    if (recentHighs.length < 2 || recentLows.length < 2) return results;

    const sortedHighs = [...recentHighs].sort((a, b) => a.index - b.index);
    const sortedLows = [...recentLows].sort((a, b) => a.index - b.index);

    // [Phase I] Theil-Sen hoisted — loop-invariant
    var _tsHFW = (sortedHighs.length >= 3 && typeof calcTheilSen === 'function')
      ? calcTheilSen(sortedHighs.map(p => p.index), sortedHighs.map(p => p.price)) : null;
    var _tsLFW = (sortedLows.length >= 3 && typeof calcTheilSen === 'function')
      ? calcTheilSen(sortedLows.map(p => p.index), sortedLows.map(p => p.price)) : null;

    for (let hi = 0; hi < sortedHighs.length - 1; hi++) {
      for (let li = 0; li < sortedLows.length - 1; li++) {
        const h1 = sortedHighs[hi], h2 = sortedHighs[hi + 1];
        const l1 = sortedLows[li], l2 = sortedLows[li + 1];
        if (h2.price >= h1.price || l2.price >= l1.price) continue;

        const a = this._atr(atr, h2.index, candles);
        const highSlope = Math.abs(_tsHFW ? _tsHFW.slope : (h2.price - h1.price) / (h2.index - h1.index)) / a;
        const lowSlope = Math.abs(_tsLFW ? _tsLFW.slope : (l2.price - l1.price) / (l2.index - l1.index)) / a;
        if (lowSlope >= highSlope) continue;

        // [P0-fix] 쐐기 수렴 검증 — Rising Wedge와 대칭 (Bulkowski 2005: 유효 쐐기는 ≥10% 수렴)
        const startHeight = h1.price - l1.price;
        const endHeight = h2.price - l2.price;
        if (startHeight <= 0 || endHeight >= startHeight * 0.9) continue;

        const span = Math.max(h2.index, l2.index) - Math.min(h1.index, l1.index);
        if (span < 8) continue;

        const endIdx = Math.max(h2.index, l2.index);
        if (endIdx >= candles.length) continue;

        const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);
        const confidence = this._adaptiveQuality('fallingWedge', { body: 0.6, volume: volumeScore, trend: 0.5, shadow: 0.6 });
        const stopLoss = +(l2.price - a).toFixed(0);
        const wedgeHeight = h2.price - l2.price;
        const priceTarget = +(Math.min(h1.price, candles[endIdx].close + Math.min(wedgeHeight * hw * mw, wedgeHeight * PatternEngine.CHART_TARGET_RAW_CAP, a * (ctx.dynamicATRCap || PatternEngine.CHART_TARGET_ATR_CAP)))).toFixed(0);

        results.push({
          type: 'fallingWedge', name: '하락 쐐기 (Falling Wedge)', nameShort: '하락쐐기',
          signal: 'buy', strength: 'medium', confidence, stopLoss, priceTarget,
          description: `하향 수렴 — 하락 피로, 상승 반전 가능. 형태 점수 ${confidence}%`,
          startIndex: Math.min(h1.index, l1.index), endIndex: endIdx,
          marker: { time: candles[endIdx].time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
          trendlines: [
            { color: KRX_COLORS.DOWN, style: 'dashed', points: [
              { time: candles[h1.index].time, value: h1.price },
              { time: candles[h2.index].time, value: h2.price },
            ]},
            { color: KRX_COLORS.UP, style: 'dashed', points: [
              { time: candles[l1.index].time, value: l1.price },
              { time: candles[l2.index].time, value: l2.price },
            ]},
          ],
        });
        break;
      }
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  대칭 삼각형 (Symmetric Triangle) — 중립 수렴
  //  시장 심리: 매수세와 매도세가 균형을 이루며 가격 범위가 점진적으로
  //  축소. 고점은 낮아지고(하향 저항) 저점은 높아지는(상향 지지) 대칭
  //  수렴 형태. 에너지 압축이 극에 달하면 어느 방향이든 폭발적 돌파 발생.
  //  Bulkowski 통계: 54%가 상방 돌파, 목표가 = 삼각형 높이의 측정 이동.
  // ══════════════════════════════════════════════════
  detectSymmetricTriangle(candles, swingHighs, swingLows, ctx = {}) {
    const results = [];
    if (swingHighs.length < 2 || swingLows.length < 2) return results;
    const { atr = [], vma = [], hurstWeight: hw = 1, meanRevWeight: mw = 1 } = ctx;

    // 최근 50봉 내 스윙 포인트만 사용
    const recentHighs = swingHighs.filter(h => h.index >= candles.length - 50);
    const recentLows = swingLows.filter(l => l.index >= candles.length - 50);
    if (recentHighs.length < 2 || recentLows.length < 2) return results;

    const sortedHighs = [...recentHighs].sort((a, b) => a.index - b.index);
    const sortedLows = [...recentLows].sort((a, b) => a.index - b.index);

    // [Phase I] Theil-Sen hoisted — loop-invariant
    var _tsHST = (sortedHighs.length >= 3 && typeof calcTheilSen === 'function')
      ? calcTheilSen(sortedHighs.map(p => p.index), sortedHighs.map(p => p.price)) : null;
    var _tsLST = (sortedLows.length >= 3 && typeof calcTheilSen === 'function')
      ? calcTheilSen(sortedLows.map(p => p.index), sortedLows.map(p => p.price)) : null;

    for (let hi = 0; hi < sortedHighs.length - 1; hi++) {
      for (let li = 0; li < sortedLows.length - 1; li++) {
        const h1 = sortedHighs[hi], h2 = sortedHighs[hi + 1];
        const l1 = sortedLows[li], l2 = sortedLows[li + 1];

        // 핵심 조건: 고점 하락(저항선 하향) + 저점 상승(지지선 상향)
        if (h2.price >= h1.price) continue;
        if (l2.price <= l1.price) continue;

        const a = this._atr(atr, h2.index, candles);
        const highSlope = (_tsHST ? _tsHST.slope : (h2.price - h1.price) / (h2.index - h1.index)) / a;
        const lowSlope = (_tsLST ? _tsLST.slope : (l2.price - l1.price) / (l2.index - l1.index)) / a;

        // 기울기 의미 유효성: 너무 완만하면 횡보, 삼각형이 아님
        if (Math.abs(highSlope) < 0.01 || Math.abs(lowSlope) < 0.01) continue;

        // 대칭성 검증: 두 기울기 절대값의 비율이 0.3~3.0 사이
        // 비율이 이 범위를 벗어나면 상승/하락 삼각형이나 쐐기에 더 가까움
        const slopeRatio = Math.abs(highSlope) / Math.abs(lowSlope);
        if (slopeRatio < 0.3 || slopeRatio > 3.0) continue;

        // 최소 패턴 폭: 10봉 이상 (충분한 수렴 기간)
        const span = Math.max(h2.index, l2.index) - Math.min(h1.index, l1.index);
        if (span < 10) continue;

        const endIdx = Math.max(h2.index, l2.index);
        if (endIdx >= candles.length) continue;

        // 거래량 분석: 삼각형 내부에서 거래량 감소가 전형적 (수렴 에너지 압축)
        const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);

        // 대칭성이 좋을수록 신뢰도 보너스 (1.0에 가까울수록 완벽한 대칭)
        const symmetryScore = 1 - Math.abs(1 - slopeRatio) / 2;
        const confidence = this._adaptiveQuality('symmetricTriangle', { body: 0.6, volume: volumeScore, trend: 0.5, extra: symmetryScore });

        results.push({
          type: 'symmetricTriangle', name: '대칭 삼각형 (Symmetric Triangle)', nameShort: '대칭삼각',
          signal: 'neutral', strength: 'medium', confidence,
          stopLoss: null, priceTarget: null,
          description: `대칭 수렴 — 매수·매도 균형, 방향 돌파 대기. 형태 점수 ${confidence}%`,
          startIndex: Math.min(h1.index, l1.index), endIndex: endIdx,
          marker: { time: candles[endIdx].time, position: 'aboveBar', color: KRX_COLORS.PTN_NEUTRAL, shape: 'circle', text: '' },
          trendlines: [
            { color: KRX_COLORS.DOWN, style: 'dashed', points: [
              { time: candles[h1.index].time, value: h1.price },
              { time: candles[h2.index].time, value: h2.price },
            ]},
            { color: KRX_COLORS.UP, style: 'dashed', points: [
              { time: candles[l1.index].time, value: l1.price },
              { time: candles[l2.index].time, value: l2.price },
            ]},
          ],
        });
        break;  // 한 쌍 발견 시 내부 루프 탈출 (중복 방지)
      }
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  이중 바닥 (Double Bottom) — 강한 지지
  // ══════════════════════════════════════════════════
  detectDoubleBottom(candles, swingLows, ctx = {}) {
    const results = [];
    const { atr = [], vma = [], hurstWeight: hw = 1, meanRevWeight: mw = 1 } = ctx;
    const recent = swingLows.filter(l => l.index >= candles.length - 50);

    for (let i = 0; i < recent.length - 1; i++) {
      const l1 = recent[i], l2 = recent[i + 1];
      const a = this._atr(atr, l2.index, candles);
      if (Math.abs(l1.price - l2.price) > a * 0.5) continue;  // Bulkowski: ±0.5 ATR (tighter)

      const span = l2.index - l1.index;
      if (span < 5 || span > 40) continue;

      // 넥라인 (두 저점 사이 최고 고가 — 실제 저항선 반영)
      let neckline = 0;
      for (let j = l1.index; j <= l2.index; j++) {
        if (candles[j].high > neckline) neckline = candles[j].high;
      }
      const raw = neckline - Math.min(l1.price, l2.price);
      const patternHeight = Math.min(raw * hw * mw, raw * PatternEngine.CHART_TARGET_RAW_CAP, a * (ctx.dynamicATRCap || PatternEngine.CHART_TARGET_ATR_CAP));

      const volumeScore = Math.min(this._volRatio(candles, l2.index, vma) / 2, 1);
      const confidence = this._adaptiveQuality('doubleBottom', { body: 0.7, volume: volumeScore, trend: 0.6, extra: 1 - Math.abs(l1.price - l2.price) / a });
      const stopLoss = +(Math.min(l1.price, l2.price) - a).toFixed(0);
      const priceTarget = +(neckline + patternHeight).toFixed(0);

      results.push({
        type: 'doubleBottom', name: '이중 바닥 (Double Bottom)', nameShort: '이중바닥',
        signal: 'buy', strength: 'strong', confidence, stopLoss, priceTarget,
        neckline: neckline,
        description: `W형 바닥 — 강한 지지 확인. 형태 점수 ${confidence}%`,
        startIndex: l1.index, endIndex: l2.index,
        marker: { time: candles[l2.index].time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  이중 천장 (Double Top) — 강한 저항
  // ══════════════════════════════════════════════════
  detectDoubleTop(candles, swingHighs, ctx = {}) {
    const results = [];
    const { atr = [], vma = [], hurstWeight: hw = 1, meanRevWeight: mw = 1 } = ctx;
    const recent = swingHighs.filter(h => h.index >= candles.length - 50);

    for (let i = 0; i < recent.length - 1; i++) {
      const h1 = recent[i], h2 = recent[i + 1];
      const a = this._atr(atr, h2.index, candles);
      if (Math.abs(h1.price - h2.price) > a * 0.5) continue;  // Bulkowski: ±0.5 ATR (tighter)

      const span = h2.index - h1.index;
      if (span < 5 || span > 40) continue;

      // 넥라인 (두 고점 사이 최저 저가 — 실제 지지선 반영)
      let neckline = Infinity;
      for (let j = h1.index; j <= h2.index; j++) {
        if (candles[j].low < neckline) neckline = candles[j].low;
      }
      const raw = Math.max(h1.price, h2.price) - neckline;
      const patternHeight = Math.min(raw * hw * mw, raw * PatternEngine.CHART_TARGET_RAW_CAP, a * (ctx.dynamicATRCap || PatternEngine.CHART_TARGET_ATR_CAP));

      const volumeScore = Math.min(this._volRatio(candles, h2.index, vma) / 2, 1);
      const confidence = this._adaptiveQuality('doubleTop', { body: 0.7, volume: volumeScore, trend: 0.6, extra: 1 - Math.abs(h1.price - h2.price) / a });
      const stopLoss = +(Math.max(h1.price, h2.price) + a).toFixed(0);
      const priceTarget = +(neckline - patternHeight).toFixed(0);

      results.push({
        type: 'doubleTop', name: '이중 천장 (Double Top)', nameShort: '이중천장',
        signal: 'sell', strength: 'strong', confidence, stopLoss, priceTarget,
        neckline: neckline,
        description: `M형 천장 — 강한 저항 확인. 형태 점수 ${confidence}%`,
        startIndex: h1.index, endIndex: h2.index,
        marker: { time: candles[h2.index].time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  머리어깨형 (Head & Shoulders) — 강한 하락 반전
  // ══════════════════════════════════════════════════
  detectHeadAndShoulders(candles, swingHighs, swingLows, ctx = {}) {
    const results = [];
    if (swingHighs.length < 3 || swingLows.length < 2) return results;
    const { atr = [], vma = [], hurstWeight: hw = 1, meanRevWeight: mw = 1 } = ctx;

    const hsW = PatternEngine.HS_WINDOW;
    const rH = swingHighs.filter(h => h.index >= candles.length - hsW);
    const rL = swingLows.filter(l => l.index >= candles.length - hsW);

    for (let i = 0; i < rH.length - 2; i++) {
      const ls = rH[i], head = rH[i + 1], rs = rH[i + 2];
      if (head.price <= ls.price || head.price <= rs.price) continue;
      const shoulderAsym = Math.abs(ls.price - rs.price) / head.price;
      if (shoulderAsym > PatternEngine.HS_SHOULDER_TOLERANCE) continue;

      const t1 = rL.find(l => l.index > ls.index && l.index < head.index);
      const t2 = rL.find(l => l.index > head.index && l.index < rs.index);
      if (!t1 || !t2) continue;

      const endIdx = Math.min(rs.index + 3, candles.length - 1);
      const neckSlope = (t2.price - t1.price) / (t2.index - t1.index);
      const neckAtEnd = t1.price + neckSlope * (endIdx - t1.index);
      const lastClose = candles[endIdx].close;

      // 넥라인 근처 또는 이탈 확인
      const a = this._atr(atr, endIdx, candles);
      if (lastClose > neckAtEnd + a * 0.5) continue;
      // [Fix H&S 대칭] 넥라인 하방 이미 원거리 돌파 → 잔여 이동 부족 필터
      if (lastClose < neckAtEnd - a * 2.0) continue;

      // [Fix H&S 대칭] 선행 상승 추세 검증 — H&S는 상승 추세 반전 패턴
      const preLookbackHS = Math.min(10, ls.index);
      if (preLookbackHS >= 3) {
        const prePriceHS = candles[ls.index - preLookbackHS].close;
        const preATR_HS = this._atr(atr, ls.index, candles);
        if (prePriceHS > ls.price - preATR_HS * 0.3) continue;
      }

      const raw = head.price - (t1.price + t2.price) / 2;
      const patternHeight = Math.min(raw * hw * mw, raw * PatternEngine.CHART_TARGET_RAW_CAP, a * (ctx.dynamicATRCap || PatternEngine.CHART_TARGET_ATR_CAP));
      const priceTarget = +(neckAtEnd - patternHeight).toFixed(0);
      // 비대칭 → symmetry 점수: 0%→1.0, 5%→0.5, 10%→0.0 (선형 감산)
      const symmetry = Math.max(0, 1 - shoulderAsym / PatternEngine.HS_SHOULDER_TOLERANCE);
      const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);

      // [Fix H&S 대칭] trend 점수를 선행 추세 기반으로 동적 계산
      let trendScoreHS = 0.5;
      if (preLookbackHS >= 3) {
        const prePriceHS = candles[ls.index - preLookbackHS].close;
        const preATR_HS = this._atr(atr, ls.index, candles);
        const rise = (ls.price - prePriceHS) / (preATR_HS * preLookbackHS);
        trendScoreHS = Math.max(0.3, Math.min(1.0, rise * 2));
      }
      const confidence = this._adaptiveQuality('headAndShoulders', { body: Math.min(patternHeight / a / 3, 1), volume: volumeScore, trend: trendScoreHS, shadow: symmetry });

      results.push({
        type: 'headAndShoulders', name: '머리어깨형 (Head & Shoulders)', nameShort: 'H&S',
        signal: 'sell', strength: 'strong', confidence,
        stopLoss: Math.round(rs.price + a * 1.5), priceTarget,  // 우측 어깨 + 1.5 ATR (head 대비 합리적 손절)
        description: `머리어깨 — 강한 하락 반전. 형태 점수 ${confidence}%`,
        startIndex: ls.index, endIndex: endIdx,
        marker: { time: candles[endIdx].time, position: 'aboveBar', color: KRX_COLORS.PTN_MARKER_SELL, shape: 'arrowDown', text: '' },
        trendlines: [
          { color: KRX_COLORS.PTN_STRUCT, style: 'dashed', points: [
            { time: candles[t1.index].time, value: t1.price },
            { time: candles[t2.index].time, value: t2.price },
          ]},
        ],
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  역머리어깨형 (Inverse H&S) — 강한 상승 반전
  // ══════════════════════════════════════════════════
  detectInverseHeadAndShoulders(candles, swingHighs, swingLows, ctx = {}) {
    const results = [];
    if (swingLows.length < 3 || swingHighs.length < 2) return results;
    const { atr = [], vma = [], hurstWeight: hw = 1, meanRevWeight: mw = 1 } = ctx;

    const hsW = PatternEngine.HS_WINDOW;
    const rL = swingLows.filter(l => l.index >= candles.length - hsW);
    const rH = swingHighs.filter(h => h.index >= candles.length - hsW);

    for (let i = 0; i < rL.length - 2; i++) {
      const ls = rL[i], head = rL[i + 1], rs = rL[i + 2];
      if (head.price >= ls.price || head.price >= rs.price) continue;
      // [P0-fix] head.price 사용 — H&S와 차원 일관성 (기존 ls.price는 비대칭 분모)
      const shoulderAsym = Math.abs(ls.price - rs.price) / Math.abs(head.price);
      if (shoulderAsym > PatternEngine.HS_SHOULDER_TOLERANCE) continue;

      const t1 = rH.find(h => h.index > ls.index && h.index < head.index);
      const t2 = rH.find(h => h.index > head.index && h.index < rs.index);
      if (!t1 || !t2) continue;

      const endIdx = Math.min(rs.index + 3, candles.length - 1);
      const neckSlope = (t2.price - t1.price) / (t2.index - t1.index);
      const neckAtEnd = t1.price + neckSlope * (endIdx - t1.index);
      const lastClose = candles[endIdx].close;
      const a = this._atr(atr, endIdx, candles);
      // [Fix invH&S-gap] 넥라인 근접 필터 양방향: 너무 아래(미형성) 또는 너무 위(이미 돌파 소진)
      // 기존: lastClose < neckAtEnd - a*0.5만 필터 → 이미 원거리 돌파한 패턴도 감지 (잔여 이동 미미)
      // 추가: lastClose > neckAtEnd + a*2.0 → 이미 2 ATR 이상 돌파 → 남은 이동 부족, 거짓 긍정
      // Bulkowski (2005): 넥라인 돌파 후 62% throwback, 대부분 1-2 ATR 이내에서 재진입
      if (lastClose < neckAtEnd - a * 0.5) continue;
      if (lastClose > neckAtEnd + a * 2.0) continue;

      // [Fix invH&S-gap] 선행 하락 추세 검증 — Bulkowski: 역H&S는 하락 추세 반전 패턴
      // 좌측 어깨 전 10봉의 가격이 좌측 어깨보다 높아야 유의미한 하락 맥락 존재
      // 이 필터 없이: 횡보 중 우연한 W형 = 거짓 긍정 → WR 하락의 핵심 원인
      const preLookback = Math.min(10, ls.index);
      if (preLookback >= 3) {
        const prePrice = candles[ls.index - preLookback].close;
        // 선행 하락 요건: 패턴 시작 전 가격이 좌측 어깨보다 높음 (최소 0.3 ATR)
        const preATR = this._atr(atr, ls.index, candles);
        if (prePrice < ls.price + preATR * 0.3) continue;
      }

      const raw = (t1.price + t2.price) / 2 - head.price;
      const patternHeight = Math.min(raw * hw * mw, raw * PatternEngine.CHART_TARGET_RAW_CAP, a * (ctx.dynamicATRCap || PatternEngine.CHART_TARGET_ATR_CAP));
      const priceTarget = +(neckAtEnd + patternHeight).toFixed(0);
      // 비대칭 → symmetry 점수: 0%→1.0, 5%→0.5, 10%→0.0 (선형 감산)
      const symmetry = Math.max(0, 1 - shoulderAsym / PatternEngine.HS_SHOULDER_TOLERANCE);
      const volumeScore = Math.min(this._volRatio(candles, endIdx, vma) / 2, 1);

      // [Fix invH&S-gap] trend 점수를 선행 추세 기반으로 동적 계산 (기존 0.7 하드코딩 제거)
      // Bulkowski: 깊은 선행 하락 → 반전 성공률 상승. ATR 정규화 기울기로 정량화.
      let trendScore = 0.5;
      if (preLookback >= 3) {
        const prePrice = candles[ls.index - preLookback].close;
        const preATR = this._atr(atr, ls.index, candles);
        // 하락 크기 / (ATR * lookback) → 정규화 기울기, clamp [0.3, 1.0]
        const decline = (prePrice - ls.price) / (preATR * preLookback);
        trendScore = Math.max(0.3, Math.min(1.0, decline * 2));
      }
      const confidence = this._adaptiveQuality('inverseHeadAndShoulders', { body: Math.min(patternHeight / a / 3, 1), volume: volumeScore, trend: trendScore, shadow: symmetry });

      results.push({
        type: 'inverseHeadAndShoulders', name: '역머리어깨형 (Inverse H&S)', nameShort: '역H&S',
        signal: 'buy', strength: 'strong', confidence,
        stopLoss: Math.round(rs.price - a * 1.5), priceTarget,  // 우측 어깨 - 1.5 ATR (head 대비 합리적 손절)
        description: `역머리어깨 — 강한 상승 반전. 형태 점수 ${confidence}%`,
        startIndex: ls.index, endIndex: endIdx,
        marker: { time: candles[endIdx].time, position: 'belowBar', color: KRX_COLORS.PTN_MARKER_BUY, shape: 'arrowUp', text: '' },
        trendlines: [
          { color: KRX_COLORS.PTN_STRUCT, style: 'dashed', points: [
            { time: candles[t1.index].time, value: t1.price },
            { time: candles[t2.index].time, value: t2.price },
          ]},
        ],
      });
    }
    return results;
  }

  // ══════════════════════════════════════════════════
  //  지지/저항 수준 탐지
  // ══════════════════════════════════════════════════
  detectSupportResistance(candles, swingHighs, swingLows, ctx = {}) {
    const { atr = [] } = ctx;
    // [Fix] 타임프레임 인식 ATR fallback
    var _srFbPct = PatternEngine.ATR_FALLBACK_BY_TF[PatternEngine._currentTimeframe || '1d'] || PatternEngine.ATR_FALLBACK_PCT;
    const lastATR = atr[candles.length - 1] || candles[candles.length - 1].close * _srFbPct;
    const tol = lastATR * 0.5;

    const pts = [
      ...swingHighs.map(h => ({ price: h.price, type: 'resistance' })),
      ...swingLows.map(l => ({ price: l.price, type: 'support' })),
    ];

    const levels = [];
    const used = new Set();
    for (let i = 0; i < pts.length; i++) {
      if (used.has(i)) continue;
      const cluster = [pts[i]];
      for (let j = i + 1; j < pts.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(pts[j].price - pts[i].price) < tol) {
          cluster.push(pts[j]);
          used.add(j);
        }
      }
      used.add(i);
      if (cluster.length >= 2) {
        const avg = cluster.reduce((s, p) => s + p.price, 0) / cluster.length;
        const sCount = cluster.filter(p => p.type === 'support').length;
        levels.push({
          price: +avg.toFixed(0),
          type: sCount >= cluster.length / 2 ? 'support' : 'resistance',
          touches: cluster.length,
          strength: Math.min(cluster.length / 4, 1),
        });
      }
    }
    return levels.sort((a, b) => b.touches - a.touches).slice(0, 10);
  }

  // ══════════════════════════════════════════════════
  //  밸류에이션 기반 지지/저항 (Fundamental S/R)
  // ══════════════════════════════════════════════════

  /**
   * 펀더멘털 밸류에이션 임계값에서 지지/저항 수준 생성
   *
   * 학술 근거:
   *  - Rothschild & Stiglitz (1976): 정보 비대칭 하에서 시장 참여자는
   *    펀더멘털 밸류에이션 임계점(PBR=1.0, PER=10 등)을 스크리닝 앵커로 사용.
   *  - Shiller (2000) "Irrational Exuberance": 라운드 넘버 및 밸류에이션
   *    배수가 심리적 지지/저항으로 작용 (behavioral anchoring).
   *  - Damodaran (2012): PBR=1.0은 자산 청산 가치, PER=10/15는
   *    KOSPI 역사적 평균/고평가 분기점.
   *
   * PBR 임계값: 0.5(심화저평가), 1.0(순자산가치), 1.5, 2.0, 3.0
   * PER 임계값: 5(심화저평가), 10(가치주), 15(적정), 20(성장주), 30(고평가)
   *
   * @param {number} currentPrice — 현재 주가
   * @param {Object} financialData — { bps, eps, per, pbr } (getFinancialData() 결과)
   * @returns {Array} 밸류에이션 S/R 수준 배열
   */
  detectValuationSR(currentPrice, financialData) {
    if (!currentPrice || currentPrice <= 0 || !financialData) return [];

    const { bps, eps } = financialData;
    const range = PatternEngine.VALUATION_SR_RANGE;
    const strength = PatternEngine.VALUATION_SR_STRENGTH;
    const lowerBound = currentPrice * (1 - range);
    const upperBound = currentPrice * (1 + range);

    const levels = [];

    // PBR 기반 가격 수준 — BPS(주당순자산) × PBR 배수
    // BPS > 0 조건: 자본잠식(BPS<=0) 시 PBR 무의미
    if (bps && bps > 0) {
      const pbrThresholds = [
        { mult: 0.5, label: 'PBR=0.5' },
        { mult: 1.0, label: 'PBR=1.0' },
        { mult: 1.5, label: 'PBR=1.5' },
        { mult: 2.0, label: 'PBR=2.0' },
        { mult: 3.0, label: 'PBR=3.0' },
      ];
      for (let i = 0; i < pbrThresholds.length; i++) {
        const price = Math.round(bps * pbrThresholds[i].mult);
        if (price >= lowerBound && price <= upperBound && price > 0) {
          levels.push({
            price: price,
            type: price < currentPrice ? 'valuation_support' : 'valuation_resistance',
            touches: 1,
            strength: strength,
            label: pbrThresholds[i].label,
          });
        }
      }
    }

    // PER 기반 가격 수준 — EPS(주당순이익) × PER 배수
    // EPS > 0 조건: 적자(EPS<=0) 시 PER 무의미
    if (eps && eps > 0) {
      const perThresholds = [
        { mult: 5,  label: 'PER=5' },
        { mult: 10, label: 'PER=10' },
        { mult: 15, label: 'PER=15' },
        { mult: 20, label: 'PER=20' },
        { mult: 30, label: 'PER=30' },
      ];
      for (let i = 0; i < perThresholds.length; i++) {
        const price = Math.round(eps * perThresholds[i].mult);
        if (price >= lowerBound && price <= upperBound && price > 0) {
          levels.push({
            price: price,
            type: price < currentPrice ? 'valuation_support' : 'valuation_resistance',
            touches: 1,
            strength: strength,
            label: perThresholds[i].label,
          });
        }
      }
    }

    // 중복 제거: PBR과 PER 수준이 근접하면 (2% 이내) 병합하여 라벨 결합
    // 예: PBR=1.0 → 50,000원, PER=10 → 51,000원 → "PBR=1.0 / PER=10"
    const merged = [];
    const used = new Set();
    for (let i = 0; i < levels.length; i++) {
      if (used.has(i)) continue;
      let best = levels[i];
      let combinedLabel = best.label;
      for (let j = i + 1; j < levels.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(levels[j].price - best.price) / currentPrice < 0.02) {
          combinedLabel += ' / ' + levels[j].label;
          // 평균 가격 사용
          best = {
            price: Math.round((best.price + levels[j].price) / 2),
            type: best.type,
            touches: 1,
            strength: strength,
            label: combinedLabel,
          };
          used.add(j);
        }
      }
      best.label = combinedLabel;
      merged.push(best);
      used.add(i);
    }

    // 현재가에 가까운 순서로 정렬, 최대 수 제한
    return merged
      .sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))
      .slice(0, PatternEngine.VALUATION_SR_MAX_LEVELS);
  }

  // ══════════════════════════════════════════════════
  //  컨플루언스 점수 보정
  // ══════════════════════════════════════════════════
  _applyConfluence(patterns, srLevels, ctx = {}) {
    if (!srLevels || !srLevels.length) return;
    const { atr = [], candles: ctxCandles = [] } = ctx;

    patterns.forEach(p => {
      if (p.confidence == null || p.endIndex == null) return;
      // [Fix] 타임프레임 인식 ATR fallback
      const _cls = ctxCandles[p.endIndex] ? ctxCandles[p.endIndex].close : null;
      var _cfFbPct = PatternEngine.ATR_FALLBACK_BY_TF[PatternEngine._currentTimeframe || '1d'] || PatternEngine.ATR_FALLBACK_PCT;
      const a = atr[p.endIndex] || (_cls ? _cls * _cfFbPct : null);
      if (!a) return;
      let boost = 0;

      for (const sr of srLevels) {
        if (p.signal === 'buy' && sr.type === 'support' && p.stopLoss) {
          if (Math.abs(p.stopLoss - sr.price) < a) boost += 3 * sr.strength;
        }
        if (p.signal === 'sell' && sr.type === 'resistance' && p.stopLoss) {
          if (Math.abs(p.stopLoss - sr.price) < a) boost += 3 * sr.strength;
        }
        if (p.priceTarget) {
          if (Math.abs(p.priceTarget - sr.price) < a) boost += 2 * sr.strength;
        }
      }

      if (boost > 0) {
        // Cap at 90: system-wide confidence ceiling (Taleb 2007 — overconfidence bias)
        p.confidence = Math.min(90, p.confidence + Math.round(boost));
        p.confluence = true;
      }
    });
  }

  /** R:R 검증 게이트 — confidence 단조 조정
   *  [Fix] rr>=1.5 → -4 역방향 감산 제거 (ISSUE-15, invH&S -39pp gap 핵심 원인)
   *  기존: [1.0,1.5)="최적" + 양극단 감산 → R:R 단조성 위반. 높은 R:R이
   *        confidence를 낮춰 qualityScaling(conf/50)까지 하향 전파.
   *        invH&S mean R:R=1.03, 상위 25%가 >1.5로 -4 → WR -3~5pp 추정.
   *  수정: rr<0.5 → -5 (극저보상), rr<1.0 → -3, rr>=1.0 → 감산 없음
   *  Bayesian sigmoid(~line 700)이 R:R↔confidencePred 연속 조절 담당.
   *  학술: Schwager (1993) "favor R:R>=2:1". 높은 R:R 패널티는 비학술적. */
  _applyRRGate(patterns, candles) {
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i];
      if (p.priceTarget == null || p.stopLoss == null || p.endIndex == null) continue;
      var entry = candles[p.endIndex] ? candles[p.endIndex].close : null;
      if (!entry) continue;
      var reward = Math.abs(p.priceTarget - entry);
      var risk = Math.abs(entry - p.stopLoss);
      if (risk <= 0) continue;
      var rr = reward / risk;
      p.riskReward = +rr.toFixed(2);
      if (rr < 0.5) {
        p.confidence = Math.max(10, p.confidence - 5);
      } else if (rr < 1.0) {
        p.confidence = Math.max(10, p.confidence - 3);
      }
      // rr >= 1.0: 감산 없음 (단조 원칙 — Bayesian sigmoid이 비현실적 목표 조절)
    }
  }

  // ══════════════════════════════════════════════════
  //  유틸리티: 스윙 포인트 & 중복 제거
  // ══════════════════════════════════════════════════

  _findSwingHighs(candles, lookback, detectFrom) {
    const highs = [];
    for (let i = Math.max(lookback, detectFrom || 0); i < candles.length - lookback; i++) {
      let isHigh = true;
      for (let j = 1; j <= lookback; j++) {
        if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) {
          isHigh = false; break;
        }
      }
      if (isHigh) highs.push({ index: i, price: candles[i].high, time: candles[i].time });
    }
    return highs;
  }

  _findSwingLows(candles, lookback, detectFrom) {
    const lows = [];
    for (let i = Math.max(lookback, detectFrom || 0); i < candles.length - lookback; i++) {
      let isLow = true;
      for (let j = 1; j <= lookback; j++) {
        if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) {
          isLow = false; break;
        }
      }
      if (isLow) lows.push({ index: i, price: candles[i].low, time: candles[i].time });
    }
    return lows;
  }

  // ══════════════════════════════════════════════════
  //  채널 탐지 — Murphy (1999): 평행 추세선 쌍
  //  swing high/low → 상하 추세선 OLS 피팅 → 6단계 검증
  // ══════════════════════════════════════════════════

  detectChannel(candles, swH, swL, ctx = {}) {
    const results = [];
    if (!swH || swH.length < 2 || !swL || swL.length < 2) return results;
    const len = candles.length;
    var _chFbPct = PatternEngine.ATR_FALLBACK_BY_TF[PatternEngine._currentTimeframe || '1d'] || PatternEngine.ATR_FALLBACK_PCT;
    const atr = (ctx.atr && ctx.atr[len - 1]) || candles[len - 1].close * _chFbPct;
    if (atr <= 0) return results;
    // [Batch 2-4] weight 추출 — 다른 차트 패턴과 일관성 (Issue C 수정)
    const hw = ctx.hurstWeight || 1;
    const mw = ctx.meanRevWeight || 1;

    // 최근 CHANNEL_MIN_SPAN 이내의 스윙포인트만 사용
    const minIdx = len - Math.max(PatternEngine.CHANNEL_MIN_SPAN * 3, 60);
    const recentHi = swH.filter(s => s.index >= minIdx);
    const recentLo = swL.filter(s => s.index >= minIdx);
    if (recentHi.length < 2 || recentLo.length < 2) return results;

    // OLS 피팅 (index → price)
    const fitLine = (points) => {
      const n = points.length;
      if (n < 2) return null;
      let sx = 0, sy = 0, sxy = 0, sx2 = 0;
      for (let i = 0; i < n; i++) {
        sx += points[i].index; sy += points[i].price;
        sxy += points[i].index * points[i].price;
        sx2 += points[i].index * points[i].index;
      }
      const denom = n * sx2 - sx * sx;
      if (Math.abs(denom) < 1e-10) return null;
      const slope = (n * sxy - sx * sy) / denom;
      const intercept = (sy - slope * sx) / n;
      return { slope, intercept };
    };

    const hiLine = fitLine(recentHi);
    const loLine = fitLine(recentLo);
    if (!hiLine || !loLine) return results;

    // Step 3: 평행도 검증 — |slope_hi - slope_lo| / ATR < PARALLELISM_MAX
    const slopeDiff = Math.abs(hiLine.slope - loLine.slope);
    if (slopeDiff / atr > PatternEngine.CHANNEL_PARALLELISM_MAX) return results;

    // Step 4: 채널 폭 검증
    const spanStart = Math.min(recentHi[0].index, recentLo[0].index);
    const spanEnd = Math.max(recentHi[recentHi.length - 1].index, recentLo[recentLo.length - 1].index);
    const midIdx = Math.round((spanStart + spanEnd) / 2);
    const width = (hiLine.slope * midIdx + hiLine.intercept) - (loLine.slope * midIdx + loLine.intercept);
    if (width < atr * PatternEngine.CHANNEL_WIDTH_MIN || width > atr * PatternEngine.CHANNEL_WIDTH_MAX) return results;

    // Step 5: 봉 포함율 검증
    const spanLen = spanEnd - spanStart + 1;
    if (spanLen < PatternEngine.CHANNEL_MIN_SPAN) return results;
    let contained = 0;
    for (let i = spanStart; i <= spanEnd && i < len; i++) {
      const upper = hiLine.slope * i + hiLine.intercept;
      const lower = loLine.slope * i + loLine.intercept;
      const tol = atr * 0.15; // 포함율 판정 여유
      if (candles[i].high <= upper + tol && candles[i].low >= lower - tol) contained++;
    }
    if (contained / spanLen < PatternEngine.CHANNEL_CONTAINMENT) return results;

    // Step 6: 터치 수 검증
    const touchTol = atr * PatternEngine.CHANNEL_TOUCH_TOL;
    let hiTouches = 0, loTouches = 0;
    for (const s of recentHi) {
      const lineVal = hiLine.slope * s.index + hiLine.intercept;
      if (Math.abs(s.price - lineVal) <= touchTol) hiTouches++;
    }
    for (const s of recentLo) {
      const lineVal = loLine.slope * s.index + loLine.intercept;
      if (Math.abs(s.price - lineVal) <= touchTol) loTouches++;
    }
    if (hiTouches + loTouches < PatternEngine.CHANNEL_MIN_TOUCHES) return results;

    // 방향 분류
    const avgSlope = (hiLine.slope + loLine.slope) / 2;
    const slopeNorm = avgSlope / atr;
    const direction = Math.abs(slopeNorm) < 0.02 ? 'horizontal'
      : slopeNorm > 0 ? 'ascending' : 'descending';
    const signal = direction === 'ascending' ? 'buy'
      : direction === 'descending' ? 'sell' : 'neutral';

    // confidence: 터치 수 + 포함율 + R² 근사
    const touchScore = Math.min(15, (hiTouches + loTouches - 3) * 5);
    const containScore = Math.min(15, Math.round((contained / spanLen - 0.80) * 150));
    const baseConf = 45 + touchScore + containScore;
    const confidence = Math.max(20, Math.min(85, baseConf));

    const lastClose = candles[len - 1].close;
    const upperNow = hiLine.slope * (len - 1) + hiLine.intercept;
    const lowerNow = loLine.slope * (len - 1) + loLine.intercept;

    const dirLabel = direction === 'ascending' ? '상승' : direction === 'descending' ? '하락' : '횡보';
    results.push({
      type: 'channel',
      name: dirLabel + ' 채널 (' + (direction === 'ascending' ? 'Rising' : direction === 'descending' ? 'Falling' : 'Horizontal') + ' Channel)',
      nameShort: dirLabel + '채널',
      description: '평행 추세선 ' + dirLabel + ' 채널. 형태 점수 ' + confidence + '%',
      subType: direction,
      signal,
      confidence,
      startIndex: spanStart,
      endIndex: spanEnd,
      startTime: candles[spanStart].time,
      endTime: candles[spanEnd].time,
      upperSlope: hiLine.slope,
      upperIntercept: hiLine.intercept,
      lowerSlope: loLine.slope,
      lowerIntercept: loLine.intercept,
      width,
      touches: hiTouches + loTouches,
      containment: +(contained / spanLen).toFixed(2),
      priceTarget: signal === 'buy' ? +(upperNow + width * 0.5 * hw * mw).toFixed(0)
        : signal === 'sell' ? +(lowerNow - width * 0.5 * hw * mw).toFixed(0)
        : +((upperNow + lowerNow) / 2).toFixed(0),
      stopLoss: signal === 'buy' ? lowerNow - atr * PatternEngine.STOP_LOSS_ATR_MULT
        : signal === 'sell' ? upperNow + atr * PatternEngine.STOP_LOSS_ATR_MULT
        : null,
    });
    return results;
  }

  // ══════════════════════════════════════════════════
  //  넥라인 돌파 확인 (H&S, 역H&S, doubleBottom, doubleTop)
  //
  //  시장 심리:
  //  넥라인은 H&S/이중천장에서 매수세의 최후 방어선, 이중바닥/역H&S에서
  //  매도세의 최후 방어선이다. 가격이 이 수준을 ATR*0.5 이상 이탈하면
  //  수급 균형이 깨졌음을 의미하며, 패턴의 예측력이 실현 단계에 진입한다.
  //  Edwards & Magee (2018): "The breakout through the neckline is the
  //  definitive confirmation of the pattern's validity."
  //
  //  알고리즘:
  //  1. endIndex 이후 최대 NECKLINE_BREAK_LOOKFORWARD 봉까지 검사
  //  2. 넥라인 가격 계산 (수평 또는 기울기 보간)
  //  3. close가 넥라인 ± ATR*NECKLINE_BREAK_ATR_MULT 이상 이탈 시 돌파 확인
  //  4. 최초 돌파 bar의 index와 가격 기록
  // ══════════════════════════════════════════════════
  _checkNecklineBreak(candles, pattern, atr) {
    // 기본값: 미확인 상태
    pattern.necklineBreakConfirmed = false;
    pattern.breakIndex = null;
    pattern.breakPrice = null;

    const ei = pattern.endIndex;
    if (ei == null || ei >= candles.length - 1) return;

    const lookforward = PatternEngine.NECKLINE_BREAK_LOOKFORWARD;
    const atrMult = PatternEngine.NECKLINE_BREAK_ATR_MULT;
    const maxIdx = Math.min(ei + lookforward, candles.length - 1);

    const type = pattern.type;

    // ── H&S / 역H&S: 기울기 넥라인 ──
    if (type === 'headAndShoulders' || type === 'inverseHeadAndShoulders') {
      if (!pattern.trendlines || !pattern.trendlines[0] ||
          !pattern.trendlines[0].points || pattern.trendlines[0].points.length < 2) return;

      const pts = pattern.trendlines[0].points;
      // 넥라인 양 끝점의 캔들 인덱스 찾기
      const i1 = candles.findIndex(c => c.time === pts[0].time);
      const i2 = candles.findIndex(c => c.time === pts[1].time);
      if (i1 < 0 || i2 < 0 || i1 === i2) return;

      const v1 = pts[0].value, v2 = pts[1].value;
      const slope = (v2 - v1) / (i2 - i1);

      for (let j = ei + 1; j <= maxIdx; j++) {
        const neckPrice = v1 + slope * (j - i1);
        const a = this._atr(atr, j, candles);
        const threshold = a * atrMult;
        const close = candles[j].close;

        if (type === 'headAndShoulders') {
          // H&S (sell): 가격이 넥라인 아래로 돌파
          if (close < neckPrice - threshold) {
            pattern.necklineBreakConfirmed = true;
            pattern.breakIndex = j;
            pattern.breakPrice = close;
            return;
          }
        } else {
          // 역H&S (buy): 가격이 넥라인 위로 돌파
          if (close > neckPrice + threshold) {
            pattern.necklineBreakConfirmed = true;
            pattern.breakIndex = j;
            pattern.breakPrice = close;
            return;
          }
        }
      }
      return;
    }

    // ── doubleBottom / doubleTop: 수평 넥라인 ──
    if (type === 'doubleBottom' || type === 'doubleTop') {
      const neckline = pattern.neckline;
      if (neckline == null || !isFinite(neckline)) return;

      for (let j = ei + 1; j <= maxIdx; j++) {
        const a = this._atr(atr, j, candles);
        const threshold = a * atrMult;
        const close = candles[j].close;

        if (type === 'doubleBottom') {
          // doubleBottom (buy): 가격이 넥라인 위로 돌파
          if (close > neckline + threshold) {
            pattern.necklineBreakConfirmed = true;
            pattern.breakIndex = j;
            pattern.breakPrice = close;
            return;
          }
        } else {
          // doubleTop (sell): 가격이 넥라인 아래로 돌파
          if (close < neckline - threshold) {
            pattern.necklineBreakConfirmed = true;
            pattern.breakIndex = j;
            pattern.breakPrice = close;
            return;
          }
        }
      }
    }
  }

  // ══════════════════════════════════════════════════
  //  삼각형/쐐기 돌파 확인 — Bulkowski (2005)
  //  미확인 시 breakoutConfirmed = false → confidence 감산 대상
  //  확인 시 breakoutConfirmed = true + breakIndex/breakPrice 기록
  //  symmetricTriangle: 돌파 방향에 따라 signal 동적 전환 (neutral→buy/sell)
  // ══════════════════════════════════════════════════
  _checkTriangleBreakout(candles, pattern, atr) {
    pattern.breakoutConfirmed = false;
    pattern.breakIndex = null;
    pattern.breakPrice = null;

    const ei = pattern.endIndex;
    if (ei == null || ei >= candles.length - 1) return;
    if (!pattern.trendlines || pattern.trendlines.length < 2) return;

    const lookforward = PatternEngine.TRIANGLE_BREAK_LOOKFORWARD;
    const atrMult = PatternEngine.TRIANGLE_BREAK_ATR_MULT;
    const maxIdx = Math.min(ei + lookforward, candles.length - 1);

    const type = pattern.type;

    // 트렌드라인 끝점에서 기울기 추출
    const tl0 = pattern.trendlines[0].points;
    const tl1 = pattern.trendlines[1].points;
    if (!tl0 || tl0.length < 2 || !tl1 || tl1.length < 2) return;

    const i0a = candles.findIndex(c => c.time === tl0[0].time);
    const i0b = candles.findIndex(c => c.time === tl0[1].time);
    const i1a = candles.findIndex(c => c.time === tl1[0].time);
    const i1b = candles.findIndex(c => c.time === tl1[1].time);
    if (i0a < 0 || i0b < 0 || i1a < 0 || i1b < 0) return;
    if (i0a === i0b || i1a === i1b) return;

    const slope0 = (tl0[1].value - tl0[0].value) / (i0b - i0a);
    const slope1 = (tl1[1].value - tl1[0].value) / (i1b - i1a);

    for (let j = ei + 1; j <= maxIdx; j++) {
      const a = this._atr(atr, j, candles);
      const threshold = a * atrMult;
      const close = candles[j].close;

      // 트렌드라인 0: 저항선 (ascending=수평, descending=하향, symmetric=하향, risingWedge=상향, fallingWedge=하향)
      const line0AtJ = tl0[0].value + slope0 * (j - i0a);
      // 트렌드라인 1: 지지선 (ascending=상향, descending=수평, symmetric=상향, risingWedge=상향, fallingWedge=하향)
      const line1AtJ = tl1[0].value + slope1 * (j - i1a);

      if (type === 'ascendingTriangle') {
        // 수평 저항 상방 돌파
        if (close > line0AtJ + threshold) {
          pattern.breakoutConfirmed = true;
          pattern.breakIndex = j;
          pattern.breakPrice = close;
          return;
        }
      } else if (type === 'descendingTriangle') {
        // 수평 지지 하방 돌파
        if (close < line1AtJ - threshold) {
          pattern.breakoutConfirmed = true;
          pattern.breakIndex = j;
          pattern.breakPrice = close;
          return;
        }
      } else if (type === 'risingWedge') {
        // 하향 이탈 (하단 트렌드라인 아래)
        if (close < line1AtJ - threshold) {
          pattern.breakoutConfirmed = true;
          pattern.breakIndex = j;
          pattern.breakPrice = close;
          return;
        }
      } else if (type === 'fallingWedge') {
        // 상향 이탈 (상단 트렌드라인 위)
        if (close > line0AtJ + threshold) {
          pattern.breakoutConfirmed = true;
          pattern.breakIndex = j;
          pattern.breakPrice = close;
          return;
        }
      } else if (type === 'symmetricTriangle') {
        // 양방향 — 돌파 방향에 따라 signal 동적 전환
        if (close > line0AtJ + threshold) {
          pattern.breakoutConfirmed = true;
          pattern.breakIndex = j;
          pattern.breakPrice = close;
          pattern.signal = 'buy';
          pattern.strength = 'strong';
          // 목표가/손절 설정 — 삼각형 높이 측정이동
          const triHeight = Math.abs(tl0[0].value - tl1[0].value);
          const capA = this._atr(atr, ei, candles);
          pattern.priceTarget = +(close + Math.min(triHeight, capA * PatternEngine.CHART_TARGET_ATR_CAP)).toFixed(0);
          pattern.stopLoss = +(line1AtJ - capA).toFixed(0);
          return;
        }
        if (close < line1AtJ - threshold) {
          pattern.breakoutConfirmed = true;
          pattern.breakIndex = j;
          pattern.breakPrice = close;
          pattern.signal = 'sell';
          pattern.strength = 'strong';
          const triHeight = Math.abs(tl0[0].value - tl1[0].value);
          const capA = this._atr(atr, ei, candles);
          pattern.priceTarget = +(close - Math.min(triHeight, capA * PatternEngine.CHART_TARGET_ATR_CAP)).toFixed(0);
          pattern.stopLoss = +(line0AtJ + capA).toFixed(0);
          return;
        }
      }
    }
  }

  _dedup(patterns) {
    // type hierarchy: 더 구체적인 패턴이 덜 구체적인 패턴을 같은 endIndex에서 억제
    // haramiCross > harami (도지가 더 특수 형태): Nison (1991) "more significant"
    // threeInside > harami (3봉 확인 완료가 2봉 미확인보다 우선): Nison (1991)
    // abandonedBaby > morningStar/eveningStar (갭 요구 더 엄격): Bulkowski (2008)
    // longLeggedDoji > doji (하위유형)
    // gravestoneDoji > doji (더 구체적 도지 하위유형): Nison (1991)
    // dragonflyDoji > doji (더 구체적 도지 하위유형): Nison (1991)
    const hierarchy = {
      longLeggedDoji: 'doji',
      gravestoneDoji: 'doji',
      dragonflyDoji: 'doji',
      bullishHaramiCross: 'bullishHarami',
      bearishHaramiCross: 'bearishHarami',
      threeInsideUp: 'bullishHarami',
      threeInsideDown: 'bearishHarami',
      abandonedBabyBullish: 'morningStar',
      abandonedBabyBearish: 'eveningStar',
    };
    const suppressed = new Set();
    for (const p of patterns) {
      if (hierarchy[p.type]) suppressed.add(`${hierarchy[p.type]}-${p.endIndex}`);
    }
    const seen = new Set();
    return patterns.filter(p => {
      const key = `${p.type}-${p.endIndex}`;
      if (seen.has(key)) return false;
      if (suppressed.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// 글로벌 인스턴스
const patternEngine = new PatternEngine();
