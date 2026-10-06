import type { Organizer, User } from "@prisma/client";
import type { OrgInfo } from "@/components/admin/organizer-review";
import { dateShort } from "./format";
import { formatPhone } from "./phone";

/** Serializable organizer summary for the admin review dialog. */
export function orgInfo(o: Organizer & { user: User; _count: { events: number } }): OrgInfo {
  return {
    id: o.id,
    name: o.name,
    ownerName: o.user.name,
    ownerEmail: o.user.email,
    ownerPhone: formatPhone(o.user.phone),
    joined: dateShort(o.createdAt),
    events: o._count.events,
    status: o.status,
    verified: o.verified,
    payoutBank: o.payoutBank,
    payoutAccountMasked: o.payoutAccount ? `••••${o.payoutAccount.slice(-4)}` : null,
    payoutVerified: o.payoutVerified,
    note: o.verificationNote,
  };
}
