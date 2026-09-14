#!/usr/bin/env python3
"""
Parallel-run comparison: manual report vs automated report, cell by cell.

For the agreed proof phase (Rob builds the monthly report manually, the skill
builds it automatically), this produces the evidence: every Dashboard cell
compared, every difference listed with both values, plus a verdict.

Rows are matched by (Brand, Country) so different row ordering does not matter.
Percent cells are compared at display precision (whole percent), numeric cells
exactly. Output: console summary + an xlsx diff report.

Usage:
    python3 diff_reports.py <manual_report.xlsx> <automated_report.xlsx> [--out diff.xlsx]
"""
import argparse
import math

import openpyxl
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

COLS = ["Network", "% active", "Active", "Quotes Made", "Av. Quotes", "% none", "NONE",
        "LOW %", "LOW dlrs", "LOW quotes", "MED %", "MED dlrs", "MED quotes",
        "HIGH %", "HIGH dlrs", "HIGH quotes"]
PCT_IDX = {1, 5, 7, 10, 13}   # compared at whole-percent display precision
AVG_IDX = {4}                  # compared at whole-number display precision


def disp(v, pct=False):
    if v is None:
        return None
    x = v * 100 if pct else v
    if isinstance(x, float):
        return int(math.floor(x + 0.5)) if x >= 0 else -int(math.floor(-x + 0.5))
    return x


def read_dashboard(path):
    wb = openpyxl.load_workbook(path)
    name = "Dashboard" if "Dashboard" in wb.sheetnames else wb.sheetnames[-1]
    out = {}
    for r in wb[name].iter_rows(min_row=1, values_only=True):
        if r and r[0] and r[1] and isinstance(r[2] if len(r) > 2 else None, (int, float)):
            out[(str(r[0]).strip(), str(r[1]).strip())] = list(r[2:20])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("manual")
    ap.add_argument("automated")
    ap.add_argument("--out", default="parallel_run_diff.xlsx")
    ap.add_argument("--ignore-blanks", action="store_true",
                    help="report blank-vs-value cells separately (layout/blank-convention "
                         "differences), not as numeric differences")
    args = ap.parse_args()

    man, auto = read_dashboard(args.manual), read_dashboard(args.automated)
    keys = sorted(set(man) | set(auto))
    diffs, blanks, identical = [], [], 0
    for k in keys:
        a, b = man.get(k), auto.get(k)
        if a is None or b is None:
            diffs.append((k, "row missing in " + ("manual" if a is None else "automated"), "", ""))
            continue
        row_diffs = []
        for i, col in enumerate(COLS):
            va = a[i] if i < len(a) else None
            vb = b[i] if i < len(b) else None
            pct = i in PCT_IDX
            da, db = disp(va, pct), disp(vb, pct)
            if i in AVG_IDX:
                da, db = disp(va), disp(vb)
            if da != db:
                if args.ignore_blanks and (da is None or db is None):
                    blanks.append((k, col, da, db))
                else:
                    row_diffs.append((col, da, db))
        if row_diffs:
            for col, da, db in row_diffs:
                diffs.append((k, col, da, db))
        else:
            identical += 1

    print(f"Rows compared: {len(keys)} | identical: {identical} | rows with differences: "
          f"{len(set(d[0] for d in diffs))} | differing cells: {len(diffs)}"
          + (f" | blank-vs-value cells (reported separately): {len(blanks)}"
             if args.ignore_blanks else ""))
    for k, col, da, db in diffs[:40]:
        print(f"  {k[0]} / {k[1]} — {col}: manual={da} vs automated={db}")
    if len(diffs) > 40:
        print(f"  ... and {len(diffs) - 40} more (see {args.out})")

    wb = Workbook()
    ws = wb.active
    ws.title = "Diff"
    for i, h in enumerate(["Brand", "Country", "Column", "Manual", "Automated"], 1):
        c = ws.cell(row=1, column=i, value=h)
        c.font = Font(name="Arial", bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="1F4E79")
    for r, (k, col, da, db) in enumerate(diffs, 2):
        ws.cell(row=r, column=1, value=k[0])
        ws.cell(row=r, column=2, value=k[1])
        ws.cell(row=r, column=3, value=col)
        ws.cell(row=r, column=4, value=da)
        ws.cell(row=r, column=5, value=db)
    ws.cell(row=len(diffs) + 3, column=1,
            value=f"Summary: {identical}/{len(keys)} rows identical.")
    wb.save(args.out)
    print(f"Diff report: {args.out}")


if __name__ == "__main__":
    main()
