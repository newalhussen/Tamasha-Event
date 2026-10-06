import type { Metadata } from "next";
import Link from "next/link";
import { NewEventForm } from "@/components/organizer/new-event-form";
import { Icon } from "@/components/ui/icon";
import { requirePage } from "@/lib/auth";

export const metadata: Metadata = { title: "Create event" };

export default async function NewEvent() {
  const user = await requirePage(["ORGANIZER"], "/organizer/events/new");
  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-night text-white">
        <div className="mx-auto flex max-w-[1360px] items-center gap-4 px-4 py-3 sm:px-8">
          <Link href="/organizer" className="on-dark flex h-11 items-center gap-2 rounded-[10px] pl-2 pr-3 font-semibold text-soft3 no-underline hover:text-white">
            <Icon name="left" size={18} stroke={2.2} />
            Exit
          </Link>
          <span className="font-display text-[19px] font-bold tracking-[-0.02em]">New event</span>
        </div>
      </header>
      <main className="mx-auto flex max-w-[640px] flex-col gap-6 px-4 pb-20 pt-12">
        <div>
          <h1 className="h-display text-[clamp(30px,4vw,40px)]">Let's start with the basics</h1>
          <p className="mt-2 text-[17px] text-muted">You can change everything later. Nothing is public until you publish{user.organizer!.verified ? "" : " and our team approves it"}.</p>
        </div>
        <NewEventForm />
      </main>
    </div>
  );
}
