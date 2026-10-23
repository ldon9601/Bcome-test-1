#!/usr/bin/env python3
"""
Checks the Jobs and Skills Australia pages listed in data/sources.json for newer spreadsheets,
downloads them, imports them with scripts/import-labour-market.py and records what was imported.

    pip install openpyxl
    python3 scripts/refresh-data.py                  check every source and import anything new
    python3 scripts/refresh-data.py --mode auto      only sources that go live automatically
    python3 scripts/refresh-data.py --mode review    only sources that need a person to check them
    python3 scripts/refresh-data.py --dry-run        report what's new without importing
    python3 scripts/refresh-data.py --report r.md    also write a Markdown summary

It never replaces data with an older period: the file date in the name (or JSA's upload folder)
and the period inside the imported data must both be the same or newer. The GitHub Actions
workflow .github/workflows/refresh-data.yml runs this every week, then validates the data and runs
the tests before anything is published. Exit code 1 means a source needs attention (a page or
file has moved, or JSA changed a workbook's layout).
"""
import argparse
import datetime as dt
import hashlib
import html.parser
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
SOURCES = os.path.join(ROOT, "data", "sources.json")
IMPORTER = os.path.join(ROOT, "scripts", "import-labour-market.py")
UA = "Bcome data refresh (+https://github.com/ldon9601/bcome-test-1)"
MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
TODAY = dt.date.today().isoformat()


# ---------------------------------------------------------------------------
# Finding links
# ---------------------------------------------------------------------------

class Links(html.parser.HTMLParser):
    """Collects <a href> links with their text, plus any other attribute that points at a file."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self._open = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "a" and a.get("href"):
            self._open = {"href": a["href"], "text": a.get("title") or a.get("aria-label") or ""}
            self.links.append(self._open)
        else:
            for k in ("data-href", "data-url", "data-file"):
                if a.get(k):
                    self.links.append({"href": a[k], "text": ""})

    def handle_data(self, data):
        if self._open is not None:
            self._open["text"] += data

    def handle_endtag(self, tag):
        if tag == "a":
            self._open = None


def file_name(url):
    return urllib.parse.unquote(urllib.parse.urlparse(url).path.rsplit("/", 1)[-1])


def date_of(*texts):
    """The latest date written in a file name or link text, as 'YYYY-MM' (or None).

    Understands 20250903, 2025-09, august_2026, 'May 2025 to May 2035' and plain years, and the
    /sites/default/files/2026-05/ upload folder JSA's website uses.
    """
    found = []
    for t in texts:
        if not t:
            continue
        s = urllib.parse.unquote(t).lower()
        for y, m, d in re.findall(r"(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)", s):
            if 1 <= int(m) <= 12 and 1 <= int(d) <= 31:
                found.append(f"{y}-{m}")
        for y, m in re.findall(r"(?<!\d)(20\d{2})-(\d{2})(?![\d])", s):
            if 1 <= int(m) <= 12:
                found.append(f"{y}-{m}")
        month = r"(?<![a-z])(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?![a-z])"
        for mon, y in re.findall(month + r"[ _\-.,]*(20\d{2})", s):
            found.append(f"{y}-{MONTHS[mon[:3]]:02d}")
        if not found:
            for y in re.findall(r"(?<!\d)(20\d{2})(?!\d)", s):
                found.append(f"{y}-01")
    return max(found) if found else None


def upload_folder(url):
    m = re.search(r"/files/(20\d{2}-\d{2})/", urllib.parse.unquote(url))
    return m.group(1) if m else None


def candidates(html_text, page_url, source):
    p = Links()
    p.feed(html_text)
    match = re.compile(source["match"], re.I)
    exclude = re.compile(source["exclude"], re.I) if source.get("exclude") else None
    seen, out = set(), []
    for link in p.links:
        url = urllib.parse.urljoin(page_url, link["href"].strip())
        name = file_name(url)
        text = re.sub(r"\s+", " ", link["text"]).strip()
        is_xlsx = name.lower().endswith(".xlsx") or ".xlsx" in text.lower()
        if not is_xlsx or url in seen:
            continue
        hay = f"{name} {text}".replace("_", " ")
        if not match.search(hay) or (exclude and exclude.search(name)):
            continue
        seen.add(url)
        out.append({"url": url, "file": name if name.lower().endswith(".xlsx") else (text or name), "text": text, "date": date_of(name, text) or upload_folder(url), "order": len(out)})
    # Newest first; undated files keep their order on the page (JSA lists the latest first).
    out.sort(key=lambda c: (c["date"] or "", -c["order"]), reverse=True)
    return out


# ---------------------------------------------------------------------------
# Network
# ---------------------------------------------------------------------------

def fetch(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001 - report any network problem the same way
            last = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"couldn't download {url}: {last}")


# ---------------------------------------------------------------------------
# Periods inside the imported data
# ---------------------------------------------------------------------------

def get_path(doc, path):
    cur = doc
    for part in path.split("."):
        if cur is None:
            return None
        if isinstance(cur, list):
            cur = cur[int(part)] if cur else None
        else:
            cur = cur.get(part)
    return cur


def norm_period(v):
    """'May 2035', '2026-02', '2025-09-03' and '2025' all become comparable 'YYYY-MM' strings."""
    if v is None:
        return None
    return date_of(str(v)) or None


def data_period(source):
    path = os.path.join(ROOT, source["period"]["file"])
    if not os.path.exists(path):
        return None
    return norm_period(get_path(json.load(open(path)), source["period"]["path"]))


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------

def refresh(source, work, dry_run):
    """Returns (status, detail). Status: unchanged | updated | new-found | skipped-older | problem."""
    latest = source.setdefault("latest", {})
    found = []
    errors = []
    for page in source["pages"]:
        try:
            found += candidates(fetch(page).decode("utf-8", "replace"), page, source)
        except RuntimeError as e:
            errors.append(str(e))
    latest["checkedAt"] = TODAY
    if not found:
        why = "; ".join(errors) if errors else f"no spreadsheet matching /{source['match']}/ on {', '.join(source['pages'])}"
        return "problem", f"Couldn't find the spreadsheet: {why}. Check the page and update data/sources.json."
    found.sort(key=lambda c: c["date"] or "", reverse=True)
    best = found[0]
    known = date_of(latest.get("file") or "")
    if best["date"] and known and best["date"] < known:
        return "unchanged", f"Newest on the website is {best['file']} ({best['date']}), older than the {known} data already loaded."

    try:
        blob = fetch(best["url"])
    except RuntimeError as e:
        return "problem", str(e)
    sha = hashlib.sha256(blob).hexdigest()
    if sha == latest.get("sha256"):
        latest["url"] = best["url"]
        return "unchanged", f"{best['file']} is already loaded."
    if dry_run:
        return "new-found", f"New file: {best['file']} ({best['date'] or 'undated'}) at {best['url']}"

    path = os.path.join(work, best["file"] if best["file"].lower().endswith(".xlsx") else f"{source['id']}.xlsx")
    with open(path, "wb") as f:
        f.write(blob)
    outputs = sorted({source["updates"], source["period"]["file"]})
    backup = {o: open(os.path.join(ROOT, o), "rb").read() for o in outputs if os.path.exists(os.path.join(ROOT, o))}
    before = data_period(source)
    r = subprocess.run([sys.executable, IMPORTER, source["importer"], path], capture_output=True, text=True)
    if r.returncode != 0:
        restore(backup)
        return "problem", f"The importer couldn't read {best['file']} (JSA may have changed the layout): {(r.stderr or r.stdout).strip()[-600:]}"
    after = data_period(source)
    if before and after and after < before:
        restore(backup)
        return "skipped-older", f"{best['file']} holds data to {after}, older than the {before} already loaded, so it was ignored."
    latest.update({"file": best["file"], "url": best["url"], "sha256": sha, "importedAt": TODAY, "period": after, "status": "imported automatically"})
    return "updated", f"Imported {best['file']} (data to {after or 'n/a'}, previously {before or 'n/a'})."


def restore(backup):
    for rel, data in backup.items():
        with open(os.path.join(ROOT, rel), "wb") as f:
            f.write(data)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--mode", choices=["auto", "review"], help="only refresh sources with this mode")
    p.add_argument("--only", help="comma-separated source ids")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--report", help="write a Markdown summary here")
    a = p.parse_args()

    doc = json.load(open(SOURCES))
    only = set(a.only.split(",")) if a.only else None
    work = tempfile.mkdtemp(prefix="bcome-refresh-")
    results = []
    try:
        for s in doc["sources"]:
            if (a.mode and s.get("mode", "auto") != a.mode) or (only and s["id"] not in only):
                continue
            status, detail = refresh(s, work, a.dry_run)
            if status == "updated":
                s["latest"]["status"] = "imported automatically" if s.get("mode") == "auto" else "imported, waiting for review"
            elif status == "problem":
                s["latest"]["status"] = "problem: " + detail[:200]
            results.append((s, status, detail))
            print(f"[{status}] {s['id']}: {detail}")
    finally:
        shutil.rmtree(work, ignore_errors=True)

    if not a.dry_run:
        with open(SOURCES, "w") as f:
            json.dump(doc, f, indent=1, ensure_ascii=False)
            f.write("\n")

    if a.report:
        icon = {"updated": "🔄", "unchanged": "✅", "problem": "⚠️", "new-found": "🆕", "skipped-older": "⏭️"}
        lines = [f"## Bcome data refresh, {TODAY}", "", "| Source | Result | Detail |", "| --- | --- | --- |"]
        for s, status, detail in results:
            lines.append(f"| [{s['title']}]({s['pages'][0]}) | {icon.get(status, '')} {status} | {detail.replace('|', '/')} |")
        with open(a.report, "w") as f:
            f.write("\n".join(lines) + "\n")

    updated = [s["id"] for s, st, _ in results if st == "updated"]
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(f"updated={','.join(updated)}\n")
            f.write(f"problems={sum(1 for _, st, _ in results if st == 'problem')}\n")
    sys.exit(1 if any(st == "problem" for _, st, _ in results) else 0)


if __name__ == "__main__":
    main()
