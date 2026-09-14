"""Shared helpers for the SSM reporting insights scripts."""
import csv
import re
from pathlib import Path

import pandas as pd

# column-name variants seen across real monthly exports (Jan-Jul 2026)
ALIASES = {
    "Month": "Year Month",
    "APPLICATIONSOURCE": "App Source",
    "APP_SOURCE": "App Source",
    "QUOTE_FRANCHISE": "Franchise",
    "FRANCHISE": "Franchise",
    "COUNTRY": "Country",
    "Region": "REGION",
}
APP_KEPT = "Menus"
REGIONS_KEPT = {"Europe", "MEA", "Middle East/Africa", "Middle East / Africa"}

CAT_BOUNDS = [(0, 0, "NONE"), (1, 19, "LOW"), (20, 99, "MEDIUM"), (100, 10**9, "HIGH")]


def category(q):
    q = int(q)
    for lo, hi, name in CAT_BOUNDS:
        if lo <= q <= hi:
            return name
    return "HIGH"


CAT_RANK = {"NONE": 0, "LOW": 1, "MEDIUM": 2, "HIGH": 3}


def load_monthly(path):
    """Load one monthly quotes file, normalise columns, return (month_label, df_menus_eur_mea)."""
    p = str(path)
    df = pd.read_csv(p) if p.lower().endswith(".csv") else pd.read_excel(p)
    renames = {o: n for o, n in ALIASES.items() if o in df.columns and n not in df.columns}
    if renames:
        df = df.rename(columns=renames)
    required = {"Country", "Franchise", "App Source", "Num Quotes"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{Path(p).name}: missing columns {missing}")
    if "REGION" in df.columns:
        df = df[df["REGION"].isin(REGIONS_KEPT)]
    df = df[df["App Source"] == APP_KEPT].copy()
    df["Country"] = df["Country"].astype(str).str.strip()
    if "Dealer Name" in df.columns:
        df["Dealer Name"] = df["Dealer Name"].astype(str).str.strip()
    month = ""
    if "Year Month" in df.columns and len(df):
        try:
            month = pd.to_datetime(df["Year Month"].iloc[0]).strftime("%b %Y")
        except Exception:
            month = str(df["Year Month"].iloc[0])
    return month or Path(p).stem, df


def load_reference(path):
    """Load network_reference.csv; returns rows + a (franchise, country) -> row lookup."""
    rows = list(csv.DictReader(open(path, encoding="utf-8")))
    lookup = {}
    for r in rows:
        r["network"] = int(r["network"])
        for c in r["data_countries"].split("|"):
            lookup[(r["franchise"], c)] = r
    return rows, lookup


def strip_rbu(label):
    return re.sub(r"\s*\(RBU\)$", "", label)
