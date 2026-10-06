import type { Request, Response } from "express";
import { me } from "../middleware/auth";
import { body } from "../middleware/validate";
import * as tickets from "../services/tickets.service";
import { ticketPatchSchema } from "../validation/schemas";

export async function mine(req: Request, res: Response) {
  res.json(await tickets.myTickets(me(req).id));
}

export async function byCode(req: Request, res: Response) {
  res.json({ ticket: await tickets.ticketByCode(me(req).id, String(req.params.code)) });
}

export async function patch(req: Request, res: Response) {
  const input = body(req, ticketPatchSchema);
  const user = me(req);
  await tickets.assignTicket(user.id, user.name, String(req.params.id), input);
  res.json({ ok: true });
}
