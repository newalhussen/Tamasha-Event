import type { Request, Response } from "express";
import { me, startSession } from "../middleware/auth";
import { body } from "../middleware/validate";
import * as orders from "../services/orders.service";
import * as tickets from "../services/tickets.service";
import { notFound } from "../utils/errors";
import { holdSchema, payOrderSchema, refundSchema } from "../validation/schemas";

/** Start checkout: reserve the chosen tickets for 10 minutes. Guests may hold; paying creates the account. */
export async function createHold(req: Request, res: Response) {
  const input = body(req, holdSchema);
  const order = await orders.createHold({ eventId: input.eventId, items: input.items, userId: req.user?.id, source: input.source });
  res.json({ orderId: order.id, holdExpiresAt: order.holdExpiresAt.toISOString() });
}

export async function checkout(req: Request, res: Response) {
  const order = await orders.loadCheckout(String(req.params.id), req.user?.id);
  if (!order) throw notFound("That order");
  res.json({ order });
}

export async function pay(req: Request, res: Response) {
  const input = body(req, payOrderSchema);
  const result = await orders.payCheckout(req.user, String(req.params.id), input);
  if (result.createdUserId) await startSession(res, result.createdUserId, "ATTENDEE");
  res.json({ orderId: result.orderId, alreadyPaid: result.alreadyPaid });
}

export async function refund(req: Request, res: Response) {
  const { reason } = body(req, refundSchema);
  res.json(await orders.requestRefund(String(req.params.id), me(req).id, reason));
}

export async function confirmation(req: Request, res: Response) {
  res.json({ order: await tickets.orderConfirmation(me(req).id, String(req.params.id)) });
}
