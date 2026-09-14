---
name: sst-action-briefing
description: >
  Generate the monthly Triage/SST Action Briefing — a single self-contained
  HTML page (plus paginated A4 PDF) in the INTELLEGAM design that turns the
  month's IFM dealer-report files into steering lists: unsold identified work,
  banding intelligence, adoption gaps and log-in churn, each with named top-5 /
  worst-5 dealers and one action per lever. Use whenever the user asks for the
  "action briefing", "monthly briefing", "Monatsbriefing", "the July/August
  edition", "das Dashboard für [Monat]", wants the SST insights "as one page /
  as PDF", or drops a month's Triage report files and asks what to do with
  them. Companion to sst-kpi-report (which reproduces the client reports) and
  sst-reporting-insights (which defines the analysis) — this skill is the
  monthly publication layer.
---

# SST Monthly Action Briefing

## What this produces

One month, one page: `SST_Action_Briefing_<Month>_<Year>.html` (self-contained,
~1.1 MB, no JavaScript — it must render identically in mail attachments,
browsers and print) and the same content as a paginated A4 PDF. The document is
**internal** (IFM account managers, QBRs): dealer names, fees and worst-lists
appear; it never goes to a client without per-client rework. It contains only
data insights and steering — no automation or effort-savings content.

## Inputs

The month's report files (finished .xlsx or raw Tableau exports — parse rules
live in the `sst-kpi-report` skill: UTF-16 tab CSVs, "49.31%" → 0.4931,
thousands commas, Total/Grand-Total rows, code prefixes). Include ONLY clients
whose file actually covers the edition's month; name the missing ones in the
footer as joining the next edition. For trends, prior months' files or the
archive from previous editions (`history/` folder next to the output).

## Workflow

1. **Compute first, write second.** Work through `references/sections.md` — it
   defines every section's formulas, the top-5/worst-5 ranking rules and the
   guardrails. Compute all numbers from the source files (Python/openpyxl);
   never reuse a figure from an earlier edition. Cross-check each section's
   totals against the source file before it goes in the page.
2. **Write the body** as `<edition>_body.html`, cloning the structure of
   `references/example_body_july_2026.html` — that file is the canonical look:
   nav anchors, dark hero ("<Month> <Year>."), statement band with em-dash
   reframe, one `.sec` per lever with `.data` table + callouts + `.duo`
   top/worst tables + a static "What to do in <next month>" block, closing
   band, steering table, dark footer with exact source-file list. Keep the
   three placeholders `{{CSS}}`, `{{LOGO_DARK}}`, `{{LOGO_LIGHT}}` — the build
   script resolves them. Static HTML only: no scripts, no hover-dependent
   information (bar values are labelled permanently).
3. **Build the standalone file:**
   `python3 scripts/build_standalone.py <edition>_body.html SST_Action_Briefing_<Month>_<Year>.html`
4. **Make the PDF:**
   `python3 scripts/make_pdf.py <standalone>.html <same name>.pdf`
   The script injects the tuned print layout (dark title page, paired content
   pages, tables never split) and prints the page count. Render a screenshot
   of page 1 and the last page (pypdf/Read) and check: statement complete on
   page 1, no large white strip at the bottom — adjust `--title-fill` /
   `--footer-fill` if needed (the script's docstring explains the knobs).
5. **Verify before delivering:** re-open the HTML, screenshot it full-page,
   and eyeball for broken tables, unresolved placeholders or overlapping
   labels. Spot-check three computed numbers against the source files. Then
   deliver both files and archive the month's normalised data into `history/`
   so the next edition's trends deepen automatically.

## Editions with less data

A single-client edition (e.g. "TBEL only") keeps the same rhythm with fewer
sections; a first-ever edition skips the trend section ("trends start next
month"). Never pad a thin month with stale data — a shorter honest edition
beats a full-looking wrong one.
