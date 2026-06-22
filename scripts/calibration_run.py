#!/usr/bin/env python3
"""Calibration: run a sample of operators through BOTH skip-trace actors and
write a side-by-side comparison CSV for manual quality review.

Reads calibration_young_input.csv (operator_no, operator_name, officer_name,
search_name, phone, state, city, wells), runs each actor over all rows in one
async run (arrays of names+phones), maps results back to operators by phone then
name, picks the best candidate per operator (K1 filer-phone match, else a
local-address match, else most-likely), and writes the chosen person + emails
from each actor next to each other.

  APIFY_TOKEN=... python3 scripts/calibration_run.py \\
    --in calibration_young_input.csv --out young_calibration_comparison.csv
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import time
import urllib.request


def env_local() -> dict[str, str]:
    env = dict(os.environ)
    path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env.setdefault(k, v.strip())
    return env


def digits(s: object) -> str:
    return "".join(c for c in str(s) if c.isdigit())[-10:]


def norm(s: object) -> str:
    return "".join(c for c in str(s).lower() if c.isalpha())


def start_run(actor: str, payload: dict, token: str) -> str:
    url = f"https://api.apify.com/v2/acts/{actor}/runs?token={token}"
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"content-type": "application/json"}, method="POST",
    )
    return json.loads(urllib.request.urlopen(req).read())["data"]["id"]


def wait(run_id: str, token: str, timeout: int = 1200) -> str:
    t0 = time.time()
    while time.time() - t0 < timeout:
        req = urllib.request.Request(f"https://api.apify.com/v2/actor-runs/{run_id}?token={token}")
        d = json.loads(urllib.request.urlopen(req).read())["data"]
        if d["status"] in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
            return d["defaultDatasetId"] if d["status"] == "SUCCEEDED" else ""
        time.sleep(6)
    return ""


def dataset(ds_id: str, token: str) -> list[dict]:
    req = urllib.request.Request(f"https://api.apify.com/v2/datasets/{ds_id}/items?clean=true&token={token}")
    return json.loads(urllib.request.urlopen(req).read())


# Towns/region we treat as "in Young County" for an address-corroboration match.
YOUNG = ["olney", "graham", "newcastle", "young", "76374", "76450", "76372"]


def is_local(text: str, city: str) -> bool:
    t = (text or "").lower()
    if city and city.lower() in t:
        return True
    return any(k in t for k in YOUNG)


def pick_intelscrape(items: list[dict], filer: str, city: str) -> dict | None:
    """K1 (filer phone in candidate phones) > local address > most-likely."""
    def k1(it):
        return any(digits(p.get("number")) == filer for p in (it.get("phones") or []))
    for it in items:
        if k1(it):
            return it
    for it in items:
        if is_local(it.get("currentAddress", ""), city):
            return it
    likely = [it for it in items if it.get("mostLikely")]
    return (likely or items or [None])[0]


def pick_oneapi(items: list[dict], filer: str, city: str) -> dict | None:
    def k1(it):
        return any(digits(it.get(f"Phone-{i}")) == filer for i in range(1, 6))
    for it in items:
        if k1(it):
            return it
    for it in items:
        addr = " ".join(str(it.get(k, "")) for k in ("Lives in", "Address Locality", "Address Region", "Postal Code"))
        if is_local(addr, city):
            return it
    return (items or [None])[0]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", default="calibration_young_input.csv")
    ap.add_argument("--out", default="young_calibration_comparison.csv")
    ap.add_argument("--max-results", type=int, default=3)
    args = ap.parse_args()

    env = env_local()
    token = env.get("APIFY_TOKEN")
    if not token:
        print("ERROR: set APIFY_TOKEN")
        return 1

    rows = [r for r in csv.DictReader(open(args.inp)) if r["officer_name"] and r["phone"]]
    print(f"{len(rows)} operators with name+phone")

    names_is = [f'{r["search_name"]}, {r["state"]}' for r in rows]
    names_oa = [f'{r["search_name"]}; {r["city"]}, {r["state"]}' for r in rows]
    phones = [r["phone"] for r in rows]

    print("starting both runs...")
    is_run = start_run("intelscrape~skip-trace-pro", {
        "phones": phones, "names": names_is, "searchState": "TX",
        "maxResultsPerQuery": args.max_results,
        "sources": ["thatsthem", "pdl", "endato", "publicrecords"],
    }, token)
    oa_run = start_run("one-api~skip-trace", {
        "phone_number": phones, "name": names_oa, "max_results": args.max_results,
    }, token)
    print(f"  intelscrape run {is_run}\n  one-api run {oa_run}")

    is_items = dataset(wait(is_run, token), token)
    oa_items = dataset(wait(oa_run, token), token)
    print(f"items: intelscrape={len(is_items)} one-api={len(oa_items)}")

    # Map each item to operators (by any phone == filer, else echoed name).
    by_phone = {digits(r["phone"]): r["operator_no"] for r in rows}
    by_name = {norm(r["search_name"]): r["operator_no"] for r in rows}

    def assign(items, get_phones, get_query):
        out: dict[str, list] = {}
        for it in items:
            op = None
            for ph in get_phones(it):
                if digits(ph) in by_phone:
                    op = by_phone[digits(ph)]; break
            if op is None:
                op = by_name.get(norm(get_query(it)))
            if op is None:
                continue
            out.setdefault(op, []).append(it)
        return out

    is_by = assign(is_items, lambda it: [p.get("number") for p in (it.get("phones") or [])] + [it.get("query")],
                   lambda it: (it.get("query") or "").split(",")[0])
    oa_by = assign(oa_items, lambda it: [it.get(f"Phone-{i}") for i in range(1, 6)] + [it.get("Input Given")],
                   lambda it: (it.get("Input Given") or "").split(";")[0])

    with open(args.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "operator_no", "operator_name", "officer_name", "filer_phone", "city", "wells",
            "is_name", "is_K1", "is_address", "is_emails",
            "oa_name", "oa_K1", "oa_address", "oa_emails",
        ])
        for r in rows:
            op = r["operator_no"]; filer = digits(r["phone"]); city = r["city"]
            isi = pick_intelscrape(is_by.get(op, []), filer, city)
            oai = pick_oneapi(oa_by.get(op, []), filer, city)
            is_em = [e.get("address") if isinstance(e, dict) else e
                     for e in (isi.get("emails") or [])] if isi else []
            oa_em = [isi for isi in ([oai.get(f"Email-{i}") for i in range(1, 6)] if oai else []) if isi]
            is_k1 = bool(isi) and any(digits(p.get("number")) == filer for p in (isi.get("phones") or []))
            oa_k1 = bool(oai) and any(digits(oai.get(f"Phone-{i}")) == filer for i in range(1, 6))
            w.writerow([
                op, r["operator_name"], r["officer_name"], r["phone"], city, r["wells"],
                isi.get("fullName") if isi else "", "Y" if is_k1 else "",
                isi.get("currentAddress") if isi else "", "; ".join(x for x in is_em if x),
                oai.get("fullName") if oai else "", "Y" if oa_k1 else "",
                oai.get("Lives in") if oai else "", "; ".join(oa_em),
            ])
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
