import { test } from "node:test";
import assert from "node:assert/strict";

import {
  areaCodeOf,
  pickOutboundNumber,
  type OutboundNumber,
} from "@/lib/wildcat/outbound";

// --- areaCodeOf ---------------------------------------------------------------

test("areaCodeOf: 10-digit national number", () => {
  assert.equal(areaCodeOf("4325551234"), "432");
});

test("areaCodeOf: 11-digit with US country code", () => {
  assert.equal(areaCodeOf("14325551234"), "432");
});

test("areaCodeOf: formatted with punctuation/spaces", () => {
  assert.equal(areaCodeOf("+1 (432) 555-1234"), "432");
  assert.equal(areaCodeOf("432.555.1234"), "432");
});

test("areaCodeOf: too short returns null", () => {
  assert.equal(areaCodeOf("5551234"), null);
  assert.equal(areaCodeOf(""), null);
});

test("areaCodeOf: 11 digits NOT starting with 1 keeps first 3", () => {
  // Defensive: not a US-1 prefix, so treated as a >=10 digit string.
  assert.equal(areaCodeOf("23455512345"), "234");
});

// --- pickOutboundNumber -------------------------------------------------------

const NUMS: OutboundNumber[] = [
  { e164: "+14325550001", areaCode: "432" }, // Midland TX
  { e164: "+15755550002", areaCode: "575" }, // Hobbs NM
  { e164: "+12125550003", areaCode: "212" }, // NYC
];

test("exact area-code match wins", () => {
  const pick = pickOutboundNumber("432", NUMS);
  assert.equal(pick?.e164, "+14325550001");
});

test("same-state preference when no exact match (TX target -> TX number)", () => {
  // 806 (Lubbock, TX) not owned; should prefer the TX number (432) over NM/NY.
  const pick = pickOutboundNumber("806", NUMS);
  assert.equal(pick?.areaCode, "432");
});

test("nearest centroid across states when no same-state owned number", () => {
  // Target 719 (Colorado Springs). Owned: NM(575) and NY(212). NM is closer.
  const pick = pickOutboundNumber("719", [
    { e164: "+15755550002", areaCode: "575" },
    { e164: "+12125550003", areaCode: "212" },
  ]);
  assert.equal(pick?.areaCode, "575");
});

test("unknown target area code falls back to first active", () => {
  const pick = pickOutboundNumber("999", NUMS);
  assert.equal(pick?.e164, "+14325550001");
});

test("null target falls back to first active", () => {
  const pick = pickOutboundNumber(null, NUMS);
  assert.equal(pick?.e164, "+14325550001");
});

test("inactive numbers are excluded", () => {
  const pick = pickOutboundNumber("432", [
    { e164: "+14325550001", areaCode: "432", active: false },
    { e164: "+15755550002", areaCode: "575" },
  ]);
  // 432 is inactive, so exact match must NOT be returned.
  assert.equal(pick?.e164, "+15755550002");
});

test("empty pool returns null", () => {
  assert.equal(pickOutboundNumber("432", []), null);
  assert.equal(
    pickOutboundNumber("432", [{ e164: "+1", areaCode: "432", active: false }]),
    null
  );
});

test("target known but no owned number has a centroid -> first active", () => {
  // Target 432 (known centroid), but owned numbers have area codes absent from
  // the centroid table, so the nearest-centroid branch finds an empty pool.
  const pick = pickOutboundNumber("806", [
    { e164: "+19995550001", areaCode: "999" },
    { e164: "+18885550002", areaCode: "888" },
  ]);
  assert.equal(pick?.e164, "+19995550001");
});
