import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/layout/auth-form";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser, homeFor } from "@/lib/auth";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; role?: string }> }) {
  const { next, role } = await searchParams;
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader user={null} variant="checkout" />
      <main className="mx-auto flex max-w-[460px] flex-col gap-6 px-4 pb-20 pt-12">
        <div>
          <h1 className="h-display text-[40px]">{role === "ORGANIZER" ? "Host your event" : "Create your account"}</h1>
          <p className="mt-2 text-[17px] text-muted">
            {role === "ORGANIZER" ? "Free events cost nothing. Paid tickets carry a 5% fee, included in the price buyers see." : "Keep your tickets in one place and walk in with a QR code."}
          </p>
        </div>
        {user ? (
          <div className="rounded-[20px] border border-line bg-white p-6">
            <p className="m-0 text-[17px]">
              You're signed in as <strong>{user.name}</strong>. To create a different account, sign out first.
            </p>
            <Link href={homeFor(user.role)} className="btn btn-dark btn-md mt-4">
              Continue
            </Link>
          </div>
        ) : (
          <div className="rounded-[20px] border border-line bg-white p-6 shadow-[0_12px_32px_rgba(21,18,31,0.06)]">
            <AuthForm mode="register" next={next} defaultRole={role === "ORGANIZER" ? "ORGANIZER" : "ATTENDEE"} />
          </div>
        )}
      </main>
    </div>
  );
}
