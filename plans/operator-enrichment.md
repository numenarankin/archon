# Operator Contact Enrichment Pipeline

Goal: turn our RRC operator/officer records into verified email + phone for as
many decision-makers as possible, to feed an outbound (cold email + cold call)
engine for WildcatIQ.

## What we already have (the enrichment inputs)

From the Texas RRC P-5 (`orf850`) + permits (`daf804`) + wellbore (`dbf900`):

- ~32,000 distinct operators attached to at least one well (permit OR H-15).
- 97% of those have officer/principal records.
- ~40,035 distinct decision-makers (Owner / President / Managing Member /
  Partner / Manager), each with name + title + physical address.
- Filer phone on ~89% of operators (`operators.phone`, the P-5
  OROR-PHONE-NUMBER). This is the single most valuable lookup key.
- Entity type (Corporation / Sole Proprietor / Partnership / etc.) to route
  each person to the right path.

What we do NOT have and must enrich:
- The decision-maker's direct/cell phone and the email they actually check.

### Important data caveats
- The P-5 file is a September 2021 snapshot; permits are current (2026). Use
  recent permit/H-15 activity, not the stale P-5 status flag, to judge who is
  active. ~3,300 operators with 25+ wells are flagged non-Active but are still
  operating.
- The P-5 address is a business mailing address, often a PO Box. It is not a
  reliable residence. We do not search by it; we let the scraper return the
  real current address as output.
- City is uncertain (PO box, wells, and residence are three different places),
  but nearly all targets are in Texas. The phone is geography-agnostic, so this
  does not block reverse-phone lookups.

## Tool: Skip Trace PRO (Apify `intelscrape/skip-trace-pro`)

Accepts four interchangeable search keys: name (+ city/state), address, phone,
email. Built-in verification (`verifyEmails` SMTP handshake, `classifyPhones`
mobile/landline E.164, `verifyPhoneLiveness` carrier check). Stacks multiple
sources (thatsthem, pdl, endato, publicrecords). Bulk via `csvUrl` up to
100,000 records with `webhookUrl` callback.

Key outputs: `bestEmail`, `bestEmailVerified`, `bestPhone` (E.164),
`phoneType`, `bestPhoneLive`, `currentAddress`, `age`, `employer`,
`occupation`, `propertyValue`, `matchConfidence`, `sourceCount`, `mostLikely`,
`bestPhoneCorroboration`, `lastActivityDate`, `breachExposed`.

Cost: roughly $0.10-0.20 per fully enriched person. Expensive enough that we
run it on demand (when the user clicks Enrich / adds a prospect), not as a bulk
pre-enrichment of all 40k.

## The precise sequence (per prospect)

### Phase A: build the input (no cost)
1. Pick the decision-maker officer, ranked by title:
   Owner > President > Managing Member > Partner > Manager.
2. Parse `officer_name` (`LAST, FIRST MIDDLE`) into first / last.
3. Assemble keys: `phone` = `operators.phone` (primary), `name` = "FIRST LAST",
   `state` = officer/operator state (default TX). City optional, low trust.
4. Cache check: `person_key = normalize(last,first) + phone`. If already
   enriched, reuse and skip the paid call (same person sits on many operators).

### Phase B: call Skip Trace PRO (the paid step)
5. Classify the filer phone first (mobile vs landline). Mobile implies a
   personal line (reverse-phone will likely land); landline implies a business
   line (expect a gatekeeper, lean on name + corroboration).
6. Run with both keys so it corroborates phone vs name:
   ```json
   {
     "phones": ["<filer phone>"],
     "names": ["FIRST LAST, TX"],
     "searchState": "TX",
     "maxResultsPerQuery": 3,
     "verifyEmails": true,
     "classifyPhones": true,
     "verifyPhoneLiveness": true,
     "sources": ["thatsthem", "pdl", "endato", "publicrecords"]
   }
   ```
   Single prospect: `run-sync-get-dataset-items`. Batch: async run + webhook.

### Phase C: match and disambiguate (decision tree)

1. Reverse phone lookup:
   - Person returned, name matches our officer -> HIT. Save email + cell. Stop.
   - Person returned, name does NOT match -> gatekeeper (CPA, filing agent,
     spouse). Do not use their email; keep their address. Fall to name search.
   - Company or nothing returned -> business line. Fall to name search. The
     phone now becomes a corroboration key (K1), not the lookup.

2. Name + state lookup:
   - 0 hits -> no email; fall back to phone channel only. Stop.
   - 1 hit -> save, but still grade via corroboration keys (1 hit is not
     guaranteed correct; common TX names collide).
   - 2+ hits -> score, do not guess (below).

3. Multi-hit resolver. Score each candidate against what the P-5 already tells
   us, in priority order:
   - K1 (decisive): our filer phone appears in the candidate's associated
     phone list. Even a business landline is usually listed among the owner's
     numbers. Exactly one candidate carrying it = that is the person.
   - K2 (strong): candidate current or historical address city/ZIP matches the
     officer P-5 city/ZIP. Address history often catches the residence behind a
     PO box.
   - K3 (strong): candidate `employer` matches the operator name, or
     `occupation` is oil/gas/petroleum/energy.

   Acceptance: take the highest scorer only if it clears a minimum (K1 alone,
   or K2+K3 together) AND beats the runner-up by a clear margin. A genuine tie
   with no corroborating key -> mark `ambiguous`, do NOT email anyone, fall
   back to the phone channel. Optionally surface top 2-3 for a one-click human
   pick. A false match is a reputation hit, worse than a miss.

### Phase D: extract and score the email
1. Pull `bestEmail` + `bestEmailVerified` (+ `emailCount` for all candidates).
2. Compute `email_confidence`, a single numeric score (0-100) we store and sort
   by. It combines two things: how sure we are this is the right person
   (attribution) and how sure we are the inbox is live and monitored
   (deliverability + use signals). Inputs:
   - Attribution: match basis from Phase C (phone hit + name match is highest;
     name-only with K1 phone-in-list next; name-only with K2/K3 lower),
     plus `matchConfidence`, `sourceCount`, `mostLikely`.
   - Deliverability/use: `bestEmailVerified` = valid (SMTP) is the required
     floor (an unverified email caps the score low); domain quality
     (Gmail/Outlook ranks above legacy ISP att/sbcglobal/aol); recent
     `lastActivityDate`; `breachExposed` true (the inbox is actually used
     across services); `sourceCount` >= 2.
3. Also store a coarse `email_grade` (verified_active / verified_uncertain /
   none) derived from the score, for quick filtering. The numeric
   `email_confidence` is the sort key; the grade is the bucket.
4. Capture `bestPhone` (E.164) + `phoneType` + `bestPhoneLive` as the
   co-primary channel. For this demographic (small TX operators, often older,
   phone-first), weight the phone at least as heavily as email.

### Phase E: write back
1. Upsert into the enrichment/contacts table: `operator_number`, person,
   `best_email` + `email_confidence` (numeric, sortable) + `email_grade`, all
   emails, `best_phone` + type + live, `current_address`,
   age/employer/occupation, `match_confidence`, `sources`, `enriched_at`, and
   the raw payload (so we never re-pay to re-derive).
2. Index `email_confidence` so the outbound pipeline can sort/filter on it
   (work the highest-confidence emails first, set a minimum threshold per
   campaign).
3. Stamp the `person_key` cache.

## One-line decision rule

Phone hit + name match -> trust it. Name-only hit -> trust only if confidence
is high and corroborated (phone-in-list, then address, then employer). Email
must be SMTP-valid to count, and is graded active/uncertain by domain +
recency + breach-use signals. True tie with no corroboration -> do not guess,
use the phone channel.

## Confidence (honest)

- ~89% with a filer phone: good. Reverse-phone is geography-agnostic, so the
  city uncertainty does not hurt these.
- ~11% with no phone: weak (name + TX only is ambiguous); low priority.
- Deliverable email found: ~50-65% of the phone-backed set.
- Of those, likely-checked (recent + corroborated + good domain): roughly half
  to two-thirds, so ~30-40% of prospects with a high-confidence monitored
  email.
- Mobile phone, liveness-checked: ~60-80%, and the more reliable channel for
  this audience.

SMTP verification proves an inbox exists and accepts mail, not that anyone
reads it. The only true proof of a monitored inbox is engagement (opens /
replies) after sending. Replace these estimates with a calibration batch of
~200-300 prospects across activity tiers before scaling spend.

## Open dependencies
- Confirm the actor returns each candidate's full phone list (needed for K1);
  verify via a small demo run. If it only returns `bestPhone`, K2/K3 carry the
  disambiguation and multi-hit confidence drops.
- Load `operators.phone` (migration `20260622000100_operator_phone.sql`), then
  join the top decision-maker per operator to produce the input rows.
