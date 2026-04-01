// ══════════════════════════════════════════════════════
//  KRX LIVE — 패턴 학술 메타데이터 + 패턴 UI 패널
//
//  app.js에서 분리된 패턴 분석 UI 전담 모듈.
//  전역 변수/함수로 노출 — 모듈 시스템 없음.
//
//  의존: colors.js (KRX_COLORS), backtester.js (backtester),
//        app.js (patternEnabled, candles, showToast,
//                scrollChartToPattern — 전역)
// ══════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════
//  PATTERN_ACADEMIC_META — 30종 패턴 학술 메타데이터
//
//  각 패턴의 정식 명칭, 분류, 캔들 수, 학술적 설명,
//  시장 심리 해설, Bulkowski 통계, 무효화 조건을 정의.
//
//  참조 문헌:
//    - Steve Nison, "Japanese Candlestick Charting" (1991)
//    - Thomas Bulkowski, "Encyclopedia of Chart Patterns" (2005)
//    - John Murphy, "Technical Analysis of Financial Markets" (1999)
//    - Gregory Morris, "Candlestick Charting Explained" (2006)
// ══════════════════════════════════════════════════════

const PATTERN_ACADEMIC_META = Object.freeze({

  threeWhiteSoldiers: {
    nameKo: '적삼병',
    category: '캔들스틱 (반전)',
    candles: 3,
    academicDesc: '연속 3개의 양봉이 점진적으로 상승하며, 각 봉의 종가가 전일 종가보다 높게 마감. 강력한 매수 압력이 지속됨을 나타내는 상승 반전 신호.',
    psychology: '매수세가 3일 연속 시장을 지배하며, 매도자가 더 이상 가격을 누를 수 없음을 인정하는 심리적 항복 과정. 각 봉의 시가가 전일 몸통 내에서 시작하여 계단식 상승을 형성.',
    bulkowskiWinRate: 82,
    invalidation: '세 번째 봉이 긴 윗꼬리를 형성하거나, 거래량이 감소 추세일 경우 신뢰도 하락. 다음 봉이 두 번째 봉 시가 아래로 하락하면 무효.'
  },

  threeBlackCrows: {
    nameKo: '흑삼병',
    category: '캔들스틱 (반전)',
    candles: 3,
    academicDesc: '연속 3개의 음봉이 점진적으로 하락하며, 각 봉의 종가가 전일 종가보다 낮게 마감. 강력한 매도 압력이 지속됨을 나타내는 하락 반전 신호.',
    psychology: '매도세가 3일 연속 가격을 압박하며, 매수자가 반등 시도에 실패하는 연속적 좌절. 공포 심리가 확산되면서 투매가 가속화.',
    bulkowskiWinRate: 78,
    invalidation: '세 번째 봉이 긴 아래꼬리를 형성하면 매수세 유입 신호. 다음 봉이 두 번째 봉 시가 위로 회복하면 무효.'
  },

  hammer: {
    nameKo: '해머',
    category: '캔들스틱 (반전)',
    candles: 1,
    academicDesc: '하락 추세 말기에 나타나는 짧은 몸통 + 긴 아래꼬리 봉. 아래꼬리가 몸통의 2배 이상이며, 윗꼬리가 거의 없음. 매수세가 장중 저점에서 강하게 반등했음을 의미.',
    psychology: '장중 큰 하락이 발생했으나, 저가에서 매수세가 유입되어 종가 근처까지 가격을 끌어올림. 매도세 소진의 조기 신호.',
    bulkowskiWinRate: 60,
    invalidation: '선행 추세가 하락이 아닌 경우 해머 의미 상실. 다음 봉의 확인(양봉 마감) 없이 단독 사용 시 오류율 증가.'
  },

  invertedHammer: {
    nameKo: '역해머',
    category: '캔들스틱 (반전)',
    candles: 1,
    academicDesc: '하락 추세 말기에 나타나는 짧은 몸통 + 긴 윗꼬리 봉. 윗꼬리가 몸통의 2배 이상이며, 아래꼬리가 거의 없음. 해머의 거울상으로, 매수세의 초기 시도를 보여주나 해머보다 신뢰도가 낮음.',
    psychology: '하락 추세 중 매수세가 장중 상승을 시도했으나 매도 압력에 밀려 종가가 하락. 그러나 매수 시도 자체가 매도세 약화의 초기 징후. Nison (1991): 확인봉(다음 봉 양봉) 필수.',
    bulkowskiWinRate: 50,
    invalidation: '선행 추세가 하락이 아닌 경우 무효. 확인봉(다음 봉 양봉 마감) 없이 단독 사용 시 신뢰도 매우 낮음(~40%). 유성형과 형태 동일하나 맥락(하락 vs 상승)으로 구분.'
  },

  hangingMan: {
    nameKo: '교수형',
    category: '캔들스틱 (반전)',
    candles: 1,
    academicDesc: '상승 추세 고점에서 해머와 동일한 형태(짧은 몸통 + 긴 아래꼬리)가 나타남. 매수세가 저점에서 반등했으나 고점 매물대의 존재를 시사. Nison (1991): 맥락이 패턴을 정의한다.',
    psychology: '상승 중 장중 큰 하락이 발생한 것 자체가 매수 강도 약화 신호. 긴 아래꼬리는 매수세의 최후 저항이며, 확인봉(음봉)이 뒤따르면 추세 전환 확정.',
    bulkowskiWinRate: 59,
    invalidation: '선행 추세가 상승이 아닌 경우 무효. 확인봉(다음 봉 음봉) 없이 단독 신뢰도 41%. 거래량 감소 동반 시 약화.'
  },

  shootingStar: {
    nameKo: '유성형',
    category: '캔들스틱 (반전)',
    candles: 1,
    academicDesc: '상승 추세 말기의 짧은 몸통 + 긴 윗꼬리 봉. 매수세가 장중 고점을 시도했으나 매도 압력에 밀려 종가가 시가 근처로 복귀.',
    psychology: '매수세가 상승을 시도했으나 고가에서 강한 매도벽에 부딪혀 좌절. 추세 전환의 강력한 초기 신호.',
    bulkowskiWinRate: 63,
    invalidation: '다음 봉의 확인(음봉 마감) 필요. 거래량이 평균 이하이면 단순 변동으로 해석.'
  },

  doji: {
    nameKo: '도지',
    category: '캔들스틱 (중립)',
    candles: 1,
    academicDesc: '시가와 종가가 거의 동일한 봉(body/range <= 5%). 매수세와 매도세가 균형을 이루어 방향성이 결정되지 않은 상태. Nison (1991): "the market is at a turning point."',
    psychology: '장중 가격 변동이 있었으나 결국 시가 근처로 복귀. 기존 추세의 모멘텀이 소진되고 있음을 시사. 추세 말기에 출현 시 반전 가능성 상승.',
    bulkowskiWinRate: 42,
    invalidation: '횡보 구간에서 빈번하게 출현하며, 추세가 없는 상황에서는 의미 없음. 확인봉 없이 단독 사용 시 신뢰도 매우 낮음. 거래량이 평균 이하이면 무시.'
  },

  spinningTop: {
    nameKo: '팽이형',
    category: '캔들스틱 (중립)',
    candles: 1,
    academicDesc: '도지보다는 실체가 있으나 작고(body 5~30%), 양쪽 꼬리가 실체 이상으로 긴 봉. 매수/매도 어느 쪽도 우위를 점하지 못한 우유부단 상태. Nison (1991): "spinning tops represent indecision."',
    psychology: '장중 매수세와 매도세가 번갈아 우위를 점했으나 결국 비등비등하게 마감. 추세 지속 후 출현 시 모멘텀 약화 신호. 단독으로는 방향성 없으나 다른 패턴과 복합 시 유효.',
    bulkowskiWinRate: 43,
    invalidation: '횡보 구간에서 매우 빈번(n=559K). 추세 없는 상황에서는 소음. 확인봉 없이 단독 매매 신호로 부적합.'
  },

  bullishEngulfing: {
    nameKo: '상승장악형',
    category: '캔들스틱 (반전)',
    candles: 2,
    academicDesc: '하락 추세에서 음봉 뒤에 그 몸통을 완전히 감싸는 양봉 출현. 매수세가 전일 매도세를 압도적으로 제압했음을 의미하는 강력한 상승 반전 신호.',
    psychology: '전일 매도세가 형성한 하락분을 당일 매수세가 완전히 뒤집음. 시장 심리가 공포에서 탐욕으로 급격히 전환.',
    bulkowskiWinRate: 63,
    invalidation: '장악 봉의 거래량이 전일 대비 감소하면 신뢰도 하락. 이미 과매도 구간이 아닌 경우 효과 감소.'
  },

  bearishEngulfing: {
    nameKo: '하락장악형',
    category: '캔들스틱 (반전)',
    candles: 2,
    academicDesc: '상승 추세에서 양봉 뒤에 그 몸통을 완전히 감싸는 음봉 출현. 매도세가 전일 매수세를 압도적으로 제압하는 하락 반전 신호.',
    psychology: '전일 매수세가 형성한 상승분을 당일 매도세가 완전히 소거. 이익 실현 욕구가 추가 매수 의지를 능가.',
    bulkowskiWinRate: 79,
    invalidation: '장악 봉 거래량 감소 시 신뢰도 하락. 지지선 근처에서는 하락 지속 실패 가능.'
  },

  bullishHarami: {
    nameKo: '상승잉태형',
    category: '캔들스틱 (반전)',
    candles: 2,
    academicDesc: '하락 추세에서 큰 음봉 뒤에 작은 양봉이 전일 몸통 내에 완전히 포함. 매도 모멘텀 약화의 신호. Nison (1991): "harami means pregnant in Japanese."',
    psychology: '전일 강한 매도세 이후, 당일 가격 변동이 전일 범위 내에 갇힘. 매도 에너지가 소진되고 있으나 아직 매수 전환은 확정되지 않음. 확인봉 필요.',
    bulkowskiWinRate: 53,
    invalidation: '확인봉(다음 봉 양봉 마감) 없이 단독 사용 시 신뢰도 낮음. 내포 봉의 body가 너무 작으면(도지급) 잉태십자로 분류.'
  },

  bearishHarami: {
    nameKo: '하락잉태형',
    category: '캔들스틱 (반전)',
    candles: 2,
    academicDesc: '상승 추세에서 큰 양봉 뒤에 작은 음봉이 전일 몸통 내에 완전히 포함. 매수 모멘텀 약화의 신호. Nison (1991): 내포(containment) 구조.',
    psychology: '전일 강한 매수세 이후, 당일 가격 변동이 전일 범위 내에 갇힘. 매수 에너지 소진 징후이나 확인봉 없이는 단순 조정 가능성.',
    bulkowskiWinRate: 53,
    invalidation: '확인봉(다음 봉 음봉 마감) 없이 단독 사용 시 신뢰도 낮음. 상승 추세가 아닌 횡보에서 출현하면 의미 약화.'
  },

  morningStar: {
    nameKo: '샛별형',
    category: '캔들스틱 (반전)',
    candles: 3,
    academicDesc: '하락 추세 후 긴 음봉 \u2192 갭 하락 후 짧은 몸통(별) \u2192 갭 상승 후 긴 양봉의 3봉 구성. 가장 신뢰도 높은 상승 반전 패턴 중 하나.',
    psychology: '1일차의 강한 하락 후, 2일차에 매도세가 소진되어 작은 봉을 형성. 3일차에 매수세가 압도하며 추세를 반전시킴.',
    bulkowskiWinRate: 78,
    invalidation: '별(2봉)의 거래량이 극히 적으면 우연적 형성 가능. 3봉의 종가가 1봉 몸통의 50% 이상을 회복하지 못하면 약한 신호.'
  },

  eveningStar: {
    nameKo: '석별형',
    category: '캔들스틱 (반전)',
    candles: 3,
    academicDesc: '상승 추세 후 긴 양봉 \u2192 갭 상승 후 짧은 몸통(별) \u2192 갭 하락 후 긴 음봉의 3봉 구성. 가장 신뢰도 높은 하락 반전 패턴 중 하나.',
    psychology: '1일차의 강한 상승 후, 2일차에 매수세가 소진되어 우유부단한 봉 형성. 3일차에 매도세가 지배하며 추세를 반전.',
    bulkowskiWinRate: 72,
    invalidation: '3봉의 종가가 1봉 몸통의 50% 이상을 하락시키지 못하면 약한 신호. 거래량 감소 시 무효.'
  },

  threeInsideUp: {
    nameKo: '상승삼내형',
    category: '캔들스틱 (반전)',
    candles: 3,
    academicDesc: '하락 추세에서 큰 음봉(1봉) + 내포 양봉(2봉, 잉태형) + 확인 양봉(3봉, 1봉 시가 상향 돌파). 잉태형에 확인봉이 추가되어 강한 상승 반전 패턴. Nison (1991): "three inside up confirms the harami."',
    psychology: '1일차 강한 매도세 이후, 2일차에 가격이 전일 범위 내에 갇히며 매도 모멘텀 소진. 3일차에 매수세가 1일차 시가를 돌파하며 추세 전환 확정. 미확인 잉태형(2봉)의 불확실성을 3봉이 해소.',
    bulkowskiWinRate: 55,
    invalidation: '3봉의 종가가 1봉 시가를 돌파하지 못하면 무효. 거래량 감소 추세이면 신뢰도 하락. 횡보 구간에서 출현 시 의미 약화.'
  },

  threeInsideDown: {
    nameKo: '하락삼내형',
    category: '캔들스틱 (반전)',
    candles: 3,
    academicDesc: '상승 추세에서 큰 양봉(1봉) + 내포 음봉(2봉, 잉태형) + 확인 음봉(3봉, 1봉 시가 하향 돌파). 잉태형에 확인봉이 추가되어 강한 하락 반전 패턴. Nison (1991): "three inside down confirms the bearish harami."',
    psychology: '1일차 강한 매수세 이후, 2일차에 가격이 전일 범위 내에 갇히며 매수 모멘텀 소진. 3일차에 매도세가 1일차 시가를 하향 돌파하며 추세 전환 확정.',
    bulkowskiWinRate: 55,
    invalidation: '3봉의 종가가 1봉 시가를 돌파하지 못하면 무효. 거래량 감소 추세이면 신뢰도 하락.'
  },

  piercingLine: {
    nameKo: '관통형',
    category: '캔들스틱 (반전)',
    candles: 2,
    academicDesc: '하락 추세에서 음봉 뒤에 갭 하락 시작 후 전일 몸통의 50% 이상을 관통하는 양봉. 매수세의 강력한 반격 신호.',
    psychology: '시가에서 공포 매도가 지속되었으나, 저가 매수세가 유입되어 전일 하락분의 절반 이상을 회복. 매도 피로의 명확한 증거.',
    bulkowskiWinRate: 64,
    invalidation: '관통 비율이 50% 미만이면 유효하지 않음. KRX 시장은 가격제한폭(30%)으로 갭이 제한적이므로 갭 조건을 완화 적용.'
  },

  darkCloud: {
    nameKo: '먹구름형',
    category: '캔들스틱 (반전)',
    candles: 2,
    academicDesc: '상승 추세에서 양봉 뒤에 갭 상승 시작 후 전일 몸통의 50% 이상을 하락 관통하는 음봉. 매도세의 강력한 반격.',
    psychology: '시가에서 추가 매수가 시도되었으나, 고가 매도 압력이 유입되어 전일 상승분의 절반 이상을 소거. 매수 피로 신호.',
    bulkowskiWinRate: 60,
    invalidation: '관통 비율 50% 미만 시 무효. 저항선이 명확하지 않으면 단순 조정으로 해석 가능.'
  },

  dragonflyDoji: {
    nameKo: '잠자리도지',
    category: '캔들스틱 (반전)',
    candles: 1,
    academicDesc: '시가 = 종가 = 고가이며 긴 아래꼬리가 있는 도지. 장중 큰 하락 후 완전 회복. 하락 추세에서 나타나면 강력한 상승 반전 신호.',
    psychology: '매도세가 장중 가격을 크게 밀어내렸으나, 매수세가 전량 회수하여 시가까지 복귀. 바닥 형성의 강한 증거.',
    bulkowskiWinRate: 57,
    invalidation: '상승 추세에서 나타나면 약세 신호일 수 있음. 거래량 동반 필수.'
  },

  gravestoneDoji: {
    nameKo: '비석도지',
    category: '캔들스틱 (반전)',
    candles: 1,
    academicDesc: '시가 = 종가 = 저가이며 긴 윗꼬리가 있는 도지. 장중 큰 상승 후 완전 반락. 상승 추세에서 나타나면 하락 반전 신호.',
    psychology: '매수세가 장중 가격을 크게 밀어올렸으나, 매도세가 전량 압박하여 시가까지 하락. 천장 형성의 증거.',
    bulkowskiWinRate: 54,
    invalidation: '하락 추세에서 나타나면 강세 신호일 수 있음. 긴 윗꼬리의 저항선과 합치 시 신뢰도 상승.'
  },

  tweezerBottom: {
    nameKo: '족집게바닥',
    category: '캔들스틱 (반전)',
    candles: 2,
    academicDesc: '연속 2봉의 저가가 거의 동일한 수준에서 형성. 하락 추세에서 해당 가격대의 강력한 지지를 확인.',
    psychology: '동일 가격대에서 2회 연속 지지가 확인되면, 해당 수준이 시장 참여자들에게 강한 가치 인식 영역으로 작용.',
    bulkowskiWinRate: 56,
    invalidation: '두 봉의 저가 차이가 ATR의 10%를 초과하면 족집게로 인정하지 않음. 추가 하락 시 무효.'
  },

  tweezerTop: {
    nameKo: '족집게천장',
    category: '캔들스틱 (반전)',
    candles: 2,
    academicDesc: '연속 2봉의 고가가 거의 동일한 수준에서 형성. 상승 추세에서 해당 가격대의 강력한 저항을 확인.',
    psychology: '동일 가격대에서 2회 연속 저항이 확인되면, 해당 수준이 공급 과잉 영역으로 작용하여 추가 상승 불가.',
    bulkowskiWinRate: 56,
    invalidation: '두 봉의 고가 차이가 ATR의 10%를 초과하면 무효. 돌파 시 오히려 매수 신호.'
  },

  bullishMarubozu: {
    nameKo: '양봉 마루보주',
    category: '캔들스틱 (지속)',
    candles: 1,
    academicDesc: '시가=저가, 종가=고가. 꼬리가 거의 없는 양봉으로, 시가부터 종가까지 매수세가 장 전체를 지배. 강한 상승 지속 신호.',
    psychology: '매도세의 장중 반격이 전혀 없었으며, 매수세가 시가 이후 단 한 번도 밀리지 않고 종가까지 일방적으로 끌어올림. 극도로 강한 매수 심리.',
    bulkowskiWinRate: 72,
    invalidation: '거래량이 평균 이하이면 유동성 부족에 의한 왜곡 가능. 상승 추세 말기에 나타나면 클라이맥스 매수(고점 경고)로 해석될 수 있음.'
  },

  bearishMarubozu: {
    nameKo: '음봉 마루보주',
    category: '캔들스틱 (지속)',
    candles: 1,
    academicDesc: '시가=고가, 종가=저가. 꼬리가 거의 없는 음봉으로, 시가부터 종가까지 매도세가 장 전체를 지배. 강한 하락 지속 신호.',
    psychology: '매수세의 장중 반등이 전혀 없었으며, 매도세가 시가 이후 단 한 번도 밀리지 않고 종가까지 일방적으로 압박. 극도로 강한 매도 심리(공포).',
    bulkowskiWinRate: 71,
    invalidation: '거래량이 평균 이하이면 유동성 부족에 의한 왜곡 가능. 하락 추세 말기에 나타나면 클라이맥스 매도(바닥 경고)로 해석될 수 있음.'
  },

  longLeggedDoji: {
    nameKo: '긴다리도지',
    category: '캔들스틱 (중립)',
    candles: 1,
    academicDesc: '시가와 종가가 거의 동일하며, 위아래 모두 긴 꼬리를 가진 도지. 장중 큰 폭의 상승과 하락이 동시에 발생했으나 결국 시가 근처로 복귀. 극도의 우유부단 신호.',
    psychology: '매수세와 매도세가 장중 격렬하게 충돌했으나 어느 쪽도 승리하지 못함. 추세 전환의 전조이며, 이후 방향은 확인봉으로 결정. Nison (1991): "among the most important of the doji."',
    bulkowskiWinRate: 45,
    invalidation: '거래량이 평균 이하이면 유동성 부족에 의한 우연적 형성. 양쪽 꼬리의 비대칭이 크면 단순 도지로 재분류.'
  },

  bullishBeltHold: {
    nameKo: '강세띠두름',
    category: '캔들스틱 (반전)',
    candles: 1,
    academicDesc: '하락 추세에서 시가=저가(또는 극근접)인 큰 양봉. 시가에서 갭 반전 후 종가까지 매수세가 지배. Morris (2006): 마루보주보다 덜 극단적이나 강력한 반전 신호.',
    psychology: '장 시작과 동시에 매수세가 완전히 장악하여 한 번도 시가 아래로 밀리지 않음. 하락 추세의 급격한 심리 전환을 의미.',
    bulkowskiWinRate: 51,
    invalidation: '선행 추세가 하락이 아닌 경우 무효. 마루보주(body 85%+) 조건 충족 시 마루보주로 분류됨.'
  },

  bearishBeltHold: {
    nameKo: '약세띠두름',
    category: '캔들스틱 (반전)',
    candles: 1,
    academicDesc: '상승 추세에서 시가=고가(또는 극근접)인 큰 음봉. 시가에서 갭 반전 후 종가까지 매도세가 지배. Morris (2006): 강한 하락 반전 신호.',
    psychology: '장 시작과 동시에 매도세가 완전히 장악하여 한 번도 시가 위로 올리지 못함. 상승 추세의 급격한 심리 붕괴.',
    bulkowskiWinRate: 57,
    invalidation: '선행 추세가 상승이 아닌 경우 무효. 마루보주 조건 충족 시 마루보주로 분류됨.'
  },

  bullishHaramiCross: {
    nameKo: '강세잉태십자',
    category: '캔들스틱 (반전)',
    candles: 2,
    academicDesc: '하락 추세에서 큰 음봉 뒤에 도지가 음봉 몸통 내에 완전히 포함. 일반 잉태형보다 강한 반전 신호. Nison (1991): "considered a more significant reversal signal than a regular harami."',
    psychology: '전일 강한 매도세 이후, 당일 매수세와 매도세가 완벽히 균형을 이루어 도지 형성. 방향성이 0으로 수렴 = 매도 모멘텀 완전 소멸.',
    bulkowskiWinRate: 46,
    invalidation: '도지 봉의 거래량이 극히 적으면 유동성 부족 신호. 확인봉(다음 봉 양봉) 없이 단독 사용 시 신뢰도 하락.'
  },

  bearishHaramiCross: {
    nameKo: '약세잉태십자',
    category: '캔들스틱 (반전)',
    candles: 2,
    academicDesc: '상승 추세에서 큰 양봉 뒤에 도지가 양봉 몸통 내에 완전히 포함. 일반 잉태형보다 강한 하락 반전 신호. Nison (1991): harami cross.',
    psychology: '전일 강한 매수세 이후, 당일 완벽한 균형(도지) = 매수 모멘텀 소멸. 이익 실현 압력이 추가 매수 의지를 정확히 상쇄.',
    bulkowskiWinRate: 58,
    invalidation: '도지 봉의 거래량이 극히 적으면 유동성 부족. 확인봉(다음 봉 음봉) 없으면 신뢰도 하락.'
  },

  stickSandwich: {
    nameKo: '스틱샌드위치',
    category: '캔들스틱 (반전)',
    candles: 3,
    academicDesc: '음봉 → 양봉 → 음봉의 3봉 구조에서 1봉과 3봉의 종가가 거의 동일. 동일 가격 수준에서 2회 지지 확인. Bulkowski (2008): 강세 반전 패턴.',
    psychology: '같은 가격에서 반복적으로 매수세가 유입되어 바닥을 형성. 중간 양봉의 반등 시도가 실패했으나, 동일 종가 방어는 해당 수준이 강력한 가치 인식 영역임을 확인.',
    bulkowskiWinRate: 52,
    invalidation: '두 음봉의 종가 차이가 클수록 신뢰도 하락. 하락 추세가 아닌 횡보에서 출현하면 의미 약화. 거래량 감소 동반 시 무효.'
  },

  abandonedBabyBullish: {
    nameKo: '강세버림받은아기',
    category: '캔들스틱 (반전)',
    candles: 3,
    academicDesc: '하락 추세에서 긴 음봉 → 갭 하락 도지(고가가 전일 저가보다 낮음) → 갭 상승 양봉. 도지가 양쪽으로 갭에 의해 분리된 극히 희귀한 강력 반전 패턴.',
    psychology: '1일차 강한 하락 후, 2일차에 갭 하락하며 매도 절정 도달. 그러나 도지 형성으로 추가 하락 실패. 3일차에 갭 상승하며 매수세가 완전히 주도권 장악.',
    bulkowskiWinRate: 52,
    invalidation: 'KRX 시장은 연속매매 구조로 갭 발생이 미국보다 드물어 출현 빈도가 매우 낮음(n~137). 갭 조건 미충족 시 샛별형으로 분류.'
  },

  abandonedBabyBearish: {
    nameKo: '약세버림받은아기',
    category: '캔들스틱 (반전)',
    candles: 3,
    academicDesc: '상승 추세에서 긴 양봉 → 갭 상승 도지(저가가 전일 고가보다 높음) → 갭 하락 음봉. 도지가 양쪽으로 갭에 의해 분리된 극히 희귀한 하락 반전 패턴.',
    psychology: '1일차 강한 상승 후, 2일차에 갭 상승하며 매수 절정 도달. 그러나 도지 형성으로 추가 상승 실패. 3일차에 갭 하락하며 매도세가 완전히 주도.',
    bulkowskiWinRate: 65,
    invalidation: 'KRX 갭 발생 빈도가 낮아 출현 극히 희귀(n~71). 갭 조건 미충족 시 석별형으로 분류.'
  },

  ascendingTriangle: {
    nameKo: '상승삼각형',
    category: '차트패턴 (지속)',
    candles: 20,
    academicDesc: '수평 저항선 + 상승 지지선이 수렴하며 삼각형 형성. 상방 돌파 확률이 높은 강세 지속/반전 패턴.',
    psychology: '매수세가 점점 높은 가격에서 매수를 시도하면서 저점이 상승. 저항선에 대한 반복적 도전은 결국 돌파를 유도.',
    bulkowskiWinRate: 75,
    invalidation: '저항선 하방 이탈 시 패턴 실패 (베어 트랩 가능). 삼각형 완성 전 봉수의 2/3 이상 경과 시 돌파 확률 감소.'
  },

  descendingTriangle: {
    nameKo: '하락삼각형',
    category: '차트패턴 (지속)',
    candles: 20,
    academicDesc: '수평 지지선 + 하락 저항선이 수렴하며 삼각형 형성. 하방 이탈 확률이 높은 약세 지속/반전 패턴.',
    psychology: '매도세가 점점 낮은 가격에서 매도를 시도하면서 고점이 하락. 지지선에 대한 반복적 압박은 결국 이탈을 유도.',
    bulkowskiWinRate: 72,
    invalidation: '지지선 상방 돌파 시 패턴 실패 (불 트랩 가능). 완성 전 2/3 이상 경과 시 돌파 확률 감소.'
  },

  risingWedge: {
    nameKo: '상승쐐기',
    category: '차트패턴 (반전)',
    candles: 20,
    academicDesc: '상승하는 두 수렴 추세선이 쐐기 형성. 상승 추세 내에서 나타나면 하락 반전, 하락 추세 내에서는 하락 지속 신호.',
    psychology: '가격이 상승하지만 범위가 좁아짐 -- 매수 모멘텀이 소진되고 있음. 매수자의 피로가 누적되어 결국 하방 이탈.',
    bulkowskiWinRate: 66,
    invalidation: '상방 돌파 시 패턴 무효. 쐐기 내 거래량이 증가 추세이면 의미 약화.'
  },

  fallingWedge: {
    nameKo: '하락쐐기',
    category: '차트패턴 (반전)',
    candles: 20,
    academicDesc: '하락하는 두 수렴 추세선이 쐐기 형성. 하락 추세 내에서 나타나면 상승 반전, 상승 추세 내에서는 상승 지속 신호.',
    psychology: '가격이 하락하지만 범위가 좁아짐 -- 매도 모멘텀이 소진. 매도자의 피로가 누적되어 결국 상방 돌파.',
    bulkowskiWinRate: 68,
    invalidation: '하방 이탈 시 패턴 무효. 돌파 시 거래량 급증이 동반되어야 유효.'
  },

  symmetricTriangle: {
    nameKo: '대칭삼각형',
    category: '차트패턴 (중립)',
    candles: 20,
    academicDesc: '하향하는 고점 추세선과 상향하는 저점 추세선이 수렴. 매수세와 매도세가 균형을 이루며 에너지가 압축되다가 한쪽 방향으로 폭발적 돌파 발생.',
    psychology: '시장 참여자들의 불확실성이 증가하며, 가격 변동폭이 줄어든다. 돌파 방향은 사전 예측 불가하나 Bulkowski 통계상 54%가 상방 돌파.',
    bulkowskiWinRate: 66,
    invalidation: '수렴 이탈 없이 삼각형 꼭짓점(apex)을 초과하면 패턴 소멸. 거짓 돌파(throwback) 37% 발생.'
  },

  channel: {
    nameKo: '채널',
    category: '차트패턴 (추세)',
    candles: 15,
    academicDesc: '평행한 상단·하단 추세선 사이에서 가격이 규칙적으로 왕복하는 구조. Murphy (1999): 추세 채널은 지지·저항 수준을 동시에 제공하며, 채널 폭은 변동성을 반영.',
    psychology: '트레이더들이 반복된 가격 수준에서 매수·매도 결정을 내리면서 자기실현적 지지·저항이 형성. 채널 이탈 시 포지션 청산이 집중되어 급등·급락 유발.',
    bulkowskiWinRate: 58,
    invalidation: '가격이 채널 상단/하단을 ATR×1.5 이상 이탈하면 채널 패턴 소멸. 채널 폭이 ATR×1.5 미만으로 좁아지면 수렴 패턴(삼각형)으로 전환.'
  },

  cupAndHandle: {
    nameKo: '컵앤핸들',
    category: '차트패턴 (지속)',
    candles: 40,
    academicDesc: 'U자형 컵(30-65봉) + 소규모 하락 핸들로 구성된 강세 지속 패턴. O\'Neil (1988) "How to Make Money in Stocks"에서 체계화. Bulkowski (2005): 61% 돌파 성공률. R²>0.6 파라볼릭 피팅으로 U-shape 검증.',
    psychology: '컵은 기관의 단계적 포지션 구축(accumulation)을, 핸들은 마지막 약한 보유자의 이탈(shakeout)을 나타냄. 핸들 완성 후 돌파 시 축적된 매수 에너지가 폭발.',
    bulkowskiWinRate: 61,
    invalidation: '핸들 깊이가 컵 깊이의 50%를 초과하면 패턴 무효. 오른쪽 림이 왼쪽 림의 90% 미만이면 컵 미완성.'
  },

  doubleBottom: {
    nameKo: '이중바닥',
    category: '차트패턴 (반전)',
    candles: 20,
    academicDesc: '두 개의 비슷한 저점(W자 형태) + 목선(neckline) 돌파로 완성. 가장 보편적인 강세 반전 패턴.',
    psychology: '동일 가격대에서 2회 매수세가 유입되어 강력한 바닥을 형성. 목선 돌파 시 억눌린 매수 에너지가 분출.',
    bulkowskiWinRate: 78,
    invalidation: '두 저점의 차이가 클수록(>3%) 신뢰도 하락. 목선 돌파 후 재하락(throwback)이 50%에서 발생하나 보통 유지.'
  },

  doubleTop: {
    nameKo: '이중천장',
    category: '차트패턴 (반전)',
    candles: 20,
    academicDesc: '두 개의 비슷한 고점(M자 형태) + 목선 하방 이탈로 완성. 가장 보편적인 약세 반전 패턴.',
    psychology: '동일 가격대에서 2회 매도 압력이 발생하여 강력한 천장 형성. 목선 이탈 시 패닉 매도 유발.',
    bulkowskiWinRate: 73,
    invalidation: '두 고점의 차이가 클수록(>3%) 신뢰도 하락. 목선 하방 이탈 후 풀백이 발생할 수 있으나 보통 재차 하락.'
  },

  headAndShoulders: {
    nameKo: '머리어깨형',
    category: '차트패턴 (반전)',
    candles: 30,
    academicDesc: '좌측어깨 \u2192 머리(최고점) \u2192 우측어깨의 3봉우리 구조 + 넥라인 하방 이탈. 가장 신뢰도 높은 하락 반전 패턴.',
    psychology: '매수세가 3차례 고점 도전하나 점차 약화(머리 이후 우측어깨가 더 낮음). 넥라인 이탈은 매수세 완전 항복을 의미.',
    bulkowskiWinRate: 83,
    invalidation: '우측어깨가 머리보다 높으면 패턴 무효. 넥라인 기울기가 급격하면 신뢰도 하락.'
  },

  inverseHeadAndShoulders: {
    nameKo: '역머리어깨형',
    category: '차트패턴 (반전)',
    candles: 30,
    academicDesc: '좌측어깨(저점) \u2192 머리(최저점) \u2192 우측어깨(저점)의 역3봉우리 + 넥라인 상방 돌파. 가장 신뢰도 높은 상승 반전 패턴.',
    psychology: '매도세가 3차례 저점 도전하나 점차 약화(머리 이후 우측어깨가 더 높음). 넥라인 돌파는 매도세 완전 소진을 의미.',
    bulkowskiWinRate: 89,
    invalidation: '우측어깨가 머리보다 낮으면 패턴 무효. 넥라인 돌파 시 거래량 급증이 동반되어야 유효.'
  },

});


// ══════════════════════════════════════════════════════
//  패턴 분석 패널
// ══════════════════════════════════════════════════════

// ── 모델 성능 섹션 — fetch 캐시 (전체 모델 수준, 종목 무관) ──
var _modelPerfCache  = null;   // 파싱된 walk_forward 객체 또는 false (로드 실패)
var _modelPerfFetching = false; // 중복 fetch 방지

function renderPatternPanel(patterns) {
  // 요약 바 업데이트
  updatePatternSummaryBar(patterns);

  // 과거 수익률 바 업데이트 (backtester 의존)
  updatePatternHistoryBar(patterns);

  // Phase 1: 수익률 테이블 (차트 하단 #php-tbody)
  updatePatternHistoryTable(patterns);

  // Phase 1: 수익률 그리드 (차트 하단 #rs-grid, 기간 탭 연동)
  updateReturnStatsGrid(patterns);

  // Phase 1: C열 패턴 카드 (#pp-cards)
  renderPatternCards(patterns);

  // Phase 4-4: 모델 성능 섹션 (OOS IC + 95% CI)
  renderModelPerfSection();

  const panel = document.getElementById('pattern-list');
  if (!panel) return;
  if (!patterns.length) {
    panel.innerHTML = '<div class="pattern-empty">감지된 패턴이 없습니다</div>';
    return;
  }

  // [FIX-TRUST] 데모/시뮬레이션 데이터 패턴 경고
  var _demoWarningHtml = '';
  if (typeof isRealData === 'function' && !isRealData()) {
    _demoWarningHtml = '<div style="padding:4px 8px;margin:0 0 6px 0;background:rgba(255,152,0,0.10);border:1px solid rgba(255,152,0,0.25);border-radius:4px;font-size:10px;color:rgba(255,152,0,0.75);text-align:center;">' +
      '\u26A0 시뮬레이션 데이터의 패턴 \u2014 실제 시장 신호 아님</div>';
  }

  panel.innerHTML = _demoWarningHtml + patterns.map((p, idx) => {
    const sc = p.signal === 'buy' ? 'buy' : p.signal === 'sell' ? 'sell' : 'neutral';
    const st = p.signal === 'buy' ? '매수' : p.signal === 'sell' ? '매도' : '중립';
    const str = p.strength === 'strong' ? '강' : p.strength === 'medium' ? '중' : '약';
    const confVal = p.confidence != null ? p.confidence : 0;
    const confColor = confVal >= 60 ? KRX_COLORS.UP : confVal >= 40 ? KRX_COLORS.ACCENT : KRX_COLORS.DOWN;
    const conf = p.confidence != null
      ? `<span class="pattern-conf" style="color:${confColor}; --conf-pct:${Math.min(confVal, 100)}%">${confVal}%</span>` : '';
    const risk = (p.stopLoss || p.priceTarget)
      ? `<div class="pattern-risk">${p.stopLoss ? `<span>손절 ${p.stopLoss.toLocaleString()}</span>` : ''}${p.priceTarget ? `<span>목표 ${p.priceTarget.toLocaleString()}</span>` : ''}${p.confluence ? '<span class="confluence-badge">합류</span>' : ''}</div>` : '';

    // 클릭-to-스크롤: endIndex 또는 index 기준 time/index 데이터 속성
    const endIdx = p.endIndex != null ? p.endIndex : (p.index != null ? p.index : (p.startIndex || 0));
    const timeVal = (candles[endIdx] && candles[endIdx].time) || '';

    return `<div class="pattern-item ${sc}" data-pattern-idx="${idx}" data-time="${timeVal}" data-index="${endIdx}" title="클릭하여 차트에서 확인"><div class="pattern-header"><span class="pattern-name">${p.nameShort || p.name || p.type}</span>${conf}<span class="pattern-signal ${sc}">${st}</span><span class="pattern-strength">${str}</span></div><div class="pattern-desc">${p.description}</div>${risk}</div>`;
  }).join('');

  // 패턴 항목 클릭 → 해당 봉으로 차트 스크롤
  panel.querySelectorAll('.pattern-item[data-time]').forEach(el => {
    el.addEventListener('click', () => {
      const time = el.dataset.time;
      const index = parseInt(el.dataset.index, 10);
      scrollChartToPattern(time, isNaN(index) ? null : index);
    });
  });
}

/**
 * 패턴 요약 바 업데이트 (차트 하단)
 * 감지된 패턴 수 + 최고 신뢰도 패턴 1개 표시
 */
function updatePatternSummaryBar(patterns) {
  const bar = document.getElementById('pattern-summary-bar');
  const textEl = document.getElementById('psb-text');
  if (!bar || !textEl) return;

  if (!patterns || !patterns.length) {
    textEl.innerHTML = '감지된 패턴 없음';
    // 아이콘 색상을 muted로
    const icon = bar.querySelector('.psb-icon');
    if (icon) icon.style.color = 'var(--text-muted)';
    return;
  }

  // 최고 신뢰도 패턴 찾기
  const sorted = [...patterns].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const top = sorted[0];
  const confVal = top.confidence || 0;
  const confClass = confVal >= 60 ? 'high' : confVal >= 40 ? 'mid' : 'low';
  const signalText = top.signal === 'buy' ? '매수' : top.signal === 'sell' ? '매도' : '중립';

  // 학술 설명 툴팁 (PATTERN_ACADEMIC_META에서 가져오기)
  const topMeta = PATTERN_ACADEMIC_META[top.type];
  const tooltipAttr = topMeta
    ? ` data-tooltip="${topMeta.academicDesc.replace(/"/g, '&quot;')}"`
    : '';

  // [FIX-TRUST] 데모 모드 시 패턴 요약에 경고 뱃지 추가
  var _demoTag = '';
  if (typeof isRealData === 'function' && !isRealData()) {
    _demoTag = ' <span style="font-size:9px;color:rgba(255,152,0,0.65);font-weight:400;">(시뮬레이션)</span>';
  }

  textEl.innerHTML =
    `패턴 <span class="psb-count">${patterns.length}개</span> 감지${_demoTag}` +
    ` | 최고: <span class="psb-top"${tooltipAttr}>${top.nameShort || top.name || top.type}</span>` +
    ` <span class="psb-conf ${confClass}">${confVal}%</span>` +
    ` (${signalText})`;

  // 아이콘 색상: 매수/매도에 따라
  const icon = bar.querySelector('.psb-icon');
  if (icon) {
    icon.style.color = top.signal === 'buy' ? 'var(--up)' :
                        top.signal === 'sell' ? 'var(--down)' : 'var(--accent)';
  }

  // [Phase1-C] Active 패턴 방향 틴트 (줌인 시 시각적 맥락 유지)
  bar.classList.remove('has-active-buy', 'has-active-sell');
  var hasActive = patterns.some(function(p) {
    return (p.priceTarget != null || p.stopLoss != null) &&
           typeof _getPatternOutcome === 'function' &&
           _getPatternOutcome(p, typeof candles !== 'undefined' ? candles : []) === 'active';
  });
  if (hasActive) {
    bar.classList.add(top.signal === 'buy' ? 'has-active-buy' : 'has-active-sell');
  }
}

// ══════════════════════════════════════════════════════
//  패턴 과거 수익률 바
//
//  현재 감지된 패턴 중 상위 3개에 대해 backtester의 결과를
//  가져와 5일 후 평균 수익률 + 승률을 차트 하단에 표시.
//  backtester 객체가 없거나 데이터 부족 시 숨김 처리.
// ══════════════════════════════════════════════════════

function updatePatternHistoryBar(patterns) {
  const bar = document.getElementById('pattern-history-bar');
  if (!bar) return;

  // 패턴 비활성 or 패턴 없음 or backtester 없음
  if (!patternEnabled || !patterns || !patterns.length || typeof backtester === 'undefined') {
    bar.style.display = 'none';
    return;
  }

  // 캔들 데이터 부족
  if (!candles || candles.length < 50) {
    bar.style.display = 'none';
    return;
  }

  // 상위 3개 패턴 (신뢰도 기준, 중복 타입 제거)
  const seen = new Set();
  const topPatterns = [];
  const sorted = [...patterns].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  for (const p of sorted) {
    if (seen.has(p.type)) continue;
    // composite 시그널은 백테스트 대상 아님
    if (p.type === 'composite') continue;
    seen.add(p.type);
    topPatterns.push(p);
    if (topPatterns.length >= 3) break;
  }

  if (topPatterns.length === 0) {
    bar.style.display = 'none';
    return;
  }

  // 각 패턴에 대해 backtester로 과거 수익률 계산
  const items = [];
  for (const p of topPatterns) {
    const result = backtester.backtest(candles, p.type);
    if (!result || result.sampleSize === 0) continue;

    const h5 = result.horizons[5];
    if (!h5 || h5.n === 0) continue;

    const retCls = h5.mean > 0 ? 'up' : h5.mean < 0 ? 'dn' : 'flat';
    const retSign = h5.mean > 0 ? '+' : '';

    // R:R 비율 표시
    var rrText = '';
    if (h5.riskReward != null && h5.riskReward > 0 && h5.riskReward !== Infinity) {
      var rrColor = h5.riskReward >= 1.5 ? 'var(--up)' : h5.riskReward < 1 ? 'var(--down)' : 'var(--text-muted)';
      rrText = `<span style="font-size:10px;color:${rrColor};white-space:nowrap;margin-left:4px;" title="평균이익/평균손실">R:R ${h5.riskReward}</span>`;
    }

    items.push(
      `<div class="ph-item">` +
      `<span class="ph-name">${result.name}</span>` +
      `<span class="ph-count">${result.sampleSize}회</span>` +
      `<span class="ph-return ${retCls}">${retSign}${h5.mean.toFixed(1)}% (5D)</span>` +
      `<span class="ph-winrate">${h5.winRate.toFixed(0)}%</span>` +
      rrText +
      `</div>`
    );
  }

  if (items.length === 0) {
    bar.style.display = 'none';
    return;
  }

  // [FIX-TRUST] 데모 데이터 백테스트 경고 — 히스토리 바에도 표시
  var _phDemoWarn = '';
  if (typeof isRealData === 'function' && !isRealData()) {
    _phDemoWarn = '<span class="ph-item" style="font-size:9px;color:rgba(255,152,0,0.6);white-space:nowrap;">\u26A0 시뮬레이션</span>';
  }

  bar.innerHTML = _phDemoWarn + items.join('');
  bar.style.display = 'flex';
}


// ══════════════════════════════════════════════════════
//  수익률 테이블 (Phase 1 — #php-tbody 렌더링)
//
//  기존 updatePatternHistoryBar의 확장 버전.
//  상위 3개 패턴에 대해 backtester.backtest()를 호출하여
//  1일/3일/5일/10일/20일 수익률 + 승률 테이블을 생성.
//
//  HTML 테이블 대상: #php-tbody (index.html 에이전트가 생성)
//  Canvas 대상: #php-curve-canvas (수익률 곡선)
//
//  색상 코딩:
//    - 양수: up (빨강, 한국식)
//    - 음수: dn (파랑)
//    - 통계적 유의: bold
// ══════════════════════════════════════════════════════

function updatePatternHistoryTable(patterns) {
  const tbody = document.getElementById('php-tbody');
  if (!tbody) return;

  // 패턴 비활성 or 데이터 부족
  if (!patternEnabled || !patterns || !patterns.length || typeof backtester === 'undefined') {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:12px">패턴 활성화 후 데이터가 표시됩니다</td></tr>';
    return;
  }

  if (!candles || candles.length < 50) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:12px">캔들 데이터 부족 (최소 50개 필요)</td></tr>';
    return;
  }

  // 상위 3개 패턴 (신뢰도 기준, 중복 타입 제거, composite 제외)
  const seen = new Set();
  const topPatterns = [];
  const sorted = [...patterns].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  for (const p of sorted) {
    if (seen.has(p.type)) continue;
    if (p.type === 'composite') continue;
    seen.add(p.type);
    topPatterns.push(p);
    if (topPatterns.length >= 3) break;
  }

  if (topPatterns.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:12px">백테스트 가능한 패턴 없음</td></tr>';
    return;
  }

  // backtestAll() 호출로 Holm-Bonferroni 다중비교 보정 적용
  // (개별 backtest() 호출 시 보정 불가 — 전체 검정 family 필요)
  const allBacktestResults = backtester.backtestAll(candles);

  // 각 패턴에 대해 backtester 호출 → 테이블 행 생성
  const horizons = [1, 3, 5, 10, 20];
  const rows = [];
  const curvesData = [];  // drawReturnCurve용
  const curveColors = [KRX_COLORS.ACCENT, KRX_COLORS.UP, KRX_COLORS.DOWN];

  for (let pi = 0; pi < topPatterns.length; pi++) {
    const p = topPatterns[pi];
    const result = allBacktestResults[p.type] || backtester.backtest(candles, p.type);
    if (!result || result.sampleSize === 0) continue;

    // 수익률 곡선 데이터 수집
    if (result.curve && result.curve.length > 0) {
      curvesData.push({
        name: result.name,
        color: curveColors[pi % curveColors.length],
        curve: result.curve,
      });
    }

    // 테이블 행: 패턴명 | 발생횟수 | 1일 | 3일 | 5일 | 10일 | 20일 | 승률
    const signalCls = result.signal === 'buy' ? 'up' : result.signal === 'sell' ? 'dn' : '';

    // 표본 부족 경고 아이콘 (5일 horizon 기준)
    const h5warn = result.horizons[5];
    let warnIcon = '';
    if (h5warn && h5warn.sampleWarning === 'insufficient') {
      warnIcon = '<span class="php-sample-warn" title="표본 10회 미만 -- 통계적 신뢰도 낮음">&#9888;</span>';
    } else if (h5warn && h5warn.sampleWarning === 'caution') {
      warnIcon = '<span class="php-sample-warn" title="표본 30회 미만 -- 해석에 주의 필요">&#9888;</span>';
    }

    let rowHtml = `<tr>`;
    rowHtml += `<td class="php-name ${signalCls}">${result.name}${warnIcon}</td>`;
    rowHtml += `<td class="php-count">${result.sampleSize}</td>`;

    // 각 horizon 셀
    for (const h of horizons) {
      const hs = result.horizons[h];
      if (!hs || hs.n === 0) {
        rowHtml += `<td class="php-ret">--</td>`;
        continue;
      }
      const retCls = hs.mean > 0 ? 'up' : hs.mean < 0 ? 'dn' : '';
      // adjustedSignificant: Holm-Bonferroni 다중비교 보정 후 유의성 (존재하면 사용, 없으면 raw fallback)
      const _adjExists = hs.adjustedSignificant != null;
      const boldCls = (_adjExists ? hs.adjustedSignificant : hs.significant) ? ' php-sig' : '';
      const sign = hs.mean > 0 ? '+' : '';
      const _rawNote = _adjExists && hs.significant && !hs.adjustedSignificant ? ' (raw p<0.05, 보정 후 비유의)' : '';
      rowHtml += `<td class="php-ret ${retCls}${boldCls}" title="n=${hs.n}, stdev=${hs.stdDev}%, t=${hs.tStat}${_rawNote}">${sign}${hs.mean.toFixed(1)}%</td>`;
    }

    // 승률 (5일 기준)
    const h5 = result.horizons[5];
    if (h5 && h5.n > 0) {
      const wrCls = h5.winRate >= 55 ? 'up' : h5.winRate <= 45 ? 'dn' : '';
      rowHtml += `<td class="php-wr ${wrCls}">${h5.winRate.toFixed(0)}%</td>`;
    } else {
      rowHtml += `<td class="php-wr">--</td>`;
    }

    // 기대수익 (WLS 회귀 예측, 5일 horizon 기준)
    const expRet = h5 ? h5.expectedReturn : null;
    if (expRet != null) {
      const expCls = expRet > 0 ? 'up' : expRet < 0 ? 'dn' : '';
      const expSign = expRet >= 0 ? '+' : '';
      rowHtml += `<td class="php-expected ${expCls}" title="WLS 회귀 예측 (R\u00B2=${h5.regression ? h5.regression.rSquared : '?'})">${expSign}${expRet}%</td>`;
    } else {
      rowHtml += `<td class="php-expected">\u2014</td>`;
    }

    // 95% 신뢰구간 — 0을 포함하면 통계적 비유의 (muted 표시)
    const ciLower = h5 ? h5.ci95Lower : null;
    const ciUpper = h5 ? h5.ci95Upper : null;
    if (ciLower != null && ciUpper != null) {
      const crossesZero = ciLower < 0 && ciUpper > 0;
      const ciClass = crossesZero ? ' php-ci-muted' : '';
      rowHtml += `<td class="php-ci${ciClass}" title="95% \uC2E0\uB8B0\uAD6C\uAC04${crossesZero ? ' (0 포함 — 통계적 비유의)' : ''}">[${ciLower}%, ${ciUpper}%]</td>`;
    } else {
      rowHtml += `<td class="php-ci">\u2014</td>`;
    }

    rowHtml += `</tr>`;
    rows.push(rowHtml);
  }

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:12px">과거 발생 이력 없음</td></tr>';
    return;
  }

  // [FIX-TRUST] 데모 데이터 백테스트 경고 행
  var _demoRowWarn = '';
  if (typeof isRealData === 'function' && !isRealData()) {
    _demoRowWarn = '<tr><td colspan="10" style="text-align:center;font-size:9px;color:rgba(255,152,0,0.65);padding:3px 6px;background:rgba(255,152,0,0.06);">\u26A0 시뮬레이션 데이터 기반 통계 \u2014 실제 시장 수익률이 아닙니다</td></tr>';
  }

  // BH-FDR 다중비교 보정 안내 행 (Phase G-1: Holm→BH 전환)
  var _holmNote = '<tr><td colspan="10" style="text-align:right;font-size:9px;color:var(--text-muted);padding:2px 6px;border-top:1px solid rgba(255,255,255,0.05);">\u203B Benjamini-Hochberg FDR \uB2E4\uC911\uBE44\uAD50 \uBCF4\uC815 \uC801\uC6A9</td></tr>';

  tbody.innerHTML = _demoRowWarn + rows.join('') + _holmNote;

  // 누적수익률 곡선 Canvas 그리기
  if (curvesData.length > 0) {
    drawReturnCurve(curvesData);
  }
}


// ══════════════════════════════════════════════════════
//  누적수익률 곡선 Canvas (Phase 1)
//
//  backtester의 curve 데이터를 Canvas2D로 시각화.
//  각 패턴의 mean 선 + 1-sigma 밴드를 그림.
//
//  curvesData 구조:
//    [{ name, color, curve: [{day, mean, upper, lower}] }]
//
//  drawFinTrendChart()와 동일한 Canvas 패턴:
//    - DPR 보정, 자동 너비 조절, 영역 채우기 + 라인
// ══════════════════════════════════════════════════════

function drawReturnCurve(curvesData) {
  const canvas = document.getElementById('php-curve-canvas');
  if (!canvas || !curvesData || !curvesData.length) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Canvas 크기 설정 (부모 너비 기반)
  const pad = { top: 8, right: 8, bottom: 20, left: 36 };
  const w = canvas.parentElement ? canvas.parentElement.clientWidth - 4 : 300;
  const h = 90;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  // [FIX] setTransform으로 변환 행렬 초기화 후 재스케일 (DPR 누적 방지)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  // 모든 곡선의 y 범위 계산
  let yMin = 0, yMax = 0;
  let maxDay = 0;
  for (const cd of curvesData) {
    for (const pt of cd.curve) {
      if (pt.upper > yMax) yMax = pt.upper;
      if (pt.lower < yMin) yMin = pt.lower;
      if (pt.day > maxDay) maxDay = pt.day;
    }
  }

  // y 범위가 0이면 기본값
  const yRange = Math.max(yMax - yMin, 0.5);
  const dayRange = Math.max(maxDay, 1);

  // y축 좌표 변환
  const toX = (day) => pad.left + (day / dayRange) * chartW;
  const toY = (val) => pad.top + ((yMax - val) / yRange) * chartH;

  // 0선
  const zeroY = toY(0);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(pad.left, zeroY);
  ctx.lineTo(w - pad.right, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);

  // 각 곡선 그리기
  for (const cd of curvesData) {
    const pts = cd.curve;
    if (!pts.length) continue;

    // 1-sigma 밴드 (반투명 영역)
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = toX(pts[i].day);
      const y = toY(pts[i].upper);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      const x = toX(pts[i].day);
      const y = toY(pts[i].lower);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    // 곡선 색상에서 반투명 추출
    ctx.fillStyle = cd.color === KRX_COLORS.ACCENT ? KRX_COLORS.ACCENT_FILL(0.08) :
                    cd.color === KRX_COLORS.UP ? KRX_COLORS.UP_FILL(0.08) :
                    KRX_COLORS.DOWN_FILL(0.08);
    ctx.fill();

    // mean 선
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = toX(pts[i].day);
      const y = toY(pts[i].mean);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = cd.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 끝점 표시
    const lastPt = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(toX(lastPt.day), toY(lastPt.mean), 2.5, 0, Math.PI * 2);
    ctx.fillStyle = cd.color;
    ctx.fill();
  }

  // x축 라벨 (일수)
  ctx.font = "9px 'Pretendard', sans-serif";
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const labelDays = [1, 5, 10, 15, 20];
  for (const d of labelDays) {
    if (d > maxDay) break;
    ctx.fillText(d + 'D', toX(d), h - pad.bottom + 4);
  }

  // y축 라벨 (수익률)
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const yTicks = _calcYTicks(yMin, yMax, 4);
  for (const t of yTicks) {
    const y = toY(t);
    ctx.fillText((t >= 0 ? '+' : '') + t.toFixed(1) + '%', pad.left - 3, y);
  }

  // 범례 (우상단)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = "9px 'Pretendard', sans-serif";
  let legendX = pad.left + 4;
  const legendY = pad.top;
  for (const cd of curvesData) {
    ctx.fillStyle = cd.color;
    ctx.fillRect(legendX, legendY, 8, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(cd.name, legendX + 11, legendY - 1);
    legendX += ctx.measureText(cd.name).width + 20;
  }
}

/**
 * y축 눈금 계산 (drawReturnCurve용)
 * @param {number} min
 * @param {number} max
 * @param {number} count - 원하는 눈금 수
 * @returns {number[]}
 */
function _calcYTicks(min, max, count) {
  const range = max - min;
  if (range <= 0) return [0];
  const rough = range / count;
  // 깔끔한 간격으로 반올림
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const nice = rough / mag >= 5 ? 5 * mag : rough / mag >= 2 ? 2 * mag : mag;
  const ticks = [];
  const start = Math.ceil(min / nice) * nice;
  for (let t = start; t <= max + nice * 0.01; t += nice) {
    ticks.push(+t.toFixed(2));
  }
  return ticks;
}


// ══════════════════════════════════════════════════════
//  수익률 그리드 (Phase 1 -- #rs-grid 렌더링)
//
//  차트 하단 #return-stats-area 내의 바 형태 수익률 표시.
//  현재 선택된 기간 탭(5일/10일/20일)에 따라 해당 horizon의
//  평균 수익률 + 승률을 시각적 바 차트로 표시.
//
//  대상 DOM: #rs-grid
//  기간 선택: .rs-tab.active[data-period]
// ══════════════════════════════════════════════════════

function updateReturnStatsGrid(patterns) {
  const grid = document.getElementById('rs-grid');
  if (!grid) return;

  // 패턴 비활성 or 데이터 부족
  if (!patternEnabled || !patterns || !patterns.length || typeof backtester === 'undefined') {
    grid.innerHTML = '';
    return;
  }

  if (!candles || candles.length < 50) {
    grid.innerHTML = '';
    return;
  }

  // 현재 선택된 기간 탭에서 horizon 일수 추출
  const activeTab = document.querySelector('.rs-tab.active');
  const periodStr = activeTab ? activeTab.dataset.period : '5d';
  const horizon = parseInt(periodStr, 10) || 5;

  // 상위 3개 패턴 (신뢰도 기준, 중복 제거, composite 제외)
  const seen = new Set();
  const topPatterns = [];
  const sorted = [...patterns].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  for (const p of sorted) {
    if (seen.has(p.type)) continue;
    if (p.type === 'composite') continue;
    seen.add(p.type);
    topPatterns.push(p);
    if (topPatterns.length >= 3) break;
  }

  if (topPatterns.length === 0) {
    grid.innerHTML = '';
    return;
  }

  // 모든 수익률의 절대값 최대치 (바 너비 정규화용)
  let maxAbsReturn = 0;
  const rowsData = [];

  for (const p of topPatterns) {
    const result = backtester.backtest(candles, p.type);
    if (!result || result.sampleSize === 0) continue;

    const hs = result.horizons[horizon];
    if (!hs || hs.n === 0) continue;

    if (Math.abs(hs.mean) > maxAbsReturn) maxAbsReturn = Math.abs(hs.mean);
    rowsData.push({ name: result.name, signal: result.signal, hs, count: result.sampleSize });
  }

  if (rowsData.length === 0) {
    grid.innerHTML = '';
    return;
  }

  maxAbsReturn = Math.max(maxAbsReturn, 0.1); // 0 방지

  // [FIX-TRUST] 데모 데이터 백테스트 경고 — 통계가 가짜 데이터 기반임을 명시
  var demoBacktestWarn = '';
  if (typeof isRealData === 'function' && !isRealData()) {
    demoBacktestWarn = '<div style="padding:3px 6px;margin:0 0 4px 0;background:rgba(255,152,0,0.08);border-radius:3px;font-size:9px;color:rgba(255,152,0,0.65);text-align:center;">' +
      '\u26A0 참고용 \u2014 시뮬레이션 데이터 기반 통계</div>';
  }

  const html = demoBacktestWarn + rowsData.map(r => {
    const retCls = r.hs.mean > 0 ? 'up' : r.hs.mean < 0 ? 'dn' : '';
    const barW = Math.min(100, (Math.abs(r.hs.mean) / maxAbsReturn) * 100);
    const sign = r.hs.mean > 0 ? '+' : '';

    // R:R 비율
    var rrSpan = '';
    if (r.hs.riskReward != null && r.hs.riskReward > 0 && r.hs.riskReward !== Infinity) {
      var rrC = r.hs.riskReward >= 1.5 ? 'up' : r.hs.riskReward < 1 ? 'dn' : '';
      rrSpan = `<span class="rs-rr ${rrC}" title="평균이익/평균손실">${r.hs.riskReward}</span>`;
    }

    return `<div class="rs-row">` +
      `<span class="rs-pattern-name">${r.name}</span>` +
      `<div class="rs-bar-wrap"><div class="rs-bar ${retCls}" style="width:${barW}%"></div></div>` +
      `<span class="rs-return ${retCls}">${sign}${r.hs.mean.toFixed(1)}%</span>` +
      `<span class="rs-winrate">${r.hs.winRate.toFixed(0)}%</span>` +
      rrSpan +
      `<span class="rs-count">${r.count}</span>` +
      `</div>`;
  }).join('');

  grid.innerHTML = html;
}


// ══════════════════════════════════════════════════════
//  C열 패턴 카드 (Phase 1 -- #pp-cards 렌더링)
//
//  상위 2-3개 패턴의 상세 카드를 생성.
//  각 카드에는 PATTERN_ACADEMIC_META의 학술 정보를 포함:
//    - 패턴명 (한/영)
//    - 신호 (매수/매도/중립)
//    - 신뢰도 바
//    - 학술 설명
//    - 시장 심리 해설
//    - 과거 통계 (Bulkowski + 실제 백테스트)
//    - 무효화 조건
//
//  대상 DOM: #pp-cards (index.html 에이전트가 생성)
// ══════════════════════════════════════════════════════

function renderPatternCards(patterns) {
  const container = document.getElementById('pp-cards');
  if (!container) return;

  // 패턴 비활성 or 패턴 없음
  if (!patternEnabled || !patterns || !patterns.length) {
    container.innerHTML = '<div class="pp-empty">패턴 버튼을 활성화하면<br>감지된 패턴의 상세 분석이<br>이곳에 표시됩니다.</div>';
    return;
  }

  // 상위 2-3개 패턴 (신뢰도 기준, 중복 타입 제거, composite 제외)
  const seen = new Set();
  const topPatterns = [];
  const sorted = [...patterns].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  for (const p of sorted) {
    if (seen.has(p.type)) continue;
    if (p.type === 'composite') continue;
    seen.add(p.type);
    topPatterns.push(p);
    if (topPatterns.length >= 3) break;
  }

  if (topPatterns.length === 0) {
    container.innerHTML = '<div class="pp-empty">캔들스틱/차트 패턴이<br>감지되지 않았습니다.</div>';
    return;
  }

  // [FIX-TRUST] 데모 데이터 패턴 카드 경고 헤더
  var _demoCardWarn = '';
  if (typeof isRealData === 'function' && !isRealData()) {
    _demoCardWarn = '<div style="padding:4px 8px;margin:0 0 8px 0;background:rgba(255,152,0,0.08);border:1px solid rgba(255,152,0,0.20);border-radius:4px;font-size:10px;color:rgba(255,152,0,0.65);text-align:center;line-height:1.4;">' +
      '\u26A0 시뮬레이션 데이터 기반 분석<br>실제 시장 데이터가 아닙니다</div>';
  }

  const cards = [];

  for (const p of topPatterns) {
    const meta = PATTERN_ACADEMIC_META[p.type];
    const signalCls = p.signal === 'buy' ? 'buy' : p.signal === 'sell' ? 'sell' : 'neutral';
    const signalText = p.signal === 'buy' ? '매수' : p.signal === 'sell' ? '매도' : '중립';
    const confVal = p.confidence != null ? p.confidence : 0;

    // 백테스트 통계 (있으면)
    let statsHtml = '';
    let scorecardHtml = '';
    if (typeof backtester !== 'undefined' && candles && candles.length >= 50) {
      const bt = backtester.backtest(candles, p.type);
      if (bt && bt.sampleSize > 0) {
        const h5 = bt.horizons[5];
        const retCls = h5 && h5.mean > 0 ? 'up' : h5 && h5.mean < 0 ? 'dn' : '';
        const retSign = h5 && h5.mean > 0 ? '+' : '';
        // WLS 기대수익 (있으면 표시)
        var expRetHtml = '';
        if (h5 && h5.expectedReturn != null) {
          var expRetCls = h5.expectedReturn > 0 ? 'up' : h5.expectedReturn < 0 ? 'dn' : '';
          var expRetSign = h5.expectedReturn >= 0 ? '+' : '';
          var ciText = (h5.ci95Lower != null && h5.ci95Upper != null)
            ? ' [' + h5.ci95Lower + '%, ' + h5.ci95Upper + '%]' : '';
          expRetHtml = `
            <div class="pp-stat-row">
              <span class="pp-stat-label">기대수익</span>
              <span class="pp-stat-value ${expRetCls}" title="WLS 회귀 예측${ciText}">${expRetSign}${h5.expectedReturn}%</span>
            </div>`;
          if (h5.regression) {
            expRetHtml += `
            <div class="pp-stat-row">
              <span class="pp-stat-label">R\u00B2</span>
              <span class="pp-stat-value" title="가중 결정계수">${h5.regression.rSquared}</span>
            </div>`;
            // 접이식 회귀 상세 (tStats 6개, intercept 제외)
            const REG_LABEL_MAP = {
              confidence:   '신뢰도',
              trendStrength:'추세강도',
              lnVolumeRatio:'거래량비',
              atrNorm:      '변동성',
            };
            const tStats  = h5.regression.tStats  || [];
            const tLabels = h5.regression.labels   || [];
            // labels[0]은 intercept → index 1부터 표시
            const regRows = [];
            for (let _i = 1; _i < tLabels.length && _i < tStats.length; _i++) {
              const rawLabel = tLabels[_i];
              const tVal     = tStats[_i];
              if (tVal == null) continue;
              const dispLabel = REG_LABEL_MAP[rawLabel] || rawLabel;
              const abst      = Math.abs(tVal);
              const sig       = abst > 2;
              const sign      = tVal >= 0 ? '+' : '';
              const tText     = sign + tVal.toFixed(2);
              regRows.push(
                `<div class="pp-reg-row${sig ? ' pp-reg-sig' : ''}">` +
                  `<span class="pp-reg-lbl">${dispLabel}</span>` +
                  `<span class="pp-reg-tval">t=${tText}${sig ? ' \u2605' : ''}</span>` +
                `</div>`
              );
            }
            if (regRows.length > 0) {
              const toggleId = 'pp-reg-' + p.type.replace(/[^a-z0-9]/gi, '_');
              expRetHtml += `
            <button class="pp-reg-toggle" type="button"
              onclick="(function(btn){
                var d=document.getElementById('${toggleId}');
                var open=d.style.display==='block';
                d.style.display=open?'none':'block';
                btn.querySelector('.pp-reg-arrow').textContent=open?'\u25b8':'\u25be';
              })(this)">
              <span class="pp-reg-arrow">\u25b8</span> 회귀 상세
            </button>
            <div class="pp-reg-detail" id="${toggleId}">
              ${regRows.join('\n              ')}
            </div>`;
            }
          }
        }

        // R:R 비율 + 순수익률 (KRX 거래비용 차감)
        var rrHtml = '';
        if (h5 && h5.n > 0) {
          if (h5.riskReward != null && h5.riskReward > 0 && h5.riskReward !== Infinity) {
            var rrCls = h5.riskReward >= 1.5 ? 'up' : h5.riskReward < 1 ? 'dn' : '';
            rrHtml += `
            <div class="pp-stat-row">
              <span class="pp-stat-label">R:R 비율</span>
              <span class="pp-stat-value ${rrCls}" title="평균이익 +${h5.avgWin}% / 평균손실 -${h5.avgLoss}%">${h5.riskReward}</span>
            </div>`;
          }
          var krxCost = (typeof backtester !== 'undefined' && backtester.KRX_COST) ? backtester.KRX_COST : 0.36;
          var netReturn = +(h5.mean - krxCost).toFixed(1);
          var netCls = netReturn > 0 ? 'up' : netReturn < 0 ? 'dn' : '';
          var netSign = netReturn >= 0 ? '+' : '';
          rrHtml += `
            <div class="pp-stat-row">
              <span class="pp-stat-label">순수익률</span>
              <span class="pp-stat-value ${netCls}" title="5일 수익률 − 거래비용 ${krxCost}%">${netSign}${netReturn}%</span>
            </div>`;
        }

        statsHtml = `
          <div class="pp-card-stats">
            <div class="pp-stat-row">
              <span class="pp-stat-label">발생빈도</span>
              <span class="pp-stat-value">${bt.sampleSize}회</span>
            </div>
            <div class="pp-stat-row">
              <span class="pp-stat-label">5일 수익률</span>
              <span class="pp-stat-value ${retCls}">${h5 && h5.n > 0 ? retSign + h5.mean.toFixed(1) + '%' : '--'}</span>
            </div>
            <div class="pp-stat-row">
              <span class="pp-stat-label">5일 승률</span>
              <span class="pp-stat-value">${h5 && h5.n > 0 ? h5.winRate.toFixed(0) + '%' : '--'}</span>
            </div>` +
            expRetHtml +
            rrHtml +
            (meta ? `
            <div class="pp-stat-row">
              <span class="pp-stat-label">학술 승률</span>
              <span class="pp-stat-value" title="Bulkowski (2005)">${meta.bulkowskiWinRate}%</span>
            </div>` : '') +
          `</div>`;

        // [Phase 1] 예측 정확도 스코어카드
        if (h5 && h5.n >= 10 && h5.patternScore != null) {
          const grade = h5.patternGrade || 'F';
          const score = h5.patternScore || 0;
          const da = h5.directionalAccuracy || 0;
          const hitRate = h5.targetHitRate;
          const mae = h5.predictionMAE;

          // 등급 색상 — KRX_COLORS 기반 (TIER_A/B/C/D + DOWN for F)
          const _gcMap = {
            A: KRX_COLORS.TIER_A, B: KRX_COLORS.TIER_B,
            C: KRX_COLORS.TIER_C, D: KRX_COLORS.TIER_D,
            F: KRX_COLORS.DOWN,
          };
          const gc = _gcMap[grade] || _gcMap.F;

          // 소표본 경고
          const nWarning = h5.n < 30 ? ' <span style="font-size:9px;color:rgba(255,255,255,0.4);">(데이터 부족 주의)</span>' : '';

          // D/F 등급 투자자 경고 — 7-agent 학술 검증 consensus
          var _dfWarning = '';
          if (grade === 'F') {
            _dfWarning = '<div style="margin-top:4px;padding:3px 6px;background:rgba(224,80,80,0.08);border:1px solid rgba(224,80,80,0.2);border-radius:3px;font-size:9px;color:rgba(224,80,80,0.8);line-height:1.3;">통계적 유의성 미달 — 독립 매매 근거로 부적합</div>';
          } else if (grade === 'D') {
            _dfWarning = '<div style="margin-top:4px;padding:3px 6px;background:rgba(255,180,50,0.06);border:1px solid rgba(255,180,50,0.15);border-radius:3px;font-size:9px;color:rgba(255,180,50,0.7);line-height:1.3;">예측력 제한 — 다른 지표와 함께 참고</div>';
          }

          // CONTEXT_ONLY 패턴 추가 경고
          var _ctxWarning = '';
          if (p._contextOnly) {
            _ctxWarning = '<div style="margin-top:3px;font-size:9px;color:rgba(255,255,255,0.35);font-style:italic;">표본 부족 또는 KRX 시장 구조 부적합 — 맥락 참고용</div>';
          }

          scorecardHtml = `
            <div class="pp-scorecard" style="margin:6px 0;padding:6px 8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:4px;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="background:${gc}25;color:${gc};border:1px solid ${gc}50;border-radius:4px;padding:1px 6px;font-weight:700;font-size:14px;line-height:1.4;">${grade}</span>
                <span style="color:rgba(255,255,255,0.7);font-size:11px;font-weight:600;">\uC608\uCE21 \uC815\uD655\uB3C4 ${Math.round(score)}\uC810</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:2px;font-size:10px;color:rgba(255,255,255,0.55);">
                <div style="display:flex;justify-content:space-between;">
                  <span>\uBC29\uD5A5 \uC801\uC911</span>
                  <span style="color:rgba(255,255,255,0.8);font-weight:500;">${da.toFixed(0)}%</span>
                </div>` +
                (hitRate != null ? `
                <div style="display:flex;justify-content:space-between;">
                  <span>\uBAA9\uD45C \uB3C4\uB2EC</span>
                  <span style="color:rgba(255,255,255,0.8);font-weight:500;">${hitRate.toFixed(0)}%</span>
                </div>` : '') +
                (mae != null ? `
                <div style="display:flex;justify-content:space-between;">
                  <span>\uD3C9\uADE0 \uC624\uCC28</span>
                  <span style="color:rgba(255,255,255,0.8);font-weight:500;">\u00B1${mae.toFixed(1)}%</span>
                </div>` : '') + `
                <div style="display:flex;justify-content:space-between;">
                  <span>5\uC77C \uAE30\uC900</span>
                  <span style="color:rgba(255,255,255,0.5);">${h5.n}\uD68C${nWarning}</span>
                </div>
              </div>` +
              // [Phase 3] MZ 회귀 + Calibration 요약 (n>=20 시 표시)
              (h5.mzRegression ? (function() {
                var mz = h5.mzRegression;
                var slopeOk = Math.abs(mz.slope - 1) < 0.5;
                var biasOk = Math.abs(mz.bias) < 3;
                var slopeColor = slopeOk ? 'rgba(255,255,255,0.8)' : KRX_COLORS.DOWN;
                var biasColor = biasOk ? 'rgba(255,255,255,0.8)' : KRX_COLORS.DOWN;
                var calText = h5.calibrationCoverage != null ? h5.calibrationCoverage.toFixed(0) + '%' : '--';
                return '<div style="margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.06);font-size:9px;color:rgba(255,255,255,0.45);">' +
                  '<div style="margin-bottom:2px;font-weight:600;color:rgba(255,255,255,0.55);">예측 진단 (Mincer-Zarnowitz)</div>' +
                  '<div style="display:flex;justify-content:space-between;"><span>기울기 (\u03B2)</span><span style="color:' + slopeColor + ';">' + mz.slope + (slopeOk ? '' : ' \u26A0') + '</span></div>' +
                  '<div style="display:flex;justify-content:space-between;"><span>편향 (bias)</span><span style="color:' + biasColor + ';">' + (mz.bias >= 0 ? '+' : '') + mz.bias + '%' + (biasOk ? '' : ' \u26A0') + '</span></div>' +
                  '<div style="display:flex;justify-content:space-between;"><span>R\u00B2</span><span>' + mz.rSquared + '</span></div>' +
                  '<div style="display:flex;justify-content:space-between;"><span>추적오차 (TE)</span><span>\u00B1' + mz.trackingError + '%</span></div>' +
                  '<div style="display:flex;justify-content:space-between;"><span>90% 커버리지</span><span>' + calText + '</span></div>' +
                  '</div>';
              })() : '') +
              _dfWarning + _ctxWarning + `
            </div>`;
        }
      }
    }

    // 학술 정보 (PATTERN_ACADEMIC_META 존재 시)
    let academicHtml = '';
    let psychologyHtml = '';
    let invalidationHtml = '';
    let categoryHtml = '';

    if (meta) {
      categoryHtml = `<span class="pp-card-category">${meta.category} / ${meta.candles}봉</span>`;
      academicHtml = `<div class="pp-card-desc">${meta.academicDesc}</div>`;
      psychologyHtml = `
        <div class="pp-card-psych">
          <span class="pp-psych-label">시장 심리</span>
          <p>${meta.psychology}</p>
        </div>`;
      invalidationHtml = `
        <div class="pp-card-invalid">
          <span class="pp-invalid-label">무효화 조건</span>
          <p>${meta.invalidation}</p>
        </div>`;
    } else {
      // 메타 없으면 기본 설명 사용
      academicHtml = `<div class="pp-card-desc">${p.description || ''}</div>`;
    }

    // 신뢰도 바
    const confBarHtml = `
      <div class="pp-conf-wrap">
        <span class="pp-conf-label">형태 점수</span>
        <div class="pp-conf-bar-track">
          <div class="pp-conf-bar-fill ${signalCls}" style="width:${Math.min(confVal, 100)}%"></div>
        </div>
        <span class="pp-conf-val">${confVal}%</span>
      </div>`;

    // reliability 배지 (Signal Backtest Tier A/B/C/D)
    let badgeHtml = '';
    const _wr = p.backtestWR != null ? p.backtestWR : p.backtestWinRate;
    const _n  = p.backtestN  != null ? p.backtestN  : p.backtestSampleSize;
    const _tier = p.reliabilityTier || null;
    if (_wr != null && _n != null && _tier) {
      const _tc = { A:KRX_COLORS.TIER_A, B:KRX_COLORS.TIER_B, C:KRX_COLORS.TIER_C, D:KRX_COLORS.TIER_D }[_tier] || KRX_COLORS.TIER_D;
      badgeHtml = '<div style="display:flex;align-items:center;gap:4px;margin:2px 0;font-size:10px;">' +
        '<span style="background:' + _tc + '30;color:' + _tc + ';border:1px solid ' + _tc + '50;border-radius:3px;padding:0 4px;font-weight:700;">' + _tier + '</span>' +
        '<span style="color:rgba(255,255,255,0.6);">WR ' + _wr.toFixed(0) + '% (n=' + _n + ')</span></div>';
    }

    // 손절/목표
    let riskHtml = '';
    if (p.stopLoss || p.priceTarget) {
      riskHtml = '<div class="pp-card-risk">';
      if (p.stopLoss) riskHtml += `<span class="pp-risk-sl">손절 ${p.stopLoss.toLocaleString()}</span>`;
      if (p.priceTarget) riskHtml += `<span class="pp-risk-tp">목표 ${p.priceTarget.toLocaleString()}</span>`;
      riskHtml += '</div>';
    }

    cards.push(`
      <div class="pp-card ${signalCls}">
        <div class="pp-card-header">
          <span class="pp-card-signal ${signalCls}">${signalText}</span>
          <span class="pp-card-name">${p.name || p.nameShort || (meta ? meta.nameKo : p.type)}</span>
        </div>
        ${categoryHtml}
        ${confBarHtml}
        ${badgeHtml}
        ${scorecardHtml}
        ${academicHtml}
        ${psychologyHtml}
        ${riskHtml}
        ${statsHtml}
        ${invalidationHtml}
      </div>
    `);
  }

  container.innerHTML = _demoCardWarn + cards.join('');
}


// ══════════════════════════════════════════════════════
//  모델 성능 섹션 (Phase 4-4)
//
//  Walk-Forward OOS IC + 95% CI + t-stat을 C열 패턴 카드
//  영역 하단에 표시.
//
//  데이터 소스: data/backtest/rl_residuals_summary.json
//    analysis.walk_forward: { n_periods, mean_ic, std_ic,
//                             t_stat, ic_positive_pct }
//
//  캐시 전략: 모델 성능은 전체 모델 수준 — 종목 변경 시
//  재로드 불필요. _modelPerfCache 에 한 번만 저장.
//
//  실패 시: console.warn 후 섹션 숨김 (에러 토스트 없음)
// ══════════════════════════════════════════════════════

/**
 * #pp-model-perf 컨테이너를 찾거나 동적 생성.
 * #pp-cards 다음에 삽입 (없으면 #pp-content 끝에).
 */
function _ensureModelPerfContainer() {
  var existing = document.getElementById('pp-model-perf');
  if (existing) return existing;

  var el = document.createElement('div');
  el.id = 'pp-model-perf';
  el.className = 'pp-model-perf';

  // #pp-cards 다음 형제로 삽입
  var cards = document.getElementById('pp-cards');
  if (cards && cards.parentNode) {
    cards.parentNode.insertBefore(el, cards.nextSibling);
  } else {
    // 폴백: #pp-content 끝에 추가
    var content = document.getElementById('pp-content');
    if (content) content.appendChild(el);
  }
  return el;
}

/**
 * 모델 성능 섹션 렌더링.
 * 캐시 히트 시 즉시 렌더. 미캐시 시 fetch 후 렌더.
 */
function renderModelPerfSection() {
  var container = _ensureModelPerfContainer();
  if (!container) return;

  // 캐시 히트 — 즉시 렌더
  if (_modelPerfCache !== null) {
    _drawModelPerfHtml(container, _modelPerfCache);
    return;
  }

  // 아직 fetch 중이면 로딩 상태만 표시하고 대기
  if (_modelPerfFetching) {
    _drawModelPerfHtml(container, null);
    return;
  }

  // 최초 fetch
  _modelPerfFetching = true;
  _drawModelPerfHtml(container, null); // 로딩 플레이스홀더

  var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var timeoutId = setTimeout(function() {
    if (controller) controller.abort();
  }, 10000);

  fetch('data/backtest/rl_residuals_summary.json', controller ? { signal: controller.signal } : {})
    .then(function(res) {
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(json) {
      var wf = json && json.analysis && json.analysis.walk_forward
               ? json.analysis.walk_forward : null;
      if (!wf || wf.mean_ic == null) throw new Error('walk_forward 필드 없음');
      _modelPerfCache = wf;
      _modelPerfFetching = false;
      // 현재 컨테이너가 여전히 DOM에 있으면 갱신
      var cur = document.getElementById('pp-model-perf');
      if (cur) _drawModelPerfHtml(cur, wf);
    })
    .catch(function(err) {
      clearTimeout(timeoutId);
      _modelPerfFetching = false;
      _modelPerfCache = false; // 실패 마킹 — 재시도 안 함
      if (err && err.name !== 'AbortError') {
        console.warn('[ModelPerf] rl_residuals_summary.json 로드 실패:', err.message || err);
      }
      var cur = document.getElementById('pp-model-perf');
      if (cur) cur.style.display = 'none';
    });
}

/**
 * 모델 성능 HTML 빌드 및 컨테이너에 삽입.
 * @param {Element} container  #pp-model-perf 엘리먼트
 * @param {Object|null|false} wf  walk_forward 데이터 (null=로딩중, false=실패)
 */
function _drawModelPerfHtml(container, wf) {
  // 실패 상태면 숨김
  if (wf === false) {
    container.style.display = 'none';
    return;
  }

  container.style.display = '';

  // 로딩 중 플레이스홀더
  if (wf === null) {
    container.innerHTML =
      '<div class="pp-model-title">모델 성능 <span class="pp-model-subtitle">(Walk-Forward OOS)</span></div>' +
      '<div class="pp-model-row">' +
        '<span class="pp-model-label">IC</span>' +
        '<span class="pp-model-value">--</span>' +
      '</div>';
    return;
  }

  // 값 계산
  var meanIc  = wf.mean_ic;
  var stdIc   = wf.std_ic;
  var n       = wf.n_periods;
  var tStat   = wf.t_stat;
  var posPct  = wf.ic_positive_pct;

  // 95% CI: mean ± 1.96 * std / sqrt(n)
  var ciHalf  = (n > 0) ? (1.96 * stdIc / Math.sqrt(n)) : 0;
  var ciLo    = meanIc - ciHalf;
  var ciHi    = meanIc + ciHalf;

  // IC 색상 클래스
  var icCls   = meanIc > 0.05 ? 'up' : meanIc <= 0 ? 'dn' : '';

  // t-stat 별 등급
  var absT    = Math.abs(tStat);
  var tStars  = absT > 3.29 ? '\u2605\u2605\u2605' :
                absT > 2.58 ? '\u2605\u2605'        :
                absT > 1.96 ? '\u2605'               : '';

  // 양수비율 색상 클래스
  var posCls  = posPct >= 100 ? 'up' : posPct < 50 ? 'dn' : '';

  var icText  = meanIc.toFixed(3);
  var ciText  = '[' + ciLo.toFixed(3) + ', ' + ciHi.toFixed(3) + ']';
  var tText   = tStat.toFixed(2) + (tStars ? ' ' + tStars : '');
  var posText = posPct.toFixed(0) + '%';
  var nText   = String(n);

  container.innerHTML =
    '<div class="pp-model-title">모델 성능 <span class="pp-model-subtitle">(Walk-Forward OOS)</span></div>' +
    '<div class="pp-model-row">' +
      '<span class="pp-model-label">IC</span>' +
      '<span class="pp-model-value ' + icCls + '" title="IC 95% 신뢰구간: ' + ciText + '">' +
        icText + ' <span class="pp-model-ci">' + ciText + '</span>' +
      '</span>' +
    '</div>' +
    '<div class="pp-model-row">' +
      '<span class="pp-model-label">t-stat</span>' +
      '<span class="pp-model-value ' + icCls + '">' + tText + '</span>' +
    '</div>' +
    '<div class="pp-model-row">' +
      '<span class="pp-model-label">양수비율</span>' +
      '<span class="pp-model-value ' + posCls + '">' + posText + '</span>' +
    '</div>' +
    '<div class="pp-model-row">' +
      '<span class="pp-model-label">기간수</span>' +
      '<span class="pp-model-value">' + nText + '</span>' +
    '</div>';
}
