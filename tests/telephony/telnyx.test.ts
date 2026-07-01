import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  encodeClientState,
  decodeClientState,
  verifyTelnyxSignature,
  hasTelnyx,
} from "@/lib/wildcat/telephony/telnyx";

// --- client_state codec -------------------------------------------------------

test("encode/decode round-trips an object", () => {
  const value = { callId: "abc-123", track: "inbound" };
  const enc = encodeClientState(value);
  assert.deepEqual(decodeClientState(enc), value);
});

test("encodeClientState produces valid base64 (Telnyx requires base64)", () => {
  const enc = encodeClientState({ callId: "x" });
  assert.match(enc, /^[A-Za-z0-9+/]+=*$/);
  // and it decodes back to JSON
  assert.deepEqual(
    JSON.parse(Buffer.from(enc, "base64").toString("utf8")),
    { callId: "x" }
  );
});

test("decodeClientState handles null/undefined/empty", () => {
  assert.equal(decodeClientState(null), null);
  assert.equal(decodeClientState(undefined), null);
  assert.equal(decodeClientState(""), null);
});

test("decodeClientState returns null on non-JSON base64 instead of throwing", () => {
  const garbage = Buffer.from("not json at all", "utf8").toString("base64");
  assert.equal(decodeClientState(garbage), null);
});

test("decodeClientState returns null on non-base64 junk instead of throwing", () => {
  // Buffer.from(..., "base64") is lenient, so this exercises the JSON.parse catch.
  assert.equal(decodeClientState("@@@not-base64@@@"), null);
});

// --- Ed25519 webhook signature verification -----------------------------------

// SPKI DER prefix for an Ed25519 public key, before the 32 raw key bytes.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

interface Keypair {
  publicKeyB64: string; // raw 32 bytes, base64 (the TELNYX_PUBLIC_KEY format)
  sign: (message: string) => string; // base64 signature
}

function makeKeypair(): Keypair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const spki = publicKey.export({ format: "der", type: "spki" }) as Buffer;
  const raw = spki.subarray(ED25519_SPKI_PREFIX.length); // last 32 bytes
  return {
    publicKeyB64: raw.toString("base64"),
    sign: (message: string) =>
      crypto.sign(null, Buffer.from(message, "utf8"), privateKey).toString("base64"),
  };
}

function nowTs(): string {
  return String(Math.floor(Date.now() / 1000));
}

// Run each case with TELNYX_PUBLIC_KEY set, restoring env afterward.
function withPublicKey<T>(b64: string | undefined, fn: () => T): T {
  const prev = process.env.TELNYX_PUBLIC_KEY;
  if (b64 === undefined) delete process.env.TELNYX_PUBLIC_KEY;
  else process.env.TELNYX_PUBLIC_KEY = b64;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.TELNYX_PUBLIC_KEY;
    else process.env.TELNYX_PUBLIC_KEY = prev;
  }
}

test("valid signature over `${ts}|${body}` verifies", () => {
  const kp = makeKeypair();
  const ts = nowTs();
  const body = JSON.stringify({ event_type: "call.answered" });
  const sig = kp.sign(`${ts}|${body}`);
  withPublicKey(kp.publicKeyB64, () => {
    assert.equal(verifyTelnyxSignature(body, sig, ts), true);
  });
});

test("tampered body fails", () => {
  const kp = makeKeypair();
  const ts = nowTs();
  const body = JSON.stringify({ event_type: "call.answered" });
  const sig = kp.sign(`${ts}|${body}`);
  withPublicKey(kp.publicKeyB64, () => {
    assert.equal(verifyTelnyxSignature(body + " ", sig, ts), false);
  });
});

test("re-serialized (whitespace-different) body fails — raw body matters", () => {
  const kp = makeKeypair();
  const ts = nowTs();
  const raw = '{"event_type":"call.answered"}';
  const reserialized = JSON.stringify(JSON.parse(raw)); // same here, but prove pretty-print breaks it
  const pretty = JSON.stringify(JSON.parse(raw), null, 2);
  const sig = kp.sign(`${ts}|${raw}`);
  withPublicKey(kp.publicKeyB64, () => {
    assert.equal(verifyTelnyxSignature(raw, sig, ts), true);
    assert.equal(verifyTelnyxSignature(reserialized, sig, ts), true);
    assert.equal(verifyTelnyxSignature(pretty, sig, ts), false);
  });
});

test("signature from a different key fails", () => {
  const signer = makeKeypair();
  const other = makeKeypair();
  const ts = nowTs();
  const body = "{}";
  const sig = signer.sign(`${ts}|${body}`);
  withPublicKey(other.publicKeyB64, () => {
    assert.equal(verifyTelnyxSignature(body, sig, ts), false);
  });
});

test("expired timestamp (>5 min old) is rejected (replay protection)", () => {
  const kp = makeKeypair();
  const ts = String(Math.floor(Date.now() / 1000) - 301);
  const body = "{}";
  const sig = kp.sign(`${ts}|${body}`);
  withPublicKey(kp.publicKeyB64, () => {
    assert.equal(verifyTelnyxSignature(body, sig, ts), false);
  });
});

test("far-future timestamp is rejected", () => {
  const kp = makeKeypair();
  const ts = String(Math.floor(Date.now() / 1000) + 600);
  const body = "{}";
  const sig = kp.sign(`${ts}|${body}`);
  withPublicKey(kp.publicKeyB64, () => {
    assert.equal(verifyTelnyxSignature(body, sig, ts), false);
  });
});

test("non-numeric timestamp is rejected", () => {
  const kp = makeKeypair();
  const body = "{}";
  const sig = kp.sign(`notanumber|${body}`);
  withPublicKey(kp.publicKeyB64, () => {
    assert.equal(verifyTelnyxSignature(body, sig, "notanumber"), false);
  });
});

test("missing signature, timestamp, or public key all fail closed", () => {
  const kp = makeKeypair();
  const ts = nowTs();
  const body = "{}";
  const sig = kp.sign(`${ts}|${body}`);
  // missing pieces
  withPublicKey(kp.publicKeyB64, () => {
    assert.equal(verifyTelnyxSignature(body, null, ts), false);
    assert.equal(verifyTelnyxSignature(body, sig, null), false);
  });
  // missing public key env
  withPublicKey(undefined, () => {
    assert.equal(verifyTelnyxSignature(body, sig, ts), false);
  });
});

test("wrong-length public key is rejected (not 32 bytes)", () => {
  const ts = nowTs();
  const body = "{}";
  const badKey = crypto.randomBytes(16).toString("base64");
  withPublicKey(badKey, () => {
    assert.equal(verifyTelnyxSignature(body, "AAAA", ts), false);
  });
});

// --- hasTelnyx env gating -----------------------------------------------------

test("hasTelnyx requires both API key and credential id", () => {
  const { TELNYX_API_KEY, TELNYX_CREDENTIAL_ID } = process.env;
  try {
    delete process.env.TELNYX_API_KEY;
    delete process.env.TELNYX_CREDENTIAL_ID;
    assert.equal(hasTelnyx(), false);

    process.env.TELNYX_API_KEY = "k";
    assert.equal(hasTelnyx(), false, "API key alone is insufficient");

    process.env.TELNYX_CREDENTIAL_ID = "c";
    assert.equal(hasTelnyx(), true);
  } finally {
    if (TELNYX_API_KEY === undefined) delete process.env.TELNYX_API_KEY;
    else process.env.TELNYX_API_KEY = TELNYX_API_KEY;
    if (TELNYX_CREDENTIAL_ID === undefined) delete process.env.TELNYX_CREDENTIAL_ID;
    else process.env.TELNYX_CREDENTIAL_ID = TELNYX_CREDENTIAL_ID;
  }
});
