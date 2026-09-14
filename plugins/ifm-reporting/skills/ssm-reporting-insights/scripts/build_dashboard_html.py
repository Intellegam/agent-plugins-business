#!/usr/bin/env python3
"""
One-page HTML dashboard — the simplest possible view of SSM usage for
management and SAMs. Same numbers as the Insights workbook, rendered as a
self-contained HTML file (inline CSS, no external dependencies) that can be
shared, opened on any device, or shown in a meeting.

Structure (deliberately minimal — one screen, no tabs):
  KPI row -> monthly trend sparklines -> ACT NOW (falling markets)
  -> CAMPAIGN TARGETS -> WHAT WORKS -> data-quality footnote.

Usage:
    python3 build_dashboard_html.py --ref <network_reference.csv> --out dashboard.html
        <monthly files, oldest first...>
"""
import argparse
import collections
import html as H

from common import load_monthly, load_reference


def sparkline(values, width=220, height=44, color="#2a78d6"):
    if not values or max(values) == 0:
        return ""
    lo, hi = min(values), max(values)
    rng = (hi - lo) or 1
    pts = []
    for i, v in enumerate(values):
        x = 6 + i * (width - 12) / (len(values) - 1 if len(values) > 1 else 1)
        y = height - 8 - (v - lo) / rng * (height - 16)
        pts.append(f"{x:.1f},{y:.1f}")
    dots = "".join(f'<circle cx="{p.split(",")[0]}" cy="{p.split(",")[1]}" r="2.5" fill="{color}"/>'
                   for p in (pts[0], pts[-1]))
    return (f'<svg width="{width}" height="{height}" role="img">'
            f'<polyline points="{" ".join(pts)}" fill="none" stroke="{color}" stroke-width="2"/>'
            f'{dots}</svg>')


def bar(pct, color):
    return (f'<div class="bar"><div class="fill" '
            f'style="width:{max(2, pct*100):.0f}%;background:{color}"></div></div>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--ref", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--min-network", type=int, default=20)
    args = ap.parse_args()

    ref_rows, lookup = load_reference(args.ref)
    net = {(r["brand_label"], r["country_label"]): r["network"] for r in ref_rows}
    months, act, qts, dropped = [], collections.defaultdict(dict), collections.defaultdict(dict), {}
    for f in args.files:
        m, df = load_monthly(f)
        months.append(m)
        drop_d = drop_q = 0
        dash_fr = {x["franchise"] for x in ref_rows}
        for (fr, co), grp in df.groupby(["Franchise", "Country"]):
            r = lookup.get((fr, co))
            if r is None:
                if fr in dash_fr:
                    drop_d += len(grp)
                    drop_q += int(grp["Num Quotes"].sum())
                continue
            key = (r["brand_label"], r["country_label"])
            act[key][m] = act[key].get(m, 0) + len(grp)
            qts[key][m] = qts[key].get(m, 0) + int(grp["Num Quotes"].sum())
        dropped[m] = (drop_d, drop_q)

    first, last = months[0], months[-1]
    total_net = sum(net.values())
    act_series = [sum(act[k].get(m, 0) for k in net) for m in months]
    q_series = [sum(qts[k].get(m, 0) for k in net) for m in months]
    deltas = [(k, (act[k].get(last, 0) - act[k].get(first, 0)) / n)
              for k, n in net.items() if n >= args.min_network]
    falling = sorted([x for x in deltas if x[1] <= -0.05], key=lambda x: x[1])[:5]
    rising = sorted([x for x in deltas if x[1] >= 0.05], key=lambda x: -x[1])[:3]
    worst = sorted(((k, n) for k, n in net.items() if n >= args.min_network),
                   key=lambda kn: act[kn[0]].get(last, 0) / kn[1])[:5]

    def market_rows(items, kind):
        out = []
        for item in items:
            if kind == "delta":
                k, d = item
                p0 = act[k].get(first, 0) / net[k]
                p1 = act[k].get(last, 0) / net[k]
                color = "#d03b3b" if d < 0 else "#0ca30c"
                out.append(f'<div class="row"><span class="mk">{H.escape(k[0]+" "+k[1])}</span>'
                           f'{bar(p1, color)}<span class="val">{p0:.0%} → {p1:.0%} '
                           f'<b>({d:+.0%})</b></span></div>')
            else:
                k, n = item
                p = act[k].get(last, 0) / n
                out.append(f'<div class="row"><span class="mk">{H.escape(k[0]+" "+k[1])}</span>'
                           f'{bar(p, "#eda100" if p else "#d03b3b")}'
                           f'<span class="val"><b>{p:.0%}</b> of {n} · '
                           f'{qts[k].get(last,0):,} quotes</span></div>')
        return "".join(out)

    q_delta = (q_series[-1] - q_series[-2]) / q_series[-2] if len(q_series) > 1 and q_series[-2] else 0
    inv_d, inv_q = dropped.get(last, (0, 0))

    page = f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SSM Usage Dashboard — {H.escape(last)}</title><style>
:root{{color-scheme:light;--page:#f9f9f7;--card:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;
--muted:#898781;--line:#e1e0d9;--border:rgba(11,11,11,.10);--blue:#2a78d6}}
@media(prefers-color-scheme:dark){{:root{{color-scheme:dark;--page:#0d0d0d;--card:#1a1a19;
--ink:#fff;--ink2:#c3c2b7;--line:#2c2c2a;--border:rgba(255,255,255,.10);--blue:#3987e5}}}}
*{{box-sizing:border-box;margin:0}}body{{background:var(--page);color:var(--ink);
font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:28px 20px 40px;line-height:1.45}}
.wrap{{max-width:860px;margin:0 auto}}h1{{font-size:22px}}.sub{{color:var(--ink2);font-size:13px;margin-top:4px}}
.kpis{{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:20px 0}}
.kpi{{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 14px}}
.kpi .l{{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}}
.kpi .v{{font-size:20px;font-weight:700;margin-top:2px}}.kpi .s{{font-size:11.5px;color:var(--ink2)}}
.cards{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}
.card{{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 16px}}
.card h2{{font-size:13px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px}}
.card.full{{grid-column:1/-1}}
.row{{display:grid;grid-template-columns:180px 1fr 170px;gap:10px;align-items:center;
padding:5px 0;border-bottom:1px solid var(--line);font-size:13px}}
.row:last-child{{border-bottom:none}}.mk{{font-weight:600}}
.bar{{height:8px;background:var(--line);border-radius:4px;overflow:hidden}}
.fill{{height:100%;border-radius:4px}}
.val{{text-align:right;color:var(--ink2)}}.val b{{color:var(--ink)}}
.spark{{display:flex;gap:28px;align-items:flex-end}}
.spark .lbl{{font-size:11.5px;color:var(--muted)}}
.foot{{margin-top:14px;font-size:12px;color:var(--ink2);background:var(--card);
border:1px solid var(--border);border-left:4px solid #eda100;border-radius:8px;padding:10px 14px}}
.red h2{{color:#d03b3b}}.grn h2{{color:#0ca30c}}.amb h2{{color:#b47b00}}
@media(max-width:700px){{.kpis{{grid-template-columns:1fr 1fr}}.cards{{grid-template-columns:1fr}}
.row{{grid-template-columns:1fr}}.val{{text-align:left}}}}
</style></head><body><div class="wrap">
<h1>SSM Usage — what matters this month</h1>
<div class="sub">{H.escape(first)} – {H.escape(last)} · Menus app only · {len(net)} brand/markets · same definitions as the monthly report</div>
<div class="kpis">
<div class="kpi"><div class="l">Network</div><div class="v">{total_net:,}</div><div class="s">dealers subscribed</div></div>
<div class="kpi"><div class="l">Active</div><div class="v">{act_series[-1]/total_net:.0%}</div><div class="s">{act_series[-1]:,} dealers in {H.escape(last)}</div></div>
<div class="kpi"><div class="l">Quotes</div><div class="v">{q_series[-1]:,}</div><div class="s">{q_delta:+.0%} vs prior month</div></div>
<div class="kpi"><div class="l">Falling</div><div class="v">{len([x for x in deltas if x[1]<=-0.05])}</div><div class="s">markets down ≥5pp since {H.escape(first)}</div></div>
<div class="kpi"><div class="l">Invisible</div><div class="v">{inv_q:,}</div><div class="s">quotes outside network list ({inv_d} dealers)</div></div>
</div>
<div class="cards">
<div class="card full"><h2>Trend — whole network</h2><div class="spark">
<div><div class="lbl">Active dealers per month ({act_series[0]:,} → {act_series[-1]:,})</div>{sparkline(act_series)}</div>
<div><div class="lbl">Quotes per month ({q_series[0]:,} → {q_series[-1]:,})</div>{sparkline(q_series)}</div>
</div></div>
<div class="card red"><h2>Act now — falling markets</h2>{market_rows(falling, "delta") or '<div class="sub">none ≥5pp</div>'}</div>
<div class="card amb"><h2>Campaign targets — lowest activation</h2>{market_rows(worst, "worst")}</div>
<div class="card grn"><h2>What works — biggest improvements</h2>{market_rows(rising, "delta") or '<div class="sub">none ≥5pp</div>'}</div>
<div class="card"><h2>How to read this</h2>
<div class="sub" style="font-size:12.5px">Active = dealer made ≥1 quote in the month. Categories as in the monthly
report (LOW 1–19 · MEDIUM 20–99 · HIGH 100+). "Falling" compares {H.escape(last)} with {H.escape(first)}.
Bars show current activation vs network size. Full detail lives in the Insights workbook
(Trends · Worst Markets · Data Quality · Journey).</div></div>
</div>
<div class="foot"><b>Data quality:</b> {inv_q:,} quotes from {inv_d} dealers of dashboard brands are not on any
report because their markets are missing from the network reference — review them in the Data Quality tab
and decide with Rob whether to add them.</div>
</div></body></html>"""
    open(args.out, "w", encoding="utf-8").write(page)
    print(f"Saved: {args.out}")


if __name__ == "__main__":
    main()
