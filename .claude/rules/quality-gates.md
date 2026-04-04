# Quality Gates — CheeseStock

Five formal gates that guard correctness across sessions, multi-agent runs, and deploys.
These are additive to `scripts/verify.py` (5 automated checks). Gate 1 extends verify.py
with a 6th automated check. Gates 2-5 are manual protocols.

---

## Gate 1 — CHECK 6: JSON Pipeline Connectivity (automated)

Add to `scripts/verify.py` as `check_pipeline()`. Run with:

```
python scripts/verify.py --check pipeline
```

### What to validate

The following table is the canonical contract between `appWorker.js` fetch() calls and
the files that must exist on disk. All paths are relative to the project root.

| Variable assigned | File path | Required top-level keys | Sample-data guard |
|---|---|---|---|
| `_macroLatest` | `data/macro/macro_latest.json` | `updated`, `mcs`, `vix`, `bok_rate` | none |
| `_bondsLatest` | `data/macro/bonds_latest.json` | `updated` | none |
| `_kosisLatest` | `data/macro/kosis_latest.json` | `updated`, `source` | none |
| `_macroComposite` | `data/macro/macro_composite.json` | `mcsV2` | none |
| `_macroLatest.vkospi` | `data/vkospi.json` | array element with `close`, `time` | none |
| `_derivativesData` | `data/derivatives/derivatives_summary.json` | array with `time` | none |
| `_investorData` | `data/derivatives/investor_summary.json` | `date`, `foreign_net_1d` | `source != "sample"` |
| `_etfData` | `data/derivatives/etf_summary.json` | `date` | none |
| `_shortSellingData` | `data/derivatives/shortselling_summary.json` | `date`, `market_short_ratio` | `source != "sample"` |
| `_derivativesData.basis` | `data/derivatives/basis_analysis.json` | array element with `basis`, `basisPct` | none |
| `_flowSignals` | `data/backtest/flow_signals.json` | `stocks`, `hmmRegimeLabel` | `status != "error"` |
| `_optionsAnalytics` | `data/derivatives/options_analytics.json` | `analytics.straddleImpliedMove` | `status != "error"` |

### Validation rules per entry

1. **File exists** — FAIL if absent. (These are not optional: absent files produce silent
   confidence-adjustment no-ops that can mask broken pipelines.)
2. **Required keys present** — WARN if a top-level required key is missing (parse the
   JSON, walk the dotted key path, warn if None or absent).
3. **Sample-data guard** — FAIL if `source == "sample"` on files that have a guard.
   Rationale: `appWorker.js` lines 318-325 null out `_investorData` and `_shortSellingData`
   when `source == "sample"`. A FAIL here is a signal that the daily update has not run
   real data yet.
4. **Array non-empty** — WARN if an expected array file (`vkospi.json`,
   `derivatives_summary.json`, `basis_analysis.json`) parses to an empty list.
5. **Staleness check** — WARN if the `updated` / `date` / `generated` field in a file
   is older than 14 calendar days relative to today's date. Use Python
   `datetime.date.fromisoformat()` for parsing.
6. **Nested key path** — For keys expressed with a dot (`analytics.straddleImpliedMove`),
   check that each segment exists before indexing the next.

### Implementation sketch

```python
# In verify.py, add this alongside the existing check_* functions:

PIPELINE_CONTRACT = [
    # (file_path, required_keys, sample_guard_field, is_array)
    ("data/macro/macro_latest.json",              ["updated","mcs","vix","bok_rate"], None,       False),
    ("data/macro/bonds_latest.json",              ["updated"],                        None,       False),
    ("data/macro/kosis_latest.json",              ["updated","source"],               None,       False),
    ("data/macro/macro_composite.json",           ["mcsV2"],                          None,       False),
    ("data/vkospi.json",                          ["close","time"],                   None,       True),
    ("data/derivatives/derivatives_summary.json", ["time"],                           None,       True),
    ("data/derivatives/investor_summary.json",    ["date","foreign_net_1d"],          "source",  False),
    ("data/derivatives/etf_summary.json",         ["date"],                           None,       False),
    ("data/derivatives/shortselling_summary.json",["date","market_short_ratio"],      "source",  False),
    ("data/derivatives/basis_analysis.json",      ["basis","basisPct"],              None,       True),
    ("data/backtest/flow_signals.json",           ["stocks","hmmRegimeLabel"],        "status",  False),
    ("data/derivatives/options_analytics.json",   [],                                 "status",  False),
    # analytics.straddleImpliedMove uses nested path check (separate logic)
]
```

For array entries, check required keys against the last element (most recent record).
For `options_analytics.json`, check `data["analytics"]["straddleImpliedMove"]` exists.
For `status` guard: FAIL if `data.get("status") == "error"`.
For `source` guard: FAIL if `data.get("source") == "sample"`.

### What CHECK 6 catches that no current check catches

- `investor_summary.json` still contains sample data after a failed KRX API run — silent
  bug because appWorker.js logs a warning but does not throw; verify.py currently ignores.
- `macro_composite.json` missing `mcsV2` key after a script schema change — confidence
  adjustments in `_applyPhase8ConfidenceToPatterns()` silently skip.
- `vkospi.json` array is empty after a VKOSPI download failure — no VKOSPI injection into
  `_macroLatest`, vol-regime classification degrades to VIX proxy without notice.
- A data file has not been refreshed in 3 weeks — stale macro adjustments applied to live
  patterns without any warning visible in the browser.

### Adding CHECK 6 to verify.py main()

In the `checks` dict and argparse `choices` list, add `"pipeline": check_pipeline`.
The `--check pipeline` flag must work the same as other categories.

---

## Gate 2 — Browser Smoke Test (10-item manual checklist)

Execute after every multi-file change, before committing. Target time: under 5 minutes.
Open browser DevTools (F12) Console and Network tabs before loading.

### The 10 items

**Initialization (3 items)**

1. Console shows `[KRX] index.json 로드 완료: N종목` with N > 2000.
   - Fail signal: N = 0 or message absent — data layer broken (api.js or index.json).

2. Console shows `[Worker] 분석 Worker 초기화 완료` within 3 seconds of page load.
   - Fail signal: absent — analysisWorker.js failed to load (check ?v=N mismatch,
     STATIC_ASSETS gap, or importScripts path error).

3. No red errors in Console on page load (yellow warnings acceptable).
   - Fail signal: any `TypeError`, `ReferenceError`, or uncaught promise rejection
     — script load order broken or global variable missing.

**Data pipeline (2 items)**

4. Select any KOSPI stock from the sidebar. Chart renders within 2 seconds.
   - Fail signal: blank chart or spinner stuck — dataService.getCandles() returning null.

5. Console shows `[KRX] 매크로/채권 데이터 로드 완료` after stock selection.
   - Fail signal: absent — macro fetch failed; pipeline running without confidence data.

**Pattern pipeline (2 items)**

6. Wait up to 8 seconds after stock load. Toast `N개 패턴 감지됨` appears.
   - Fail signal: no toast — Worker result not arriving; check Worker version mismatch
     or candles array below 50 bars.

7. Pattern panel (C column) shows at least 1 pattern card.
   - Fail signal: empty panel when toast fired — renderPatternPanel() receiving empty
     array; check `_filterPatternsForViz()` or `detectedPatterns._srLevels` corruption.

**UI integrity (2 items)**

8. Toggle each vizToggle (candle / chart / signal / forecast) on and off. Chart must
   re-render without console errors each time.
   - Fail signal: error on toggle — `_filterPatternsForViz()` or `_renderOverlays()` crash.

9. Resize browser window to < 1200px and back. Sidebar and panels collapse/expand
   correctly. No horizontal scrollbar at any breakpoint.
   - Fail signal: layout broken — CSS breakpoint or JS responsive handler regression.

**Deploy integrity (1 item)**

10. Open Network tab, hard-reload (Ctrl+Shift+R). All local JS files return HTTP 200.
    No 404s for `js/*.js` or `css/style.css`. Service Worker registered (`sw.js` visible).
    - Fail signal: 404 on any file — STATIC_ASSETS or ?v=N mismatch broke cache.

### Abbreviated checklist (copy-paste for session notes)

```
[ ] 1. index.json N>2000 종목
[ ] 2. Worker 초기화 완료
[ ] 3. No red console errors on load
[ ] 4. Stock selection renders chart <2s
[ ] 5. 매크로/채권 데이터 로드 완료 in console
[ ] 6. Toast: N개 패턴 감지됨
[ ] 7. Pattern panel shows >= 1 card
[ ] 8. All 4 vizToggles cycle without errors
[ ] 9. Resize <1200px: layout ok, no horizontal scroll
[ ] 10. Hard reload: zero 404s, sw.js registered
```

---

## Gate 3 — Change Contract Template (per multi-agent session)

**When required:** Any session that dispatches 6 or more parallel agents, or touches
3 or more JS files simultaneously.

**Lifecycle:** Ephemeral (not committed). Created at session start, discarded at session end.
Store in `c:\Users\seth1\krx-live-chart-remote\results\session_contract.md` (already in
.gitignore via `results/`). Overwrite at the start of each new session.

**How agents reference it:** The orchestrator agent reads the file before dispatching
sub-agents. Each sub-agent receives the relevant rows from the "File ownership" table
as part of its prompt context, not the entire document.

### Template

```markdown
# Session Change Contract — [DATE] [BRIEF_TOPIC]

## Objective (1 sentence)
[What is being built or fixed]

## Files Modified
| File | Agent | Change Type | Touches global |
|------|-------|-------------|---------------|
| js/FILE.js | Agent-N | add/edit/delete | YES/NO — VARNAME |

## Global Variable Freeze
Variables that must NOT change signature during this session:
- [list each: type + name + declared-in file]

## Cross-file dependencies added this session
- FILE_A reads GLOBAL exported by FILE_B (new dependency)

## Commit scope
Single commit / split by [criterion]. Reason: [rationale]

## Rollback checkpoint
Last known-good commit: [git short hash]
Rollback command: git checkout [hash] -- [files]

## Gate 2 items to verify post-session
[List which of the 10 smoke test items are most relevant to this change]
```

### Mandatory fields

All six sections are required. A session contract with any section left as placeholder
`[...]` is considered unsigned and agents should refuse to proceed to the commit step.

### File ownership rule

No two agents in the same session may write to the same file without explicit
"merge coordination" noted in the File Ownership table. If a merge is needed,
one agent writes the file and the other patches a diff that the orchestrator applies.

---

## Gate 4 — ANATOMY-First Workflow

### Inverted principle

ANATOMY documents (`docs/ANATOMY_V*.md`) are currently written as audit output: agents
inspect the codebase and record what they found. Under the ANATOMY-First workflow,
ANATOMY is written **before** a session begins and updated **before** any file is modified.
The pre-change snapshot becomes the source of truth that prevents unintended drift.

### Pre-change ANATOMY check (mandatory before any session touching >= 3 JS files)

Read `docs/ANATOMY_V*.md` (highest version number). Verify the following columns for
every file the session will touch:

| Column | What to verify | Fail condition |
|--------|---------------|----------------|
| Global Exported | Listed globals match current `var`/`const` declarations at module scope | Mismatch — file was changed without updating ANATOMY |
| Depends On | Every listed dependency is still in LOAD_ORDER before this file | Missing — load order changed |
| Key Functions | Named functions still exist at the stated line (spot-check 2-3) | Function renamed or removed |
| Worker Protocol | If file participates in Worker messaging, message types match current `postMessage` calls | Schema drift |
| Side Effects | Init calls, event listeners, and singleton instantiation still match | New side effect not recorded |

If any column fails, **update ANATOMY before writing code**, not after.

### Required ANATOMY columns (minimum viable)

```
| File | Globals Exported | Depends On (files) | Key Functions | Worker Protocol | Version |
```

The `Version` column records the last session that modified the file. Format: `YYYY-MM-DD`.

### When to update vs recreate

| Trigger | Action |
|---------|--------|
| 1-2 files modified, no new globals | Update affected rows in-place |
| New global exported | Add row entry AND update LOAD_ORDER table if order changed |
| New file added | Add full new row; update `docs/ANATOMY_V*.md` version number in header |
| New Worker message type | Update Worker Protocol column for both `appWorker.js` and `analysisWorker.js` |
| File deleted or renamed | Remove row; bump ANATOMY version (V4 -> V5) |
| > 5 files modified in one session | Recreate full ANATOMY as new version; archive old as `ANATOMY_V(N-1).md` |

### Version bump rule

The ANATOMY version number (`V4`, `V5`, ...) increments only when rows are added or
removed (structural change). Editing existing row content is not a version bump.

---

## Gate 5 — Session Start / End Protocol

### Session Start Checklist (run before any code changes)

```
[ ] S1. git pull — ensure branch is up-to-date
[ ] S2. git status — confirm clean working tree (no uncommitted edits from prior session)
[ ] S3. python scripts/verify.py --strict — must exit 0
[ ] S4. Read docs/ANATOMY_V*.md — identify highest version, read all rows for files in scope
[ ] S5. Write results/session_contract.md — fill all 6 sections (Gate 3)
[ ] S6. Confirm Gate 1 data files exist: run python scripts/verify.py --check pipeline
        (or manually confirm each row in the pipeline contract table is on disk)
[ ] S7. Note current sw.js CACHE_NAME version — you will need to bump it if JS files change
[ ] S8. Note current analysisWorker.js ?v=N — must stay in sync with index.html after changes
```

S1-S3 are non-negotiable. S4-S8 are required if the session modifies JS files. If
`verify.py --strict` fails at S3, the session does not start — fix the issue first.

### Session End Checklist (run before commit + push + deploy)

```
[ ] E1. python scripts/verify.py --strict — must exit 0
[ ] E2. python scripts/verify.py --check pipeline — zero FAILs (WARNs acceptable)
[ ] E3. Complete Gate 2 Browser Smoke Test — all 10 items checked
[ ] E4. If any JS file changed: bump CACHE_NAME in sw.js (cheesestock-vN -> vN+1)
[ ] E5. If any JS file changed: ensure ?v=N in index.html <script> tags and
        analysisWorker.js importScripts() are in sync (verify.py CHECK 5f catches this)
[ ] E6. If any file added/removed: update sw.js STATIC_ASSETS array
[ ] E7. Update ANATOMY — apply Gate 4 update-vs-recreate rule
[ ] E8. Stage specific files only (git add js/FILE.js) — never git add -A
[ ] E9. Commit message: ASCII-only, no Korean characters
[ ] E10. Deploy sequence: python scripts/stage_deploy.py, then wrangler pages deploy deploy/
         OR: npm run deploy (runs both steps)
```

E1 and E3 are non-negotiable. If E1 fails, do not commit. If the Browser Smoke Test
(E3) fails on any of items 1-3 or 6, do not deploy.

### Multi-agent session special rules

When 6+ agents ran in parallel:

- After collecting all agent outputs, run E1 before merging any file.
- Reconcile the File Ownership table in the session contract — confirm no two agents
  wrote to the same file without coordination.
- Run `git diff --stat HEAD` and compare the file list against the session contract's
  "Files Modified" table. Any file in the diff that is not in the contract is an
  unauthorized change — revert it and investigate.
- If any agent reports "could not complete due to dependency on another agent's output",
  that agent's changes must be reviewed manually before being included in the commit.

### Version sync quick-reference

After any JS file edit, these three values must agree:

| Location | How to find | Must match |
|----------|------------|------------|
| `index.html` `<script src="js/FILE.js?v=N">` | grep `?v=` in index.html | same N |
| `analysisWorker.js` `importScripts('FILE.js?v=N')` | grep `?v=` in analysisWorker.js | same N |
| `sw.js` `CACHE_NAME` | line 8 in sw.js | bumped if any JS changed |

The `verify.py` CHECK 5f catches the first two mismatches automatically.
CACHE_NAME is a manual step (E4 above).

---

## Summary table

| Gate | Type | Trigger | Tool |
|------|------|---------|------|
| 1 — CHECK 6 pipeline | Automated | Every verify.py run | `verify.py --check pipeline` |
| 2 — Browser smoke test | Manual, 10 items | After every multi-file change | Browser DevTools |
| 3 — Change contract | Manual document | Sessions with 6+ agents or 3+ JS files | `results/session_contract.md` |
| 4 — ANATOMY-first | Read-then-write workflow | Sessions touching 3+ JS files | `docs/ANATOMY_V*.md` |
| 5 — Session start/end | Checklists | Every session | `verify.py`, git, browser |
