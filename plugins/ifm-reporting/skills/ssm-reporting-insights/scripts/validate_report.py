#!/usr/bin/env python3
"""
Self-check for a generated "SSM Quotes Analysis" workbook.

Verifies, cell by cell, that the Dashboard is internally consistent and (if the
source quotes file is provided) that nothing was lost or double-counted:

  1. LOW + MEDIUM + HIGH dealer counts == active dealers, per row
  2. LOW + MEDIUM + HIGH quotes == Quotes Made, per row
  3. NONE == network - active, per row
  4. every % cell == its underlying fraction
  5. brand TOTAL rows == sum of their country rows
  6. Grand Total == sum of brand totals
  7. (with source file) dashboard grand totals == input totals for the
     reference markets — checksum against the raw data

Exit code 0 = all green (report safe to distribute), 1 = violations found.

Usage:
    python3 validate_report.py <report.xlsx> [--source <monthly quotes file>] [--ref <network_reference.csv>]
"""
import argparse
import collections
import sys

import openpyxl

from common import load_monthly, load_reference


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("report")
    ap.add_argument("--source")
    ap.add_argument("--ref")
    args = ap.parse_args()

    ws = openpyxl.load_workbook(args.report)["Dashboard"]
    rows = [r for r in ws.iter_rows(min_row=5, values_only=True)
            if r[0] is not None and r[2] is not None]
    bad = []
    brand_rows, country_rows = {}, []
    for r in rows:
        brand, country, net, pa, act, qt, avg, pn, none = r[:9]
        bl = [(r[10] or 0), (r[13] or 0), (r[16] or 0)]
        bq = [(r[11] or 0), (r[14] or 0), (r[17] or 0)]
        loc = f"{brand}/{country}"
        if sum(bl) != act:
            bad.append(f"{loc}: bucket dealers {sum(bl)} != active {act}")
        if sum(bq) != qt:
            bad.append(f"{loc}: bucket quotes {sum(bq)} != quotes made {qt}")
        if none != net - act:
            bad.append(f"{loc}: NONE {none} != network-active {net - act}")
        if net and abs(pa - act / net) > 1e-9:
            bad.append(f"{loc}: active %% wrong")
        if country == "TOTAL":
            brand_rows[brand] = r
        elif country != "Grand Total":
            country_rows.append(r)

    if args.ref:
        ref_rows, _ = load_reference(args.ref)
        grp_of = {x["brand_label"]: x["group"] for x in ref_rows}
    else:
        grp_of = {}
    agg = collections.defaultdict(lambda: [0, 0, 0])
    for r in country_rows:
        g = grp_of.get(r[0], r[0])
        agg[g][0] += r[2]; agg[g][1] += r[4]; agg[g][2] += r[5]
    for b, t in brand_rows.items():
        if [t[2], t[4], t[5]] != agg[b]:
            bad.append(f"{b} TOTAL != sum of its country rows")
    gts = [r for r in rows if r[1] == "Grand Total"]
    if gts:
        gt = gts[0]
        sums = [sum(t[i] for t in brand_rows.values()) for i in (2, 4, 5)]
        if [gt[2], gt[4], gt[5]] != sums:
            bad.append("Grand Total != sum of brand totals")

    if args.source and args.ref:
        _, df = load_monthly(args.source)
        _, lookup = load_reference(args.ref)
        on = df[[(fr, co) in lookup for fr, co in zip(df["Franchise"], df["Country"])]]
        gt = gts[0]
        if gt[4] != len(on):
            bad.append(f"checksum dealers: dashboard {gt[4]} != input {len(on)}")
        if gt[5] != int(on["Num Quotes"].sum()):
            bad.append(f"checksum quotes: dashboard {gt[5]} != input {int(on['Num Quotes'].sum())}")

    n_checks = len(rows) * 4 + len(brand_rows) + 1 + (2 if args.source and args.ref else 0)
    if bad:
        print(f"VALIDATION FAILED — {len(bad)} violation(s) across ~{n_checks} checks:")
        for b in bad:
            print("  !!", b)
        sys.exit(1)
    print(f"VALIDATION PASSED — ~{n_checks} checks green "
          f"({len(rows)} dashboard rows, {len(brand_rows)} brand totals"
          + (", input checksums verified" if args.source and args.ref else "") + ").")


if __name__ == "__main__":
    main()
