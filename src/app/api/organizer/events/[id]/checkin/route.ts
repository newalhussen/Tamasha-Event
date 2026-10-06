import { parseBody, route } from "@/lib/api";
import { getManagedEvent } from "@/lib/access";
import { requireOrganizer } from "@/lib/auth";
import { checkInByCode, checkInProgress } from "@/lib/checkin";
import { checkInSchema } from "@/lib/validation";

/** Door scanner: validate a scanned or typed ticket code and check it in. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const user = await requireOrganizer();
  await getManagedEvent(user, id);
  const { code, gate } = await parseBody(req, checkInSchema);
  const [result, progress] = [await checkInByCode(id, code, user.id, gate), await checkInProgress(id)];
  return { result, progress };
});
