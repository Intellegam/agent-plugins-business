#!/usr/bin/env python3
"""
SSM Subscribing Dealer Analysis — DRAFT automation of Rob's (IFM) half-yearly process.

Extracts SSM subscribers from the Global Order Line Report, removes non-dealer
entities, and produces dealer quantities per brand and market.

DRAFT STATUS: the Global Order Line Report's column layout is unknown until a
real file is available. The script auto-guesses a column mapping, prints it,
and stops for confirmation unless --assume-mapping is given. All business
rules marked TODO in SKILL.md are applied as configurable placeholders.

Usage:
    python3 analyze_subscribers.py <order_lines.xlsx|.csv> [--outdir DIR]
        [--assume-mapping] [--map key=ColumnName ...] [--validate targets.json]

Mapping keys: product, dealer, country, customer, billto, price, tier
"""
import argparse
import csv
import json
import re
import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
REFS = HERE.parent / "references"

# ---------------------------------------------------------------- mapping ---
# Best-guess synonyms for each logical field; refined once a real file is seen.
SYNONYMS = {
    "product": ["product", "product name", "product description", "item",
                "order line", "subscription", "description"],
    "dealer": ["dealer name", "account name", "account", "dealer", "company",
               "end user", "site name"],
    "country": ["country", "market", "dealer country"],
    "customer": ["customer", "client", "brand", "franchise", "customer name"],
    "billto": ["bill to", "bill-to", "billto", "billing account", "payer"],
    "price": ["price", "unit price", "net price", "amount", "line total"],
    "tier": ["tier", "price tier", "level", "band"],
}


def guess_mapping(columns):
    mapping = {}
    lower = {c.lower().strip(): c for c in columns}
    for key, names in SYNONYMS.items():
        for n in names:
            hit = next((orig for lc, orig in lower.items() if n in lc), None)
            if hit:
                mapping[key] = hit
                break
    return mapping


# ---------------------------------------------------------------- loading ---
def load(path):
    if str(path).lower().endswith(".csv"):
        return pd.read_csv(path, low_memory=False)
    return pd.read_excel(path)


def read_patterns(fname):
    rows = list(csv.DictReader(open(REFS / fname, encoding="utf-8")))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--outdir", default=".")
    ap.add_argument("--assume-mapping", action="store_true")
    ap.add_argument("--map", action="append", default=[],
                    help="override mapping, e.g. --map product=Product Description")
    ap.add_argument("--validate", default=str(REFS / "dealer_qty_targets.json"))
    args = ap.parse_args()

    df = load(args.input)
    print(f"Loaded {len(df):,} rows, {len(df.columns)} columns")
    if len(df) < 90_000:
        print(f"  WARNING: expected 110,000+ rows — is this the full global report?")

    mapping = guess_mapping(df.columns)
    for ov in args.map:
        k, v = ov.split("=", 1)
        mapping[k.strip()] = v.strip()

    print("\nColumn mapping (logical field -> file column):")
    for k in SYNONYMS:
        print(f"  {k:10s} -> {mapping.get(k, '?? NOT FOUND ??')}")
    missing = [k for k in ("product", "dealer", "country") if k not in mapping]
    if missing:
        sys.exit(f"\nERROR: cannot proceed without columns for {missing}. "
                 f"Use --map to assign them.")
    if not args.assume_mapping:
        print("\nDRAFT MODE: verify the mapping above against the real file, then "
              "re-run with --assume-mapping (or --map overrides).")
        print("Columns available:", list(df.columns))
        return

    prod = df[mapping["product"]].astype(str)

    # ---- step 2: SSM subscriber extraction --------------------------------
    pat_rows = read_patterns("product_patterns.csv")
    keep = pd.Series(False, index=df.index)
    for p in pat_rows:
        keep |= prod.str.contains(p["pattern"], case=False, regex=True, na=False)
    ssm = df[keep].copy()
    print(f"\nSSM subscriber lines: {len(ssm):,}")

    # ---- step 3: remove non-dealer entities -------------------------------
    excl_rows = read_patterns("exclusion_patterns.csv")
    name = ssm[mapping["dealer"]].astype(str)
    excluded = pd.Series(False, index=ssm.index)
    excl_log = []
    for e in excl_rows:
        hit = name.str.contains(e["pattern"], case=False, regex=True, na=False)
        if hit.any():
            excl_log.append((e["label"], int(hit.sum())))
        excluded |= hit
    removed = ssm[excluded]
    dealers = ssm[~excluded].copy()
    print(f"Removed non-dealer lines: {len(removed):,} "
          f"({', '.join(f'{l}: {n}' for l, n in excl_log) or 'none'})")
    print(f"Remaining dealer lines: {len(dealers):,} (expected ~16,000)")
    if not 12_000 <= len(dealers) <= 20_000:
        print("  WARNING: outside the usual ~16,000 range — check patterns.")

    # ---- step 5: business rules (DRAFT placeholders) ----------------------
    # TODO(Rob): bill-to != customer mapping (e.g. MPE) — references/billto_map.csv
    billto_map_file = REFS / "billto_map.csv"
    if billto_map_file.exists() and "billto" in mapping:
        bmap = {r["billto"]: r["customer"]
                for r in csv.DictReader(open(billto_map_file, encoding="utf-8"))}
        if "customer" in mapping:
            dealers[mapping["customer"]] = dealers.apply(
                lambda r: bmap.get(str(r[mapping["billto"]]),
                                   r[mapping["customer"]]), axis=1)
        print(f"Applied bill-to remapping for {len(bmap)} accounts.")
    else:
        print("NOTE: no billto_map.csv yet — bill-to != customer rule NOT applied (TODO Rob).")

    # TODO(Rob): two-tier pricing — keep first tier only. Placeholder: if a tier
    # column exists, keep the lowest tier value per dealer.
    if "tier" in mapping:
        dealers = dealers.sort_values(mapping["tier"]).drop_duplicates(
            subset=[mapping["dealer"], mapping["country"]], keep="first")
        print("Applied two-tier rule (kept first tier per dealer) — VERIFY with Rob.")
    else:
        # at minimum, one line per dealer+country so multi-line orders don't double-count
        before = len(dealers)
        dealers = dealers.drop_duplicates(subset=[mapping["dealer"], mapping["country"]])
        print(f"De-duplicated dealer+country: {before:,} -> {len(dealers):,} lines.")

    # NOTE: enterprise zero-priced lines are INCLUDED by design (never filter on price).

    # ---- brand attribution -------------------------------------------------
    def brand_of(product_text):
        t = str(product_text)
        if re.search(r"Microcat LIVE Toyota", t, re.I):
            return "Toyota"
        m = re.search(r"Superservice Menus(?: LIVE)?(?: -)?\s+([A-Za-z /]+?)"
                      r"(?:\s+Enterprise|\s*\(|$)", t, re.I)
        return m.group(1).strip().title() if m else "UNMAPPED"

    dealers["_brand"] = dealers[mapping["product"]].map(brand_of)
    un = (dealers["_brand"] == "UNMAPPED").sum()
    if un:
        print(f"  WARNING: {un} lines with unmapped brand — inspect products:")
        print(dealers.loc[dealers['_brand'] == 'UNMAPPED', mapping['product']]
              .value_counts().head(10).to_string())

    qty = (dealers.groupby(["_brand", mapping["country"]])[mapping["dealer"]]
           .nunique().rename("dealers").reset_index())

    # ---- output workbook ----------------------------------------------------
    outdir = Path(args.outdir)
    out = outdir / "SSM Dealer Qty (generated).xlsx"
    with pd.ExcelWriter(out) as xw:
        qty.pivot_table(index=mapping["country"], columns="_brand",
                        values="dealers", aggfunc="sum").to_excel(xw, sheet_name="Summary")
        for b, grp in qty.groupby("_brand"):
            grp.drop(columns="_brand").to_excel(
                xw, sheet_name=str(b)[:31], index=False)
        removed.to_excel(xw, sheet_name="Excluded entities", index=False)
    print(f"\nSaved: {out}")

    # ---- validation against targets ----------------------------------------
    tpath = Path(args.validate)
    if tpath.exists():
        targets = json.load(open(tpath, encoding="utf-8"))
        print("\nValidation vs targets (dealer_qty_targets.json):")
        got = {(r["_brand"], r[mapping["country"]]): r["dealers"]
               for _, r in qty.iterrows()}
        same = diff = 0
        for brand, e in targets.get("brands", {}).items():
            for market, expect in e["per_market"].items():
                g = got.get((brand, re.sub(r"\s*\(RBU\)$", "", market)))
                if g == expect:
                    same += 1
                else:
                    diff += 1
                    print(f"  DIFF {brand}/{market}: expected {expect}, got {g} "
                          f"[target source: {e['source']}]")
        print(f"  identical: {same}, differing: {diff}")
        print("  (differences against jan26_pdf_parse targets are only indicative)")


if __name__ == "__main__":
    main()
