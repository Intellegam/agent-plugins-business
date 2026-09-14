# Section catalogue — data modules, formulas, list rules

The briefing has a fixed rhythm: dark title page → statement band → one section
per lever → closing statement band → steering table → dark footer. Include only
levers whose data exists for the edition's month; name the excluded clients in
the footer ("they join the <next month> edition"). Column-name quirks, code
prefixes and Total/Grand-Total handling follow the `sst-kpi-report` skill's
parse rules; MoM formulas follow `sst-reporting-insights`.

## Lever 1 — Money on the table (`#opp1`)

- Per network: `Identified = Σ Total P&L Identified`, `Unsold = Identified − Σ Total P&L Sold`, share unsold.
- Summary table: one row per network with data this month (keep currencies apart — never convert).
- Per network a `duo` block: **Top 5 best converters** = highest % sold with
  Identified > €20k (the volume floor keeps 1-job-100% dealers out of the
  benchmark); **Worst 5** = largest Unsold € (rank by € at stake, not by
  percentage — a 70 % seller with huge volume outranks a 20 % seller with none).
- Accent callout: total unsold across the covered networks; second callout: the
  best in-network conversion as the "proven possible" number.

## Trend interlude (`#trend`)

- Needs ≥ 2 months of history (the KMUK annual workbook carries its own; other
  clients need archived prior editions). First edition: skip the section and say
  "trends start next month" — never invent a baseline.
- Bar pairs: one declining and one improving dealer (biggest |Δpp| × volume),
  values labelled above each bar, months below. Then the full per-dealer table:
  series · trend arrow (▲ > +1 pp, ▼ < −1 pp, → else, first→last) · unsold in
  the edition month.

## Lever 2 — Banding intelligence (`#opp2`, Nissan Germany)

- Recompute scores from the raw Bandingrepgen export (spec in sst-kpi-report's
  banding-spec.md: Nissan + Germany only, blanks score 0, values-only).
- Findings table: network-wide failing criteria (count = all dealers), Band E
  count, near-miss count. Top 5 = highest score, each with its failing
  criteria named (that's the coaching agenda). Worst 5 = score 0 with the
  highest throughput (wasted volume first).
- Action must lead with the data-mapping check when a criterion fails
  network-wide — never send the client accusations built on an unverified metric.

## Lever 3 — Adoption gaps (`#opp3`)

- `Active` = Throughput > 10 in the month. Gaps: Completed = 0 · Completed > 0
  with Send-Inspection = 0 · Completed > 0 with Videos = 0.
- Top 5 = highest completion count/rate (in-network proof), Worst 5 = silent
  dealers by throughput desc (the call list, biggest wasted volume first).
- Where the client pays a usage fee (NGER €200/mo), say so — the list IS that service.

## Lever 4 — Churn early-warning (`#opp4`)

- From the month's log-in report: counts per trend label (Increasing /
  Decreasing / Stopped; blank = no label). Top 5 most active, Worst 5 stopped
  (dedupe by user/dealer, rank by prior volume) with the full 4-week series —
  that series is what makes the call credible.

## Steering table (`#plan`)

One row per lever: the month's list · owner · **one metric that must move by
the next edition** (e.g. "T-IRE 56 % → 60 %+ sold", "4 / 4 contacted"). Close
with "The monthly rhythm": movement between editions, not absolute numbers, is
the steering signal.

## Voice & guardrails

- English, INTELLEGAM register: short sentences, numbers lead, no hype, no emoji.
- Statement bands use the em-dash reframe: `[observation] — [punchline]`, the
  punchline in the accent span.
- Every dealer figure must be recomputed from the source files — never carried
  over from a previous edition or estimated. Footer lists the exact source
  files. Internal document: dealer names and fees may appear; it is not
  client-facing without per-client rework.
- No automation/effort-savings content — the briefing is about the data and the
  steering, nothing else.
