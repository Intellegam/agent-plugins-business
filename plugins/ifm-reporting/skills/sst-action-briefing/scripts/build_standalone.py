#!/usr/bin/env python3
"""Assemble a self-contained briefing HTML: inline the token CSS, three
Montserrat weights (400/500/600) and the two logo SVGs into one file.

Usage: python3 build_standalone.py <body.html> <output.html> [--assets DIR]

The body file uses three placeholders: {{CSS}} in <head>, and
{{LOGO_DARK}} / {{LOGO_LIGHT}} wherever a wordmark <img src> is needed.
"""
import base64, re, sys, os

def b64(path, mime):
    with open(path, "rb") as f:
        return f"data:{mime};base64," + base64.b64encode(f.read()).decode()

def main():
    body_path, out_path = sys.argv[1], sys.argv[2]
    assets = sys.argv[sys.argv.index("--assets")+1] if "--assets" in sys.argv else \
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")

    html = open(body_path).read()
    css = open(os.path.join(assets, "colors_and_type.css")).read()

    keep = {"Montserrat-Regular.ttf", "Montserrat-Medium.ttf", "Montserrat-SemiBold.ttf"}
    out = []
    for ln in css.split("\n"):
        if "@font-face" in ln and "Montserrat" in ln:
            m = re.search(r"fonts/(Montserrat-[A-Za-z]+\.ttf)", ln)
            if m and m.group(1) in keep:
                uri = b64(os.path.join(assets, "fonts", m.group(1)), "font/ttf")
                out.append(ln.replace(f"fonts/{m.group(1)}", uri))
            # other weights dropped: unused by the briefing, saves ~4 MB
        else:
            out.append(ln)

    html = html.replace("{{CSS}}", "<style>\n" + "\n".join(out) + "\n</style>")
    html = html.replace("{{LOGO_DARK}}", b64(os.path.join(assets, "logo-wordmark-dark.svg"), "image/svg+xml"))
    html = html.replace("{{LOGO_LIGHT}}", b64(os.path.join(assets, "logo-wordmark-light.svg"), "image/svg+xml"))

    leftover = re.findall(r"\{\{[A-Z_]+\}\}|assets/[^\"')]+", html)
    if leftover:
        print("WARNING unresolved refs:", leftover[:5])
    open(out_path, "w").write(html)
    print(f"written {out_path} ({os.path.getsize(out_path)/1e6:.2f} MB)")

if __name__ == "__main__":
    main()
