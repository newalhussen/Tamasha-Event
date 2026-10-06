import type { Metadata } from "next";
import Link from "next/link";
import { AdminChrome } from "@/components/admin/chrome";
import { UserStatusButton } from "@/components/admin/row-actions";
import { requirePage } from "@/lib/auth";
import { apiGet } from "@/lib/server-api";
import { dateShort } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Admin · Users" };
const ROLES = [
  { key: "all", label: "Everyone" },
  { key: "ATTENDEE", label: "Attendees" },
  { key: "ORGANIZER", label: "Organizers" },
  { key: "ADMIN", label: "Admins" },
];

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string }> }) {
  const { q = "", role = "all", page: rp } = await searchParams;
  const me = await requirePage(["ADMIN"], "/admin/users");
  const page = Math.max(1, Number(rp) || 1);
  const { rows, total, pageSize } = await apiGet<{
    total: number;
    pageSize: number;
    rows: { id: string; name: string; email: string; phone: string | null; role: string; status: string; createdAt: string; orders: number; organizerName: string | null }[];
  }>(`/admin/users?q=${encodeURIComponent(q)}&role=${role}&page=${page}`);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (over: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, role, ...over })) if (v && v !== "all") sp.set(k, v);
    return `/admin/users${sp.size ? `?${sp}` : ""}`;
  };

  return (
    <>
      <AdminChrome current="users" />
      <main className="mx-auto flex max-w-[1360px] flex-col gap-6 px-4 pb-[72px] pt-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="h-display text-[clamp(30px,4vw,40px)]">Users</h1>
          <form action="/admin/users" role="search" className="flex gap-2">
            {role !== "all" && <input type="hidden" name="role" value={role} />}
            <label htmlFor="uq" className="sr-only">
              Search users
            </label>
            <input id="uq" name="q" defaultValue={q} type="search" placeholder="Name, email or phone" className="input !h-11 !w-[260px]" />
            <button className="btn btn-dark">Search</button>
          </form>
        </div>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <Link key={r.key} href={href({ role: r.key, page: undefined })} className="pill" aria-pressed={role === r.key}>
              {r.label}
            </Link>
          ))}
        </div>
        <div className="table-card">
          <table style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Role</th>
                <th scope="col">Phone</th>
                <th scope="col">Orders</th>
                <th scope="col">Joined</th>
                <th scope="col" className="text-right">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className={u.status === "SUSPENDED" ? "text-muted" : ""}>
                  <td>
                    <div className="font-bold">
                      {u.name} {u.status === "SUSPENDED" && <span className="badge badge-danger ml-1">Suspended</span>}
                    </div>
                    <div className="text-sm text-muted">{u.email}</div>
                  </td>
                  <td>
                    <span className={`badge ${u.role === "ADMIN" ? "badge-rose" : u.role === "ORGANIZER" ? "badge-tint" : "badge-neutral"}`}>{u.role.toLowerCase()}</span>
                    {u.organizerName && <div className="text-[13px] text-muted">{u.organizerName}</div>}
                  </td>
                  <td>{formatPhone(u.phone) || "—"}</td>
                  <td>{u.orders}</td>
                  <td className="text-muted">{dateShort(u.createdAt)}</td>
                  <td className="text-right">{u.role === "ADMIN" && u.id !== me.id ? <span className="text-sm text-muted">Protected</span> : <UserStatusButton userId={u.id} status={u.status} self={u.id === me.id} />}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted">
                    No users match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between text-muted">
            <span>
              Page {page} of {pages} · {total} users
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={href({ page: String(page - 1) })} className="btn">
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link href={href({ page: String(page + 1) })} className="btn">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
