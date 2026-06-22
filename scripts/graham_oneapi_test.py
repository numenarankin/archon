#!/usr/bin/env python3
"""Run one-api/skip-trace over the Graham / Young County operators and write a
per-operator email-discovery results CSV for manual quality review.

Reads graham_oneapi_input.csv (operator_no, operator_name, officer_name,
search_name, phone, state, city, wells_young), queries the actor in small
run-sync chunks (resilient to the Apify monthly-limit error), picks the best
candidate per operator (K1 filer-phone match > local Young County address >
first), and writes the chosen person + emails.

  APIFY_TOKEN=... python3 scripts/graham_oneapi_test.py \\
    --in graham_oneapi_input.csv --out graham_oneapi_results.csv --chunk 10

If it stops early on "Monthly usage hard limit exceeded", raise the limit in
Apify Console -> Settings -> Usage & billing, then re-run (it overwrites).
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import urllib.error
import urllib.request

YOUNG = ["olney", "graham", "newcastle", "young", "76374", "76450", "76372", "loving", "jean"]


def env_local() -> dict:
    env = dict(os.environ)
    p = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    if os.path.exists(p):
        for line in open(p):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env.setdefault(k, v.strip())
    return env


def digits(s) -> str:
    return "".join(c for c in str(s) if c.isdigit())[-10:]


def run_sync(token: str, names: list[str], phones: list[str], max_results: int) -> list[dict]:
    inp = {"name": names, "phone_number": phones, "max_results": max_results}
    url = f"https://api.apify.com/v2/acts/one-api~skip-trace/run-sync-get-dataset-items?token={token}"
    req = urllib.request.Request(url, data=json.dumps(inp).encode(),
                                 headers={"content-type": "application/json"}, method="POST")
    return json.loads(urllib.request.urlopen(req, timeout=240).read())


def emails_of(it: dict) -> list[str]:
    return [it.get(f"Email-{i}") for i in range(1, 6) if it.get(f"Email-{i}")]


def phones_of(it: dict) -> list[str]:
    return [digits(it.get(f"Phone-{i}")) for i in range(1, 6) if it.get(f"Phone-{i}")]


def lives_in(it: dict) -> str:
    return it.get("Lives in") or " ".join(
        str(it.get(k, "")) for k in ("Address Locality", "Address Region", "Postal Code"))


def pick(items: list[dict], filer: str, city: str) -> dict | None:
    for it in items:  # K1: our filer phone among the person's numbers
        if filer in phones_of(it):
            return it
    for it in items:  # local address corroboration
        addr = lives_in(it).lower()
        if (city and city.lower() in addr) or any(k in addr for k in YOUNG):
            return it
    return items[0] if items else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", default="graham_oneapi_input.csv")
    ap.add_argument("--out", default="graham_oneapi_results.csv")
    ap.add_argument("--chunk", type=int, default=10)
    ap.add_argument("--max-results", type=int, default=3)
    args = ap.parse_args()

    token = env_local().get("APIFY_TOKEN")
    if not token:
        print("ERROR: set APIFY_TOKEN")
        return 1

    rows = [r for r in csv.DictReader(open(args.inp)) if r["officer_name"] and r["phone"]]
    print(f"{len(rows)} operators with name+phone")

    results: dict[str, list[dict]] = {}
    processed = 0
    for i in range(0, len(rows), args.chunk):
        chunk = rows[i:i + args.chunk]
        names = [f'{r["search_name"]}; {r["city"]}, {r["state"]}' for r in chunk]
        phones = [r["phone"] for r in chunk]
        try:
            items = run_sync(token, names, phones, args.max_results)
        except urllib.error.HTTPError as e:
            print(f"STOPPED at row {i}: HTTP {e.code} {e.read().decode()[:160]}")
            break
        # map items back to operators by phone, then by name token
        by_phone = {digits(r["phone"]): r["operator_no"] for r in chunk}
        by_name = {"".join(c for c in r["search_name"].lower() if c.isalpha()): r["operator_no"] for r in chunk}
        for it in items:
            op = None
            for ph in phones_of(it):
                if ph in by_phone:
                    op = by_phone[ph]; break
            if op is None:
                key = "".join(c for c in str(it.get("Input Given", "")).split(";")[0].lower() if c.isalpha())
                op = by_name.get(key)
            if op is not None:
                results.setdefault(op, []).append(it)
        processed += len(chunk)
        print(f"  processed {processed}/{len(rows)}")

    with_email = 0
    with open(args.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["operator_no", "operator_name", "officer_name", "filer_phone", "city",
                    "wells_young", "picked_name", "K1", "lives_in", "n_emails", "emails"])
        for r in rows:
            op = r["operator_no"]; filer = digits(r["phone"])
            chosen = pick(results.get(op, []), filer, r["city"])
            em = emails_of(chosen) if chosen else []
            if em:
                with_email += 1
            k1 = bool(chosen) and filer in phones_of(chosen)
            w.writerow([op, r["operator_name"], r["officer_name"], r["phone"], r["city"],
                        r["wells_young"], chosen.get("fullName") if chosen else "",
                        "Y" if k1 else "", lives_in(chosen) if chosen else "",
                        len(em), "; ".join(em)])
    print(f"\nwrote {args.out}")
    print(f"email found for {with_email}/{len(rows)} operators ({100*with_email/len(rows):.0f}%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
