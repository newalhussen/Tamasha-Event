import { parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requestRefund } from "@/lib/orders";
import { refundSchema } from "@/lib/validation";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireUser(["ATTENDEE"]);
  const { reason } = await parseBody(req, refundSchema);
  return requestRefund(id, user.id, reason);
});
