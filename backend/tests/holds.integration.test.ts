// Integration test: needs a migrated PostgreSQL database (DATABASE_URL). Run with `npm test`.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { db } from "../src/db/prisma";
import { checkInByCode } from "../src/services/checkin.service";
import { cancelEventAndRefund, createHold, payOrder, requestRefund } from "../src/services/orders.service";

const stamp = Date.now();
let organizerId = "";
let userId = "";
let eventId = "";
let typeId = "";

before(async () => {
  const user = await db.user.create({ data: { name: "Test Organizer", email: `org${stamp}@test.local`, passwordHash: "x", role: "ORGANIZER" } });
  userId = user.id;
  const org = await db.organizer.create({ data: { userId: user.id, name: `Test Org ${stamp}`, slug: `test-org-${stamp}`, verified: true, status: "VERIFIED" } });
  organizerId = org.id;
  const event = await db.event.create({
    data: {
      organizerId,
      slug: `test-event-${stamp}`,
      title: "Concurrency Test Night",
      startsAt: new Date(Date.now() + 5 * 86_400_000),
      capacity: 50,
      status: "PUBLISHED",
      refundUntil: new Date(Date.now() + 2 * 86_400_000),
    },
  });
  eventId = event.id;
  const type = await db.ticketType.create({ data: { eventId, name: "General", kind: "PAID", price: 500, quantity: 5 } });
  typeId = type.id;
});

after(async () => {
  await db.event.deleteMany({ where: { id: eventId } });
  await db.organizer.deleteMany({ where: { id: organizerId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});

test("ten buyers racing for five tickets: exactly five holds succeed, none oversell", async () => {
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => createHold({ eventId, items: [{ ticketTypeId: typeId, quantity: 1 }] })));
  const ok = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");
  assert.equal(ok.length, 5);
  assert.equal(rejected.length, 5);
  const held = await db.ticket.count({ where: { eventId, status: "HELD" } });
  assert.equal(held, 5);
});

test("pay, check in once, refund inside the window, and cancel refunds everyone", async () => {
  await db.ticket.deleteMany({ where: { eventId } });
  await db.order.deleteMany({ where: { eventId } });
  const buyer = await db.user.create({ data: { name: "Test Buyer", email: `buyer${stamp}@test.local`, passwordHash: "x" } });
  try {
    const hold = await createHold({ eventId, items: [{ ticketTypeId: typeId, quantity: 2 }], userId: buyer.id });
    await payOrder({ orderId: hold.id, userId: buyer.id, name: "Test Buyer", email: buyer.email, phone: "0911234567", holders: [], method: "TELEBIRR", payPhone: "0911234567" });
    const tickets = await db.ticket.findMany({ where: { orderId: hold.id }, orderBy: { seq: "asc" } });
    assert.ok(tickets.every((t) => t.status === "VALID"));

    // Two scanners hit the same ticket at once: only one is admitted.
    const scans = await Promise.all([checkInByCode(eventId, tickets[0].code, userId, "Gate A"), checkInByCode(eventId, tickets[0].code, userId, "Gate B")]);
    assert.deepEqual(scans.map((s) => s.kind).sort(), ["ALREADY", "OK"]);

    // A used ticket blocks self-service refunds for the order.
    await assert.rejects(() => requestRefund(hold.id, buyer.id), /already used/);

    const second = await createHold({ eventId, items: [{ ticketTypeId: typeId, quantity: 1 }], userId: buyer.id });
    await payOrder({ orderId: second.id, userId: buyer.id, name: "Test Buyer", email: buyer.email, phone: "0911234567", holders: [], method: "CBE_BIRR", payPhone: "0911234567" });
    const refund = await requestRefund(second.id, buyer.id);
    assert.equal(refund.refunded, true);

    const { refundedOrders } = await cancelEventAndRefund(eventId);
    assert.equal(refundedOrders, 1);
    assert.equal(await db.ticket.count({ where: { eventId, status: { in: ["VALID", "CHECKED_IN"] } } }), 0);
  } finally {
    await db.ticket.deleteMany({ where: { eventId } });
    await db.order.deleteMany({ where: { eventId } });
    await db.user.delete({ where: { id: buyer.id } });
  }
});
