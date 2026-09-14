#!/usr/bin/env python3
"""
SSM Quotes Created Usage Report — exact automation of Rob's (IFM) manual monthly process.

Replicates the status quo 1:1:
  Tab 1 "All Data"         : raw rows filtered to EUR + MEA regions
  Tab 2 "0 quote dealers"  : All Data rows with 0 quotes
  Tab 3 "1+ quote dealers" : All Data rows with 1+ quotes
  Tab 4 "Pivot"            : franchise/country counts & quote sums per usage bucket (Menus only)
  Tab 5 "Dashboard"        : the SSM Quote Analysis dashboard (identical layout to the
                             manual version incl. colour bands 0-59% / 60-79% / 80%+)

Usage:
    python3 build_ssm_report.py <quotes_file.csv|.xlsx> <network_reference.csv> <output.xlsx>

Business rules encoded (from Rob's process description, validated against Apr26 output):
  * Regions kept: Europe + MEA (APAC / AMERICAS dropped)
  * Dashboard uses App Source == "Menus" only ("Connect" discarded)
  * Usage buckets: NONE = 0 quotes, LOW = 1-19, MEDIUM = 20-99, HIGH = 100+
  * NONE dealer count = network size - active dealers (network from reference file)
  * Only brand/market combinations present in the network reference appear on the
    dashboard (anything else is reported as a warning, exactly as the manual
    process silently drops them)
  * Grand Total "Av. Quotes" = SUM of the brand-total averages (quirk of the
    original Excel formula, kept for 1:1 comparability)
"""
import sys
import csv
from collections import OrderedDict

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

REGIONS_KEPT = {"Europe", "MEA", "Middle East/Africa", "Middle East / Africa"}
APP_KEPT = "Menus"

# sanity ranges from Rob's work instruction (warnings only, never fatal)
SANITY = {
    "raw": (25_000, 30_000),
    "all_data": (20_000, 25_000),
    "zero": (10_000, 17_500),
    "one_plus": (7_500, 12_500),
}

FILL_HDR = PatternFill("solid", fgColor="D9D9D9")
FILL_TOTAL = PatternFill("solid", fgColor="F2F2F2")
# Dashboard colour scheme (Rob's original layout, Sep 2026 feedback):
# column groups carry their own colour, header darker / data rows lighter;
# Brand-Country-Network header and every TOTAL row are yellow.
FILL_YELLOW = PatternFill("solid", fgColor="FFFF00")
GROUP_FILLS = {                      # (first col, last col): (header, data)
    (4, 7):   ("5B9BD5", "DDEBF7"),  # Network Coverage - blue
    (8, 9):   ("D9D9D9", "F2F2F2"),  # NONE   - grey
    (10, 12): ("F4B183", "FBE5D6"),  # LOW    - orange
    (13, 15): ("C77DD1", "E9D3EE"),  # MEDIUM - purple
    (16, 18): ("A9D18E", "E2EFDA"),  # HIGH   - green
}
def _group_fill(col, header):
    for (a, b), (h, d) in GROUP_FILLS.items():
        if a <= col <= b:
            return PatternFill("solid", fgColor=h if header else d)
    return None
THIN = Border(*[Side(style="thin", color="BFBFBF")] * 4)


def warn(msg):
    print(f"  WARNING: {msg}")


def check_range(name, n):
    lo, hi = SANITY[name]
    if not lo <= n <= hi:
        warn(f"{name} has {n:,} rows - outside the usual range {lo:,}-{hi:,}. "
             f"Check the source file before distributing the report.")


def load_quotes(path):
    """Load a monthly quotes file, tolerating the schema variants seen in real
    exports (Jan-Mar26: 12 cols; Apr-Jun26: 11 cols, no DYNAMICS_ACCOUNT_ID;
    Jul26: 6 cols - 'Month' instead of 'Year Month', no REGION, no prices)."""
    if str(path).lower().endswith(".csv"):
        df = pd.read_csv(path)
    else:
        df = pd.read_excel(path)
    # normalise column-name variants seen across real monthly exports
    ALIASES = {
        "Month": "Year Month",              # Jul26-style export
        "APPLICATIONSOURCE": "App Source",  # May26-style export
        "APP_SOURCE": "App Source",
        "QUOTE_FRANCHISE": "Franchise",     # May26-style export
        "FRANCHISE": "Franchise",
        "COUNTRY": "Country",
        "Region": "REGION",
    }
    renames = {old: new for old, new in ALIASES.items()
               if old in df.columns and new not in df.columns}
    if renames:
        df = df.rename(columns=renames)
        warn(f"normalised column names: {renames}")
    required = {"Country", "Franchise", "App Source", "Num Quotes"}
    missing = required - set(df.columns)
    if missing:
        sys.exit(f"ERROR: quotes file is missing expected columns: {missing}")
    if "REGION" not in df.columns:
        warn("no REGION column - assuming the file is already EUR+MEA only "
             "(region filter skipped).")
    return df


def load_network(path):
    rows = list(csv.DictReader(open(path, encoding="utf-8")))
    for r in rows:
        r["network"] = int(r["network"])
        r["data_countries"] = r["data_countries"].split("|")
    return rows


def bucket_stats(quotes_series):
    q = quotes_series
    return {
        "low": (int(((q >= 1) & (q <= 19)).sum()), int(q[(q >= 1) & (q <= 19)].sum())),
        "med": (int(((q >= 20) & (q <= 99)).sum()), int(q[(q >= 20) & (q <= 99)].sum())),
        "high": (int((q >= 100).sum()), int(q[q >= 100].sum())),
    }


def write_data_tab(wb, title, df):
    ws = wb.create_sheet(title)
    ws.append(list(df.columns))
    for c in ws[1]:
        c.font = Font(bold=True)
        c.fill = FILL_HDR
    for row in df.itertuples(index=False):
        ws.append(list(row))
    ws.freeze_panes = "A2"
    return ws


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    quotes_path, network_path, out_path = sys.argv[1:4]

    print("Loading data ...")
    raw = load_quotes(quotes_path)
    network = load_network(network_path)

    n_raw = len(raw)
    print(f"  raw file: {n_raw:,} rows")
    if n_raw >= SANITY["raw"][0] * 0.8:
        check_range("raw", n_raw)
    else:
        warn(f"raw file has only {n_raw:,} rows - it looks pre-filtered "
             f"(the full monthly extract has 25,000-30,000 rows incl. APAC/AMERICAS "
             f"and 0-quote dealers). Proceeding with what is there.")

    # ---- Step 4: All Data = EUR + MEA only -------------------------------
    if "REGION" in raw.columns:
        all_data = raw[raw["REGION"].isin(REGIONS_KEPT)].copy()
    else:
        all_data = raw.copy()
    check_range("all_data", len(all_data))

    # ---- Steps 5/6: split by quote count ---------------------------------
    zero = all_data[all_data["Num Quotes"] == 0]
    one_plus = all_data[all_data["Num Quotes"] >= 1]
    if len(zero):
        check_range("zero", len(zero))
    check_range("one_plus", len(one_plus))
    print(f"  All Data {len(all_data):,} | 0 quote {len(zero):,} | 1+ quote {len(one_plus):,}")

    # ---- Steps 7-9: Menus only, per brand/market bucket stats ------------
    menus = one_plus[one_plus["App Source"] == APP_KEPT]

    # report month for the title
    month_title = ""
    if "Year Month" in raw.columns:
        try:
            month_title = pd.to_datetime(raw["Year Month"].iloc[0]).strftime("%B %Y")
        except Exception:
            month_title = str(raw["Year Month"].iloc[0])

    stats = []          # one entry per network-reference row
    used_keys = set()
    for ref in network:
        sel = menus[(menus["Franchise"] == ref["franchise"])
                    & (menus["Country"].isin(ref["data_countries"]))]
        q = sel["Num Quotes"]
        entry = {
            **ref,
            "active": len(sel),
            "quotes": int(q.sum()),
            **bucket_stats(q),
        }
        stats.append(entry)
        for c in ref["data_countries"]:
            used_keys.add((ref["franchise"], c))

    # markets in the data but not on the dashboard (status quo: dropped silently)
    dropped = (menus.groupby(["Franchise", "Country"])["Num Quotes"].agg(["count", "sum"]))
    for (fr, co), r in dropped.iterrows():
        if (fr, co) not in used_keys:
            warn(f"not on dashboard (market not in network reference): "
                 f"{fr} / {co} - {r['count']} active dealers, {int(r['sum'])} quotes")

    # ---- Build workbook ---------------------------------------------------
    wb = Workbook()
    wb.remove(wb.active)
    write_data_tab(wb, "All Data", all_data)
    write_data_tab(wb, "0 quote dealers", zero)
    write_data_tab(wb, "1+ quote dealers", one_plus)

    # Pivot tab (intermediate step of the manual process, kept for traceability)
    pv = wb.create_sheet("Pivot")
    pv.append(["Franchise", "Country (dashboard label)",
               "Active dealers", "Total quotes",
               "Low dealers (1-19)", "Low quotes",
               "Medium dealers (20-99)", "Medium quotes",
               "High dealers (100+)", "High quotes"])
    for c in pv[1]:
        c.font = Font(bold=True)
        c.fill = FILL_HDR
    for s in stats:
        pv.append([s["franchise"], s["country_label"], s["active"], s["quotes"],
                   s["low"][0], s["low"][1], s["med"][0], s["med"][1],
                   s["high"][0], s["high"][1]])
    pv.freeze_panes = "A2"

    # ---- Dashboard --------------------------------------------------------
    ws = wb.create_sheet("Dashboard")
    title = f"SSM Quote Analysis - {month_title}" if month_title else "SSM Quote Analysis"
    ws["A1"] = title
    ws["A1"].font = Font(bold=True, size=14)

    # header block (3 rows), matching the manual layout
    ws.merge_cells("D2:G2"); ws["D2"] = "Network Coverage - Active Dealers"
    ws.merge_cells("H2:I2"); ws["H2"] = "Usage = NONE"
    ws.merge_cells("J2:L2"); ws["J2"] = "Usage = LOW"
    ws.merge_cells("M2:O2"); ws["M2"] = "Usage = MEDIUM"
    ws.merge_cells("P2:R2"); ws["P2"] = "Usage = HIGH"
    ws.merge_cells("D3:G3")
    ws.merge_cells("H3:I3"); ws["H3"] = "0 quotes"
    ws.merge_cells("J3:L3"); ws["J3"] = "1 to 19 quotes pcm"
    ws.merge_cells("M3:O3"); ws["M3"] = "20 to 99 quotes pcm"
    ws.merge_cells("P3:R3"); ws["P3"] = "100+ quotes pcm"
    hdr4 = ["Brand", "Country", "Network", "%", "Total", "Quotes Made", "Av. Quotes",
            "%", "Total", "%", "Dlrs", "Quotes", "%", "Dlrs", "Quotes", "%", "Dlrs", "Quotes"]
    for i, h in enumerate(hdr4, start=1):
        ws.cell(row=4, column=i, value=h)
    for r in (2, 3, 4):
        for c in range(1, 19):
            cell = ws.cell(row=r, column=c)
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal="center", wrap_text=True)
            if c <= 3:
                if r == 4:
                    cell.fill = FILL_YELLOW
            else:
                cell.fill = _group_fill(c, header=True)

    PCT, INT0, NUM = "0%", "0", "#,##0"

    def put(row, col, value, fmt=NUM, bold=False, fill=None):
        cell = ws.cell(row=row, column=col, value=value)
        cell.number_format = fmt
        cell.alignment = Alignment(horizontal="center" if col >= 3 else "left")
        if bold:
            cell.font = Font(bold=True)
        f = fill if fill else _group_fill(col, header=False)
        if f:
            cell.fill = f

    def write_row(r, brand, country, net, active, quotes, buckets, bold=False,
                  avg_override=None):
        fill = FILL_YELLOW if bold else None
        put(r, 1, brand, "@", bold, fill)
        put(r, 2, country, "@", bold, fill)
        put(r, 3, net, NUM, bold, fill)
        put(r, 4, (active / net) if net else 0, PCT, bold, fill)
        put(r, 5, active, NUM, bold, fill)
        put(r, 6, quotes, NUM, bold, fill)
        if avg_override is not None:
            put(r, 7, avg_override, INT0, bold, fill)
        else:
            put(r, 7, (quotes / active) if active else 0, INT0, bold, fill)
        put(r, 8, ((net - active) / net) if net else 0, PCT, bold, fill)
        put(r, 9, net - active, NUM, bold, fill)
        col = 10
        for key in ("low", "med", "high"):
            dl, qs = buckets[key]
            if dl or bold:
                put(r, col, (dl / net) if net else 0, PCT, bold, fill)
                put(r, col + 1, dl, NUM, bold, fill)
                put(r, col + 2, qs, NUM, bold, fill)
            else:
                for cc in range(col, col + 3):
                    put(r, cc, None, NUM, bold, fill)
            col += 3

    # group stats -> brand TOTAL row + country rows (reference order)
    groups = OrderedDict()
    for s in stats:
        groups.setdefault(s["group"], []).append(s)

    row = 5
    grand = dict(net=0, active=0, quotes=0, avg_sum=0.0,
                 low=[0, 0], med=[0, 0], high=[0, 0])
    for gname, members in groups.items():
        tot = dict(net=sum(m["network"] for m in members),
                   active=sum(m["active"] for m in members),
                   quotes=sum(m["quotes"] for m in members))
        tbuck = {k: (sum(m[k][0] for m in members), sum(m[k][1] for m in members))
                 for k in ("low", "med", "high")}
        write_row(row, gname, "TOTAL", tot["net"], tot["active"], tot["quotes"],
                  tbuck, bold=True)
        row += 1
        for m in members:
            write_row(row, m["brand_label"], m["country_label"], m["network"],
                      m["active"], m["quotes"],
                      {k: m[k] for k in ("low", "med", "high")})
            row += 1
        grand["net"] += tot["net"]; grand["active"] += tot["active"]
        grand["quotes"] += tot["quotes"]
        grand["avg_sum"] += (tot["quotes"] / tot["active"]) if tot["active"] else 0
        for k in ("low", "med", "high"):
            grand[k][0] += tbuck[k][0]; grand[k][1] += tbuck[k][1]

    write_row(row, "Grand Total", "Grand Total", grand["net"], grand["active"],
              grand["quotes"], {k: tuple(grand[k]) for k in ("low", "med", "high")},
              bold=True, avg_override=grand["avg_sum"])
    last_data_row = row

    widths = [14, 22, 9, 7, 8, 12, 10, 7, 8, 7, 7, 9, 7, 7, 9, 7, 7, 9]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A5"

    # print setup so a PDF export matches the manual handout
    ws.print_title_rows = "1:4"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True

    wb.save(out_path)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
