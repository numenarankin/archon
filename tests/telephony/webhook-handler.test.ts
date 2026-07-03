import { test } from "node:test";
import assert from "node:assert/strict";

import { handleEvent, type WebhookDeps } from "@/app/api/telnyx/webhook/route";
import { encodeClientState } from "@/lib/wildcat/telephony/telnyx";

/**
 * Exercises the webhook branch logic with a fake Supabase admin and a spy
 * startTranscription, so the DB side-effects are asserted without live infra.
 */

interface Op {
  op: "update" | "insert" | "select";
  table: string;
  patch?: Record<string, unknown>;
  row?: Record<string, unknown>;
  eq?: { col: string; val: unknown };
}

interface FakeAdmin {
  ops: Op[];
  client: WebhookDeps["admin"];
}

// A minimal chainable stand-in for the subset of the Supabase client the
// handler uses: from().update().eq(), from().insert(), from().select().eq().maybeSingle().
function makeFakeAdmin(seed: { workspaceId?: string | null } = {}): FakeAdmin {
  const ops: Op[] = [];
  const client = {
    from(table: string) {
      return {
        update(patch: Record<string, unknown>) {
          return {
            eq(col: string, val: unknown) {
              ops.push({ op: "update", table, patch, eq: { col, val } });
              return Promise.resolve({ error: null });
            },
          };
        },
        insert(row: Record<string, unknown>) {
          ops.push({ op: "insert", table, row });
          return Promise.resolve({ error: null });
        },
        select() {
          return {
            eq(col: string, val: unknown) {
              return {
                maybeSingle() {
                  ops.push({ op: "select", table, eq: { col, val } });
                  const data =
                    seed.workspaceId === undefined
                      ? { workspace_id: "ws-1" }
                      : seed.workspaceId === null
                        ? null
                        : { workspace_id: seed.workspaceId };
                  return Promise.resolve({ data, error: null });
                },
              };
            },
          };
        },
      };
    },
  };
  return { ops, client: client as unknown as WebhookDeps["admin"] };
}

function spyTranscription() {
  const calls: Array<{ callControlId: string; track: string; clientState: string }> = [];
  const fn: WebhookDeps["startTranscription"] = async (callControlId, track, clientState) => {
    calls.push({ callControlId, track, clientState });
  };
  return { calls, fn };
}

const CALL_ID = "call-uuid-1";

test("call.initiated stores the provider_call_id on the sales_calls row", async () => {
  const admin = makeFakeAdmin();
  const t = spyTranscription();
  await handleEvent(
    "call.initiated",
    {
      call_control_id: "cc-123",
      client_state: encodeClientState({ callId: CALL_ID }),
    },
    { admin: admin.client, startTranscription: t.fn }
  );
  assert.deepEqual(admin.ops, [
    {
      op: "update",
      table: "sales_calls",
      patch: { provider_call_id: "cc-123" },
      eq: { col: "id", val: CALL_ID },
    },
  ]);
});

test("call.initiated with no client_state is a no-op", async () => {
  const admin = makeFakeAdmin();
  const t = spyTranscription();
  await handleEvent(
    "call.initiated",
    { call_control_id: "cc-123", client_state: null },
    { admin: admin.client, startTranscription: t.fn }
  );
  assert.equal(admin.ops.length, 0);
});

test("call.answered starts BOTH transcription tracks with track-tagged client_state", async () => {
  const admin = makeFakeAdmin();
  const t = spyTranscription();
  await handleEvent(
    "call.answered",
    {
      call_control_id: "cc-xyz",
      client_state: encodeClientState({ callId: CALL_ID }),
    },
    { admin: admin.client, startTranscription: t.fn }
  );
  assert.equal(t.calls.length, 2);
  const tracks = t.calls.map((c) => c.track).sort();
  assert.deepEqual(tracks, ["inbound", "outbound"]);
  for (const c of t.calls) {
    assert.equal(c.callControlId, "cc-xyz");
    // client_state must carry both the callId and its own track back to us.
    const decoded = JSON.parse(Buffer.from(c.clientState, "base64").toString("utf8"));
    assert.equal(decoded.callId, CALL_ID);
    assert.equal(decoded.track, c.track);
  }
});

test("call.answered without call_control_id does not start transcription", async () => {
  const admin = makeFakeAdmin();
  const t = spyTranscription();
  await handleEvent(
    "call.answered",
    { client_state: encodeClientState({ callId: CALL_ID }) },
    { admin: admin.client, startTranscription: t.fn }
  );
  assert.equal(t.calls.length, 0);
});

test("call.transcription (rep track) inserts a line WITHOUT an app-set seq", async () => {
  const admin = makeFakeAdmin({ workspaceId: "ws-42" });
  const t = spyTranscription();
  await handleEvent(
    "call.transcription",
    {
      client_state: encodeClientState({ callId: CALL_ID, track: "inbound" }),
      transcription_data: { transcript: "hello there", is_final: true },
    },
    { admin: admin.client, startTranscription: t.fn }
  );
  const insert = admin.ops.find((o) => o.op === "insert");
  assert.ok(insert, "expected an insert");
  assert.equal(insert.table, "sales_call_lines");
  assert.equal(insert.row?.workspace_id, "ws-42");
  assert.equal(insert.row?.call_id, CALL_ID);
  assert.equal(insert.row?.speaker, "rep"); // inbound -> rep
  assert.equal(insert.row?.text, "hello there");
  // The race fix: the app must not send seq; the DB assigns it.
  assert.ok(
    !("seq" in (insert.row ?? {})),
    "seq must be omitted so the DB identity assigns it"
  );
});

test("call.transcription (outbound track) maps to prospect", async () => {
  const admin = makeFakeAdmin({ workspaceId: "ws-42" });
  const t = spyTranscription();
  await handleEvent(
    "call.transcription",
    {
      client_state: encodeClientState({ callId: CALL_ID, track: "outbound" }),
      transcription_data: { transcript: "who is this", is_final: true },
    },
    { admin: admin.client, startTranscription: t.fn }
  );
  const insert = admin.ops.find((o) => o.op === "insert");
  assert.equal(insert?.row?.speaker, "prospect");
});

test("call.transcription ignores non-final segments", async () => {
  const admin = makeFakeAdmin();
  const t = spyTranscription();
  await handleEvent(
    "call.transcription",
    {
      client_state: encodeClientState({ callId: CALL_ID, track: "inbound" }),
      transcription_data: { transcript: "par", is_final: false },
    },
    { admin: admin.client, startTranscription: t.fn }
  );
  assert.equal(admin.ops.length, 0);
});

test("call.transcription ignores empty transcript text", async () => {
  const admin = makeFakeAdmin();
  const t = spyTranscription();
  await handleEvent(
    "call.transcription",
    {
      client_state: encodeClientState({ callId: CALL_ID, track: "inbound" }),
      transcription_data: { transcript: "", is_final: true },
    },
    { admin: admin.client, startTranscription: t.fn }
  );
  assert.equal(admin.ops.length, 0);
});

test("call.transcription for an unknown call (no row) does not insert", async () => {
  const admin = makeFakeAdmin({ workspaceId: null });
  const t = spyTranscription();
  await handleEvent(
    "call.transcription",
    {
      client_state: encodeClientState({ callId: CALL_ID, track: "inbound" }),
      transcription_data: { transcript: "hello", is_final: true },
    },
    { admin: admin.client, startTranscription: t.fn }
  );
  assert.ok(!admin.ops.some((o) => o.op === "insert"));
});

test("call.hangup computes duration_seconds and ended_at", async () => {
  const admin = makeFakeAdmin();
  const t = spyTranscription();
  await handleEvent(
    "call.hangup",
    {
      client_state: encodeClientState({ callId: CALL_ID }),
      start_time: "2025-09-02T09:17:44.000Z",
      end_time: "2025-09-02T09:18:06.000Z", // 22s later
    },
    { admin: admin.client, startTranscription: t.fn }
  );
  const update = admin.ops.find((o) => o.op === "update");
  assert.equal(update?.patch?.ended_at, "2025-09-02T09:18:06.000Z");
  assert.equal(update?.patch?.duration_seconds, 22);
  assert.deepEqual(update?.eq, { col: "id", val: CALL_ID });
});

test("call.hangup with only end_time sets ended_at but no duration", async () => {
  const admin = makeFakeAdmin();
  const t = spyTranscription();
  await handleEvent(
    "call.hangup",
    {
      client_state: encodeClientState({ callId: CALL_ID }),
      end_time: "2025-09-02T09:18:06.000Z",
    },
    { admin: admin.client, startTranscription: t.fn }
  );
  const update = admin.ops.find((o) => o.op === "update");
  assert.equal(update?.patch?.ended_at, "2025-09-02T09:18:06.000Z");
  assert.ok(!("duration_seconds" in (update?.patch ?? {})));
});

test("call.hangup with no timestamps writes nothing", async () => {
  const admin = makeFakeAdmin();
  const t = spyTranscription();
  await handleEvent(
    "call.hangup",
    { client_state: encodeClientState({ callId: CALL_ID }) },
    { admin: admin.client, startTranscription: t.fn }
  );
  assert.equal(admin.ops.length, 0);
});

test("unknown event types are ignored", async () => {
  const admin = makeFakeAdmin();
  const t = spyTranscription();
  await handleEvent(
    "call.machine.detection.ended",
    { call_control_id: "cc", client_state: encodeClientState({ callId: CALL_ID }) },
    { admin: admin.client, startTranscription: t.fn }
  );
  assert.equal(admin.ops.length, 0);
  assert.equal(t.calls.length, 0);
});
