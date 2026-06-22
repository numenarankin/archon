# Operator Contact Enrichment: Build Plan

Implementation plan for enriching Texas RRC operators with verified
decision-maker email + phone, scored by confidence, stored in Supabase, and
sortable for outbound. This is the build/engineering plan; the data logic and
hit-rate analysis live in `operator-enrichment.md`.

Scope of this doc: from raw data we already hold, produce a populated
`operator_contacts` table. Out of scope: the outbound sequencer (cold email /
dialer). This plan stops at "clean, scored contact data, ready to query."

Design note (run-once): the RRC P-5 is a monthly snapshot, so the set of
meaningfully large operators is static between pulls. We bulk-enrich the whole
> N-well universe a single time and keep the data; there is no per-prospect
"enrich" button, because everyone worth contacting is already in the table. The
only reasons to run again are a fresh RRC snapshot or a lower well threshold,
both of which just re-run the bulk script. Re-runs are idempotent via the
primary key (operator_no, officer_name) upsert. `person_key` is a non-unique
index that groups the same human across the operators they run (one person can
be the decision-maker for several operators), so a shared person/phone fans out
to all their operator rows.

## 1. Goal and definition of done

- For every operator with > 20 wells, find the best decision-maker email and
  phone via the Skip Trace PRO scraper.
- Disambiguate each result against our P-5 records so we email the right
  person, not a same-name stranger.
- Store a numeric `email_confidence` (0-100) we can sort/threshold on.
- Persist the raw scraper payload so we never pay to re-enrich the same person.

Done = `operator_contacts` populated, in one bulk run, for the ~4,367 top
decision-makers of the > 20-well universe, each with email (where found),
phone, confidence score, and provenance. That table is then the permanent
contact dataset.

## 2. Universe and volume

- Operators with > 20 wells: 4,970.
- With a top decision-maker on file: 4,720.
- Distinct people after dedup (top-1 per operator): 4,367 (the enrichment
  volume).
- Threshold is well count, by design: we price SaaS per well, so operator size
  (well count), not production, is the qualifier.

## 3. Architecture and data flow

```
Supabase (existing)                         Apify                  Supabase (new)
operators ----+                                                    operator_contacts
operator_officers --> [selection] --> CSV --> Skip Trace PRO --> [match + score] --> rows
well_operator -+        (SQL)      (Storage)   (scraper)          (our code)
operators.phone-+
```

1. Selection: SQL picks top decision-maker per > 20-well operator with
   name + filer phone + per-row state.
2. CSV: export to a signed Supabase Storage URL.
3. Scrape: Skip Trace PRO bulk run (csvUrl + webhook) returns candidates.
4. Match + score: our code disambiguates, computes `email_confidence`.
5. Write: upsert into `operator_contacts`.

## 4. Inputs we already hold (no scraping)

Per operator, from existing tables:
- `operators.operator_number`, `operator_name`, `city`, `state`, `zip`
- `operators.phone` (P-5 filer phone, migration `..._operator_phone.sql`)
- `operator_officers` (name, title, address) to pick the decision-maker
- `well_operator` for the well count

Key correctness rule already settled: per-row `state` from the DB
(`operators.state`, fallback `officer_state`), NOT a hardcoded "TX". 11% of
these operators are HQ'd out of state (OK 187, CO 111, LA 83, ...). Hardcoding
TX would mis-search the decision-maker for 547 operators. `searchState: "TX"`
is only a fallback for the ~9 blank-state rows; the phone key carries the
lookup regardless of state.

## 5. Decision-maker selection (the "top" officer)

The P-5 has no primary-contact flag, so rank officers by title and take rank 1:

`Owner > President > Managing Member > Partner > Manager > (other)`

Agents (RESIDENT TEXAS AGENT, FILING AGENT) sink to the bottom. Ties resolve to
a stable arbitrary pick. A wrong pick here is caught downstream by the
phone-anchored match, not silently emailed.

## 6. Database: `operator_contacts`

New migration `20260622000400_operator_contacts.sql`:

```sql
create table operator_contacts (
  operator_no       integer  not null,     -- joins operators.operator_number
  officer_name      text     not null,     -- who we targeted (LAST, FIRST)
  person_key        text     not null,     -- normalize(last,first)+phone (dedup/cache)
  best_email        text,
  email_confidence  smallint,              -- 0-100, OUTBOUND SORT KEY
  email_grade       text,                  -- verified_active / verified_uncertain / none
  emails            jsonb,                 -- all candidates [{address,source,verified}]
  best_phone        text,                  -- E.164
  phone_type        text,                  -- mobile / landline
  phone_live        boolean,
  current_address   text,                  -- scraper-returned (solves PO-box gap)
  age               smallint,
  employer          text,
  occupation        text,
  match_basis       text,                  -- phone_namematch / name_k1 / name_k2 / name_k3 / single / ambiguous
  match_confidence  smallint,              -- 0-100 attribution certainty
  sources           text[],
  raw               jsonb,                 -- full scraper payload (never re-pay)
  enriched_at       timestamptz default now(),
  primary key (operator_no, officer_name)
);

create index operator_contacts_confidence_idx on operator_contacts (email_confidence desc);
create unique index operator_contacts_person_idx on operator_contacts (person_key);

alter table operator_contacts enable row level security;
create policy operator_contacts_authenticated on operator_contacts
  for all to authenticated using (true) with check (true);
```

Plus a query function `contacts_for_outbound(p_min_confidence smallint)` that
returns rows ordered by `email_confidence desc` for the outbound list (PostgREST
can sort, but a function keeps the join to operator/well-count in one place).

## 7. Selection query (build the CSV input)

A SQL function `operators_for_enrichment(p_min_wells int default 20)` returning
one row per operator: `operator_no, name (FIRST LAST), phone, state`. Logic:
1. well counts from `well_operator`, filter `> p_min_wells`.
2. rank officers by the title priority above, take rank 1.
3. parse `officer_name` "LAST, FIRST MIDDLE" -> "FIRST LAST".
4. state = coalesce(operator.state, officer_state, 'TX').
5. emit only rows with a non-null phone OR a usable name+state.

Export the result to CSV (`scripts/export_enrichment_csv.py` or a small route),
upload to Supabase Storage, generate a signed URL.

## 8. Scraper integration

### Bulk run (the universe sweep)
`scripts/run_enrichment.py` (or an admin API route):
```
POST https://api.apify.com/v2/acts/intelscrape~skip-trace-pro/runs?token=$APIFY_TOKEN
{
  "csvUrl": "<signed storage url>",
  "maxResultsPerQuery": 3,
  "verifyEmails": true,
  "classifyPhones": true,
  "verifyPhoneLiveness": true,
  "sources": ["thatsthem","pdl","endato","publicrecords"],
  "webhookUrl": "<APP_URL>/api/enrich/callback"
}
```
Strategy: phone-first. Each row carries phone + name + state; keep
`maxResultsPerQuery` at 3 so common-name searches do not balloon results
(billing is per result returned).

### Webhook receiver
`src/app/api/enrich/callback/route.ts`: validates the Apify signature, pulls the
dataset items, runs match + score (sec. 9-10), upserts `operator_contacts`.
Idempotent on `person_key`.

### Single-lookup primitive (calibration only)
`skiptrace.runSingle()` enriches one person synchronously (Apify
`run-sync-get-dataset-items`). Used for the Phase 0 demo and the Phase 5
calibration spot-checks. There is no on-demand route or UI button: the bulk run
covers the whole universe once, so per-prospect enrichment is unnecessary.

### Env / secrets
`APIFY_TOKEN`, `MILLIONVERIFIER_API_KEY` (email verify), `NUMVERIFY_API_KEY`
(phone liveness), optional `HIBP_API_KEY` (breach signal). Added to
`.env.example` and the deployment env.

## 9. Match and disambiguate (`src/lib/enrichment/match.ts`)

Input: our officer record + the scraper's candidate list for that row.
Output: chosen candidate + `match_basis` + `match_confidence`.

1. Reverse-phone candidate whose name matches officer -> `phone_namematch`
   (highest). Done.
2. Else name candidates, scored by corroboration keys:
   - K1 filer phone in candidate's phone list -> `name_k1` (decisive)
   - K2 candidate current/historical address city/zip == officer P-5 city/zip
     -> `name_k2`
   - K3 candidate employer ~ operator name OR occupation in
     {oil,gas,petroleum,energy} -> `name_k3`
3. Single name hit, state matches, no corroboration -> `single` (medium).
4. Accept top scorer only if it clears the minimum (K1 alone, or K2+K3) AND
   beats runner-up by a margin; else `ambiguous` -> no email, keep phone, flag
   for optional human pick.

Name matching: normalize case/punctuation, handle "LAST, FIRST" vs "First Last",
nickname tolerance (Bob/Robert), ignore middle initials.

## 10. Email confidence score (`src/lib/enrichment/score.ts`)

`email_confidence` = attribution (0-50) + deliverability/use (0-50), clamped
0-100. If the email is not SMTP-valid, hard-cap the total at 20.

Attribution (from match_basis + scraper flags), capped 50:
- phone_namematch: 40
- name_k1: 35
- name_k2: 22
- name_k3: 18
- single: 10
- + matchConfidence/100 * 10
- + mostLikely ? 5 : 0

Deliverability/use (capped 50):
- bestEmailVerified valid (SMTP): 25  (floor; if not valid, see cap above)
- domain: gmail/outlook/icloud 10; corporate 8; legacy ISP (att/sbcglobal/aol) 3
- lastActivityDate within 24 months: 8
- breachExposed true: 4   (positive: inbox is actually used)
- sourceCount >= 2: 3

Grade buckets (for quick filter; the numeric score is the sort key):
- verified_active: >= 70
- verified_uncertain: 40-69
- none: < 40 or no email

## 11. Build phases and tasks

Phase 0 - Data prep (dependency)
- [ ] Confirm `operators.phone` populated (migration + loader run).
- [ ] Confirm officer physical address parsed (re-parse `K` record if needed).
- [ ] One demo Skip Trace PRO run to confirm the output includes each
      candidate's full phone list (needed for K1). If only `bestPhone`, K2/K3
      carry disambiguation and we note the lower multi-hit confidence.

Phase 1 - Schema + selection
- [ ] Migration `..._operator_contacts.sql` (table, indexes, RLS, function).
- [ ] `operators_for_enrichment()` function.
- [ ] CSV export script + Supabase Storage upload + signed URL.

Phase 2 - Scraper integration
- [ ] Env/secrets wired (`APIFY_TOKEN`, verifier keys).
- [ ] `run_enrichment.py` bulk trigger.
- [ ] `/api/enrich/callback` webhook receiver (signature check, dataset pull).

Phase 3 - Match + score
- [ ] `match.ts` (disambiguation, K1/K2/K3, name normalization).
- [ ] `score.ts` (email_confidence, grade).
- [ ] Unit tests for both with fixture payloads.

Phase 4 - Writeback + cache
- [ ] Upsert into `operator_contacts`, idempotent on `person_key`.
- [ ] Cache check so repeat people / re-runs are free.

Phase 5 - Calibration batch
- [ ] Run ~200-300 of the > 20-well operators across activity tiers.
- [ ] Measure: email-found rate, verified rate, phone rate, score
      distribution, ambiguous rate.
- [ ] Tune thresholds (acceptance margin, score weights) from real results.

Phase 6 - Full universe run (one time)
- [ ] Run all ~4,367. Monitor cost vs estimate (~$85-105).
- [ ] QA a sample of high-confidence rows by hand.
- [ ] Done. The table is now the permanent contact dataset; re-run only on a
      fresh RRC snapshot or a lower well threshold.

## 12. Cost

- Scraper: $15 / 1,000 results, pay-per-event, zero-hit lookups free, no
  platform/monthly fee.
- Phone-first, top-1 per operator (4,367): ~$85-105 actor.
- Verification APIs: MillionVerifier ~$2-5; NumVerify free tier; HIBP ~$4/mo
  optional.
- All-in for the full > 20-well sweep: under ~$120. Cost is not the constraint;
  disambiguation accuracy is.

## 13. Validation and quality gates

- Calibration batch before the full run (Phase 5).
- Hand-QA a sample of `verified_active` rows: is it the right person, is the
  email plausible.
- Track `ambiguous` rate; if high, tighten name matching or add a human-pick
  queue.
- Reminder: SMTP-valid proves an inbox exists, not that it is read. True
  "checked" rate only emerges from send engagement later; the score is our best
  pre-send proxy.

## 14. Risks and open items

- Phone-list output: K1 depends on the actor returning per-candidate phone
  lists. Confirm in Phase 0.
- Stale inputs: P-5 (incl. filer phone) is a 2021 snapshot. Phones mostly
  persist; a fresh P-5 pull would refresh phone/address/status and lift match
  rates. Not a blocker, a future upgrade.
- Older demographic: thinner personal-email footprints; phone is the stronger
  channel. Score weighting reflects this.
- Compliance: cold email needs CAN-SPAM hygiene (unsubscribe, physical
  address); cold calling/SMS to cells carries TCPA/DNC exposure. Design DNC
  scrubbing in before any dialer (outbound is out of scope here but flag it).
- Business-domain waterfall is a MARGINAL lever, not a major one. "Corporation"
  is a legal form, not a web presence: most of these small operators have no
  website and no email domain (a family LLC running 30 wells has no need for
  one), so the owner uses a personal Gmail just like a sole proprietor. A
  domain -> Findymail/Prospeo path would only help the small slice of larger,
  truly corporate operators that actually run a domain, so expect a few points
  at most. The people-search / personal-email path (Skip Trace PRO) is the
  dominant route for essentially the whole universe; do not over-invest in the
  domain path.

## 15. Deliverables checklist

- [ ] `supabase/migrations/20260622000400_operator_contacts.sql`
- [ ] `operators_for_enrichment()` + `contacts_for_outbound()` functions
- [ ] `scripts/export_enrichment_csv.py`
- [ ] `scripts/run_enrichment.py`
- [ ] `src/app/api/enrich/callback/route.ts` (bulk webhook receiver)
- [ ] `src/lib/enrichment/{types,util,skiptrace,match,score,persist}.ts`
- [ ] `.env.example` updated with the four keys
- [ ] Calibration report (Phase 5) before the full run
