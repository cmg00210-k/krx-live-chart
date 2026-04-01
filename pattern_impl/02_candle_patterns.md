# 02. 캔들스틱 + 차트 패턴 정의서 -- 42종 전수 조사

> 16_pattern_reference.md의 42종 패턴 전체를 대상으로
> 현재 구현 상태, 학술 근거, 미구현 패턴의 정의를 정리한다.

---

## 1. 1봉 패턴 (Single-Candle) -- 12종

### 구현 완료 (7종)

| # | 패턴명 | 함수명 | patterns.js 라인 | 학술 근거 | 비고 |
|---|--------|--------|-----------------|----------|------|
| 1 | 해머 (Hammer) | `detectHammer()` | L228-266 | 06 S3.3, 07 S3 | 하락 추세 필수 확인 |
| 2 | 역해머 (Inverted Hammer) | `detectInvertedHammer()` | L268-305 | 06 S3.3 | 하락 추세 필수 확인 |
| 3 | 교수형 (Hanging Man) | `detectHangingMan()` | L307-350 | 06 S3.3 | 상승 추세 필수 확인 |
| 4 | 유성형 (Shooting Star) | `detectShootingStar()` | L352-390 | 06 S3.3 | 상승 추세 필수 확인 |
| 5 | 도지 (Doji) | `detectDoji()` | L392-427 | 06 S3.3 | body < range*0.05 |
| 6 | 잠자리 도지 (Dragonfly Doji) | `detectDragonflyDoji()` | L744-790 | 06 S3.3, 16 ref | Phase 8 추가. T자 형태, 해머보다 극단적 |
| 7 | 비석 도지 (Gravestone Doji) | `detectGravestoneDoji()` | L799-845 | 06 S3.3, 16 ref | Phase 8 추가. 역T자 형태, 유성형보다 극단적 |

### 미구현 (5종)

| # | 패턴명 | 학술 근거 | 구현 난이도 | 알고리즘 정의 |
|---|--------|----------|-----------|------------|
| 8 | 긴다리 도지 (Long-Legged Doji) | 16 ref | 낮음 | body < range*0.05 AND upperShadow > range*0.3 AND lowerShadow > range*0.3 |
| 9 | 팽이형 (Spinning Top) | 06 S3.3 | 낮음 | body < range*0.3 AND body > range*0.05 AND 양쪽 그림자 존재 |
| 10 | 양봉 마루보주 (Bullish Marubozu) | 06 S3.3 | 낮음 | close > open AND upperShadow < body*0.02 AND lowerShadow < body*0.02 |
| 11 | 음봉 마루보주 (Bearish Marubozu) | 06 S3.3 | 낮음 | close < open AND upperShadow < body*0.02 AND lowerShadow < body*0.02 |
| 12 | 띠형 (Belt Hold) | 16 ref | 낮음 | 강세: 양봉, lowerShadow=0(갭 시가), 약세: 역 |

---

## 2. 2봉 패턴 (Double-Candle) -- 10종

### 구현 완료 (6종)

| # | 패턴명 | 함수명 | patterns.js 라인 | 비고 |
|---|--------|--------|-----------------|------|
| 13 | 상승 장악형 (Bullish Engulfing) | `detectEngulfing()` | L429-465 | 하락 추세 확인 시 가산 |
| 14 | 하락 장악형 (Bearish Engulfing) | `detectEngulfing()` | L429-481 | 상승 추세 확인 시 가산 |
| 15-16 | 잉태형 (Harami) | `detectHarami()` | L483-537 | 상승/하락 양방향 구현 |
| 18 | 관통형 (Piercing Line) | `detectPiercingLine()` | L620-673 | Phase 8 추가. 50% 관통 기준 |
| 19 | 먹구름형 (Dark Cloud Cover) | `detectDarkCloud()` | L682-735 | Phase 8 추가. 관통형 약세 대칭 |
| 20 | 족집게 천장 (Tweezer Top) | `detectTweezerTop()` | L908-951 | Phase 8 추가. 동일 고가 저항 |
| 21 | 족집게 바닥 (Tweezer Bottom) | `detectTweezerBottom()` | L854-898 | Phase 8 추가. 동일 저가 지지 |

### 부분 구현 (1종)

| # | 패턴명 | 함수명 | 비고 |
|---|--------|--------|------|
| 17 | 잉태 십자형 (Harami Cross) | -- | 잉태형에서 두 번째 봉이 도지인 변형 -- 별도 감지 없음 |

### 미구현 (1종)

| # | 패턴명 | 학술 근거 | 난이도 | 알고리즘 정의 |
|---|--------|----------|-------|------------|
| 22 | 스틱 샌드위치 (Stick Sandwich) | 16 ref | 중간 | 음봉-양봉-음봉, 첫째/셋째 종가 동일 |

---

## 3. 3봉 패턴 (Triple-Candle) -- 12종

### 구현 완료 (4종)

| # | 패턴명 | 함수명 | patterns.js 라인 |
|---|--------|--------|-----------------|
| 23 | 샛별형 (Morning Star) | `detectMorningStar()` | L539-575 |
| 24 | 석별형 (Evening Star) | `detectEveningStar()` | L577-618 |
| 27 | 적삼병 (Three White Soldiers) | `detectThreeWhiteSoldiers()` | L152-190 |
| 28 | 흑삼병 (Three Black Crows) | `detectThreeBlackCrows()` | L192-226 |

### 미구현 (8종)

| # | 패턴명 | 학술 근거 | 난이도 | 알고리즘 정의 |
|---|--------|----------|-------|------------|
| 25 | 샛별 도지형 (Morning Doji Star) | 07 S8.5 | 낮음 | 샛별형에서 봉1이 도지(body<range*0.05). 현재 body1<ATR*0.2로 일반 소형봉 허용 |
| 26 | 석별 도지형 (Evening Doji Star) | 07 S8.5 | 낮음 | 석별형에서 봉1이 도지 |
| 29 | 강세 버림받은 아기 | 07 S8.2 | 중간 | 음봉→갭다운 도지→갭업 양봉. KRX 갭 제한 주의 |
| 30 | 약세 버림받은 아기 | 07 S8.2 | 중간 | 양봉→갭업 도지→갭다운 음봉 |
| 31 | 상승 삼내형 (Three Inside Up) | 07 S8.3 | 낮음 | 음봉→Harami 양봉→돌파 양봉(c2>o0) |
| 32 | 하락 삼내형 (Three Inside Down) | 07 S8.3 | 낮음 | 양봉→Harami 음봉→돌파 음봉(c2<o0) |
| 33 | 갭상 쌍까마귀 (Upside Gap Two Crows) | 16 ref | 중간 | 양봉→갭업 음봉(소형)→음봉(봉1 장악) |
| 34 | 타스키 갭 (Tasuki Gap) | 16 ref | 중간 | 양/음봉 갭 후 반대 봉이 갭 미충전 |

> **참고**: 샛별/석별의 도지 변형은 현재 구현에서 body1 < ATR*0.2 조건으로 자동 포함된다.
> 그러나 도지 변형은 더 강한 반전 신호로 구분 표시해야 한다 (07 S8.5).
> 별도 type 'morningDojiStar'/'eveningDojiStar' 추가 또는 confidence 가산 처리 권장.

---

## 4. 차트 패턴 (Multi-Candle Structure) -- 8종

### 구현 완료 (8종)

| # | 패턴명 | 함수명 | patterns.js 라인 | 비고 |
|---|--------|--------|-----------------|------|
| 35 | 이중 바닥 (Double Bottom) | `detectDoubleBottom()` | L1194-1231 | 넥라인 + 목표가 계산 |
| 36 | 이중 천장 (Double Top) | `detectDoubleTop()` | L1233-1270 | 넥라인 + 목표가 계산 |
| 37 | 머리어깨형 (Head & Shoulders) | `detectHeadAndShoulders()` | L1272-1323 | 대칭도 + 넥라인 기울기 |
| 38 | 역머리어깨형 (Inverse H&S) | `detectInverseHeadAndShoulders()` | L1325-1374 | 위와 대칭 구현 |
| 39 | 상승 삼각형 (Ascending Triangle) | `detectAscendingTriangle()` | L956-1013 | 수평 저항 + 상승 지지 |
| 40 | 하락 삼각형 (Descending Triangle) | `detectDescendingTriangle()` | L1015-1072 | 수평 지지 + 하락 저항 |
| 41 | 상승 쐐기 (Rising Wedge) | `detectRisingWedge()` | L1074-1132 | ATR 정규화 기울기 비교 |
| 42 | 하락 쐐기 (Falling Wedge) | `detectFallingWedge()` | L1134-1192 | ATR 정규화 기울기 비교 |

### 미구현 추가 차트 패턴 (학술 문서에 기술됨)

| 패턴명 | 학술 근거 | 난이도 | 비고 |
|--------|----------|-------|------|
| 대칭 삼각형 (Symmetrical Triangle) | 06 S4.2 | 중간 | 상/하 삼각형 코드 변형 가능 |
| 깃발형 (Flag) | 06 S4.2 | 중간 | 급등/급락 후 채널형 조정 |
| 페넌트형 (Pennant) | -- | 중간 | 깃발의 삼각형 변형 |
| 컵앤핸들 (Cup and Handle) | 07 S9.2 | 높음 | 2차 함수 피팅 필요 |
| 하모닉 패턴 4종 | 07 S9.4 | 높음 | 피보나치 5점 패턴 |

---

## 5. 구현 현황 요약

```
42종 패턴 기준:
  구현 완료:   26종 (61.9%)
  부분 구현:    1종 (잉태 십자형)
  미구현:      15종 (35.7%)

카테고리별:
  1봉 패턴:  7/12 (58.3%)  -- Phase 8: 잠자리/비석 도지 추가
  2봉 패턴:  6/10 (60.0%)  -- Phase 8: 관통형/먹구름/족집게 추가
  3봉 패턴:  4/12 (33.3%)
  차트 패턴: 8/8  (100.0%)

추가 차트 패턴(42종 외):
  대칭 삼각형, 깃발, 페넌트, 컵앤핸들, 하모닉 4종 = 8종 미구현
```

---

## 6. 미구현 패턴 우선순위 (구현 효과 순)

### Tier 1 -- 즉시 구현 (기존 코드 패턴 재사용, 각 30분 이내)

1. **상승 삼내형** (Three Inside Up) -- 잉태형+돌파, 기존 Harami 로직 확장
2. **하락 삼내형** (Three Inside Down) -- 위의 약세 버전
3. **긴다리 도지** (Long-Legged Doji) -- 기존 detectDoji에 sub-type 추가
4. **팽이형** (Spinning Top) -- 도지와 유사하나 약간의 몸통

### Tier 2 -- 단기 구현 (새 로직 필요, 각 1-2시간)

5. **마루보주** (Bullish/Bearish) -- 그림자 없는 큰 몸통
6. **띠형** (Belt Hold) -- 갭 시가 + 방향 전환
7. **샛별/석별 도지형** -- 기존 Morning/Evening Star에 도지 조건 추가
8. **잉태 십자형** -- 기존 Harami에서 봉1이 도지인 경우 구분
9. **대칭 삼각형** -- 기존 삼각형 코드 변형

### Tier 3 -- 중기 구현 (복합 로직, 각 3-5시간)

12. **버림받은 아기** -- 갭+도지 복합 조건 (KRX 가격제한 주의)
13. **깃발/페넌트** -- 급등/급락 감지 + 채널 피팅
14. **스틱 샌드위치** -- 드물지만 높은 신뢰도
15. **갭상 쌍까마귀** -- 갭 조건 필요
16. **타스키 갭** -- 갭 미충전 조건

### Tier 4 -- 장기 구현 (고급 알고리즘)

17. **하모닉 패턴** -- 피보나치 5점 조합 탐색
18. **컵앤핸들** -- 2차 함수 피팅 + R2 검증
19. **엘리엇 파동** -- 5점 조합 + 피보나치 가이드라인
