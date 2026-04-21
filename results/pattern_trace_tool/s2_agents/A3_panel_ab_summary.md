# A3 Panel + A/B Test Summary — Session 2

Agent: financial-systems-architect (A3)
Deliverables: `debug/tracePanel.js` + `scripts/pattern_trace_ab_test.mjs`
Date: 2026-04-21

## LOC Delta

| File | S1 LOC | S2 LOC | Delta |
|------|--------|--------|-------|
| `debug/tracePanel.js` | 765 | 881 | +116 |
| `scripts/pattern_trace_ab_test.mjs` | 428 | 631 | +203 |
| Total | 1193 | 1512 | +319 |

Note: AB script grew significantly due to sub-directory batch mode, improved summary
printing, legacy flat-scan fallback, and the extensive DevTools console snippet in the
header comment block.

## tracePanel.js Refinements (Session 2)

### 1. Cohen power fallback bullet

When `pVal == null` (A-MVP/A-Mid does not yet emit pValue from backtester), the Pwr
column now shows a bullet `•` marker with a tooltip if the EB-shrunk WR diverges more
than 5pp from the grand mean:

  `'pVal absent — directional only (shrinkage +8.3pp from 45.0%)'`

When divergence is <= 5pp, the column remains `—` (no claim made).

### 2. Anti-predictor strict null guard

Both the inline family-row icon and the Section 8 aggregate card collection now check
`antiPredictor === true` (strict equality), not `antiPredictor` (truthy). This prevents
false positives when `l3.antiPredictor` is `null` (A-MVP traces) or `undefined`
(A-Mid traces for patterns where the hook did not emit the field).

The condition in full:
  `antiP === true && inv === false && finConf != null && finConf > 50 && shrunk < 48`

### 3. Pattern card EB shrunk live-update

Section 5 pattern detection cards now contain `<span class="tp-eb-shrunk">` with
`data-wr-raw`, `data-wr-n`, and `data-wr-grand` attributes. `_refreshWilsonCells()`
also iterates `.tp-eb-shrunk` and recomputes `_shrink(rawWR, wrN, _n0, grand)` on
every N0 slider move.

The displayed value is the on-the-fly shrunk value (not the frozen `l3.wr.shrunk`
from the trace JSON). The trace's `wr.N0` label is shown as a reference.

### 4. Aggregate anti-predictor list live-update

A `<div id="tp-anti-predictor-container">` placeholder is rendered inside Section 8.
`_refreshAntiPredictors()` (new helper) iterates `_currentTrace.perPattern`,
recomputes shrunk values against current `_n0`, and writes innerHTML to the container
only. This avoids full panel rebuild.

`_currentTrace` is stored as module-level state on `load()` and remains set until the
next `load()` call.

### 5. Wilson CI small-n asterisk

`_wilsonStr()` now appends `*` when `n < 5`. The `.tp-wilson-cell` also gets
`title="n<5 — CI statistically uninformative"` via setAttribute.

### 6. BH-FDR numeric threshold

The BH column now renders:
  `<pValue exponential>  P|F  <threshold exponential (muted, 9px)>`

Example: `9.54e-4  P  9.62e-4`

The threshold shown is `bhFdrThreshold` from the trace l3 data if present; otherwise
falls back to the cross-asset constant `9.62e-4` (q=0.05, 2631 tests).

### 7. Aggregate rejection source tooltip

When `agg.source === 'aggregate'` (A-Mid estimation mode), the tooltip on the
"미설명 기각" row reads:
  `'추정치 — Session 3 helper-observer에서 정밀화'`

When source is absent (A-MVP), the existing tooltip reads:
  `'Main-thread 14-stage cascade not traced in MVP. See appWorker.js L309-336.'`

The source value is also displayed inline as a muted `[aggregate]` badge.

## Graceful Degradation — A-MVP Behavior Preserved

When A1 hook outputs a trace at `traceLevel=mvp` (no pValue, no antiPredictor, no
bhFdrThreshold, no aggregateRejected), all new features degrade gracefully:

| New feature | A-MVP behavior |
|-------------|----------------|
| Cohen power bullet | `—` (rawWR and wrN may also be absent) |
| BH threshold display | `—` (pVal is null) |
| Anti-predictor inline icon | hidden (`antiP === true` check fails; null !== true) |
| Pattern card EB live-update | `span.tp-eb-shrunk` omitted when `l3.wr` absent |
| Aggregate container | empty `<div>` (perPattern.aggregateRejected absent) |
| Source tooltip | falls back to existing MVP tooltip text |

No try/catch wrappers needed — all guards are `!= null` or `=== true` checks on
fields that are simply absent in A-MVP traces.

## AB Script Changes (Session 2)

### M4 fix — sub-KRW price rounding

`_priceRound(v)` introduced:
  `|price| >= 100` → `Math.round(v)` (KRW integer convention)
  `|price| < 100`  → `Math.round(v * 100) / 100` (2dp for sub-100 KRW stocks)

Applied to `priceTarget` and `stopLoss` in `tupleKey()`. `confidence` remains
integer-rounded (patterns.js returns integer confidence values).

Boundary: 99.99 KRW → 2dp; 100.00 KRW → integer. Stocks below 100 KRW are rare
on KRX (mostly very low-priced KOSDAQ microcaps).

### L4 fix — strict: true CLI parsing

`parseArgs()` now uses `strict: true`. Unknown flags (e.g. `--refs`, `--traces`)
immediately print a clear error with the supported flag list:

  `[AB] CLI error: Unknown option '--refs'`
  `[AB] Supported flags: --ref, --trace, --batch-dir, --help, --stocks`

Previously `strict: false` silently ignored typos, causing the script to fall into
list-expected mode with no diagnostic.

### Windows path fix

`REPO_ROOT` now uses `fileURLToPath(import.meta.url)` (from `node:url`) instead of
`new URL(import.meta.url).pathname`. On Windows, `pathname` returns `/C:/...` which
causes `path.resolve('/C:/...', '..')` to produce `C:\C:\...` (double-drive). The
`fileURLToPath` function returns the native path `C:\...` correctly.

### Batch sub-directory mode

`--batch-dir` now supports two layouts:

**Sub-directory layout (preferred, for 5-stock P3 regression)**:
  `<batch-dir>/<code>_<tf>/prod_ref.json + debug_trace.json`

The script auto-detects sub-directories via `readdirSync + withFileTypes`. If found,
uses sub-dir layout. If not, falls back to legacy flat scan.

Summary line format (per P3 spec):
  `005930 daily   PASS Delta=0  patterns=23/23`
  `035720 daily   FAIL Delta=1  mismatch: bar=187  key=hammer|187|detected|73|68000|65000`

Exit 0 only if ALL pairs pass. Exit 1 if any fail.

### DevTools console snippet

Full snippet documented in the header comment block (lines 28-50). Uses the targeted
shape (just `patterns` + `meta`) rather than the full `_lastAnalysisResult` object,
keeping the prod_ref.json compact for comparison.

## Batch Directory Convention

```
results/pattern_trace_tool/ab_reports/
  005930_daily/
    prod_ref.json       <- production Worker output captured via DevTools
    debug_trace.json    <- debug trace Worker output from viewer Download
  005930_1m/
    prod_ref.json
    debug_trace.json
  035720_daily/
    ...
  000660_15m/
    ...
  001000_daily/         <- KOSDAQ small-cap (any dir not starting with 1-5 digits)
    ...
```

Wildcard KOSDAQ small-cap: any sub-directory name is valid. The script does not
filter by code pattern — all sub-directories in batch-dir are treated as pairs.

## Self-Verification Completed

1. `node --input-type=module --check < scripts/pattern_trace_ab_test.mjs` → SYNTAX OK
2. `grep "panel\.innerHTML" debug/tracePanel.js` → 3 matches (existing: L802 clear,
   L816 initial load, L867 showError). Zero new full-panel rebuilds.
3. Fixture test: `_fixture_test/005930_daily/{prod_ref,debug_trace}.json` with 2
   matching patterns. `node scripts/pattern_trace_ab_test.mjs --batch-dir _fixture_test`
   → PASS Delta=0 patterns=2/2, EXIT_CODE=0. Fixture removed after test.
