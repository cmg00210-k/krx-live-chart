#!/usr/bin/env python3
"""5-year backtest WR extraction from occurrenceReturns (Phase 2-E)"""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
from collections import defaultdict

SIG = dict(hammer='buy',invertedHammer='buy',shootingStar='sell',hangingMan='sell',
    bullishEngulfing='buy',bearishEngulfing='sell',bullishHarami='buy',bearishHarami='sell',
    morningStar='buy',eveningStar='sell',piercingLine='buy',darkCloud='sell',
    dragonflyDoji='buy',gravestoneDoji='sell',tweezerBottom='buy',tweezerTop='sell',
    bullishMarubozu='buy',bearishMarubozu='sell',threeWhiteSoldiers='buy',threeBlackCrows='sell',
    bullishBeltHold='buy',bearishBeltHold='sell',threeInsideUp='buy',threeInsideDown='sell',
    abandonedBabyBullish='buy',abandonedBabyBearish='sell',
    doubleBottom='buy',doubleTop='sell',headAndShoulders='sell',inverseHeadAndShoulders='buy',
    ascendingTriangle='buy',descendingTriangle='sell',risingWedge='sell',fallingWedge='buy')

OLD = dict(hammer=47.9,invertedHammer=52.3,shootingStar=56.0,hangingMan=55.2,
    bullishEngulfing=43.5,bearishEngulfing=56.4,bullishHarami=45.9,bearishHarami=53.7,
    piercingLine=37.3,darkCloud=55.1,tweezerBottom=42.6,tweezerTop=54.0,
    threeWhiteSoldiers=56.2,threeBlackCrows=63.6,morningStar=42.9,eveningStar=53.3,
    bullishMarubozu=42.1,bearishMarubozu=58.1,bullishBeltHold=55.0,bearishBeltHold=58.0,
    threeInsideUp=56.0,threeInsideDown=55.0,abandonedBabyBullish=53.0,abandonedBabyBearish=53.0,
    dragonflyDoji=50.0,gravestoneDoji=59.1,doubleBottom=65.6,doubleTop=73.0,
    headAndShoulders=50.0,inverseHeadAndShoulders=50.0,
    ascendingTriangle=41.7,descendingTriangle=58.3,risingWedge=64.5,fallingWedge=35.5)

wins = defaultdict(int)
total = defaultdict(int)
cnt = 0

with open('data/backtest/raw_results.ndjson', 'r', encoding='utf-8') as f:
    for line in f:
        cnt += 1
        rec = json.loads(line)
        for occ in rec.get('occurrenceReturns', []):
            pt = occ.get('type', '')
            if pt not in SIG:
                continue
            rets = occ.get('returns', {})
            r5 = rets.get('5')
            if r5 is None:
                continue
            total[pt] += 1
            s = SIG[pt]
            # r5 is already % return (positive=up, negative=down)
            if (s == 'buy' and r5 > 0) or (s == 'sell' and r5 < 0):
                wins[pt] += 1

# Write results
lines = []
lines.append(f'stocks: {cnt}')
lines.append(f'{"Pattern":<30} {"n":>8}  {"WR5yr":>7}  {"WR1yr":>7}  {"delta":>7}')
lines.append('-' * 67)

wr_json = {}
sz_json = {}

for k in sorted(total, key=lambda x: -total[x]):
    wr = wins[k] / total[k] * 100
    old = OLD.get(k, 0)
    d = wr - old
    flag = ' ***' if abs(d) > 5 else ''
    lines.append(f'{k:<30} {total[k]:>8}  {wr:>6.1f}%  {old:>6.1f}%  {d:>+6.1f}{flag}')
    wr_json[k] = round(wr, 1)
    sz_json[k] = total[k]

with open('data/backtest/wr_5year.txt', 'w', encoding='utf-8') as out:
    out.write('\n'.join(lines) + '\n')

with open('data/backtest/wr_5year.json', 'w', encoding='utf-8') as jf:
    json.dump({'win_rates': wr_json, 'sample_sizes': sz_json}, jf, indent=2)

# Print to stdout
for l in lines:
    print(l)
print(f'\nTotal patterns with h=5 returns: {sum(total.values())}')
