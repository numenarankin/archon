# ZeroBounce Activity Data — Graham sample (50 emails)

Run: 50 emails (best clean-tier, live-domain, one per operator) through
`GET https://api.zerobounce.net/v2/activity`. Response fields: `found`,
`active_first_seen`, `active_in_days`.

NOTE: only the aggregate and the 10 recently-active emails below were captured
(the original run printed results but did not persist the full per-email rows;
the 15 stale and 25 not-found emails were not individually recorded). Do not
re-run — this is the recoverable record.

## Aggregate (n=50)
- Any activity signal (`found:true`): 25/50 = 50%
- Active within last 90 days: 10/50 = 20%
- No signal (`found:false`, free lookups): 25/50 = 50%

Recency distribution (sums to 50, confirming all 50 were processed):

| active_in_days | count |
|---|---|
| 30   | 3 |
| 60   | 6 |
| 90   | 1 |
| 180  | 5 |
| 365  | 2 |
| 365+ | 8 |
| not found | 25 |

Credit note: ZeroBounce Activity API charges only on `found:true` results, so
this 50-email run cost ~20-25 credits (the 25 not-found lookups were free).

## The 10 recently-active emails (active_in_days <= 90)

| email | operator | active_in_days | first_seen |
|---|---|---|---|
| kassideesuede@gmail.com     | 5 G RESOURCES, LLC      | 30 | 2015-04-23 |
| barbaraantle@gmail.com      | ANTLE OPERATING, INC.   | 60 | 2009-01-21 |
| barbaraantle@gmail.com      | ANTLE, E.               | 60 | 2009-01-21 |
| bmacdiarmid@gmail.com       | BAY ROCK OPERATING CO.  | 60 | 2024-12-01 |
| embeisch@gmail.com          | BEISCH & HANNA, INC.    | 60 | 2019-12-20 |
| amyldrake@comcast.net       | CASTEEL, MICHAEL HOYT   | 90 | (none)     |
| janice.gragg@sbcglobal.net  | GRAGG OIL CO.           | 30 | 2009-03-28 |
| austin.m.hawkins@gmail.com  | HAWKINS, G. A.          | 60 | 2024-07-25 |
| hnelle@aol.com              | HUNTER & MCDONALD       | 60 | 2009-05-27 |
| edkarper@sbcglobal.net      | KARPER COMPANY, THE     | 30 | 2010-09-21 |

## Takeaways
- Only ~20% of best-tier emails are active within 90 days; 50% show no signal.
- The active ones are long-held but still-used addresses (e.g. Gragg first seen
  2009, active within 30 days) — genuinely good leads when the signal is recent.
- This 20% is a per-single-email floor: most operators have 2-5 candidate
  emails, so testing all candidates and keeping the best-recency one should
  raise the per-operator active rate. (Not yet run.)
