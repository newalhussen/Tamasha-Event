export const dynamic = "force-dynamic";

export default function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-bg text-[15px]">{children}</div>;
}
