/**
 * Disambiguation: given our target and the scraper's candidates, decide which
 * candidate (if any) is the right person, and how sure we are. We never blindly
 * guess on a tie — see plans/enrichment-build-plan.md section 9.
 *
 * Corroboration keys, strongest first:
 *   K1  the candidate carries our filer phone   (decisive)
 *   K2  the candidate address matches our city/ZIP
 *   K3  the candidate employer/occupation matches the operator / oil-and-gas
 */
import type {
  EnrichTarget,
  MatchBasis,
  MatchResult,
  SkipTraceCandidate,
} from "./types";
import {
  addressMatches,
  employerMatches,
  nameMatches,
  phoneKey,
} from "./util";

/** Attribution certainty (0-100) implied by each match basis. */
const BASIS_CONFIDENCE: Record<MatchBasis, number> = {
  phone_namematch: 95,
  name_k1: 82,
  name_k2: 70,
  name_k3: 62,
  single: 45,
  ambiguous: 10,
  none: 0,
};

interface Scored {
  candidate: SkipTraceCandidate;
  basis: MatchBasis;
  points: number;
}

/** Does this candidate carry our filer phone among its numbers? (K1) */
function carriesOurPhone(c: SkipTraceCandidate, phone: string | null): boolean {
  const target = phoneKey(phone);
  if (!target) return false;
  return c.phones.some((p) => phoneKey(p) === target);
}

function scoreCandidate(t: EnrichTarget, c: SkipTraceCandidate): Scored {
  const named = nameMatches(t.firstName, t.lastName, c.fullName);
  const k1 = carriesOurPhone(c, t.phone);
  const k2 = addressMatches(c.currentAddress, t.city, t.zip);
  const k3 = employerMatches(c.employer, c.occupation, t.operatorName);

  let points = 0;
  if (k1) points += 50;
  if (k2) points += 25;
  if (k3) points += 20;
  if (named) points += 15;
  // Lean on the actor's own confidence as a small tiebreaker.
  if (c.matchConfidence) points += (c.matchConfidence / 100) * 10;
  if (c.mostLikely) points += 5;

  let basis: MatchBasis;
  if (k1 && named) basis = "phone_namematch";
  else if (k1) basis = "name_k1";
  else if (named && k2) basis = "name_k2";
  else if (named && k3) basis = "name_k3";
  else if (named) basis = "single";
  else basis = "ambiguous";

  return { candidate: c, basis, points };
}

const MIN_POINTS = 35; // floor: roughly K1 alone, or name + (K2 or K3)
const MARGIN = 15; // winner must beat the runner-up by this many points

/** Pick the right candidate, or report `ambiguous` / `none`. */
export function matchCandidate(
  target: EnrichTarget,
  candidates: SkipTraceCandidate[]
): MatchResult {
  if (candidates.length === 0) {
    return { basis: "none", candidate: null, matchConfidence: 0 };
  }

  const scored = candidates
    .map((c) => scoreCandidate(target, c))
    .sort((a, b) => b.points - a.points);

  const top = scored[0];
  const runnerUp = scored[1];

  // Single candidate: accept only if it clears the floor.
  if (!runnerUp) {
    if (top.points >= MIN_POINTS) {
      return {
        basis: top.basis,
        candidate: top.candidate,
        matchConfidence: BASIS_CONFIDENCE[top.basis],
      };
    }
    return { basis: "ambiguous", candidate: null, matchConfidence: BASIS_CONFIDENCE.ambiguous };
  }

  // Multiple candidates: need a clear, corroborated winner.
  const clearWinner =
    top.points >= MIN_POINTS && top.points - runnerUp.points >= MARGIN;
  if (clearWinner) {
    return {
      basis: top.basis,
      candidate: top.candidate,
      matchConfidence: BASIS_CONFIDENCE[top.basis],
    };
  }

  // A decisive phone match overrides a close score race — only that one
  // candidate carries our actual number.
  const phoneHits = scored.filter((s) => s.basis === "phone_namematch" || s.basis === "name_k1");
  if (phoneHits.length === 1) {
    return {
      basis: phoneHits[0].basis,
      candidate: phoneHits[0].candidate,
      matchConfidence: BASIS_CONFIDENCE[phoneHits[0].basis],
    };
  }

  return { basis: "ambiguous", candidate: null, matchConfidence: BASIS_CONFIDENCE.ambiguous };
}
