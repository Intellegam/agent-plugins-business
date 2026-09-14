---
name: ssm-quotes-report
description: >
  Automates IFM/Infomedia's monthly "SSM quotes created usage report" exactly as
  Rob's (IFM) manual process produces it — same tabs, same dashboard layout and
  colour scheme, same numbers. Use whenever someone asks to "run the SSM quotes
  report", "create the monthly SSM usage report/dashboard", "SSM Quote Analysis
  for [month]", uploads the monthly SSM_QUOTE_DETAILS file/zip, or forwards the
  "Monthly SSM Quote Data Report" email from no-reply@infomedia.com.au.
---

# SSM Quotes Created Usage Report (monthly)

## Purpose

Replaces the manual monthly process (roughly 16 steps in Excel) with one script
run. **This is a status-quo automation: the output must be identical to the
manual report** — same five tabs, same dashboard layout, same categories, same
colour scheme — so Rob and the SAMs can compare like for like. Do not add
trends, extra metrics or redesigns unless explicitly asked (that is what the
companion skill `ssm-reporting-insights` is for).

## Inputs

1. **Monthly quotes file** — the `SSM_QUOTE_DETAILS_<DATE>` CSV inside the zip
   attached to the automatic email "Monthly SSM Quote Data Report" from
   no-reply@infomedia.com.au (the zip usually contains a DETAILS and a SUMMARY
   zip; only DETAILS is needed). CSV or XLSX both work. Expected columns:
   `Year Month, REGION, Country, DYNAMICS_ACCOUNT_ID, Dealer Name, App Source,
   Franchise, Num Quotes, Total Parts Price, Total Labour Price, Total Sundry
   Price, Total Commercial Price`. Since Aug 2026 the extract names two columns
   `APPLICATIONSOURCE` / `QUOTE_FRANCHISE` and adds a leading `ORDER_BY` column —
   the script normalises these automatically and prints a WARNING when it does.
2. **Network reference** — `references/network_reference.csv` (bundled).
   Defines which brand/market combinations appear on the dashboard, their
   network sizes, and how dashboard labels map to raw-data values
   (e.g. "Nissan Belgium (RBU)" → Nissan/Belgium; "ORA/Havel Baltic States" →
   Ora in Estonia+Latvia+Lithuania; KGM → franchise "Ssangyong").

## How to run

```
python3 scripts/build_ssm_report.py <quotes_file> references/network_reference.csv "SSM Quotes Analysis (<MonYY>).xlsx"
```

If the user provided a zip: unzip first (nested zips: unzip the DETAILS one
too). Then run the script, read every WARNING it prints, and summarise them for
the user. Then run the validator from `ssm-reporting-insights`
(`scripts/validate_report.py`) — only deliver if it passes. Deliver the xlsx.

Always also produce the PDF handout (that is what Rob and the SAMs actually
receive): copy the workbook, delete all sheets except Dashboard, then
`libreoffice --headless --convert-to pdf <copy>.xlsx`. Render page 1 to PNG
(`pdftoppm -png -r 80 -f 1 -l 1`) and look at it once before delivering —
colour scheme and column alignment must match the layout described below.

## Business rules (validated against the April 2026 original)

- Regions kept: **Europe + MEA** only (APAC/AMERICAS removed) → tab "All Data".
  The raw file labels MEA as `MEA` or, since Aug 2026, `Middle East/Africa` —
  both are kept (`REGIONS_KEPT` in the script). If a new label appears, the
  MEA markets (e.g. Kia South Africa, 62 dealers) silently drop to 0 % — check
  `REGION.value_counts()` whenever a MEA market shows 0 active dealers.
- Tab "0 quote dealers" = All Data with `Num Quotes == 0`;
  tab "1+ quote dealers" = All Data with `Num Quotes >= 1`.
- Dashboard counts **App Source == "Menus" only** ("Connect" discarded).
- Usage categories: NONE = 0 quotes, LOW = 1–19, MEDIUM = 20–99, HIGH = 100+
  quotes per calendar month.
- NONE dealers = network size (from reference) − active dealers. Percentages
  are fractions of network size, displayed rounded to whole percent.
- `Av. Quotes` = quotes ÷ active dealers per row. The Grand Total `Av. Quotes`
  is the **sum of the brand-total averages** — a quirk of the original Excel
  formula, kept intentionally for 1:1 comparability.
- Only brand/markets in the network reference appear on the dashboard (the
  manual process drops everything else silently — Toyota and Ford are handled
  as enterprise brands elsewhere). The script prints a WARNING for every
  dropped market so nothing disappears unnoticed. Rob's rule of thumb: a
  market that is in the dealer listing belongs on the dashboard even with zero
  activity (e.g. ORA Ireland) — non-usage must be visible, so extend the
  reference from the listing rather than hiding such markets.
- A market with 0 rows in the raw file (not 0 quotes — no dealers at all) is
  usually a **cancelled subscription** (Hyundai Sweden, Aug 2026), not a data
  error. Confirm with Rob, then remove it from the network reference.

## Dashboard layout & colour scheme (Rob's original, confirmed Sep 2026)

The dashboard reproduces Rob's manual Excel formatting exactly — this was his
explicit feedback on the first automated run, so do not "improve" it. The
scheme is implemented in `GROUP_FILLS` / `FILL_YELLOW` in the script:

- Title row 1: "SSM Quote Analysis - <Month Year>", bold.
- Header rows 2–4 with merged group headers. Columns A–C (Brand, Country,
  Network): rows 2–3 blank, row 4 **yellow** (FFFF00).
- Column groups, each with a darker header fill (rows 2–4) and a lighter data
  fill (all data rows):
  - D–G "Network Coverage - Active Dealers" (%, Total, Quotes Made,
    Av. Quotes): blue — header 5B9BD5, data DDEBF7
  - H–I "Usage = NONE / 0 quotes": grey — header D9D9D9, data F2F2F2
  - J–L "Usage = LOW / 1 to 19 quotes pcm": orange — header F4B183, data FBE5D6
  - M–O "Usage = MEDIUM / 20 to 99 quotes pcm": purple — header C77DD1, data E9D3EE
  - P–R "Usage = HIGH / 100+ quotes pcm": green — header A9D18E, data E2EFDA
- Every brand **TOTAL row and the Grand Total row: whole row yellow + bold**.
- LOW/MEDIUM/HIGH cells are left **blank** (not 0) when a market has no dealers
  in that category; NONE always shows values ("0% 0" is fine).
- **No red/amber/green traffic light on the % column and no legend** — the
  first automated version had one; Rob's original does not, and he asked for
  his layout. Numbers centred from column C onwards, no cell borders.
- Recently launched markets are highlighted manually in the original; if the
  user names such markets, highlight those rows (yellow fill on brand+country).
- Landscape print setup with repeated header rows (1:4) is preconfigured so the
  PDF export matches the manual handout.

## Sanity checks (from the manual work instruction — warnings, never fatal)

raw file 25,000–30,000 rows · All Data 20,000–25,000 · 0-quote 10,000–17,500 ·
1+ quote 7,500–12,500. Outside these ranges → warn the user to check the
source file before distributing. Aug 2026 reference values: 27,514 / 23,675 /
15,671 / 8,004; network 6,819, active 4,589 (67 %), 397,487 quotes.

## Validation status

Rebuilt from the April 2026 raw data, the script reproduces the original
"SSM Quotes Analysis (Apr26)" dashboard in 96 of 106 rows to the digit. Every
remaining difference traces to a manual error in the original, which the
automation corrects (Rob has acknowledged these): (a) Isuzu Sweden/UK "active
dealers" (72/73) contradicted the bucket counts in the same original PDF
(67/70 — the raw data confirms 67/70); (b) the "Other Brands TOTAL" network in
the original summed only the ORA/Havel rows (73 instead of 222) — a
formula-range slip; the Grand Total row inherits both. If the user asks why
totals differ slightly from an old manual report, this is the explanation.

## Operations (agreed with Rob, Sep 2026)

- <recipient> is on Infomedia's distribution list from the October
  run (September data) onwards — the monthly zip arrives in the operator's mailbox.
- September 2026 is the first **parallel-run** month: Rob produces the manual
  report, we produce the automated one, then `diff_reports.py` from
  `ssm-reporting-insights` documents every difference. Two clean months →
  manual process retired.
- Outputs go to Rob (<recipient>) as a reply in the "Monthly SSM Quote
  Data Report" thread: xlsx + Dashboard PDF, plus the insights outputs. The
  4 MB xlsx cannot be pushed through the Gmail connector as an attachment —
  save the files to the user's Downloads folder via the device bridge and let
  the operator attach them to the draft.

## Maintaining the network reference

Network sizes come from Rob's half-yearly "SSM subscribing dealer analysis"
(January & July), which he shares as an "SSM Dealer listing" Excel (the raw
Global Order Line file stays inside IFM). When a NEW listing arrives, run:

```
python3 scripts/update_network_reference.py "<SSM Dealer listing.xlsx>" references/network_reference.csv
```

It updates network values in place, self-checks the listing's Grand Total
cells, and prints every decision that needs Rob's confirmation (markets
missing from the listing, markets in the listing that are not yet on the
dashboard). Do NOT run it with an OLD listing — e.g. the Jan26 listing is
older than the values already used by the Apr26 dashboard (Rob updates some
markets mid-cycle: Hyundai Denmark 46→53, Nissan Italy added with 147, etc.).
Between updates the sizes are intentionally static — that matches the manual
process. Occasional artefacts like "% active" above 100 % (e.g. Kia Sweden,
82 active vs. network 81) simply mean the network figure is stale; leave them,
the original shows the same. Pending (Sep 2026): remove Hyundai Sweden
(cancelled, network 66) and add the single-dealer / zero-activity listing
markets once Rob confirms the July listing is current. Keep the copy in
`ssm-reporting-insights/references/` identical.

## Private data (not in this repository)

`references/network_reference.example.csv` carries the real brand/market
mapping but a flat placeholder network size (100) for every row — the real
subscriber counts are Infomedia data and are distributed privately as
`references/network_reference.csv`. Drop the private file next to the example
before running; never commit it. The same applies to the copy in
`ssm-reporting-insights/references/`.

## Output

One xlsx with tabs, in order: `All Data`, `0 quote dealers`,
`1+ quote dealers`, `Pivot` (intermediate counts per brand/market, for
traceability), `Dashboard` (title "SSM Quote Analysis - <Month Year>", month
taken from the `Year Month` column), plus the Dashboard-only PDF handout.

After delivering, the file is typically shared with the SAMs and used to pick
the worst-using markets for usage-improvement campaigns; if asked, list the
markets with the lowest % active per brand from the Dashboard.

## Change log

- Sep 2026: dashboard colour scheme rebuilt to Rob's original (group colours,
  yellow totals, no % traffic light); `REGIONS_KEPT` extended with
  "Middle East/Africa"; column-name normalisation for the Aug 2026 extract.
