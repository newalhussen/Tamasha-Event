import { requirePage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePage(["ADMIN"], "/admin");
  return <div className="min-h-screen bg-bg text-[15px]">{children}</div>;
}
