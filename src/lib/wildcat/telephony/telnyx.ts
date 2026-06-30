import "server-only";

import crypto from "node:crypto";

/**
 * Telnyx Call Control + WebRTC helpers (REST via fetch, no SDK dependency).
 * See plans/telnyx_dialer.md for the full integration spec. All functions throw
 * on misconfiguration; callers gate on `hasTelnyx()` first.
 */

const API = "https://api.telnyx.com/v2";

/** True when the server has the env needed to mint tokens + issue commands. */
export function hasTelnyx(): boolean {
  return Boolean(process.env.TELNYX_API_KEY && process.env.TELNYX_CREDENTIAL_ID);
}

function apiKey(): string {
  const key = process.env.TELNYX_API_KEY;
  if (!key) throw new Error("TELNYX_API_KEY is not set");
  return key;
}

/**
 * Mint a short-lived (24h) WebRTC JWT from the on-demand telephony credential.
 * The token endpoint returns the JWT as text/plain.
 */
export async function mintWebrtcToken(): Promise<string> {
  const credentialId = process.env.TELNYX_CREDENTIAL_ID;
  if (!credentialId) throw new Error("TELNYX_CREDENTIAL_ID is not set");
  const res = await fetch(
    `${API}/telephony_credentials/${credentialId}/token`,
    { method: "POST", headers: { authorization: `Bearer ${apiKey()}` } }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Telnyx token failed (${res.status}): ${detail}`);
  }
  return (await res.text()).trim();
}

export type TranscriptTrack = "inbound" | "outbound";

/** client_state we attach to the dialed leg (rides on call.* webhooks). */
export interface CallClientState {
  callId: string;
}

/** client_state we attach to each transcription (rides on call.transcription). */
export interface TranscriptionClientState {
  callId: string;
  track: TranscriptTrack;
}

export function encodeClientState(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

export function decodeClientState<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * Start real-time transcription on one track of a call. We start two (inbound +
 * outbound) per call so the resulting `call.transcription` webhooks can be
 * attributed to rep vs prospect via their distinct client_state.
 */
export async function startTranscription(
  callControlId: string,
  track: TranscriptTrack,
  clientState: string
): Promise<void> {
  const res = await fetch(
    `${API}/calls/${encodeURIComponent(callControlId)}/actions/transcription_start`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        transcription_engine: "Deepgram",
        transcription_tracks: track,
        transcription_engine_config: { transcription_model: "deepgram/nova-3" },
        client_state: clientState,
      }),
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`transcription_start (${track}) failed (${res.status}): ${detail}`);
  }
}

// SPKI DER prefix for an Ed25519 public key, before the 32 raw key bytes.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/**
 * Verify a Telnyx webhook signature. The signed payload is
 * `${timestamp}|${rawBody}`, Ed25519-signed with the account public key
 * (Base64). Rejects signatures older than 5 minutes (replay protection).
 *
 * Pass the RAW request body — re-serialized JSON will not match.
 */
export function verifyTelnyxSignature(
  rawBody: string,
  signatureB64: string | null,
  timestamp: string | null
): boolean {
  const publicKeyB64 = process.env.TELNYX_PUBLIC_KEY;
  if (!publicKeyB64 || !signatureB64 || !timestamp) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  try {
    const rawKey = Buffer.from(publicKeyB64, "base64");
    if (rawKey.length !== 32) return false;
    const der = Buffer.concat([ED25519_SPKI_PREFIX, rawKey]);
    const key = crypto.createPublicKey({ key: der, format: "der", type: "spki" });
    const message = Buffer.from(`${timestamp}|${rawBody}`, "utf8");
    const signature = Buffer.from(signatureB64, "base64");
    return crypto.verify(null, message, key, signature);
  } catch {
    return false;
  }
}
