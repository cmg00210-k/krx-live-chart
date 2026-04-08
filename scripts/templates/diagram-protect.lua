-- diagram-protect.lua
-- Pandoc Lua filter for CheeseStock ANATOMY V7 PDF
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

-- Stage short labels for running header
local STAGE_LABELS = {
  ["1"] = "Stage 1: 문제 정의",
  ["2"] = "Stage 2: 데이터 기반",
  ["3"] = "Stage 3: 분석 엔진",
  ["4"] = "Stage 4: 검증·통제",
  ["5"] = "Stage 5: 로드맵",
}

-- Generate LaTeX commands to switch dynamic color aliases
local function stage_color_switch(stage_num)
  local pfx = STAGE_PREFIXES[stage_num]
  if not pfx then return "" end
  local label = STAGE_LABELS[stage_num] or ("Stage " .. stage_num)
  return "\\colorlet{curStageMarker}{" .. pfx .. "Marker}\n"
    .. "\\colorlet{curStageCodeBg}{" .. pfx .. "CodeBg}\n"
    .. "\\colorlet{curStageQuoteBg}{" .. pfx .. "QuoteBg}\n"
    .. "\\colorlet{curStageDark}{" .. pfx .. "}\n"
    .. "\\colorlet{shadecolor}{" .. pfx .. "CodeBg}\n"
    .. "\\arrayrulecolor{" .. pfx .. "Marker!55}\n"
    .. "\\renewcommand{\\currentstage}{" .. label .. "}\n"
end

-- ============================================================
-- 1. HEADERS: inject Stage navigator + color accent on Stage H1
-- ============================================================
function Header(el)
  if el.level == 1 then
    local text = pandoc.utils.stringify(el)
    local stage_num = text:match("^Stage (%d)")
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

    -- "CheeseStock" title: inline, no page break (flows after TOC)
    if text:match("^CheeseStock") then
      return pandoc.RawBlock("latex",
        "{\\Large\\bfseries\\sffamily\\color{dark} " .. text .. "}\\par\\vspace{2pt}\n")
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

  -- H2 "ANATOMY V7": inline subtitle, no page break
  if el.level == 2 then
    local text = pandoc.utils.stringify(el)
    if text:match("^ANATOMY V7") then
      return pandoc.RawBlock("latex",
        "{\\large\\bfseries\\sffamily\\color{navy} " .. text .. "}\\par\\vspace{4pt}\n")
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

  -- Stage-colored background via mdframed + left accent bar
  local latex = pre
    .. "\\vspace{1pt}\n"
    .. "\\begin{mdframed}["
    .. "backgroundcolor=curStageCodeBg,"
    .. "linewidth=1.5pt,linecolor=curStageMarker!70,"
    .. "leftline=true,topline=false,rightline=false,bottomline=false,"
    .. "innerleftmargin=6pt,innerrightmargin=4pt,"
    .. "innertopmargin=2pt,innerbottommargin=2pt,"
    .. "skipabove=1pt,skipbelow=1pt"
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

  return el
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
    -- 3-4 col: give CJK text room; line-height 11.5pt matches arraystretch=1.35 * 8.5pt
    fontcmd = "\\fontsize{8.5pt}{11.5pt}\\selectfont"
  else
    -- 1-2 col: body text size, no shrinkage
    fontcmd = "\\fontsize{9.5pt}{13pt}\\selectfont"
  end

  -- Make header cells bold at AST level (works with both p{} and l-type columns)
  if el.head and el.head.rows then
    for _, row in ipairs(el.head.rows) do
      for _, cell in ipairs(row.cells) do
        for _, block in ipairs(cell.contents) do
          if block.t == "Para" or block.t == "Plain" then
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

  -- Header row: stage-colored background + bold/larger font
  -- Insert \rowcolor after \toprule, and wrap header cells in bold font group
  latex = latex:gsub("(\\toprule[^\n]*\n)", "%1\\rowcolor{curStageQuoteBg}\n")
  -- Prevent header row duplication on continuation pages:
  -- Full header (with bold/rowcolor) only on first page via \endfirsthead,
  -- continuation pages get just a thin \midrule via \endhead
  latex = latex:gsub(
    "(\\midrule[^\n]*\n)(\\endhead)",
    "%1\\endfirsthead\n\\midrule\\noalign{}\n\\endhead"
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

  -- Use brace-group: { fontcmd \sloppy latex }
  local result = pre .. "{" .. fontcmd .. "\\sloppy\n"
    .. latex
    .. "}\n"

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
