# ifm-reporting

Claude plugin that automates the recurring dealer-usage reporting Intellegam
runs for IFM Europe / Infomedia. Every skill replaces a manual Excel process
that exists today; the outputs are built to match the manual originals one to
one so the report owners can compare like for like during the parallel run.

## Skills

| Skill | Cadence | What it does |
|---|---|---|
| `ssm-quotes-report` | monthly | Rebuilds the "SSM Quote Analysis" workbook (All Data / 0 quote / 1+ quote / Pivot / Dashboard) and the PDF handout from the Infomedia `SSM_QUOTE_DETAILS` extract — same layout, colour scheme and numbers as the manual report. |
| `ssm-reporting-insights` | monthly / ad hoc | Additive analysis on top of the monthly report: usage trends per market, campaign-target list, data-quality checks, dealer journey (e.g. Nissan Europe), validator for a generated report, parallel-run diff manual vs automated. |
| `ssm-subscriber-analysis` | half-yearly (draft) | Refreshes the network sizes from the Global Order Line report / dealer listing. Draft — see the skill for the two deployment paths. |
| `sst-kpi-report` | weekly / monthly | Produces the Superservice Triage client KPI reports (AFG, Nissan, Toyota, Kia, Ford, …) from raw Tableau exports: validation, transformation, exact file naming, e-mail draft. |
| `sst-action-briefing` | monthly | Turns the month's Triage report files into a one-page internal Action Briefing (HTML + A4 PDF) in the Intellegam design: unsold work, banding, adoption gaps, log-in churn. |

## Requirements

Python 3 with `pandas` and `openpyxl`; LibreOffice (`libreoffice --headless`)
for PDF export; `pdftoppm` (poppler) for visual checks. No MCP servers are
bundled — mail is drafted through whatever Gmail/Outlook connector the user
has, and always as a draft, never sent automatically.

## Private data — read before first use

This repository is public. Everything personal or commercially sensitive has
been removed and replaced with placeholders or synthetic examples:

- `ssm-quotes-report/references/network_reference.example.csv` and the copy in
  `ssm-reporting-insights/references/` carry the real brand/market mapping but
  a flat placeholder network size (100). The real `network_reference.csv`
  (Infomedia subscriber counts per market) is distributed privately.
- `ssm-subscriber-analysis/references/dealer_qty_targets.json` is a
  structure-only example.
- `sst-kpi-report/references/reports.md` has no recipient addresses or client
  contact names; they live in a private companion file
  (`reports.recipients.local.md`).
- `sst-action-briefing/references/example_body_july_2026.html` is a synthetic
  example: dealer names replaced, all figures scrambled. Only structure and
  styling are canonical.

Never commit the private files. Each skill's SKILL.md has a "Private data"
section describing where the real file goes.

## Status

- SSM monthly report: validated against the April 2026 original (96/106 rows
  to the digit; the remaining differences are documented manual formula
  errors). August 2026 delivered; September 2026 is the first parallel-run
  month with the report owner.
- SST KPI reports: configured from the June 2026 work instructions, real raw
  exports and 13 real sent e-mails (Aug 2026); parallel run pending.
- SST Action Briefing: July 2026 edition published internally.

## Maintainer

Intellegam GmbH — Consulting (Philipp Seiter).
