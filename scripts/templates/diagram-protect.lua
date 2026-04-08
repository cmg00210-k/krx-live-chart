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

-- Generate LaTeX commands to switch dynamic color aliases
local function stage_color_switch(stage_num)
  local pfx = STAGE_PREFIXES[stage_num]
  if not pfx then return "" end
  return "\\colorlet{curStageMarker}{" .. pfx .. "Marker}\n"
    .. "\\colorlet{curStageCodeBg}{" .. pfx .. "CodeBg}\n"
    .. "\\colorlet{curStageQuoteBg}{" .. pfx .. "QuoteBg}\n"
    .. "\\colorlet{curStageDark}{" .. pfx .. "}\n"
    .. "\\arrayrulecolor{" .. pfx .. "Marker!30}\n"
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

    -- "부록" appendix titles: clearpage but no navigator
    if text:match("^부록") then
      local heading_latex = pandoc.write(pandoc.Pandoc({
        pandoc.Header(1, el.content, el.attr)
      }), "latex")
      return pandoc.RawBlock("latex", "\\clearpage\n" .. heading_latex)
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
-- 2. CODE BLOCKS: aggressive compact sizing
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

  -- Page-split strategy
  local pre = ""
  local post = ""
  if lines <= 15 then
    pre = "\\begin{samepage}\n"
    post = "\\end{samepage}\n"
  elseif lines <= 25 then
    pre = string.format("\\needspace{%d\\baselineskip}\n", math.ceil(lines * 0.5))
  end
  -- 25+ lines: no constraint, free flow

  local latex = pre
    .. "\\vspace{1pt}\n"
    .. "\\begin{Verbatim}[fontsize=" .. fontcmd .. ","
    .. "xleftmargin=4pt,xrightmargin=4pt,"
    -- !70 for visible left bar on the code-block background (#F4F4F6 vs stage marker tint)
    .. "frame=leftline,framerule=1.5pt,rulecolor=\\color{curStageMarker!70},"
    .. "formatcom=\\color{bodytext}]\n"
    .. text .. "\n"
    .. "\\end{Verbatim}\n"
    .. "\\vspace{1pt}\n"
    .. post

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
-- 5. TABLES: prevent font overlap via font scaling
-- ============================================================
function Table(el)
  local ncols = #el.colspecs

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

  -- Let pandoc produce longtable with its own p{} column widths.
  -- Wrap in a TeX group (not \begingroup..\endgroup as a token sequence) so that
  -- the font command is properly scoped and does not bleed into surrounding text.
  local latex = pandoc.write(pandoc.Pandoc({el}), "latex")

  -- Use brace-group: { fontcmd \sloppy latex }
  -- This is safer than \begingroup..\endgroup when fontcmd contains \selectfont
  -- which has side effects that \begingroup does not fully contain.
  local result = "{" .. fontcmd .. "\\sloppy\n"
    .. latex
    .. "}\n"

  return pandoc.RawBlock("latex", result)
end
