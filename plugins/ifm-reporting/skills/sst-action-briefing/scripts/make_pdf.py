#!/usr/bin/env python3
"""Print the standalone briefing HTML to a paginated A4 PDF via headless Chromium.

Usage: python3 make_pdf.py <standalone.html> <output.pdf>
       [--title-fill PX] [--footer-fill PX] [--scale F]

Injects the tuned print stylesheet (one dark title page, then paired content
pages, tables never split), renders, and reports the page count. If the first
page cuts the opening statement or the last page shows a white strip, adjust:
  --title-fill  bottom padding of the title page's statement band (default 540;
                bigger fills more dark, too big pushes the statement to page 2)
  --footer-fill bottom padding of the footer (default 520)
Re-run until the page count is stable and page 1 holds the full statement.
"""
import sys, os, re

PRINT_CSS = """
<style>
@media print {
  .nav { display: none !important; }
  .hero { padding: 300px 0 150px; }
  .hero h1 { font-size: 100px; }
  .hero p { font-size: 17px; }
  .hero + .band { padding: 140px 0 %(title_fill)dpx; }
  .statement { font-size: 34px; }
  #opp1, #trend, #opp3 { break-before: page; }
  #opp4 + .band { break-before: page; padding: 70px 0 40px; }
  .sec { padding: 42px 0 22px; border-top: none; }
  #opp2, #opp4 { padding-top: 30px; border-top: 1px solid var(--grid); margin-top: 26px; }
  #plan { padding-top: 30px; }
  .sec h2 { font-size: 36px; }
  .sec .lede { font-size: 14.5px; margin-top: 8px; }
  .sec .eyebrow { font-size: 11.5px; margin-bottom: 8px; }
  .data { margin-top: 22px; gap: 26px; grid-template-columns: 1fr 210px; }
  table.kpi td { font-size: 13px; padding: 8px 0; }
  table.kpi th { font-size: 10px; padding-bottom: 7px; }
  .callout { padding: 12px 14px; }
  .callout__v { font-size: 23px; }
  .callout__l { font-size: 10px; }
  .duo { gap: 26px; margin-top: 20px; }
  .duo h5 { font-size: 10px; }
  table.mini { font-size: 11.5px; }
  table.mini td { padding: 5px 0 5px 12px; }
  table.mini td:first-child { padding-left: 0; }
  table.mini th { font-size: 9px; padding-bottom: 5px; padding-left: 12px; }
  table.mini th:first-child { padding-left: 0; }
  h4 { margin-top: 24px !important; font-size: 15px !important; }
  .action-static { margin-top: 20px; }
  .action-static__l { padding: 10px 0 3px; font-size: 10.5px; }
  .action-static .action__b { font-size: 12.5px; padding-bottom: 8px; line-height: 1.5; }
  .trends { margin-top: 22px; gap: 30px; }
  .trend h4 { margin-top: 0 !important; }
  .trend .note { font-size: 12px; margin-top: 8px; }
  .bars { height: 70px; margin-top: 24px; }
  .foot { padding: 40px 0 %(footer_fill)dpx; }
  .foot p { font-size: 13px; }
  .foot .fine { font-size: 9.5px; }
  table, .duo > div, .callout, .trend, .action-static, .data { break-inside: avoid; }
  h2, h4, h5 { break-after: avoid; }
}
</style>
</head>"""

def main():
    src, out = sys.argv[1], sys.argv[2]
    def arg(flag, default):
        return type(default)(sys.argv[sys.argv.index(flag)+1]) if flag in sys.argv else default
    title_fill, footer_fill, scale = arg("--title-fill", 540), arg("--footer-fill", 520), arg("--scale", 0.66)

    html = open(src).read().replace("</head>", PRINT_CSS % {"title_fill": title_fill, "footer_fill": footer_fill}, 1)
    tmp = src.replace(".html", "._print.html")
    open(tmp, "w").write(html)

    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        pg.goto("file://" + os.path.abspath(tmp))
        pg.wait_for_timeout(1200)
        pg.emulate_media(media="print")
        pg.pdf(path=out, format="A4", print_background=True, scale=scale,
               margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        b.close()
    os.remove(tmp)
    try:
        import pypdf
        print(f"written {out}: {len(pypdf.PdfReader(out).pages)} pages")
    except Exception:
        print(f"written {out}")

if __name__ == "__main__":
    main()
