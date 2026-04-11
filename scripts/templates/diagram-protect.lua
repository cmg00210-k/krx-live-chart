-- diagram-protect.lua
-- Pandoc Lua filter for CheeseStock ANATOMY V7/V8 PDF
-- Stage navigation, code blocks, blockquote classification

-- Stage color mapping for LaTeX
local STAGE_COLORS = {
  ["1"] = "stageOneMarker",
  ["2"] = "stageTwoMarker",
  ["3"] = "stageThreeMarker",
  ["4"] = "stageFourMarker",
  ["5"] = "stageFiveMarker",
}

-- Stage color prefixes (for CodeBg / QuoteBg / Dark aliases)
local STAGE_PREFIXES = {
  ["1"] = "stageOne",
  ["2"] = "stageTwo",
  ["3"] = "stageThree",
  ["4"] = "stageFour",
  ["5"] = "stageFive",
}

-- Stage short labels for running header (V7 English default)
local STAGE_LABELS = {
  ["1"] = "Stage 1: 문제 정의",
  ["2"] = "Stage 2: 데이터 기반",
  ["3"] = "Stage 3: 분석 엔진",
  ["4"] = "Stage 4: 검증·통제",
  ["5"] = "Stage 5: 로드맵",
}

-- V8 Korean labels: dynamically extracted from 제N장 headings (B안).
-- No hardcoded table needed — the heading text itself becomes the running header label.
-- Populated at runtime by Header() when 제N장 pattern is detected.

-- Generate LaTeX commands to switch dynamic color aliases
local function stage_color_switch(stage_num)
  local pfx = STAGE_PREFIXES[stage_num]
  if not pfx then return "" end
  local label = STAGE_LABELS[stage_num] or ("Stage " .. stage_num)
  -- Stage 2 (Academic): wider line spacing for formula-dense content (1 per 14 lines)
  -- Also tighten display math spacing for Stage 2 to reduce bold-label gaps
  local stretch = (stage_num == "2")
    and "\\setstretch{1.40}\n\\abovedisplayskip=5pt plus 2pt minus 2pt\n\\belowdisplayskip=5pt plus 2pt minus 2pt\n\\abovedisplayshortskip=3pt plus 1pt minus 1pt\n\\belowdisplayshortskip=3pt plus 1pt minus 1pt\n"
    or "\\setstretch{1.35}\n"
  return "\\colorlet{curStageMarker}{" .. pfx .. "Marker}\n"
    .. "\\colorlet{curStageCodeBg}{" .. pfx .. "CodeBg}\n"
    .. "\\colorlet{curStageQuoteBg}{" .. pfx .. "QuoteBg}\n"
    .. "\\colorlet{curStageDark}{" .. pfx .. "}\n"
    .. "\\colorlet{shadecolor}{" .. pfx .. "CodeBg}\n"
    .. "\\arrayrulecolor{" .. pfx .. "Marker!55}\n"
    .. "\\renewcommand{\\currentstage}{" .. label .. "}\n"
    .. stretch
end

-- ============================================================
-- 1. HEADERS: inject Stage navigator + color accent on Stage H1
-- ============================================================
function Header(el)
  if el.level == 1 then
    local text = pandoc.utils.stringify(el)
    local stage_num_en = text:match("^Stage (%d)")
    local stage_num_ko = text:match("^제(%d)장")
    local stage_num = stage_num_en or stage_num_ko
    -- B안: extract running header label directly from heading text
    -- e.g. "제2장: 학술적 기반" → STAGE_LABELS["2"] = "제2장: 학술적 기반"
    if stage_num_ko then
      -- Strip trailing em-dash clauses for concise header (keep "제N장: ..." part)
      local short = text:match("^(제%d장[：:].-)%s+[—%-]") or text
      STAGE_LABELS[stage_num_ko] = short
    end
    if stage_num and STAGE_COLORS[stage_num] then
      local color = STAGE_COLORS[stage_num]
      -- clearpage + color switch + navigator + heading
      local pre = "\\clearpage\n"
        .. stage_color_switch(stage_num)
        .. "\\stagenavigator{" .. stage_num .. "}\n"
        .. "\\vspace{6pt}\n"
      local heading_latex = pandoc.write(pandoc.Pandoc({
        pandoc.Header(1, el.content, el.attr)
      }), "latex")
      return pandoc.RawBlock("latex", pre .. heading_latex)
    end

    -- "CheeseStock" title: Stage overview flow.
    -- \clearpage ensures the overview starts on a fresh page after TOC,
    -- preventing the title from being orphaned at the bottom of the TOC page.
    -- The following Stage H1 (제1장) also emits \clearpage, but that only
    -- separates the overview from Chapter 1 — no blank page results.
    if text:match("^CheeseStock") then
      return pandoc.RawBlock("latex",
        "\\clearpage\n\\stageoverviewflow\n")
    end

    -- "부록" appendix titles: muted banner with subtle rule
    if text:match("^부록") then
      return pandoc.RawBlock("latex",
        "\\clearpage\n"
        .. "\\vspace{8pt}\n"
        .. "\\noindent\\colorbox{tableodd}{\\parbox{\\dimexpr\\linewidth-2\\fboxsep\\relax}"
        .. "{\\centering\\vspace{6pt}\n"
        .. "{\\Large\\bfseries\\sffamily\\color{muted} " .. text .. "}\\vspace{6pt}\n"
        .. "}}\\par\n"
        .. "\\vspace{4pt}\\noindent{\\color{muted!40}\\rule{\\linewidth}{0.4pt}}\\vspace{8pt}\n")
    end
  end

  -- H2 handling: suppress redundant headings, add \clearpage for major discipline transitions
  if el.level == 2 then
    local text = pandoc.utils.stringify(el)

    -- Suppress redundant ANATOMY version headings
    if text:match("^ANATOMY V[78]") then
      return pandoc.RawBlock("latex", "")
    end

    -- Major discipline transitions in Chapter 2 (제2장 학술적 기반) get \clearpage.
    -- These sections (2.3~2.6) each introduce a distinct academic discipline and are
    -- long enough that a forced page break improves reader orientation.
    if text:match("^2%.[3456]") then
      local heading_latex = pandoc.write(pandoc.Pandoc({
        pandoc.Header(2, el.content, el.attr)
      }), "latex")
      return pandoc.RawBlock("latex", "\\clearpage\n" .. heading_latex)
    end
  end

  return el
end

-- ============================================================
-- 2. CODE BLOCKS: Stage-colored mdframed + adaptive font sizing
-- ============================================================
function CodeBlock(el)
  local text = el.text or ""
  local lines = 0
  for _ in text:gmatch("\n") do lines = lines + 1 end
  lines = lines + 1

  local max_width = 0
  for line in text:gmatch("[^\n]*") do
    if #line > max_width then max_width = #line end
  end

  -- Font sizing: fit content, not waste space
  local fontcmd
  if max_width > 70 then
    fontcmd = "\\fontsize{6.5pt}{8pt}\\selectfont"
  elseif max_width > 55 or lines > 35 then
    fontcmd = "\\fontsize{7pt}{8.5pt}\\selectfont"
  elseif lines > 20 then
    fontcmd = "\\fontsize{7.5pt}{9pt}\\selectfont"
  else
    fontcmd = "\\fontsize{8pt}{10pt}\\selectfont"
  end

  -- Page-split: needspace for short/medium, free flow for long
  local pre = ""
  if lines <= 15 then
    pre = string.format("\\needspace{%d\\baselineskip}\n", lines)
  elseif lines <= 25 then
    pre = string.format("\\needspace{%d\\baselineskip}\n", math.ceil(lines * 0.5))
  end

  -- Language-based visual differentiation
  local lang = el.classes[1] or ""
  local bar_color
  if lang == "python" or lang == "javascript" or lang == "js" then
    bar_color = "curStageMarker!90"   -- code: strong Stage bar
  elseif lang == "json" or lang == "csv" then
    bar_color = "muted!60"            -- data: neutral gray bar
  elseif lang == "" or lang == "text" then
    bar_color = "curStageMarker!40"   -- pseudocode/diagram: subtle bar
  else
    bar_color = "curStageMarker!70"   -- default
  end

  -- Language label (small tag above code block)
  local lang_label = ""
  if lang ~= "" then
    lang_label = "\\noindent{\\fontsize{6pt}{7pt}\\selectfont"
      .. "\\sffamily\\color{muted}\\texttt{" .. lang:upper() .. "}}\\vspace{-2pt}\n"
  end

  -- Stage-colored background via mdframed + left accent bar
  local latex = pre
    .. "\\vspace{1pt}\n"
    .. lang_label
    .. "\\begin{mdframed}["
    .. "backgroundcolor=curStageCodeBg,"
    .. "linewidth=1.5pt,linecolor=" .. bar_color .. ","
    .. "leftline=true,topline=false,rightline=false,bottomline=false,"
    .. "innerleftmargin=6pt,innerrightmargin=4pt,"
    .. "innertopmargin=2pt,innerbottommargin=2pt,"
    .. "skipabove=6pt,skipbelow=6pt"
    .. "]\n"
    .. "\\begin{Verbatim}[fontsize=" .. fontcmd .. ","
    .. "formatcom=\\color{bodytext}]\n"
    .. text .. "\n"
    .. "\\end{Verbatim}\n"
    .. "\\end{mdframed}\n"
    .. "\\vspace{1pt}\n"

  return pandoc.RawBlock("latex", latex)
end

-- ============================================================
-- 3. BLOCKQUOTES: keypoint / stage meta / default
-- ============================================================
function BlockQuote(el)
  local first_block = el.content[1]
  if first_block and first_block.t == "Para" then
    local text = pandoc.utils.stringify(first_block)

    -- Keypoint box
    if text:match("%[핵심 요[점약]%]") then
      local body = pandoc.write(pandoc.Pandoc(el.content), "latex")
      body = body:gsub("%[핵심 요점%]", ""):gsub("%[핵심 요약%]", "")
      return pandoc.RawBlock("latex",
        "\\begin{keypoint}{핵심 요약}\n" .. body .. "\n\\end{keypoint}\n")
    end

    -- Stage meta
    if text:match("^%*%*Stage") or text:match("^Stage %d") then
      local body = pandoc.write(pandoc.Pandoc(el.content), "latex")
      return pandoc.RawBlock("latex",
        "\\begin{stagemeta}\n" .. body .. "\n\\end{stagemeta}\n")
    end
  end
  return el
end

-- ============================================================
-- 3b. RAW BLOCKS: convert <!-- newpage --> HTML comments to \clearpage
-- ============================================================
-- Markdown authors can insert <!-- newpage --> before any H3 or paragraph
-- to force a manual page break (e.g. before 이징 모형, 멱법칙, 극단값 이론).
function RawBlock(el)
  if el.format == "html" then
    local trimmed = el.text:match("^%s*(.-)%s*$")
    if trimmed == "<!-- newpage -->" then
      return pandoc.RawBlock("latex", "\\clearpage\n")
    end
  end
  return el
end

-- ============================================================
-- 4. HORIZONTAL RULES: Stage-colored instead of black
-- ============================================================
function HorizontalRule(el)
  return pandoc.RawBlock("latex",
    "\\vspace{2pt}\\noindent{\\color{curStageMarker!25}\\rule{\\linewidth}{0.4pt}}\\vspace{2pt}\n")
end

-- ============================================================
-- 5. PARAGRAPHS: source citations as scriptsize italic
-- ============================================================
function Para(el)
  local text = pandoc.utils.stringify(el)

  -- Standalone "출처:" lines -> sourcecite environment
  if text:match("^출처:") or text:match("^출처：") then
    local body = pandoc.write(pandoc.Pandoc({el}), "latex")
    return pandoc.RawBlock("latex",
      "\\begin{sourcecite}\n" .. body .. "\n\\end{sourcecite}\n")
  end

  -- Pure bold paragraphs (concept labels): tighten vertical spacing
  -- Detects paragraphs that consist entirely of a single Strong element
  -- (e.g., **물리학-금융학 대응 관계**) and reduces parskip around them
  if #el.content == 1 and el.content[1].t == "Strong" then
    local body = pandoc.write(pandoc.Pandoc({el}), "latex")
    return pandoc.RawBlock("latex",
      "\\vspace{2pt}\\noindent" .. body
      .. "\\vspace{-\\parskip}\\vspace{1pt}\n")
  end

  return el
end

-- ============================================================
-- 5b. INLINE CODE: auto line-break for long \texttt{} spans
-- ============================================================
-- Overfull \hbox fix: insert \allowbreak at natural break points
-- (slash, underscore, dot, comma, open-paren) so LaTeX can wrap
-- long file paths, function names, and identifiers.
function Code(el)
  local text = el.text or ""
  -- Skip short code (<=20 chars) — no break needed
  if #text <= 20 then return el end

  -- Escape LaTeX specials in monospace text
  local escaped = text
    :gsub("\\", "\\textbackslash{}")
    :gsub("{", "\\{")
    :gsub("}", "\\}")
    :gsub("%%", "\\%%")
    :gsub("%$", "\\$")
    :gsub("&", "\\&")
    :gsub("#", "\\#")
    :gsub("_", "\\_")
    :gsub("~", "\\textasciitilde{}")
    :gsub("%^", "\\textasciicircum{}")

  -- Insert \allowbreak ONLY at semantic break points (dot and underscore).
  -- CamelCase breaks are intentionally excluded: splitting "IndicatorCache"
  -- at "Indicator|Cache" is less readable than splitting at a dot or underscore.
  -- Path separators and parens keep their breaks for file path wrapping.
  escaped = escaped
    :gsub("/",            "/\\allowbreak{}")      -- path separators
    :gsub("\\_",          "\\_\\allowbreak{}")     -- underscores (already escaped)
    :gsub("%.",           ".\\allowbreak{}")       -- dots (methods, extensions)

  -- Identifiers >14 chars: use smaller font to prevent overflow in
  -- narrow table cells (14 = ~threshold where 8.5pt Consolas exceeds
  -- a 3-column table cell width at A4/22mm margins)
  local size_prefix = ""
  if #text > 14 then
    size_prefix = "\\fontsize{6.5pt}{8pt}\\selectfont"
  end

  return pandoc.RawInline("latex",
    "{" .. size_prefix .. "\\texttt{" .. escaped .. "}}")
end

-- ============================================================
-- 6. TABLES: font scaling + header rowcolor + short-table needspace
-- ============================================================
-- Count data rows in a pandoc Table element
local function count_table_rows(el)
  local nrows = 0
  for _, body in ipairs(el.bodies) do
    nrows = nrows + #body.body
  end
  return nrows
end

function Table(el)
  local ncols = #el.colspecs
  local nrows = count_table_rows(el)

  -- Font size by column count.
  -- All tables go through this filter so font sizing is centralized here
  -- (AtBeginEnvironment hooks in the template only enforce \sloppy, not font size).
  local fontcmd
  if ncols >= 9 then
    -- 9+ cols: very dense, minimum legible size
    fontcmd = "\\fontsize{6pt}{7.5pt}\\selectfont"
  elseif ncols >= 7 then
    fontcmd = "\\fontsize{6.5pt}{8.5pt}\\selectfont"
  elseif ncols >= 5 then
    fontcmd = "\\fontsize{7.5pt}{9.5pt}\\selectfont"
  elseif ncols >= 3 then
    -- 3-4 col: 9pt NRF standard, Malgun Gothic legibility threshold
    fontcmd = "\\fontsize{9pt}{12pt}\\selectfont"
  else
    -- 1-2 col: body text size, no shrinkage
    fontcmd = "\\fontsize{9.5pt}{13pt}\\selectfont"
  end

  -- Auto right-align numeric columns (CFA/Bloomberg standard)
  for c = 1, ncols do
    local num_count, total = 0, 0
    for _, body in ipairs(el.bodies) do
      for _, row in ipairs(body.body) do
        if row.cells[c] then
          total = total + 1
          local text = pandoc.utils.stringify(row.cells[c].contents)
          -- Pure numeric only: "65", "3.14", "50%", "-2.5", "1,234"
          -- Excludes Korean suffixes like "1등급", "47개 문서"
          if text:match("^[%-]?%d+[%.%%]?%d*$")
             or text:match("^[%-]?%d+,%d+$") then
            num_count = num_count + 1
          end
        end
      end
    end
    if total > 0 and num_count / total >= 0.5 then
      el.colspecs[c] = {pandoc.AlignRight, el.colspecs[c][2]}
    end
  end

  -- Header font: +1pt larger than data rows
  local hdr_fontcmd
  if ncols >= 9 then hdr_fontcmd = "\\fontsize{7pt}{9pt}\\selectfont"
  elseif ncols >= 7 then hdr_fontcmd = "\\fontsize{7.5pt}{9.5pt}\\selectfont"
  elseif ncols >= 5 then hdr_fontcmd = "\\fontsize{8.5pt}{11pt}\\selectfont"
  elseif ncols >= 3 then hdr_fontcmd = "\\fontsize{10pt}{13pt}\\selectfont"
  else hdr_fontcmd = "\\fontsize{10.5pt}{14pt}\\selectfont"
  end

  -- Apply font/color INSIDE each header cell at AST level (fixes minipage scope issue).
  -- Row-level declarations don't persist across pandoc's minipage cell boundaries.
  if el.head and el.head.rows then
    for _, row in ipairs(el.head.rows) do
      for _, cell in ipairs(row.cells) do
        for _, block in ipairs(cell.contents) do
          if block.t == "Para" or block.t == "Plain" then
            table.insert(block.content, 1,
              pandoc.RawInline("latex", hdr_fontcmd .. "\\color{curStageDark}"))
            block.content = {pandoc.Strong(block.content)}
          end
        end
      end
    end
  end

  -- Let pandoc produce longtable with its own p{} column widths.
  local latex = pandoc.write(pandoc.Pandoc({el}), "latex")

  -- Left-align all tables (pandoc default [] = centered)
  latex = latex:gsub("\\begin{longtable}%[%]", "\\begin{longtable}[l]")

  -- Expand bare-column tables to full textwidth (fixes right margin waste)
  -- Bare columns: {llll}, {lrl}, {rll} etc. → equal-width p{} columns
  latex = latex:gsub(
    "\\begin{longtable}%[l%]{@{}([lrc]+)@{}}",
    function(cols)
      local n = #cols
      local width = string.format("%.4f", (1.0 - n * 0.01) / n)
      local new_cols = ""
      for i = 1, n do
        local a = cols:sub(i, i)
        local cmd = (a == "r") and "\\raggedleft\\arraybackslash"
                 or (a == "c") and "\\centering\\arraybackslash"
                 or "\\raggedright\\arraybackslash"
        new_cols = new_cols .. ">{" .. cmd .. "}p{(\\linewidth - "
          .. (2 * n) .. "\\tabcolsep) * \\real{" .. width .. "}}"
      end
      return "\\begin{longtable}[l]{@{}" .. new_cols .. "@{}}"
    end
  )

  -- Rebalance narrow columns: any column < MIN_COL_PCT gets expanded,
  -- deficit taken proportionally from wider columns.
  -- Fixes pandoc's tendency to give ID/code columns <10% width.
  local MIN_COL_PCT = 0.14  -- 14% minimum (~24mm at A4/22mm margins)
  latex = latex:gsub(
    "(\\begin{longtable}%[l%]{@{})(.-)(@{}})",
    function(pre, colspec, post)
      -- Extract all \real{X.XXXX} values
      local widths = {}
      for w in colspec:gmatch("\\real{([%d%.]+)}") do
        table.insert(widths, tonumber(w))
      end
      if #widths < 3 then return pre .. colspec .. post end

      -- Check if any column is below minimum
      local needs_fix = false
      for _, w in ipairs(widths) do
        if w < MIN_COL_PCT then needs_fix = true; break end
      end
      if not needs_fix then return pre .. colspec .. post end

      -- Calculate deficit and redistribute
      local deficit = 0
      local donor_total = 0
      for i, w in ipairs(widths) do
        if w < MIN_COL_PCT then
          deficit = deficit + (MIN_COL_PCT - w)
          widths[i] = MIN_COL_PCT
        else
          donor_total = donor_total + w
        end
      end
      -- Shrink donors proportionally
      if donor_total > 0 then
        for i, w in ipairs(widths) do
          if w > MIN_COL_PCT then
            widths[i] = w - (w / donor_total) * deficit
          end
        end
      end

      -- Rebuild colspec with new widths
      local idx = 0
      local new_colspec = colspec:gsub("\\real{[%d%.]+}", function()
        idx = idx + 1
        return "\\real{" .. string.format("%.4f", widths[idx]) .. "}"
      end)
      return pre .. new_colspec .. post
    end
  )

  -- Post-process \texttt{} inside table cells: add \allowbreak at _ and camelCase
  -- Pandoc generates \texttt{} directly for backtick code in table cells,
  -- bypassing the Lua Code() handler. This regex catches those.
  latex = latex:gsub("\\texttt{([^}]+)}", function(inner)
    if #inner <= 14 then return "\\texttt{" .. inner .. "}" end
    -- Add \allowbreak at dot and underscore boundaries only (no CamelCase split).
    -- CamelCase splitting (e.g. "Indicator|Cache") creates unnatural breaks;
    -- dot/underscore boundaries are always semantic split points.
    local fixed = inner
      :gsub("\\_", "\\_\\allowbreak{}")
      :gsub("%.", ".\\allowbreak{}")
    return "{\\fontsize{6.5pt}{8pt}\\selectfont\\texttt{" .. fixed .. "}}"
  end)

  -- Header row: stage-colored background only (font/color applied per-cell at AST level)
  latex = latex:gsub("(\\toprule[^\n]*\n)", "%1\\rowcolor{curStageQuoteBg}\n")
  -- Prevent header row duplication on continuation pages:
  -- Full header (with bold/rowcolor) only on first page via \endfirsthead,
  -- continuation pages get just a thin \midrule via \endhead.
  -- Non-greedy: only replace the FIRST occurrence to avoid multi-midrule tables.
  local head_done = false
  latex = latex:gsub(
    "(\\midrule[^\n]*\n)(\\endhead)",
    function(a, b)
      if head_done then return a .. b end
      head_done = true
      return a .. "\\endfirsthead\n\\midrule\\noalign{}\n\\endhead"
    end
  )

  -- Short tables (<=12 rows): keep on same page via needspace estimate
  -- Row height ~16pt (arraystretch 1.35 * ~12pt line), +30pt for rules/header
  local pre = ""
  if nrows <= 12 then
    local est_height = nrows * 16 + 30
    pre = string.format("\\needspace{%dpt}\n", est_height)
  elseif nrows <= 20 then
    -- Medium tables: request at least half the table stays together
    local est_half = math.ceil(nrows * 0.5) * 16 + 30
    pre = string.format("\\needspace{%dpt}\n", est_half)
  end

  -- Dynamic tabcolsep: wider padding for few-column tables, tighter for dense ones
  local tabcolsep
  if ncols >= 7 then
    tabcolsep = "2.5pt"
  elseif ncols >= 5 then
    tabcolsep = "3pt"
  elseif ncols >= 3 then
    tabcolsep = "6pt"
  else
    tabcolsep = "8pt"
  end

  -- Use brace-group: vspace + dynamic tabcolsep + row striping + fontcmd
  local result = pre .. "\\vspace{4pt}\n"
    .. "{\\setlength{\\tabcolsep}{" .. tabcolsep .. "}\n"
    .. "\\rowcolors{2}{tableodd}{white}\n"
    .. fontcmd .. "\\sloppy\n"
    .. latex
    .. "\\rowcolors{0}{}{}\n"
    .. "}\\vspace{4pt}\n"

  return pandoc.RawBlock("latex", result)
end

-- ============================================================
-- 7. PANDOC-LEVEL: inject \nopagebreak after headings
-- ============================================================
-- Element filters run first (Header, Table, etc.), then Pandoc() runs.
-- Standard H2/H3 headers that Header() returned unchanged are still Header
-- elements here, so we can detect them and inject page-break suppression.
function Pandoc(doc)
  local blocks = doc.blocks
  local result = {}

  for i, block in ipairs(blocks) do
    table.insert(result, block)

    -- After H2/H3/H4 headers: suppress page break to keep heading with content
    if block.t == "Header" and block.level >= 2 then
      table.insert(result, pandoc.RawBlock("latex", "\\nopagebreak[4]\n"))
    end
  end

  doc.blocks = result
  return doc
end
