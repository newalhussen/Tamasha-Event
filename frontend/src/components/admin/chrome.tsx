import { AdminHeader } from "@/components/layout/staff-header";
import { requirePage } from "@/lib/auth";
import { apiGet } from "@/lib/server-api";

/** Console header with live queue badges. Each admin page renders it with its own `current` tab. */
export async function AdminChrome({ current }: { current: "overview" | "events" | "organizers" | "users" | "reports" }) {
  const user = await requirePage(["ADMIN"], "/admin");
  const counts = await apiGet<{ events: number; organizers: number; reports: number }>("/admin/counts");
  return <AdminHeader user={user} current={current} counts={counts} />;
}
