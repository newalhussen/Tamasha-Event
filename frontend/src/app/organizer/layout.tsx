import { requirePage } from "@/lib/auth";

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage(["ORGANIZER"], "/organizer");
  if (!user.organizer) {
    return <div className="p-10">Your account has no organizer profile. Contact support.</div>;
  }
  return children;
}
