---
name: ssm-reporting-insights
description: >
  Value-add analysis layer on top of the monthly SSM quotes report (companion
  to the ssm-quotes-report skill — that one replicates the status-quo report
  1:1, this one adds the insights the manual process cannot deliver). Use it
  whenever someone wants trends or month-over-month comparisons of SSM usage,
  a campaign target list / worst-performing markets, a dealer journey or
  webinar-impact tracking (e.g. for Nissan Europe), a data-quality check of
  the monthly extracts, validation/self-check of a generated SSM report, or a
  parallel-run comparison between Rob's manual report and the automated one.
  Trigger on phrases like "SSM trends", "worst markets", "campaign targets",
  "dealer journey", "compare manual vs automated report", "validate the SSM
  report", "which markets are declining", or when several monthly SSM quotes
  files are provided at once.
---

# SSM Reporting Insights

## What this skill adds (and why)

The `ssm-quotes-report` skill reproduces Rob's monthly report exactly — by
design, nothing more. This skill is the upgrade path, built from validated
findings on the real Jan–Aug 2026 data:

- **Trends**: single-month spot reports hid a 35-point collapse
  (Hyundai Sweden 92% → 58% active, Jan→Jul). In August the market
  disappeared entirely — Hyundai Sweden had cancelled. The trend view showed
  the churn months ahead: trend view = churn early warning, and this is the
  business case Rob accepted.
- **Worst Markets**: step 16 of the manual process (pick campaign targets)
  as a generated, justified list — including whether a market is *falling*
  (win-back case) or *never started* (activation case).
- **Data Quality**: the manual process silently drops markets not in the
  network list — ~8,000 quotes from dashboard brands Jan–Jul 26 (e.g. Hyundai
  France, ~680/month) were invisible. This makes every drop explicit.
- **Dealer Journey**: dealer-level month-by-month usage with categories and
  movers — Nissan Europe's explicit request for webinar impact tracking
  (Jan→Jul: 253 dealers improved, 314 declined). Rob singled this tab out as
  the most useful part of the first delivery.
- **Self-check**: four manual formula errors were found in original reports;
  the validator makes such errors structurally impossible to ship.
- **Parallel-run diff**: the agreed proof phase (manual vs automated, two
  clean months, starting with September 2026 data) reduced to one command
  with an evidence file.

All outputs are ADDITIVE. Never modify the 1:1 monthly report itself — Rob and
the SAMs must keep their like-for-like comparison. The colour scheme Rob asked
for (column-group colours, yellow totals) applies to the monthly Dashboard
only; the insights workbook keeps its own neutral formatting.

## Inputs

- One or more monthly quotes files (`SSM_QUOTE_DETAILS` zip/CSV/XLSX or the
  "MonYY quotes.xlsx" extracts). All known column variants are normalised
  automatically — including the Aug 2026 renames `APPLICATIONSOURCE` /
  `QUOTE_FRANCHISE` and the Jul26 six-column extract without REGION. Pass them
  **oldest first**. The Jan–Jul 2026 extracts live in the operator's
  "superservicemenuscy26ytdquotedatapermonth" zip; ask for it when a trend
  run is requested and only the latest month is at hand.
- `references/network_reference.csv` (bundled; keep in sync with the copy in
  ssm-quotes-report — it is refreshed from Rob's half-yearly dealer listing).

Region filter: Europe + MEA, where MEA is labelled `MEA` or (since Aug 2026)
`Middle East/Africa` — both are in `REGIONS_KEPT` in `scripts/common.py`. A
new label would silently drop the MEA markets; check when Kia South Africa
shows 0 active.

## Private data (not in this repository)

`references/network_reference.example.csv` has placeholder network sizes
(100). Use the privately distributed `network_reference.csv` (identical to the
one used by `ssm-quotes-report`) for every real run; never commit it.

## Commands

**One-page HTML dashboard** (the simplest view — KPI row, network trend
sparklines, ACT NOW / CAMPAIGN TARGETS / WHAT WORKS, data-quality footnote;
self-contained file for sharing or showing in meetings):

```
python3 scripts/build_dashboard_html.py --ref references/network_reference.csv \
    --out "SSM Usage Dashboard (MonYY).html" <monthly files, oldest first...>
```

**Insights workbook** (leads with an "Overview" tab that mirrors the HTML
dashboard, then Trends + Worst Markets + Data Quality, optional
journey tabs per franchise):

```
python3 scripts/build_insights.py --ref references/network_reference.csv \
    --out "SSM Insights (Jan-Aug26).xlsx" [--journey Nissan] [--min-network 20] \
    "Jan26 quotes.xlsx" "Feb26 quotes.xlsx" ... SSM_QUOTE_DETAILS_<date>.csv
```

With a single monthly file it still works (Worst Markets + Data Quality;
trends need ≥2 months — say so rather than producing a one-column trend).
Always include `--journey Nissan` — Nissan Europe is the standing request.

**Validate a generated monthly report** (run after every ssm-quotes-report
run; only distribute the report if this passes):

```
python3 scripts/validate_report.py "SSM Quotes Analysis (MonYY).xlsx" \
    --source "<monthly quotes file>" --ref references/network_reference.csv
```

**Parallel-run comparison** (manual vs automated report):

```
python3 scripts/diff_reports.py "<Rob's manual report>.xlsx" \
    "<automated report>.xlsx" --out parallel_run_diff.xlsx
```

Known acceptable differences in a parallel run: the documented manual formula
errors (Isuzu active counts, "Other Brands" network total, Grand-Total
inheritance). If a diff matches one of those, explain it rather than treating
it as an automation bug.

## Interpreting zero markets

- 0 quotes but dealers present in the raw file → real non-usage → campaign
  target (activation or win-back depending on the trend).
- **0 rows** in the raw file for a brand/market that is in the network
  reference (e.g. Hyundai Sweden, Aug 2026) → almost always a cancelled
  subscription. Say so explicitly, do not list it as a campaign target, and
  flag it for removal from the network reference after Rob confirms.
- Market in Rob's dealer listing but never in the quote data (ORA Ireland,
  Maxus Belgium) → belongs on the dashboard at 0 % so non-usage is visible;
  add it to the reference from the listing.

## How to present results

Lead with the two or three findings that need action (biggest decline, top
campaign target, dropped markets), not with a tour of the tabs. Numbers beat
adjectives: "Hyundai Sweden fell 92% → 58%" lands, "some markets declined"
does not. When the user is preparing something for Rob, IFM leadership or the SAMs,
offer the specific rows they need rather than the whole workbook. Rob's own
words: these insights "give the account executive and customer success team
guidance on where to focus their efforts" — frame findings that way.

Categories everywhere: NONE = 0 quotes, LOW = 1–19, MEDIUM = 20–99,
HIGH = 100+ per month; "Menus" app only — same definitions as the monthly
report, so the two skills never disagree.

## Next step requested by Rob (Sep 2026)

A **customer-facing per-client output** (one template per OEM client for
quarterly business reviews / monthly project status meetings) built from the
same monthly data: active %, usage trend, category shifts, best/worst markets,
dealer-level detail. Scoping call offered; Nissan Europe is the natural pilot
(dealer journey already exists). When this is requested, build it as an
additional output of `build_insights.py` (one tab or one-pager per client),
never by altering the monthly report.

## Change log

- Sep 2026: `REGIONS_KEPT` in `scripts/common.py` extended with
  "Middle East/Africa" (Aug 2026 extract relabelled MEA); Jan–Aug 2026 run
  validated; Hyundai Sweden churn documented as the trend-view proof case.
