---
name: ssm-subscriber-analysis
description: >
  DRAFT — Automates IFM/Infomedia's half-yearly (January & July) "SSM subscribing
  dealer analysis": extracting SSM subscribers from the Global Order Line Report
  (~110,000 rows), removing non-dealer entities, and producing dealer quantities
  per customer (client/brand) and market. Use when someone asks to "run the SSM
  subscriber analysis", "update the SSM dealer quantities/network sizes", uploads
  a "GLOBAL Order Lines" file, or forwards the "Global Order Line Report" email
  from the Infomedia data team. Replaces ~2 full days of manual work.
---

# SSM Subscribing Dealer Analysis (half-yearly) — DRAFT

## Status: DRAFT — read this first

**Update Aug 2026: Rob cannot share the raw Global Order Line file with
Intellegam** (global data, commercially sensitive, and per Rob the extraction
requires specific knowledge of order/subscription naming idiosyncrasies and
the SSM-into-EPC merge). He instead shares the derived output, his
"SSM Dealer listing" Excel. That changes the deployment options:

- **Path A (current status quo):** Rob keeps running his half-yearly analysis;
  Intellegam consumes only the resulting dealer listing. Use
  `ssm-quotes-report/scripts/update_network_reference.py` to ingest each new
  listing into the monthly report's network reference. This skill is then not
  needed on the Intellegam side.
- **Path B (real automation of the 2-day job):** THIS skill runs inside IFM,
  by Rob himself, in IFM's own Claude — the raw file never leaves IFM. Rob's
  specific knowledge (the "idiosyncrasies") must be encoded into the pattern
  and mapping files below; a working session with Rob screen-sharing the raw
  file is the practical way to do that. The validation harness then proves the
  skill against his own Jan26 results.

**Update Sep 2026 (Rob's feedback on the first automated monthly report):**
Rob did not choose between Path A and B. His stated business need is
different: a *customer-facing output per client* (QBR / monthly project status
review template) built from the monthly SSM data — that lives in
`ssm-reporting-insights`, not here. Until Rob asks for Path B, treat Path A as
the operating mode: consume his dealer listing and keep
`network_reference.csv` (both copies, in `ssm-quotes-report` and
`ssm-reporting-insights`) current. Two reference changes are pending his
confirmation: remove Hyundai Sweden (cancelled Aug 2026, network 66) and add
the listing markets that never appear in the quote data (single-dealer
markets, ORA Ireland, Maxus Belgium) — Rob wants non-usage visible on the
dashboard rather than hidden.

`references/dealer_qty_targets.json` now contains **verified** Jan26 numbers
from Rob's own Excel (source: rob_jan26_excel). Note: two Grand Total cells in
his file are formula-range slips (Isuzu prints 127, rows sum to 205; Nissan
prints 1,623, rows sum to 1,823) — the per-market values are correct.

When the user runs this skill while it is still a draft, say so, produce the
best possible output, and clearly list which rules were applied as assumptions.

## Private data (not in this repository)

`references/dealer_qty_targets.json` in this repository is a structure-only
example. The real validation targets (per-market subscriber counts from the
IFM dealer listing) are distributed privately; drop them in under the same
file name before running the validation harness.

## Purpose

Twice a year (January & July) the "network" sizes used by the monthly SSM
quotes report must be refreshed from the subscriber base. The manual process
takes roughly 2 full days. The output feeds
`ssm-quotes-report/references/network_reference.csv` — after a successful run,
update that file too.

## Inputs

1. **Global Order Line Report** — attachment of the email "Global Order Line
   Report <DATE>" from the Infomedia data team; file like
   "<DATE> GLOBAL Order Lines … qty 112,207" (~110,000+ rows). Column layout
   unknown until a real file is seen — on first contact, print all columns and
   map them interactively (product/description, account/dealer name, bill-to,
   customer/client, country, price/tier, quantity).
2. **`references/product_patterns.csv`** — patterns identifying SSM subscription
   order lines.
3. **`references/exclusion_patterns.csv`** — patterns for non-dealer entities.
4. **`references/dealer_qty_targets.json`** — Jan26 expected results for
   validation.

## Process (from Rob's description)

1. Load the file; expect 110,000+ rows (sanity warning otherwise).
2. **Extract SSM subscribers** — order lines whose product matches:
   - `Superservice Menus LIVE [brand]` (per-dealer subscriptions)
   - `Superservice Menus LIVE Hyundai Enterprise (Provision)`
   - `Superservice Menus - Ford Europe Enterprise (Provision)`
   - `Microcat LIVE Toyota Europe Enterprise (Provisioning)` — Toyota's SSM is
     linked to the EPC product, so these count as SSM subscribers.
3. **Remove non-dealer entities**: QA accounts, internal accounts, DMS,
   training and NSC accounts (pattern list in `exclusion_patterns.csv` —
   extend it with whatever the real data shows; keep a log of what was
   removed and show it to the user).
4. Expected result: ~16,000 rows (sanity warning otherwise).
5. **Count dealers per customer (client/brand) and market**, honouring:
   - **Bill-to ≠ customer** in some cases (e.g. MPE) — mapping table needed
     from Rob (TODO).
   - **Enterprise customers** are billed centrally via provision set-up →
     zero-priced lines MUST be included, otherwise entire networks vanish.
   - **Two-tier priced customers**: count only the FIRST tier (do not
     double-count dealers appearing in both tiers).
6. Output workbook: one sheet per brand with country → dealer quantity, plus a
   summary sheet in the layout of "SSM Dealer Qty (Jan26)" and a reconciliation
   sheet listing every excluded entity and every applied special rule.

## Validation harness

When run on the **January 2026** file, compare per brand/market against
`references/dealer_qty_targets.json`:

- entries with `source=apr26_dashboard` are verified numbers;
- entries with `source=jan26_pdf_parse` (Toyota, Ford, Daihatsu) are
  machine-read from a PDF and only indicative.

Report the comparison like the quotes-report validation: rows identical /
rows differing / explanation per difference. Target: every difference either
zero or explained by a documented rule. Note: the Jan26 original prints an
Isuzu "Grand Total" of 127 although its own country rows sum to 205 (and 205
matches the verified April data) — another manual-formula slip; expect it.

## Open questions for Rob (blockers for final version)

1. Column layout of the Global Order Line Report (or just: one sample file).
2. The bill-to → customer mapping (which accounts, besides MPE, and what maps
   to what?).
3. Exact patterns/naming conventions for QA/internal/DMS/training/NSC accounts.
4. Which customers are two-tier priced, and how tiers are identified in the
   data.
5. Which enterprise customers exist besides Hyundai, Ford Europe, Toyota
   Europe (and how provision lines are recognised).
6. His original Jan26 Excel (not the PDF) as the definitive validation target.

## How to run

```
python3 scripts/analyze_subscribers.py <order_lines_file.xlsx|.csv> --outdir .
```

The script is column-mapping driven: on first run against an unknown file it
prints the columns it found and its best-guess mapping, and stops for
confirmation (`--assume-mapping` to proceed anyway). Adjust the mapping at the
top of the script or via `--map "product=Product Description" ...` once the
real layout is known.

## After a successful run

1. Deliver the workbook to the user (goes to the SAMs).
2. Update `network` values in
   `ssm-quotes-report/references/network_reference.csv` and note the date.
3. Remind the user this refresh is due again in ~6 months.
