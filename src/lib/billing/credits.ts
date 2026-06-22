import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import { hasSupabase, isPaidMode } from "@/lib/env";
import {
  anthropicCredits,
  anthropicWebSearchCredits,
  elevenLabsTtsCredits,
  elevenLabsSttCredits,
} from "@/lib/billing/tiers";

/**
 * The AI-credit gate and meter.
 *
 * Every AI entry point calls `gateAI()` BEFORE doing work, then meters the
 * actual usage AFTER the call completes (drains free credits first, then paid;
 * the last call may land the balance negative — that's intended). All balance
 * math lives in atomic SECURITY DEFINER RPCs (see the billing migration), never
 * read-then-write in JS.
 *
 * Fail-open policy: if billing isn't configured, or the RPC is missing (e.g.
 * the migration hasn't run on a dev database), the gate ALLOWS the call so the
 * app keeps working. Real enforcement happens once Supabase + the migration are
 * in place: a structured `allowed: false` from the RPC always blocks.
 */

export interface GateResult {
  allowed: boolean;
  reason: string;
  orgId?: string;
  freeRemaining?: number;
  paidBalance?: number;
  balance?: number;
}

interface GateRow {
  allowed: boolean;
  reason: string;
  org_id?: string;
  free_remaining?: number;
  paid_balance?: number;
  balance?: number;
}

/**
 * Decide whether the current user's org may make an AI call. Resolves the org,
 * ensures the monthly grant is current, checks subscription status + a positive
 * balance — all server-side in one atomic RPC.
 */
export async function gateAI(client?: SupabaseClient): Promise<GateResult> {
  // Master switch off → never gate (free-for-all mode).
  if (!isPaidMode()) {
    return { allowed: true, reason: "paid_mode_off" };
  }
  if (!hasSupabase()) {
    return { allowed: true, reason: "billing_disabled" };
  }
  try {
    const sb = client ?? (await getSupabaseServer());
    const { data, error } = await sb.rpc("billing_gate");
    if (error) {
      // Missing function / not-yet-migrated DB → fail open (dev).
      console.error("gateAI: billing_gate failed, allowing", error.message);
      return { allowed: true, reason: "gate_error" };
    }
    const row = data as GateRow;
    return {
      allowed: Boolean(row?.allowed),
      reason: row?.reason ?? "unknown",
      orgId: row?.org_id,
      freeRemaining: row?.free_remaining,
      paidBalance: row?.paid_balance,
      balance: row?.balance,
    };
  } catch (err) {
    console.error("gateAI: unexpected error, allowing", err);
    return { allowed: true, reason: "gate_exception" };
  }
}

/**
 * Spend `amount` credits for the current user's org. Safe to call from a
 * route's `onFinish` — reuses the same request-scoped (cookie-bound) client so
 * the RPC resolves the same org. Never throws; logs and returns on failure.
 */
async function spend(
  amount: number,
  reason: string,
  meta?: Record<string, unknown>,
  client?: SupabaseClient
): Promise<void> {
  // Don't meter when paid mode is off — no point driving balances negative.
  if (!isPaidMode() || !hasSupabase() || amount <= 0) return;
  try {
    const sb = client ?? (await getSupabaseServer());
    const { error } = await sb.rpc("billing_spend", {
      p_amount: amount,
      p_reason: reason,
      p_meta: meta ?? null,
    });
    if (error) console.error("spend: billing_spend failed", error.message);
  } catch (err) {
    console.error("spend: unexpected error", err);
  }
}

/** Meter an Anthropic call from its token usage (from streamText `onFinish`). */
export async function meterAnthropic(
  usage: { inputTokens?: number; outputTokens?: number },
  reason: string,
  client?: SupabaseClient
): Promise<void> {
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  const credits = anthropicCredits(input, output);
  await spend(credits, reason, { provider: "anthropic", input, output }, client);
}

/**
 * Sum Anthropic web-search requests across a streamText run's steps. Each step's
 * `providerMetadata.anthropic.usage` carries the raw Anthropic usage, including
 * `server_tool_use.web_search_requests`. Traversed defensively (shape is the
 * provider's, not ours).
 */
export function countWebSearchRequests(
  steps: ReadonlyArray<{ providerMetadata?: unknown }> | undefined
): number {
  let total = 0;
  for (const step of steps ?? []) {
    const usage = (
      step.providerMetadata as
        | {
            anthropic?: {
              usage?: { server_tool_use?: { web_search_requests?: unknown } };
            };
          }
        | undefined
    )?.anthropic?.usage?.server_tool_use?.web_search_requests;
    if (typeof usage === "number") total += usage;
  }
  return total;
}

/** Meter Anthropic web searches (provider-executed, billed separately by token). */
export async function meterAnthropicWebSearch(
  requests: number,
  reason: string,
  client?: SupabaseClient
): Promise<void> {
  if (requests <= 0) return;
  await spend(
    anthropicWebSearchCredits(requests),
    reason,
    { provider: "anthropic", kind: "web_search", requests },
    client
  );
}

/** Meter an ElevenLabs text-to-speech call by character count. */
export async function meterElevenLabsTts(
  chars: number,
  reason: string,
  client?: SupabaseClient
): Promise<void> {
  await spend(elevenLabsTtsCredits(chars), reason, {
    provider: "elevenlabs",
    kind: "tts",
    chars,
  }, client);
}

/** Meter an ElevenLabs speech-to-text (transcription) call. */
export async function meterElevenLabsStt(
  reason: string,
  client?: SupabaseClient
): Promise<void> {
  await spend(elevenLabsSttCredits(), reason, {
    provider: "elevenlabs",
    kind: "stt",
  }, client);
}

export interface CreditBalance {
  freeRemaining: number;
  paidBalance: number;
  total: number;
}

/** Read the current org's credit balance for display (RLS-scoped). */
export async function getCreditBalance(): Promise<CreditBalance | null> {
  if (!hasSupabase()) return null;
  try {
    const sb = await getSupabaseServer();
    const { data, error } = await sb
      .from("org_credits")
      .select("free_remaining, paid_balance")
      .maybeSingle();
    if (error || !data) return null;
    const free = Number(data.free_remaining ?? 0);
    const paid = Number(data.paid_balance ?? 0);
    return { freeRemaining: free, paidBalance: paid, total: free + paid };
  } catch {
    return null;
  }
}
