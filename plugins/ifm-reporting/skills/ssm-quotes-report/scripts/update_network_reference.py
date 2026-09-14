#!/usr/bin/env python3
"""
Update network_reference.csv from Rob's "SSM Dealer listing" Excel
(the summary he derives from the half-yearly Global Order Line analysis,
sheet like "Summary (Jan26)" — multi-column layout with stacked
"Country | <Brand>" tables; Astara brands use "Astara | <Brand>" headers).

Usage:
    python3 update_network_reference.py "<2026 SSM Dealer listing.xlsx>" <network_reference.csv>

Behaviour:
- Updates the `network` value of every existing reference row found in the
  listing (matching on franchise + data country, "(RBU)" suffixes and the
  ORA "Baltic States" grouping handled).
- Prints rows in the reference that are missing from the listing, and
  brand/markets in the listing that are not yet on the dashboard (decide with
  Rob whether to add them as new reference rows).
- Never deletes rows automatically. Review the printed report, then commit.
- Also verifies the listing's own "Grand Total" cells and reports any that do
  not match the sum of their country rows (known slips: Isuzu, Nissan in the
  Jan26 file).
"""
import csv
import re
import sys

import openpyxl

# listing brand -> reference brand_label
LISTING2REF = {'Hyundai': 'Hyundai', 'Isuzu': 'Isuzu', 'Kia': 'Kia',
               'Mitsubishi': 'Mitsubishi', 'Nissan': 'Nissan', 'ORA': 'ORA/Havel',
               'Great Wall': 'Great Wall', 'KGM': 'KGM', 'Maxus': 'Maxus',
               'MG': 'MG', 'Subaru': 'Subaru', 'Suzuki': 'Suzuki'}
# brands present in the listing but NOT on the quotes dashboard (enterprise etc.)
NON_DASHBOARD = {'Toyota', 'Ford', 'Daihatsu', 'AFG'}
HEADER_WORDS = {'Country', 'Astara', 'AFG'}


def parse_listing(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[wb.sheetnames[0]]
    grid = [[c.value for c in row] for row in ws.iter_rows()]
    R = len(grid)
    C = max(len(r) for r in grid)
    tables, gtotals = {}, {}
    for col in range(C - 1):
        r = 0
        while r < R:
            cell = grid[r][col] if col < len(grid[r]) else None
            nxt = grid[r][col + 1] if col + 1 < len(grid[r]) else None
            if (isinstance(cell, str) and cell.strip() in HEADER_WORDS
                    and isinstance(nxt, str) and nxt.strip()
                    and not str(nxt).strip().isdigit()):
                brand = nxt.strip()
                if cell.strip() == 'AFG':
                    brand = 'AFG'
                r += 1
                d = tables.setdefault(brand, {})
                while r < R:
                    name = grid[r][col] if col < len(grid[r]) else None
                    val = grid[r][col + 1] if col + 1 < len(grid[r]) else None
                    if name is None or (isinstance(name, str)
                                        and name.strip() in HEADER_WORDS):
                        break
                    name = str(name).strip()
                    if name.lower().startswith('grand total'):
                        gtotals[brand] = val
                        r += 1
                        break
                    if val is not None:
                        d[name] = int(val)
                    r += 1
            else:
                r += 1
    return tables, gtotals


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    listing_path, ref_path = sys.argv[1], sys.argv[2]
    tables, gtotals = parse_listing(listing_path)

    print("Listing self-check (printed Grand Total vs sum of rows):")
    for b in sorted(tables):
        s = sum(tables[b].values())
        gt = gtotals.get(b)
        mark = 'OK' if gt in (None, s) else f'MISMATCH (printed {gt}, rows sum to {s})'
        print(f"  {b:12s} {s:5d}  {mark}")

    rows = list(csv.DictReader(open(ref_path, encoding='utf-8')))
    ref2listing = {v: k for k, v in LISTING2REF.items()}
    used = set()
    updated = missing = same = 0
    for r in rows:
        lb = ref2listing.get(r['brand_label'])
        if not lb or lb not in tables:
            continue
        dcs = r['data_countries'].split('|')
        vals = [tables[lb].get(c) for c in dcs]
        if all(v is None for v in vals):
            missing += 1
            print(f"  NOT IN LISTING: {r['brand_label']} / {r['country_label']} "
                  f"(keeping {r['network']}) - confirm with Rob")
            continue
        new = sum(v for v in vals if v is not None)
        for c in dcs:
            used.add((lb, c))
        if new != int(r['network']):
            print(f"  UPDATE {r['brand_label']} / {r['country_label']}: "
                  f"{r['network']} -> {new}")
            r['network'] = str(new)
            updated += 1
        else:
            same += 1

    print(f"\nUpdated {updated}, unchanged {same}, missing from listing {missing}.")
    print("\nIn listing but NOT on the dashboard (add to reference? ask Rob):")
    for b, d in sorted(tables.items()):
        if b in NON_DASHBOARD:
            continue
        for c, q in sorted(d.items()):
            if (b, c) not in used:
                print(f"  {LISTING2REF.get(b, b)} / {c}: {q}")

    with open(ref_path, 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=['group', 'brand_label', 'country_label',
                                           'franchise', 'data_countries', 'network'])
        w.writeheader()
        w.writerows(rows)
    print(f"\nSaved: {ref_path}")


if __name__ == '__main__':
    main()
