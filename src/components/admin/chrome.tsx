import { AdminHeader } from "@/components/layout/staff-header";
import { adminCounts } from "@/lib/admin";
import { requirePage } from "@/lib/auth";

/** Console header with live queue badges. Each admin page renders it with its own `current` tab. */
export async function AdminChrome({ current }: { current: "overview" | "events" | "organizers" | "users" | "reports" }) {
  const user = await requirePage(["ADMIN"], "/admin");
  const counts = await adminCounts();
  return <AdminHeader user={user} current={current} counts={counts} />;
}
