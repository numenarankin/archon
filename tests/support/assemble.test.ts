import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assembleStaffThreads,
  unknownRequester,
  type StaffAttachmentRow,
  type StaffMessageRow,
  type StaffThreadRow,
} from "@/lib/support/assemble";
import type { SupportRequester } from "@/lib/support/types";

const REQUESTER: SupportRequester = {
  id: "owner-1",
  name: "Jane Pumper",
  email: "jane@well.co",
};

function thread(overrides: Partial<StaffThreadRow> = {}): StaffThreadRow {
  return {
    id: "t1",
    owner_id: "owner-1",
    subject: "Tank gauge question",
    status: "open",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:05:00Z",
    last_message_at: "2026-06-01T00:05:00Z",
    staff_last_read_at: null,
    ...overrides,
  };
}

function msg(overrides: Partial<StaffMessageRow> = {}): StaffMessageRow {
  return {
    id: "m1",
    thread_id: "t1",
    sender_role: "user",
    body: "Hi",
    created_at: "2026-06-01T00:01:00Z",
    ...overrides,
  };
}

const requesters = new Map([["owner-1", REQUESTER]]);

test("attaches the resolved requester to its thread", () => {
  const [t] = assembleStaffThreads([thread()], [msg()], [], requesters, new Map());
  assert.deepEqual(t.requester, REQUESTER);
});

test("falls back to an Unknown requester when the owner can't be resolved", () => {
  const [t] = assembleStaffThreads([thread()], [msg()], [], new Map(), new Map());
  assert.deepEqual(t.requester, unknownRequester("owner-1"));
  assert.equal(t.requester.email, "");
});

test("unread when the last message is from the user and never read by staff", () => {
  const [t] = assembleStaffThreads(
    [thread({ staff_last_read_at: null })],
    [msg({ sender_role: "user" })],
    [],
    requesters,
    new Map()
  );
  assert.equal(t.unread, true);
});

test("read when staff watermark is newer than the last message", () => {
  const [t] = assembleStaffThreads(
    [thread({ staff_last_read_at: "2026-06-01T00:10:00Z" })],
    [msg({ sender_role: "user", created_at: "2026-06-01T00:01:00Z" })],
    [],
    requesters,
    new Map()
  );
  assert.equal(t.unread, false);
});

test("NOT unread when the last message came from staff (own reply)", () => {
  const [t] = assembleStaffThreads(
    [thread({ staff_last_read_at: null })],
    [
      msg({ id: "m1", sender_role: "user", body: "Hi" }),
      msg({ id: "m2", sender_role: "staff", body: "Hello!" }),
    ],
    [],
    requesters,
    new Map()
  );
  assert.equal(t.unread, false);
});

test("a thread with no messages is not unread", () => {
  const [t] = assembleStaffThreads([thread()], [], [], requesters, new Map());
  assert.equal(t.unread, false);
  assert.equal(t.messages.length, 0);
});

test("preserves per-thread message order from the input", () => {
  const [t] = assembleStaffThreads(
    [thread()],
    [
      msg({ id: "m1", body: "first" }),
      msg({ id: "m2", body: "second" }),
      msg({ id: "m3", body: "third" }),
    ],
    [],
    requesters,
    new Map()
  );
  assert.deepEqual(
    t.messages.map((m) => m.body),
    ["first", "second", "third"]
  );
});

test("groups attachments onto their message and signs by storage key", () => {
  const att: StaffAttachmentRow[] = [
    { message_id: "m1", file_id: "f1", name: "gauge.pdf", storageKey: "key-1" },
  ];
  const urlByKey = new Map([["key-1", "https://signed/key-1"]]);
  const [t] = assembleStaffThreads([thread()], [msg({ id: "m1" })], att, requesters, urlByKey);
  assert.equal(t.messages[0].attachments.length, 1);
  assert.deepEqual(t.messages[0].attachments[0], {
    id: "f1",
    name: "gauge.pdf",
    url: "https://signed/key-1",
  });
});

test("attachment with an unsigned key yields a null url (name still shows)", () => {
  const att: StaffAttachmentRow[] = [
    { message_id: "m1", file_id: "f1", name: null, storageKey: "missing" },
  ];
  const [t] = assembleStaffThreads([thread()], [msg({ id: "m1" })], att, requesters, new Map());
  assert.deepEqual(t.messages[0].attachments[0], {
    id: "f1",
    name: "file",
    url: null,
  });
});

test("multiple threads keep their own messages and requesters", () => {
  const other: SupportRequester = { id: "owner-2", name: "Bob", email: "bob@x.co" };
  const rs = new Map([
    ["owner-1", REQUESTER],
    ["owner-2", other],
  ]);
  const rows = assembleStaffThreads(
    [thread({ id: "t1", owner_id: "owner-1" }), thread({ id: "t2", owner_id: "owner-2" })],
    [
      msg({ id: "a", thread_id: "t1", body: "t1 only" }),
      msg({ id: "b", thread_id: "t2", body: "t2 only" }),
    ],
    [],
    rs,
    new Map()
  );
  const t1 = rows.find((t) => t.id === "t1")!;
  const t2 = rows.find((t) => t.id === "t2")!;
  assert.deepEqual(t1.messages.map((m) => m.body), ["t1 only"]);
  assert.deepEqual(t2.messages.map((m) => m.body), ["t2 only"]);
  assert.equal(t1.requester.name, "Jane Pumper");
  assert.equal(t2.requester.name, "Bob");
});
