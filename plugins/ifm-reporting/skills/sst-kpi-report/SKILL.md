---
name: sst-kpi-report
description: >
  Produce any of the recurring IFM Triage/SST/SSM client reports from a raw
  internal extract (Tableau crosstab/CSV, or the SSM_QUOTE_DETAILS email file).
  Covers all active reports: AFG, NGER, TBEL, NAE (Main KPI + Video
  Presentation), eNEST, HCI, NIS_BAL, NBELUX, Chapelhouse log-in, MIT UK
  log-in, MMUK Quote Summary, KMUK monthly tab, T-IRE 7-sheet job-type pack,
  Nissan Germany Banding, NMGB EVHC Dealer Submission, EMEA Usage Tracker —
  plus assistance for the Ford Video pair. Use whenever the user asks to
  "run/build/prepare the [client] report", drops a Tableau eVHC/log-in extract
  and names a client, or asks "which reports are due". Produces the
  client-ready .xlsx with the correct naming convention plus a ready-to-send
  email draft in Simon (IFM report owner)'s actual wording. v0.3 — validated against raw
  Tableau exports, work instructions, sample files and 13 real sent emails.
---

# IFM Triage/SST Report Generator

## Security rule (the reason this process exists)

Tableau at IFM is not partitioned by customer/brand/market, so nothing is ever
scheduled out of Tableau directly to clients. The raw extract stays internal;
only the finished flat file goes out. **Never include markets/dealers outside
the client's configured scope in an output file.** If foreign markets appear,
filter them out and flag it in the run log.

## Raw Tableau export format (verified against real raw exports, Aug 2026)

Raw crosstab/CSV downloads from Tableau are **UTF-16 LE, tab-separated**. Parse
with `encoding="utf-16"`, `delimiter="\t"` — a naive UTF-8 comma parser fails.
Normalise values before any logic:

- Percent columns arrive as strings: `"49.31%"` → `0.4931`
- Thousands separators: `"23,635"` → `23635`
- Dealer codes carry prefixes the bespoke outputs strip: `U2254` → `2254`
  (KMUK), `N-GB-M-1798` → `1798` (NMGB). Baltics codes are inconsistent in the
  source (`NEEM270100` vs `N-EE-M-270130`) — pass through as-is.
- Raw exports contain BOTH per-market `Total` rows (Dealer Name/Code = "Total")
  and a final `Grand Total` row. Exclude them from dealer sums, keep them where
  the sent sample keeps them, and use them as a checksum: dealer-row sums must
  equal the Total/Grand Total row. Mismatch = filtering/paste error → stop.
- A single `*` as dealer code is normal (NAE); `***` in one cell = data-quality
  issue → flag.

## Private data (not in this repository)

`references/reports.md` is published without recipient addresses, client
contact names and dealer identities (placeholders `<recipient>`,
`<first name>`). Before the first send of any report, get the private
companion file `reports.recipients.local.md` from the report owner and use it
for To/CC and greetings; never commit it.

## Inputs

1. **Raw extract** (or, for MMUK Quote Summary, the SSM_QUOTE_DETAILS file from
   no-reply@infomedia.com.au).
2. **Report key** — look up the block in `references/reports.md` (schedule,
   Tableau source, transformation, naming, subject, recipients, email wording,
   checks). Weekly runs are identical to monthly ones except the date range
   (confirmed by Simon: weekly = MTD, monthly = previous month).
3. **Reporting period** — confirm if ambiguous.

## The three report patterns

**Pattern 1 — export → validate → rename → email** (AFG, NGER, TBEL, NAE Main
KPI, Video Presentation, eNEST, HCI, NIS_BAL, NBELUX, Chapelhouse log-in,
MIT UK log-in): no restructuring. Normalise (see raw format), convert to xlsx,
exact file naming, email draft. Value = validation + zero-error packaging.

**Pattern 2 — template/bespoke** (KMUK, T-IRE, Banding, NMGB, MMUK Quote
Summary, Usage Tracker): apply the report-specific logic in
`references/reports.md` (Banding: `references/banding-spec.md` — scoring
reproduced exactly for 191/191 dealers; thresholds, blank→0 and Germany-only
scope all confirmed by Simon). **KMUK caution:** the bespoke workbook's
monetary columns come from the dedicated `KMUK_Triage_KPIs` view, NOT the
generic KME_SST_KPI view — the generic view's money figures do not match
(verified 24 Aug 2026). Always use the view named in the config.

**Pattern 3 — Ford Video (assist only)**: compute the 5 %/min-2-per-dealer QA
sample, validate/format both files (decimal watched rates), draft the email.
The in-app video collection stays manual for now; an IFM colleague
(<recipient>) is working on automatic video-URL extraction —
coordinate there before building more.

## Workflow

1. Identify the report; load its config block.
2. Read + normalise the extract (raw format above; finished .xlsx inputs work too).
3. Validate — stop and report on failure: required columns (fuzzy: case,
   spacing, `e-VHC`/`e--VHC`, `Evhcs's`), no `#REF!`/`#N/A`, expected markets
   only, row count within ±40 % of typical, Total/Grand-Total checksum.
4. Transform per pattern and config.
5. Write the .xlsx: values only — never formulas in client files. Bold frozen
   header, sensible widths, exact sheet names.
6. Name the file exactly per convention.
7. Draft the email — never send automatically. Use the To/CC and the wording
   from the config's real sent examples (Simon's register: "Hi <name>, Please
   find the latest <report> attached. Kind Regards, Simon (IFM report owner)").
8. Self-check: re-open the file; row count and Throughput/Completed (or
   logins/quotes) sums must match in-scope input; state both in the run log.

## Output

Client-ready file(s) named per convention · run log (rows in/out, markets,
checks, flags) · email draft (To, CC, subject, body, attachments).

## Due-date awareness

Mondays: AFG + NGER weekly, Ford pair. First working day: AFG + NGER monthly.
First 1–2 working days: T-IRE, KMUK, Chapelhouse, Mitsubishi UK pair, NAE pair,
Banding, eNEST, NIS_BAL, NBELUX. 5th working day: NMGB.

## Retired — refuse and note if requested

- **JLR EIR**: no longer provided post March 2026 (confirmed).
- **SPC_eVHC_KPI (Sytner)**: recipient left the company; report no longer
  required (confirmed Aug 2026).

## Open items

- Parallel run (skill vs Simon, one full cycle) = the acceptance test.
- Tableau scheduled exports to an **internal** IFM mailbox would remove the
  manual download step — feasible per Simon; raise with the IFM Systems Admin (Systems
  Admin) from ~early Sep 2026.
- HCI recipients/wording: no sent example provided yet.
