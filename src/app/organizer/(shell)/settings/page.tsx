import type { Metadata } from "next";
import { OrganizerHeader } from "@/components/layout/staff-header";
import { OrganizerSettingsForm } from "@/components/organizer/settings-form";
import { requirePage } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Organizer settings" };

export default async function OrganizerSettings() {
  const user = await requirePage(["ORGANIZER"], "/organizer/settings");
  const org = await db.organizer.findUniqueOrThrow({ where: { id: user.organizer!.id } });
  return (
    <>
      <OrganizerHeader user={user} current="home" />
      <main className="mx-auto flex max-w-[1360px] flex-col gap-6 px-4 pb-[72px] pt-8 sm:px-8">
        <div>
          <h1 className="h-display text-[clamp(30px,4vw,40px)]">Profile and payouts</h1>
          {org.verificationNote && <p className="mt-2 rounded-xl bg-warn-bg px-4 py-3 text-warn-ink">Message from Tamasha: {org.verificationNote}</p>}
        </div>
        <OrganizerSettingsForm
          initial={{ name: org.name, description: org.description, payoutBank: org.payoutBank ?? "", payoutAccount: org.payoutAccount ?? "", payoutVerified: org.payoutVerified }}
        />
      </main>
    </>
  );
}
