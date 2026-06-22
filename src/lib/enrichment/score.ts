/**
 * Email confidence score (0-100): the outbound sort key. It blends how sure we
 * are this is the right person (attribution, from the match basis) with how sure
 * we are the inbox is live and monitored (deliverability + use signals). An
 * unverified email is hard-capped low. See plans/enrichment-build-plan.md sec 10.
 */
import type { EmailGrade, EmailScore, MatchBasis, MatchResult } from "./types";

const ATTRIBUTION: Record<MatchBasis, number> = {
  phone_namematch: 40,
  name_k1: 35,
  name_k2: 22,
  name_k3: 18,
  single: 10,
  ambiguous: 0,
  none: 0,
};

const GMAIL_LIKE = ["gmail.com", "outlook.com", "hotmail.com", "icloud.com", "yahoo.com"];
const LEGACY_ISP = ["att.net", "sbcglobal.net", "aol.com", "bellsouth.net", "swbell.net"];

const UNVERIFIED_CAP = 20;
const ACTIVE_THRESHOLD = 70;
const UNCERTAIN_THRESHOLD = 40;

function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "";
}

/** Months since an ISO/parseable date string, or null if unparseable. */
function monthsSince(date: string | null): number | null {
  if (!date) return null;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60 * 24 * 30);
}

function gradeFor(score: number, hasEmail: boolean): EmailGrade {
  if (!hasEmail) return "none";
  if (score >= ACTIVE_THRESHOLD) return "verified_active";
  if (score >= UNCERTAIN_THRESHOLD) return "verified_uncertain";
  return "none";
}

/** Compute the email confidence score + grade from a match result. */
export function scoreEmail(match: MatchResult): EmailScore {
  const c = match.candidate;
  const email = c?.bestEmail ?? null;
  if (!c || !email) {
    return { emailConfidence: 0, emailGrade: "none" };
  }

  // Attribution (0-50): how sure we have the right person.
  let attribution = ATTRIBUTION[match.basis];
  if (c.matchConfidence) attribution += (c.matchConfidence / 100) * 10;
  if (c.mostLikely) attribution += 5;
  attribution = Math.min(50, attribution);

  // Deliverability + use (0-50): how sure the inbox is live and monitored.
  let deliver = 0;
  const verified = c.bestEmailVerified === true;
  if (verified) deliver += 25;

  const domain = domainOf(email);
  if (GMAIL_LIKE.includes(domain)) deliver += 10;
  else if (LEGACY_ISP.includes(domain)) deliver += 3;
  else if (domain) deliver += 8; // a real custom/corporate domain

  const months = monthsSince(c.lastActivityDate);
  if (months !== null && months <= 24) deliver += 8;
  if (c.breachExposed === true) deliver += 4; // the inbox is actually used
  if ((c.sourceCount ?? 0) >= 2) deliver += 3;
  deliver = Math.min(50, deliver);

  let score = Math.round(attribution + deliver);
  // An unverified email can never rank as a confident send.
  if (!verified) score = Math.min(score, UNVERIFIED_CAP);
  score = Math.max(0, Math.min(100, score));

  return { emailConfidence: score, emailGrade: gradeFor(score, true) };
}
