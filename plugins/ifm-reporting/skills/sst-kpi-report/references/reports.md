# Report configurations (v0.3 — work instructions June 2026 + raw exports, samples and 13 real sent emails, Aug 2026)

> **Public-repository note.** Recipient e-mail addresses, client contact names and other personal data have been removed from this file and replaced with `<recipient>` / `<first name>` placeholders. The real recipient lists live in a private companion file (`reports.recipients.local.md`, not in this repository) — ask the report owner before the first send of any report.

Tableau instance: `https://eu-west-1a.online.tableau.com/#/site/infodrive/`
Sign-off style (from real emails): "Hi <first name>, / Dear all," … "Please find
the latest <report> attached." … "Kind Regards, Simon (IFM report owner)". CC an IFM account
manager where noted (the responsible IFM account manager).

Common 28-col SST KPI set: Market · Currency · Dealer Name · Dealer Code ·
Throughput · e-VHC's Deleted · e-VHC's Completed · Completion Rate Incl./Excl.
Delete · eVHCs using Send Inspection Report · Identified $/MPI · Sold $/MPI ·
Total P&L Identified/Sold · Percentage Sold · Red Identified/Sold
(parts/labour/total) · Amber Identified/Sold (parts/labour/total) · Jobs with
Video. (27-col variant: single Completion Rate. NIS_BAL orders Excl before Incl.)

---

## AFG — Al Futtaim Group (Pattern 1)
- Weekly Monday (MTD) + monthly 1st working day · view `AFG_SST_KPI/Main_Dealer_KPI`
- 28-col set with per-market Total rows (KSA/SAR, UAE/AED) · ~40 dealers
- File: `AFG_KPI_MTOD_YYYY-MM-DD` → .xlsx
- Subject (real): "AFG -SST Month-to-date KPI report" · Body: "Dear all, Please find your latest Triage eVHC KPI report attached."
- To: <recipient> · CC: <recipients>
  (procedure lists 5 To-recipients incl. three further client contacts — the Aug 2026 sent mail uses the smaller list above; follow the latest thread)

## NGER — Nissan Germany (Pattern 1)
- Weekly Monday (MTD) + monthly 1st working day · view `NGER_SST_KPI-Modified/NGER_SST_KPI`
- 28-col set · Germany/EUR · ~165–205 dealer rows + Germany-Total + Grand Total
- File: `NGER_Triage_KPI_MTOD_YYYY-MM-DD` (weekly) / `NGER_SST_KPI YYYYMMDD` seen too
- Subject (real): "NGER Triage eVHC KPIs" · "Hi <first name>, Please find the latest eVHC KPI report attached."
- To: <recipient> · CC: <recipients>
- "IFM Account Managers" DL = the two IFM account managers

## TBEL — Toyota Belgium (Pattern 1)
- **Monthly only** (confirmed Aug 2026; the weekly run was dropped) · view `TBEL_KPI_2025-Modified/TBEL_SST_KPI` · Crosstab
- 28-col set incl. the recently added "Completion Rate Excluding Deleted" column · Belgium + Luxembourg/EUR · ~88 dealers
- Dealer codes now flow through from Dynamics into Tableau automatically — no manual lookup anymore
- File: `TBEL_KPI_[MonYY]` · Subject (real): "TBEL - Triage KPI report"
- To: Laurent.Warnotte@**inchcape.be** (procedure said @toyota.be — the sent mail uses inchcape.be; use that)

## NAE — Nissan Europe monthly pair (Pattern 1, two files, one email)
- Monthly, first days · Report 1: view `NAE_NEW_KPI-Modfied/Main_Dealer_KPI`, 28-col, 400+ rows, file `NAE_Triage_KPI_report_-_[Month]_[Year]`
- Report 2: view `VideoandAuthreporting_17653448522360/VideoPresentationReport`, 11 cols, file `Video_Presentation_Report_[Month]_[YY]`
- Dealer code `*` = normal, keep
- Subject (real): "Nissan Europe - Triage eVHC KPIs"
- To: <recipients> · CC: <recipient> (added Aug 2026); <recipients>

## ENEST — Nissan eNEST region (Pattern 1) · ACTIVE
- eNEST = Benelux (BE/NL/LU) + Scandinavia/Nordics (DK/NO/SE) business region
- Monthly · 27-col variant · ~164 rows, sorted by e-VHC's Completed desc
- File: `ENEST_SST_KPI [MonYY]` · Subject (real): "eNEST Triage KPI Report" · "Hi <first name>, Please find the attached Triage KPI report for [MonYY]."
- To: <recipient> · CC: <recipient>

## HCI — Hyundai Cars Ireland (Pattern 1) · ACTIVE
- Monthly · 27-col variant · Ireland/EUR · ~34 dealers, sorted by Dealer Name
- File: `HCI_SST_KPI [Month] [YYYY]` · ❓ recipients/wording: no sent example yet — ask before first automated run

## NIS_BAL — Nissan Baltics (Pattern 1)
- Monthly · 28-col variant with **Completion Rate Excl before Incl** · Estonia (+LV/LT)/EUR · ~16 rows
- Dealer-code formats inconsistent in source (`NEEM270100` / `N-EE-M-270130`) — pass through unchanged
- File: `NIS_BAL_SST [Month] [YYYY]` · Subject (real): "EVHC report BAL" · "Hi <first name>, Please find the attached KPI reports for Nissan Baltic dealers."
- To: <recipient> · CC: <recipient>

## NBELUX — Nissan BeLux (Pattern 1)
- Monthly · 27-col variant · Belgium + Luxembourg/EUR · ~48 rows, sorted by Dealer Name
- File: `NBELUX SST KPI [Month] [YYYY]` · Subject (real): "Nissan BeLux Superservice Triage monthly KPI report - [MonYY]" · "Hi <first name>, Please find the attached Superservice Triage KPI report for [Month YYYY]."
- To: <recipient> · CC: <recipient>

## CHAPELHOUSE — Log-in Activity (Pattern 1)
- Monthly, first days · last 4 weeks · view `ChapelhouseLog-inReport/Log-inActivity`
- Per **user**: Region, Country, Company, Username, Dealer Code, Login Activity, Logins W-3/-2/Last/This
- File: `Triage Log-ins - Chapelhouse [MonYY]` · Subject (real): "Chapelhouse Monthly Triage Log-in report" · "Hi <first name>, Please find the latest Triage user log-ins report attached."
- To: <recipient> (+ S.Murphy@ in earlier sends) · CC: <recipient>; an IFM account manager; p.johnson@ in older sends — follow latest thread

## MITUK + MMUK_QS — Mitsubishi UK pair (one email)
- Monthly, beginning of month · Subject (real): "MMUK Monthly Reports" · "Dear all, Please find the latest SSM usage reports attached."
- MITUK: view `MistsubishiUKlog-inactivity/MITUKlog-inactivity`, per dealer, file `MIT UK log-in activity [MonYY]`
- MMUK_QS: filter SSM_QUOTE_DETAILS (from no-reply@infomedia.com.au) to UK + Mitsubishi → new workbook, file `MMUK QUOTE SUMMARY [Month]` (overlaps `ssm-quotes-report` skill — reuse)
- To: <recipients — private list>

## KMUK — Kia UK (Pattern 2, annual multi-tab workbook)
- Monthly, first working days · **source view: `KMUKSSTKPI2026_17779937996240/KMUK_Triage_KPIs`** — the dedicated view whose columns match the workbook.
  ⚠ Do NOT derive from the generic KME_SST_KPI view: its count columns match but the monetary columns (Total Identified/Authorised, RED/AMBER £) do not (verified 24 Aug 2026).
- Raw dealer codes carry a `U` prefix (`U2254`) → strip to match the audited static list:
  <five dealer codes + names — see the private recipients/config file>
- Workbook `KMUK_Triage_KPI_[YEAR].xlsx`, new tab `[MonYY]` per month, new file each January
- Subject (real): "KMUK eVHC Reporting" · "Dear all, Please find the latest Triage eVHC KPI report attached."
- To: <recipients>

## TIRE — Toyota Ireland (Pattern 2, 7 crosstabs → 1 workbook)
- Monthly, first 2 working days · report `T-IREJobType_JAVA_ETL-Modified/TIre_SST_KPI`, 7 tabs each exported as Crosstab
- Sheets in order, names as in Tableau incl. dealer counts: `TIre_SST_KPI (N)`, `Retail_Serivce_Repair (N)` (sic), `2_Year_Service_Pack (N)`, `3_Year_Care_Pack (N)`, `Sales (N)`, `Warranty_Campaign (N)`, `No_job_type (N)` — counts change as dealers join (e.g. a dealer added Jul 2026)
- Raw tab format: 26 cols, no Dealer Code, percents as text
- File: `TIre_SST_KPI_(Month)_2026` · Subject (real): "Toyota Ireland - Monthly Triage KPI report" · "Hi <first name>, Please find the attached report for [Month YYYY]."
- To: <recipient> · CC: <recipients>

## BANDING — Nissan Germany Monthly Banding (Pattern 2 — see banding-spec.md)
- Monthly, first days · view `NCEMonthlyBandingReport/Bandingrepgen` · raw is UTF-16 tab CSV, cols A–N, percents as text
- Raw contains multiple franchises/markets (Nissan, Toyota, …) — score **Nissan + Germany only** (confirmed), blanks score 0 (confirmed), thresholds current (confirmed)
- Sort by Total Score desc · output values only (never the formula logic)
- File: `Nissan Germany banding report [Month]` · Subject: "Nissan Germany Monthly Banding Report - [Month Year]"
- To: <recipient>

## NMGB — Nissan GB EVHC Dealer Submission (Pattern 2, OEM template)
- Monthly, 5th working day · workspace Triage Dealer Reports Admin EU → `NMGB_Dealer_Submission_Form` / worksheet `NMGB_DLR_SUBMISSION` · Crosstab
- Raw: 16 cols starting Dealer Name, Dealer Code (`N-GB-M-1798` → strip to `1798` for template col A) + Red/Amber blocks; Grand Total row present
- Fill blank template "TRIAGE EVHC Monthly Performance Report BLANK.xlsx" (static dealer codes/site names; formulas =D/C etc. compute the target ratios — keep them intact, fill input cells only); update the date cell at the top
- File: `TRIAGE EVHC Monthly Performance Report [MonYY]` · Subject (real): "Infomedia - EVHC Dealer Submission Form" · "Hi <first name>, Please find the eVHC KPI data submission for [Month YYYY] attached."
- To: <recipient> · CC: <recipient> (<recipient> in earlier sends)
- Always run the #REF!/error scan before saving (July 2026 file shipped with two #REF! cells)

## TRACKER — EMEA SST Usage Tracker (Pattern 2, internal only — never emailed)
- Monthly · file `EMEA SST Usage Tracker FY27.xlsx`: `Overview` sheet + one tab per month (`Jul26`, …)
- Per country/RBU row (NCE, …): Billed Subs (dealers), Dealers completed ≥1 VHC, % complete, Total VHCs, VHCs/dealer, dealers over 20+/50+/100+ VHC thresholds + ratios (formulas in file — keep)
- Used for QBR tracking of top SST clients · no recipients

## FORD — Weekly Video pair (Pattern 3, assist only)
- Weekly Monday AM · MTD · Ford franchise only
- General Input File from Triage UI (Reports > Video Performance > General, login <Triage admin account>); mapping per work instruction; watched rate as decimal; file `Ford_Video_General_Input_File_YYYY_wkXX.xlsx`
- QA file: 5 % of previous week's videos per dealer (round down), min 2/dealer; Simon fills only the columns present in the examples — the Ford team does the video evaluation
- Automation path: an IFM colleague (<recipient>) is working on automatic video-URL extraction — align there (Simon can arrange a call)
- One email, both files · Subject (real): "Ford Video Check data - Superservice Triage"
- To: <recipients> · CC: <recipients> (<recipient> in procedure but not the Aug 2026 send — follow latest thread)

---

## Retired
- **JLR EIR** — no longer provided post March 2026 (confirmed)
- **SPC_eVHC_KPI (Sytner)** — recipient left; report no longer required (confirmed Aug 2026)

## Infrastructure option
Tableau scheduled exports to an **internal IFM mailbox** are feasible (Simon) —
would remove the manual download for all Pattern-1 reports. Owner: the IFM Systems Admin
(Systems Admin), available again ~early Sep 2026.
