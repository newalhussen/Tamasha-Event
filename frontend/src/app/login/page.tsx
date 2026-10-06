import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/layout/auth-form";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser, homeFor } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

const DEMO = [
  ["Attendee", "meron@tamasha.et"],
  ["Organizer", "dawit@tamasha.et"],
  ["Admin", "admin@tamasha.et"],
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : homeFor(user.role));
  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader user={null} variant="checkout" />
      <main className="mx-auto flex max-w-[460px] flex-col gap-6 px-4 pb-20 pt-12">
        <div>
          <h1 className="h-display text-[40px]">Welcome back</h1>
          <p className="mt-2 text-[17px] text-muted">Sign in to see your tickets or manage your events.</p>
        </div>
        <div className="rounded-[20px] border border-line bg-white p-6 shadow-[0_12px_32px_rgba(21,18,31,0.06)]">
          <AuthForm mode="login" next={next} />
        </div>
        {process.env.NODE_ENV !== "production" && (
          <details className="rounded-2xl border border-dashed border-field bg-white px-5 py-4 text-sm">
            <summary className="cursor-pointer font-semibold">Demo accounts (development only)</summary>
            <p className="mt-2 text-muted">
              Password for every seeded account: <code className="mono">12345678</code>
            </p>
            <ul className="m-0 mt-2 list-none p-0">
              {DEMO.map(([role, email]) => (
                <li key={email} className="flex justify-between gap-3 border-t border-line py-2">
                  <span className="text-muted">{role}</span>
                  <span className="mono">{email}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
    </div>
  );
}
