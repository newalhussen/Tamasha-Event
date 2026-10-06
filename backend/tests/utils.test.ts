import assert from "node:assert/strict";
import { test } from "node:test";
import { newOrderCode, newTicketCode, normalizeTicketCode } from "../src/utils/codes";
import { area, birr, fromInputParts, toInputParts, where } from "../src/utils/format";
import { formatPhone, normalizePhone } from "../src/utils/phone";

test("Ethiopian phone numbers normalise to 09XXXXXXXX", () => {
  assert.equal(normalizePhone("0911 234 567"), "0911234567");
  assert.equal(normalizePhone("+251 911 234 567"), "0911234567");
  assert.equal(normalizePhone("251711234567"), "0711234567");
  assert.equal(normalizePhone("0812345678"), null);
  assert.equal(normalizePhone("12345"), null);
  assert.equal(formatPhone("0911234567"), "0911 234 567");
});

test("ticket codes are unambiguous and parse back from loose input", () => {
  const code = newTicketCode();
  assert.match(code, /^TMS-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  assert.equal(normalizeTicketCode(code.toLowerCase().replace(/-/g, " ")), code);
  assert.match(newOrderCode(), /^TM-\d{5}$/);
});

test("Addis Ababa time round-trips (UTC+3, no DST)", () => {
  const d = fromInputParts("2026-10-17", "19:00")!;
  assert.equal(d.toISOString(), "2026-10-17T16:00:00.000Z");
  assert.deepEqual(toInputParts(d), { date: "2026-10-17", time: "19:00" });
});

test("formatting helpers", () => {
  assert.equal(birr(1800), "ETB 1,800");
  assert.equal(area("4th floor, Skyline Building, Bole Road, Addis Ababa"), "Bole Road");
  assert.equal(where("The Depot", "Kazanchis, Addis Ababa"), "The Depot, Kazanchis");
  assert.equal(where("Hall", "Addis Ababa"), "Hall");
});
