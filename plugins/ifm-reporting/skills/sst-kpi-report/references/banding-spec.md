# Nissan Germany Banding — scoring specification (v0.3)

**Raw-export header aliases** (raw UTF-16 tab CSV differs from the finished
sample): `Created By Company Country1` = Market · `Completion Rate Excluding
Delete` = Completion Rate · `Sold On Followup` = Sold on Follow-up. Percentages
arrive as text ("29.34%") → convert to decimals before scoring. Raw contains
multiple franchises (Nissan AND Toyota Germany rows) plus Total/Grand-Total
rows — filter to **Franchise = Nissan, Country = Germany**, drop Total rows.
Scope, blank→0 and thresholds all confirmed by Simon (IFM report owner) (Aug 2026).

Reverse-engineered from `Banding Report - July 2026.xlsx` (score-column headers
state the thresholds) and confirmed structurally by the work instruction
(template with pre-built VLOOKUPs; customer receives values only).

## Input (Tableau `Bandingrepgen`, columns A–N)

Franchise · Market · Currency · Dealer Name · Throughput · e-VHC's Completed ·
Completion Rate · eVHCs using Send Inspection Report · Identified $ per MPI ·
Sold $ per MPI · Percentage Sold · Percentage Sold Red · Percentage Sold Amber ·
Sold on Follow-up

Scope confirmed: **Germany only, Franchise Nissan** (the July 2026 sample
scored 191 such dealers).

## Scoring — 10 criteria, 10 points each (score 10 if condition met, else 0)

| # | Criterion (source column) | Condition |
|---|---------------------------|-----------|
| 1 | Created / Throughput | > 33 |
| 2 | Completed (e-VHC's Completed) | > 20 |
| 3 | Completion Rate | > 90 % |
| 4 | Sent Inspection (Send Inspection Report count) | > 3 |
| 5 | Identified per VHC (Identified $ per MPI) | > €100 |
| 6 | Authorised per VHC (Sold $ per MPI) | > €70 |
| 7 | Authorised (Percentage Sold) | > 50 % |
| 8 | Authorised Red (Percentage Sold Red) | > 70 % |
| 9 | Authorised Amber (Percentage Sold Amber) | > 50 % |
| 10 | Sold on Follow-up | > €1 |

**Total Score** = sum (0–100).

## Bands

Band A = 90–100 · Band B = 70–80 · Band C = 50–60 · Band D = 20–40 · Band E = 0–10

(Scores are always multiples of 10, so the gaps between bands cannot occur.)

## Output rules

1. Sort dealers by Total Score, highest → lowest.
2. Customer file = **values only** — no formulas, no threshold columns' logic
   beyond what the template shows. The formula-stripping is deliberate: the
   client must not see the internal VLOOKUP logic.
3. File name `Nissan Germany banding report [Month]`; recipient
   <recipient>; subject "Nissan Germany Monthly Banding Report -
   [Month Year]".
4. Blank inputs (e.g. Percentage Sold Red empty because no red work) score 0
   for that criterion — confirmed by Simon, and consistent with the sample.
