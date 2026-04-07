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

-- ============================================================
-- 1. HEADERS: inject Stage navigator + color accent on Stage H1
-- ============================================================
function Header(el)
  if el.level == 1 then
    local text = pandoc.utils.stringify(el)
    local stage_num = text:match("^Stage (%d)")
    if stage_num and STAGE_COLORS[stage_num] then
      local color = STAGE_COLORS[stage_num]
      -- clearpage + navigator + heading (no decorative rule)
      local pre = "\\clearpage\n"
        .. "\\stagenavigator{" .. stage_num .. "}\n"
        .. "\\vspace{6pt}\n"
      local heading_latex = pandoc.write(pandoc.Pandoc({
        pandoc.Header(1, el.content, el.attr)
      }), "latex")
      return pandoc.RawBlock("latex", pre .. heading_latex)
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
    .. "frame=leftline,framerule=1.5pt,rulecolor=\\color{gold!50},"
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
-- 4. TABLES: scale wide tables to prevent font overlap
-- ============================================================
function Table(el)
  local ncols = #el.colspecs
  if ncols < 5 then
    return el  -- narrow tables: pandoc default is fine
  end

  -- Convert table to LaTeX via pandoc
  local latex = pandoc.write(pandoc.Pandoc({el}), "latex")

  -- Convert longtable -> tabular for adjustbox compatibility
  latex = latex:gsub("\\begin{longtable}%[%]", "\\begin{tabular}")
  latex = latex:gsub("\\end{longtable}", "\\end{tabular}")
  latex = latex:gsub("\\endhead%s*\n?", "")
  latex = latex:gsub("\\endfoot%s*\n?", "")
  latex = latex:gsub("\\endlastfoot%s*\n?", "")
  latex = latex:gsub("\\endfirsthead%s*\n?", "")

  -- Font size by column count
  local fontcmd
  if ncols >= 7 then
    fontcmd = "\\scriptsize"
  elseif ncols >= 6 then
    fontcmd = "\\fontsize{7.5pt}{9.5pt}\\selectfont"
  else
    fontcmd = "\\footnotesize"
  end

  -- Wrap in adjustbox as safety net
  local result = "\\begingroup" .. fontcmd .. "\\sloppy\n"
    .. "\\noindent\\begin{adjustbox}{max width=\\linewidth}\n"
    .. latex
    .. "\\end{adjustbox}\n"
    .. "\\endgroup\n"

  return pandoc.RawBlock("latex", result)
end
