# CheeseStock ANATOMY V8 — PDF Design Specification

**Version:** 1.0 | **Date:** 2026-04-08 | **Status:** LOCKED

> This specification locks ALL design decisions BEFORE content writing begins.
> Every value is concrete — no interpretation needed by downstream agents.

---

## 1. Page Layout

| Property | Value |
|----------|-------|
| Paper Size | A4 (210mm x 297mm), Portrait |
| Margin Top | 20mm |
| Margin Bottom | 20mm |
| Margin Left | 22mm |
| Margin Right | 22mm |
| Effective Column Width | 166mm |
| Header Rule | 0.3pt, stage color at 55% opacity |
| Footer | Page number, bottom center |

---

## 2. Typography Hierarchy

### Font Selection

| Type | Font | Fallback | Usage |
|------|------|----------|-------|
| Body/Headers (Latin) | Calibri | Georgia | All prose and headings |
| Monospace | Consolas | Courier New | Code, formulas, variables |
| Korean (CJK) | Malgun Gothic | NanumGothic | Korean text, mixed content |

### Heading Hierarchy

| Level | Size | Weight | Line-Height | Color | Spacing Before/After |
|-------|------|--------|-------------|-------|---------------------|
| H1 (Stage) | 14pt | 700 | 18pt | Stage-specific | 0pt / 6pt |
| H2 (Section) | 12pt | 700 | 15pt | Stage-specific | 10pt / 3pt |
| H3 (Subsec) | 10.5pt | 700 | 13pt | #555555 | 6pt / 4pt |
| H4 (Label) | 10pt | 700 | — | #555555 | 4pt / 4pt (run-in) |
| Body | 9.5pt | 400 | 13pt | #1A1A1A | 3pt / 3pt |
| Block Code | 8.5pt | 400 | 11pt | #1A1A1A | 4pt / 4pt |
| Inline Code | 9pt | 400 | — | #1A1A1A | — |
| Caption | 8pt | 700/400 | — | #555555 | 4pt above / 2pt below |
| Footnote | 7.5pt | 400 italic | 9.5pt | #555555 | 3pt / 2pt |

---

## 3. Color Palette

### Stage Colors (H1/H2, borders, accents)

| Stage | Name | Hex | Usage |
|-------|------|-----|-------|
| 1 | Slate Blue | #2C3E5C | Data & API |
| 2 | Amber Dark | #3D3000 | Academic Foundations |
| 3 | Emerald Teal | #1A3D35 | Technical Analysis |
| 4 | Deep Violet | #2D1B4E | Chart Visualization |
| 5 | Warm Espresso | #3A2010 | Website Delivery |

### Code Block Backgrounds (per Stage)

| Stage | Background Hex |
|-------|---------------|
| 1 | #F2F5FA |
| 2 | #FDFAF0 |
| 3 | #F0FAF7 |
| 4 | #F5F0FA |
| 5 | #FAF5EF |

### Utility Colors

| Element | Hex | Name |
|---------|-----|------|
| Body Text | #1A1A1A | Dark Charcoal |
| Muted Text | #555555 | Medium Gray |
| Hyperlinks | #2C3E6B | Navy |
| Table Odd Row | #F7F7F7 | Very Light Gray |
| Table Even Row | #FFFFFF | White |

---

## 4. Table Style

| Property | Value |
|----------|-------|
| Style | booktabs (horizontal rules only) |
| Header BG | Stage color (100% opaque) |
| Header Text | #FFFFFF, 9pt bold, centered |
| Body Font | 9pt regular |
| Alternating | White / #F7F7F7 |
| Border Color | Stage color at 55% opacity |
| Border Width | 0.3pt (top/bottom), 0.2pt (mid) |
| Row Height | arraystretch = 1.35 |
| Column Spacing | tabcolsep = 3.5pt |
| Caption | 8pt bold, 4pt above table |
| Multi-page | longtable package |

---

## 5. Diagram & Figure Style

| Property | Value |
|----------|-------|
| Format | ASCII art in code blocks |
| Font | Consolas 8.5pt |
| Background | Stage-specific code background |
| Box Drawing | Unicode (U+2500 series) |
| Arrow Style | -> (horizontal), v (vertical) |
| Numbering | "Figure [Stage].[Number]: [Description]" |
| Alignment | Centered within column |

---

## 6. Blockquote & Callout

### Regular Blockquote
- Background: Stage-specific light background
- Left Border: 2.5pt, stage color (100% opaque)
- Padding: 8pt L/R, 4pt T/B
- Font: 9.5pt regular, #1A1A1A

### Key Point Box
- Background: #FFFFFF
- Border: 1.5pt left + top + bottom, stage color at 60%
- Header: "Key Point: [Title]" bold, stage color at 80%
- Body: 9.5pt, #1A1A1A

---

## 7. Formula Display

| Property | Value |
|----------|-------|
| Engine | amsmath (LaTeX) |
| Size | 9.5pt (same as body) |
| Variables | Italic (automatic) |
| Block formulas | Centered, auto-numbered |
| Number position | Right flush |
| Background | Stage-specific code background |
| Spacing | 6pt above, 6pt below |

---

## 8. Page Numbering & Navigation

| Property | Value |
|----------|-------|
| Position | Bottom center |
| Font | Calibri 10pt, #555555 |
| First page | Hidden |
| TOC depth | H1 + H2 |
| TOC leaders | Dotted |
| TOC indentation | H1=0pt, H2=12pt |
| Cross-ref format | "Stage [N], Section [M.M]" |
| Link color | #2C3E6B (Navy) |

---

## 9. V8 Stage Names (Updated for Theoretical Coherence)

| Stage | Color | V8 Title |
|-------|-------|----------|
| 1 | #2C3E5C | Data & API: The Raw Material |
| 2 | #3D3000 | Academic Foundations: The Intellectual Bedrock |
| 3 | #1A3D35 | Technical Analysis: The Applied Theory |
| 4 | #2D1B4E | Chart: The Visual Translation |
| 5 | #3A2010 | www.cheesestock.co.kr: The Delivery |

---

## 10. Build Pipeline

```bash
pandoc input.md -o output.pdf \
  --template=scripts/templates/cheesestock-d4.tex \
  --lua-filter=scripts/templates/diagram-protect.lua \
  -F pandoc-crossref
```

- Engine: XeLaTeX (CJK via xeCJK)
- Template: cheesestock-d4.tex
- Lua filter: diagram-protect.lua
- Packages: booktabs, longtable, amsmath, hyperref, xeCJK

---

## 11. Benchmark Adoption Summary

| Benchmark | Adopted Elements |
|-----------|-----------------|
| Bloomberg Equity Research | H2 numbering, left-bar quotes, footnote citations |
| Goldman Sachs Technical | Stage navigator, confidence scores, ASCII flowcharts |
| Journal of Financial Economics | Formula numbering, notation conventions, appendix structure |
| CFA Institute Research | Key Takeaways box, glossary, executive summaries |
| TradingView Documentation | Code block styling, function signature tables |

---

## QA Checklist (Pre-Export)

- [ ] All 5 stages use correct marker colors
- [ ] Header rule matches current stage color
- [ ] Tables have stage-colored borders at 55%
- [ ] Code blocks have correct stage background
- [ ] Blockquotes have stage-colored left bar
- [ ] Page numbers in footer center (except cover)
- [ ] TOC auto-generated and hyperlinked
- [ ] Cross-references linked (Stage N, Section M.M)
- [ ] Formulas centered and auto-numbered
- [ ] CJK text renders in Malgun Gothic
- [ ] No orphaned headings at page bottom
- [ ] PDF bookmarks at H1/H2 levels
- [ ] Margins: 20mm T/B, 22mm L/R
