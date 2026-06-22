#!/usr/bin/env python3
"""Trigger a Skip Trace PRO bulk run over the enrichment input CSV.

Starts the Apify actor against a hosted CSV (csvUrl) and registers our webhook
so results POST back to /api/enrich/callback when the run finishes. The webhook
fetches the dataset, maps each person to an operator, scores, and stores.

  APIFY_TOKEN=... \\
  APP_URL=https://your-app.example.com \\
  APIFY_WEBHOOK_SECRET=... \\
    python3 scripts/run_enrichment.py \\
      --csv-url 'https://...signed-storage-url...' \\
      --min-wells 20

Notes:
- Verifier keys (MillionVerifier / NumVerify / HIBP) are configured on the actor
  itself or passed in `input` below — confirm the exact field names against the
  actor's input schema before a paid run (Phase 0 demo).
- Billing is per result returned ($15 / 1,000). Phone-first + maxResultsPerQuery
  of 3 keeps common-name searches from ballooning. Zero-hit lookups are free.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request


ACTOR_ID = "intelscrape~skip-trace-pro"


def main() -> int:
    ap = argparse.ArgumentParser(description="Run Skip Trace PRO bulk enrichment")
    ap.add_argument("--csv-url", required=True, help="public/signed URL to the input CSV")
    ap.add_argument("--min-wells", type=int, default=20)
    args = ap.parse_args()

    token = os.environ.get("APIFY_TOKEN")
    if not token:
        print("ERROR: set APIFY_TOKEN")
        return 1
    app_url = os.environ.get("APP_URL", "http://localhost:3000").rstrip("/")
    secret = os.environ.get("APIFY_WEBHOOK_SECRET", "")

    webhook_url = f"{app_url}/api/enrich/callback?minWells={args.min_wells}"
    if secret:
        webhook_url += f"&secret={secret}"

    payload = {
        "csvUrl": args.csv_url,
        "maxResultsPerQuery": 3,
        "verifyEmails": True,
        "classifyPhones": True,
        "verifyPhoneLiveness": True,
        "sources": ["thatsthem", "pdl", "endato", "publicrecords"],
        # Fire our webhook only when the run actually succeeds.
        "webhooks": [
            {
                "eventTypes": ["ACTOR.RUN.SUCCEEDED"],
                "requestUrl": webhook_url,
            }
        ],
    }

    req = urllib.request.Request(
        f"https://api.apify.com/v2/acts/{ACTOR_ID}/runs?token={token}",
        data=json.dumps(payload).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
        print(f"ERROR: Apify returned {e.code}: {e.read().decode()}")
        return 1

    run = body.get("data", {})
    print(f"started run {run.get('id')} (status {run.get('status')})")
    print(f"results will POST to {webhook_url} on success")
    print(f"watch: https://console.apify.com/actors/runs/{run.get('id')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
