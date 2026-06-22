#!/usr/bin/env python3
"""Scrape the Mapbox GL JS guides + API reference into local markdown.

Enumerates the real (server-rendered) doc pages from the Mapbox GL JS sitemap,
extracts each page's <article> body, and converts it to GitHub-flavored markdown
with pandoc. Output mirrors the doc hierarchy under docs/mapbox-gl-js/.

Usage:  python3 scripts/scrape_mapbox_docs.py
"""
from __future__ import annotations

import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup

SITEMAP = "https://docs.mapbox.com/mapbox-gl-js/sitemap.xml"
BASE = "https://docs.mapbox.com/mapbox-gl-js/"
OUT = Path(__file__).resolve().parent.parent / "docs" / "mapbox-gl-js"
UA = {"User-Agent": "Mozilla/5.0 (docs scraper for local reference)"}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def list_pages() -> list[str]:
    """Guide + API page URLs from the sitemap (skip -md twins, examples, indexes dupes)."""
    xml = fetch(SITEMAP)
    urls = set(re.findall(r"https://docs\.mapbox\.com/mapbox-gl-js/(?:guides|api)/[a-z0-9/-]*", xml))
    pages = []
    for u in urls:
        path = u[len(BASE):].rstrip("/")
        if not path or path.endswith("-md"):   # skip section roots handled below & md twins
            continue
        pages.append(u.rstrip("/") + "/")
    # add the two section landing pages explicitly
    pages += [BASE + "guides/", BASE + "api/"]
    return sorted(set(pages))


_KEEP_ATTRS = {"a": {"href"}, "img": {"src", "alt"}, "pre": {"class"}, "code": {"class"}}
_TOC_RE = re.compile(r"(?m)^On this page\s*$\n(?:^\s*[-*] \[[^\]]*\]\(#[^)]*\)\s*$\n?)+")


def _clean(article) -> None:
    """Strip Docusaurus UI cruft so the markdown is clean reference text."""
    for el in article.select(
            "script, style, button, nav, svg, [clipboard-text], [aria-label=Copy]"):
        el.decompose()
    # Heading anchors: <h2><a ...>Text</a></h2> -> <h2>Text</h2>.
    for h in article.find_all(["h1", "h2", "h3", "h4", "h5", "h6"]):
        for a in h.find_all("a"):
            a.replace_with(a.get_text())
    # Real code-fence language lives on <pre class="prism-code language-js ...">.
    # Keep only the bare language token so pandoc emits ```js (not ```language-js).
    for tag in article.find_all(["pre", "code"]):
        langs = [c[9:] for c in (tag.get("class") or []) if c.startswith("language-")]
        if langs:
            tag["class"] = [langs[0]]
        elif "class" in tag.attrs:
            del tag["class"]
    # Drop noisy attributes (class/style/id/data-*), keeping only what markdown needs.
    for tag in article.find_all(True):
        tag.attrs = {k: v for k, v in tag.attrs.items()
                     if k in _KEEP_ATTRS.get(tag.name, set())}
    # Unwrap layout containers so they do not pass through as raw HTML.
    for tag in article.find_all(["div", "span", "section"]):
        tag.unwrap()


def to_markdown(html: str, url: str) -> str | None:
    soup = BeautifulSoup(html, "html.parser")
    if soup.title and "404" in soup.title.get_text():
        return None
    article = soup.find("div", class_="theme-doc-markdown") or soup.find("article")
    if article is None:
        return None
    _clean(article)
    md = subprocess.run(
        ["pandoc", "-f", "html", "-t", "gfm", "--wrap=none"],
        input=article.decode_contents(),           # inner HTML, drops the root wrapper
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    md = _TOC_RE.sub("", md)                        # drop the "On this page" TOC
    md = re.sub(r"(?m)^\s*</?div[^>]*>\s*$\n?", "", md)  # strip leftover wrapper divs
    md = md.replace("​", "")                   # drop heading anchor zero-width spaces
    md = re.sub(r"\n{3,}", "\n\n", md).strip()      # collapse blank runs
    return f"<!-- Source: {url} -->\n\n{md}\n"


def dest(url: str) -> Path:
    rel = url[len(BASE):].rstrip("/") or "index"
    return OUT / (rel + ".md")


def main() -> int:
    pages = list_pages()
    print(f"discovered {len(pages)} pages")
    saved = skipped = 0
    for url in pages:
        try:
            md = to_markdown(fetch(url), url)
        except Exception as e:  # noqa: BLE001 - report and continue
            print(f"  ERR  {url}  ({e})")
            skipped += 1
            continue
        if not md or len(md) < 200:
            print(f"  skip {url}  (no content)")
            skipped += 1
            continue
        path = dest(url)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(md)
        print(f"  ok   {path.relative_to(OUT.parent)}  ({len(md)//1024}k)")
        saved += 1
        time.sleep(0.3)  # be polite
    print(f"\nsaved {saved}, skipped {skipped} -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
