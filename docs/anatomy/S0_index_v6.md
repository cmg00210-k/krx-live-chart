# CheeseStock Production Anatomy V6 -- Master Index

## www.cheesestock.co.kr | Deployed: Cloudflare Pages

| Field | Value |
|-------|-------|
| Version | V6 |
| Date | 2026-04-06 |
| Total Documents | 19 |
| Total Lines | 18,471 |
| Formulas Documented | 218 (CFA Paper Grade) |
| Constants Inventoried | 300+ (graded A-E) |
| Pipeline Traces | 5/5 PASS |
| Formula-Code Fidelity | 15/15 verified (12 MATCH, 3 MINOR_DIFF, 0 DISCREPANCY) |
| Agents Deployed | 22 specialized agents across 7 waves |

---

## Architecture: 5-Stage Pipeline

```
Stage 1          Stage 2              Stage 3              Stage 4           Stage 5
API Pipeline --> Theoretical Basis --> TA/QA Methods --> Chart Rendering --> 4-Column UI
(8 APIs)        (47 core_data docs)  (patterns/signals)  (Canvas2D/LWC)   (responsive)
  |                   |                    |                   |                |
  v                   v                    v                   v                v
JSON files       150+ formulas        45 patterns          9+4 layers      A|B|C|D cols
25+ files        219 constants        28 indicators        7 tools         8 breakpoints
18-step pipeline 200+ citations       22 composites        ISeriesPrimitive virtual scroll
```

---

## Document Map

### Stage 0: Verification & Index

| File | Lines | Content |
|------|-------|---------|
| [S0_index_v6.md](S0_index_v6.md) | this file | Master index, reading guide |
| [S0_cross_stage_verification_v6.md](S0_cross_stage_verification_v6.md) | 114 | 5 end-to-end pipeline traces (all PASS) |
| [S0_formula_fidelity_v6.md](S0_formula_fidelity_v6.md) | 131 | 15 formula-code spot-checks (0 discrepancies) |
| [S0_consistency_audit_v6.md](S0_consistency_audit_v6.md) | 120 | ID uniqueness, line numbers, file paths (CONDITIONAL PASS) |

### Stage 1: API Data Pipeline (2,187 lines)

| File | Lines | Content |
|------|-------|---------|
| [S1_api_pipeline_v6_sec1to4.md](S1_api_pipeline_v6_sec1to4.md) | 1,015 | 8 APIs (ECOS/FRED/KRX/DART/KOSIS/pykrx/yfinance), 13 download scripts, 19-step pipeline, health checks |
| [S1_api_pipeline_v6_sec5to8.md](S1_api_pipeline_v6_sec5to8.md) | 628 | 15 compute scripts, 60+ JSON catalog, JS 3-batch loader, quality gates |
| [S1_api_pipeline_v6_sec9.md](S1_api_pipeline_v6_sec9.md) | 544 | Pipeline reliability: 4 P0 CRITICAL, 5 P1, 8 P2 findings |

### Stage 2: Theoretical Basis (10,611 lines)

| File | Lines | Domain | Formulas |
|------|-------|--------|----------|
| [S2_theoretical_basis_v6.md](S2_theoretical_basis_v6.md) | 1,057 | Mathematics & Statistics | M-1..M-5, S-1..S-13 (18 formulas) |
| [S2_sec23_finance_behavioral_v6.md](S2_sec23_finance_behavioral_v6.md) | 1,768 | Classical Finance & Behavioral | F-1..F-9, B-1..B-6 (15 formulas) |
| [S2_sec25_macroeconomics_v6.md](S2_sec25_macroeconomics_v6.md) | 1,183 | Macroeconomics | MAC-1..MAC-10 (10 formulas) |
| [S2_sec26_microeconomics_v6.md](S2_sec26_microeconomics_v6.md) | 1,149 | Microeconomics | MIC-1..MIC-10 (10 formulas) |
| [S2_sec27_derivatives_v6.md](S2_sec27_derivatives_v6.md) | 1,271 | Derivatives (Options/Futures/Flow) | DRV-1..DRV-17 (17 formulas) |
| [S2_sec28_bonds_credit_v6.md](S2_sec28_bonds_credit_v6.md) | 1,405 | Bonds & Credit Risk | BND-1..BND-15 (15 formulas) |
| [S2_sec29_rl_game_control_v6.md](S2_sec29_rl_game_control_v6.md) | 1,778 | RL, Game Theory, Adaptive Models | GT-1..3, OC-1..3, RL-1..4, AD-1..5 (15 formulas) |

### Stage 3: TA & QA Methods (3,228 lines)

| File | Lines | Content |
|------|-------|---------|
| [S3_ta_methods_v6.md](S3_ta_methods_v6.md) | 659 | 32 indicators (I-01..I-32), 45 patterns (P-01..P-45), 80+ thresholds, 5-tier system |
| [S3_signal_backtester_v6.md](S3_signal_backtester_v6.md) | 1,452 | 16 signals, 22 composites, backtester (WLS/Ridge/HC3/LinUCB), 38 validated methods |
| [S3_confidence_chain_v6.md](S3_confidence_chain_v6.md) | 1,117 | 10-function confidence chain (CONF-1..CONF-10), interaction effects, null safety |

### Stage 4: Chart Rendering (1,182 lines)

| File | Lines | Content |
|------|-------|---------|
| [S4_chart_rendering_v6.md](S4_chart_rendering_v6.md) | 1,182 | 9-layer PatternRenderer, 4-layer SignalRenderer, ChartManager, 7 drawing tools |

### Stage 5: UI Architecture (1,898 lines)

| File | Lines | Content |
|------|-------|---------|
| [S5_ui_architecture_v6.md](S5_ui_architecture_v6.md) | 956 | 4-column grid, 8 responsive breakpoints, virtual scroll, typography, colors |
| [S5_lifecycle_workers_v6.md](S5_lifecycle_workers_v6.md) | 942 | 36-step init lifecycle, Worker protocol, SW cache, global variable graph |

---

## Formula ID Registry (218 total)

| Prefix | Domain | Range | Count | Document |
|--------|--------|-------|-------|----------|
| M- | Mathematics | M-1..M-5 | 5 | S2_theoretical_basis |
| S- | Statistics | S-1..S-13 | 13 | S2_theoretical_basis |
| F- | Finance Theory | F-1..F-9 | 9 | S2_sec23_finance_behavioral |
| B- | Behavioral | B-1..B-6 | 6 | S2_sec23_finance_behavioral |
| MAC- | Macroeconomics | MAC-1..MAC-10 | 10 | S2_sec25_macroeconomics |
| MIC- | Microeconomics | MIC-1..MIC-10 | 10 | S2_sec26_microeconomics |
| DRV- | Derivatives | DRV-1..DRV-17 | 17 | S2_sec27_derivatives |
| BND- | Bonds/Credit | BND-1..BND-15 | 15 | S2_sec28_bonds_credit |
| GT- | Game Theory | GT-1..GT-3 | 3 | S2_sec29_rl_game_control |
| OC- | Optimal Control | OC-1..OC-3 | 3 | S2_sec29_rl_game_control |
| RL- | Reinforcement Learning | RL-1..RL-4 | 4 | S2_sec29_rl_game_control |
| AD- | Adaptive Models | AD-1..AD-5 | 5 | S2_sec29_rl_game_control |
| I- | Indicators | I-01..I-32 | 32 | S3_ta_methods |
| P- | Patterns | P-01..P-45 | 45 | S3_ta_methods |
| SIG- | Signals | SIG-01..SIG-16+ | 16+ | S3_signal_backtester |
| CONF- | Confidence Chain | CONF-1..CONF-10 | 10 | S3_confidence_chain |

**Known issue:** `F-` prefix collision with Findings IDs in S1/S2_sec25 — recommend renaming Finding IDs to `FND-`.

---

## Constant Grade Distribution (aggregated across all documents)

| Grade | Definition | Count | % |
|-------|-----------|-------|---|
| [A] Academic Fixed | Value from published paper, universally accepted | ~60 | 20% |
| [B] Tunable with Basis | Has academic range, calibrated within bounds | ~90 | 30% |
| [C] KRX-Adapted | Adjusted for Korean market structure | ~70 | 23% |
| [D] Heuristic | No calibration data, needs empirical validation | ~80 | 27% |
| [E] Deprecated | Marked for removal | 1 | <1% |

**Calibration priority (D-grade):** CUSUM (4), Kalman (4), REGIME_CONFIDENCE_MULT, composite window (5 bars), WLS lambda (0.995), volume z-score mapping

---

## Critical Findings Across All Waves

### P0 CRITICAL (4 — from Wave 1.3)
1. daily_update.bat Steps 6/7: silent failure (errorlevel overwrite)
2. verify.py: Worker constructor URLs not validated
3. daily_deploy.bat: skips all compute steps (serves stale data)
4. Multiplicative post-filter stacking can crush confidence to floor

### P1 HIGH (8 — aggregated)
- auto_update.bat: zero error checking
- Cross-stock BH-FDR not applied (607K effective tests)
- Survivorship universe limitation
- WLS n/k ratio below recommended range
- RL reward/metric misalignment (IC vs return)
- Staleness gap: _staleDataSources tracked but never consumed
- CupAndHandle bracket data shape mismatch
- Hardcoded `#fff` in patternRenderer.js R:R bar

### Corrections Applied (V5 → V6)
- KTB monthly stat codes: 721Y001 replaces deprecated 817Y002 monthly usage
- M2 stat: 161Y006/BBHA00 confirmed, old 101Y003 deprecated
- Pipeline step count: 19 (not 18)
- Blume formula: 0.33 + 0.67β (not 0.343 + 0.677β)
- Blume citation: 1975 (not 1971)
- Extended line alpha: 0.35 (not 0.25)
- --fs-nano: 10px (not 9px)
- HHI thresholds: DOJ/FTC 2010 Guidelines cited
- Slippage model: _getAdaptiveSlippage() already implements 4-tier

---

## Reading Guide

### For Developers
Start with S5_lifecycle_workers → S1_api_pipeline → S3_ta_methods → S4_chart_rendering

### For Quant Researchers
Start with S2_theoretical_basis → S2_sec27_derivatives → S3_signal_backtester → S3_confidence_chain

### For Financial Analysts
Start with S2_sec23_finance_behavioral → S2_sec28_bonds_credit → S2_sec25_macroeconomics

### For QA / Verification
Start with S0_cross_stage_verification → S0_formula_fidelity → S0_consistency_audit

### For Consumers / End Users
Start with S0_index (this file) → S5_ui_architecture → S3_ta_methods (patterns and signals)

---

## V5 → V6 Comparison

| Metric | V5 | V6 | Change |
|--------|----|----|--------|
| Documents | 11 | 19 | +8 new |
| Total Lines | 10,422 | 18,471 | +77% |
| Formulas | ~50 (partial annotation) | 218 (CFA Paper Grade) | +336% |
| Constants Graded | ~100 | 300+ | +200% |
| Pipeline Traces | 0 | 5 (all PASS) | NEW |
| Formula-Code Checks | 0 | 15 (0 discrepancies) | NEW |
| Critical Findings | 0 | 4 P0 + 8 P1 | NEW |
| New Sections | -- | RL/Game, Signal/Backtester, Confidence Chain, Lifecycle/Workers | 4 NEW |
| Agents Used | 9 | 22 | +144% |

---

*Generated by 22 specialized agents (financial-systems-architect, cfa-financial-analyst, code-audit-inspector, statistical-validation-expert, financial-theory-expert, macro-economist, microeconomics-analyst, derivatives-expert, bond-expert-kr, technical-pattern-architect, pattern-analysis-renderer, font-ui-designer, Explore) across 7 sequential waves.*
