# Pattern Trace Tool — Session 2 Handoff

**Branch**: `feat/pattern-trace-tool-s2` (base=`feat/pattern-trace-tool`, PR #8 open)
**Scope**: A-Mid hook + live-scan viewer + statistical panel refinements + A/B batch mode
**Status**: Code complete. Syntax PASS. verify.py --strict baseline unchanged (5 WARN / 0 ERR).
**Production file touches**: ZERO (js/, index.html, sw.js, scripts/build.mjs, scripts/stage_deploy.py, _headers all untouched).

---

## What was delivered in Session 2

### A. A-Mid hook (auto-trading-dev agent)

File: `debug/pattern-trace-hook.js` · 419 → 744 LOC (+325)

- **Aggregate rejection per 45 pattern families** via `LOOKBACK_BY_FAMILY` table + pre/post diff (no source-touch). Emits `{considered, detected, nearMiss, unexplainedReject, source:'aggregate'}` per family including zero-detection ones.
- **Invariant guard**: `considered >= detected + nearMiss + unexplainedReject`; violations clamped + recorded to `meta.captureErrors[].category='aggregate.invariant'`.
- **L3 statistical fields**: `pValue` from best-effort `backtester.backtestAll → horizons[5].tStat → _approxPValue()` (gated on `traceLevel='mid'`, 500ms budget tracked in `meta.pValueDurationMs`); `bhFdrThreshold = 9.62e-4` constant; `antiPredictor` from EB-shrunk WR < 48; `inverted` honestly null when pattern object doesn't expose it.
- **M5 double-install guard**: wrappers tag `__isTraceWrapped=true`; re-entry logs warning and skips re-wrap.
- **Dynamic `meta.traceLevel`**: honors `msg.traceLevel` ('mvp'|'mid'|'full').
- **pValue reliability**: 43/45 families reliable when `backtestAll` succeeds; `risingThreeMethods`/`fallingThreeMethods` always null (known 43/45 gap from `PATTERN_WIN_RATES` table).

### B. Live-scan viewer (pattern-analysis-renderer agent)

Files: `debug/pattern-trace.js` (332 → 834 LOC), `debug/pattern-trace.html` (72 → 81), `debug/traceCanvas.js` (846 → 897), `debug/traceStyles.css` (375 → 434).

- `?source=production-wss|kiwoom-local` with `?code=005930&market=KOSPI&tf=1d` URL params.
- Seed candles via `dataService.getCandles()` (read-only consumption of api.js), then `realtimeProvider.start(stock, tf)` for live ticks.
- `_onTick()` handles full `candles[]` WS messages AND incremental price ticks (append/update last bar).
- 3-second debounced `_scheduleLiveAnalysis()` posting to debug Worker. Stale-result rejection via `requestId`.
- `_tailFollow` flag (default true in live modes); user scrubber interaction disables, "[live] Follow" button re-enables.
- Source badge: File-replay (gray) / Production-WSS (blue) / Kiwoom-local (green) + connection-dot (connected/reconnecting/failed).
- `beforeunload` cleanup: unsubscribe tick listener + stop WS + cancel timer + terminate Worker + traceCanvas.destroy().
- **M1 fix**: dead ternary `isUp ? color : color` → `color`.
- **M2 fix**: clamp indicator reads `preAnalyze.regime.dynamicATRCap` (number only, guarded against `{_unavailable}` object).
- **M3 fix**: `destroy()` exposed + `_initResize()` double-init guard + mousemove/mouseleave removeEventListener.
- **M4 fix**: AB script sub-KRW rounding (integer for |v|>=100, 2dp for <100).

### C. Panel refinements + AB batch mode (financial-systems-architect agent)

Files: `debug/tracePanel.js` (765 → 877 LOC), `scripts/pattern_trace_ab_test.mjs` (428 → 631 LOC).

- **N₀ slider live-update**: `.tp-wilson-cell` AND `.tp-eb-shrunk` (new, on pattern cards) use `data-*` attrs. Full panel rebuild never triggered.
- **Cohen power bullet**: `•` when pVal absent but shrinkage > 5pp from grandMean.
- **Anti-predictor strict guard**: requires `antiPredictor === true` (not truthy) — avoids false-positive from null A-MVP traces.
- **Wilson n<5 asterisk**: marks statistically uninformative CIs.
- **BH-FDR numeric threshold display**: P/F badge + `9.62e-4` muted text.
- **Aggregate source tooltip**: "추정치 — Session 3 helper-observer에서 정밀화" for `source='aggregate'`.
- **`tp-anti-predictor-container` live rebuild**: `_refreshAntiPredictors()` recomputes only that subsection on slider move.

AB script:
- `strict:true` parseArgs (unknown flags fail cleanly with supported list).
- `_priceRound()` convention: integer ≥100 KRW, 2dp <100 KRW.
- `fileURLToPath(import.meta.url)` Windows path fix.
- `--batch-dir <path>` subdirectory mode: `<code>_<tf>/prod_ref.json + debug_trace.json` layout.
- PASS format: `PASS Δ=0 patterns=N/N`.
- Fixture self-test (same JSON as ref + trace) verified: `Δ=0, exit 0` ✓.

### D. Code-audit cross-check (code-audit-inspector agent)

Report: `results/pattern_trace_tool/s2_agents/CODE_AUDIT_S2_REPORT.md`

- 10/10 gates assessed, 8 PASS / 2 PARTIAL (both subsequently fixed).
- **S2-H1 fixed**: scrubber `input` handler now guarded by `e.isTrusted` — `scrubber.dispatchEvent(new Event('input'))` from pattern-card click no longer disables tail-follow.
- **S2-H2 fixed**: pattern-detection cards at `tracePanel.js:669` now coerce `barIndex` + `conf` via `Number() + isFinite()` before interpolation.
- S1 H1 (playback cancel) + H2 (3/4 innerHTML sinks) remain FIXED from S1.
- S1 M1-M5 all FIXED in this session.

---

## What remains manual (cannot auto-execute in this session)

### A/B 5-stock regression (real 10-run pass)

The AB script mechanics are verified (fixture test Δ=0, exit 0). Full regression requires manual DevTools capture per stock/tf pair.

**Capture workflow** (to be run by user after merge, per stock):

1. Start local server:
   ```
   npx -y serve -l 5500 .
   ```
2. Open `http://localhost:5500` (production site) in Chrome/Edge. Select stock.
3. Wait for `Toast: N개 패턴 감지됨`.
4. DevTools console:
   ```js
   copy(JSON.stringify({
     patterns: window._lastAnalysisResult.patterns,
     meta: {
       stockCode: currentStock.code,
       barCount: candles.length,
       timeframe: currentTimeframe
     }
   }))
   ```
5. Paste clipboard into `results/pattern_trace_tool/ab_reports/<code>_<tf>/prod_ref.json`.
6. In a second tab, open `http://localhost:5500/debug/pattern-trace.html?source=file`. Drop the candle JSON for the same stock/tf.
7. Click "Download trace" → save as `results/pattern_trace_tool/ab_reports/<code>_<tf>/debug_trace.json`.
8. Repeat steps 2-7 for all 5 stocks × 2 timeframes = 10 runs:
   - 005930 (Samsung) daily + 1m
   - 035720 (Kakao) daily
   - 000660 (SK Hynix) 15m
   - KOSDAQ small-cap (any) daily
9. Run `node scripts/pattern_trace_ab_test.mjs --batch-dir results/pattern_trace_tool/ab_reports/`. Requires 10/10 PASS Δ=0 for merge gate.

### Launcher smoke test (production-wss live connect)

OneDrive launchers verified present:

```
C:\Users\seth1\OneDrive\바탕 화면\CheeseStock_Trace.bat         (production-wss)
C:\Users\seth1\OneDrive\바탕 화면\CheeseStock_Trace_Kiwoom.bat  (kiwoom-local)
C:\Users\seth1\OneDrive\바탕 화면\CheeseStock_Trace_Replay.url  (file-replay)
```

Live-scan first-run behavior (P4 manual smoke, pending user):
- `CheeseStock_Trace.bat` double-click → browser opens `?source=production-wss` → `realtimeProvider.connect('wss://cheesestock.co.kr')`. V48 Phase 3 HMAC barrier expected close code 1006/1008 (unauthenticated). Viewer should degrade gracefully: seed candles via `dataService.getCandles()` remain usable, banner shows failure state.
- `CheeseStock_Trace_Kiwoom.bat` → starts `server\start_server.bat` first, then browser opens `?source=kiwoom-local` → 10-30ms tick-level stream. Requires Kiwoom OCX installed and logged in. **KNOWSTOCK 동시 실행 금지** (Kiwoom 1인 1접속).

### Risk R11 (production-wss HMAC barrier)

V48 Phase 3 requires HMAC + session token + rate limit. Debug viewer does not hold secrets → `?source=production-wss` likely fails at WS handshake. If confirmed, Session 3 backlog item: add read-only ticker feed endpoint server-side that does NOT require HMAC (ws_server.py extension).

---

## Session 3 backlog (unchanged from S2 plan)

- Helper observer: `_quality` / `_detectTrend` / `_atr` / `_stopLoss` / `_candleTarget` / `_applyConfluence` / `_applyRRGate` wrap for near-miss capture (~75-85% coverage).
- Chromium `new Error().stack` caller correlation with Firefox/Safari warning banner.
- Anti-predictor runtime audit (48-threshold full audit).
- BH-FDR q/√2631 ≈ 9.62e-4 inline display on every detection card.
- Bulkowski 2005 theoretical WR vs observed EB-shrunk; flag `regime_mismatch` on >15pp deviation.
- Component B Node CLI (post-MVP).

---

## Verification summary

| Gate | Status |
|------|--------|
| verify.py --strict 5 WARN baseline | PASS (unchanged) |
| Syntax: hook / worker / main / canvas / panel / styles / ab | 6/6 OK |
| ZERO production file touch | CONFIRMED |
| ?v=N pins sync (14/28/50/47/49) | PASS |
| stage_deploy.py debug/ blacklist | PASS (L59) |
| 7 S1 gates + 3 S2 gates (G1-G10) | 10/10 after H1/H2 fix |
| AB script fixture determinism | PASS (Δ=0 exit 0) |
| 10-run browser regression | Pending manual (post-merge) |

---

## Files changed (Session 2)

| File | S1 LOC | S2 LOC | Delta |
|------|--------|--------|-------|
| debug/pattern-trace-hook.js | 419 | 744 | +325 |
| debug/pattern-trace.js | 332 | 836 | +504 |
| debug/pattern-trace.html | 72 | 81 | +9 |
| debug/traceCanvas.js | 846 | 897 | +51 |
| debug/tracePanel.js | 765 | 877 | +112 |
| debug/traceStyles.css | 375 | 434 | +59 |
| scripts/pattern_trace_ab_test.mjs | 428 | 631 | +203 |
| **Total** | **3,237** | **4,500** | **+1,263** |

Session 2 agent archives:
- `results/pattern_trace_tool/s2_agents/A1_hook_amid_summary.md`
- `results/pattern_trace_tool/s2_agents/A2_live_scan_summary.md`
- `results/pattern_trace_tool/s2_agents/A3_panel_ab_summary.md`
- `results/pattern_trace_tool/s2_agents/CODE_AUDIT_S2_REPORT.md`
