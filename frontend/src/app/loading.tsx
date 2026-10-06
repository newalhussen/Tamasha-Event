/** Generic route-transition placeholder (pages with their own skeleton override this). */
export default function Loading() {
  return (
    <div className="min-h-screen bg-bg" aria-busy="true" aria-label="Loading">
      <div className="h-[72px] border-b border-line bg-white" />
      <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-4 py-10 sm:px-8">
        <div className="skeleton h-12 w-[55%]" />
        <div className="skeleton h-5 w-[35%]" />
        <div className="skeleton mt-4 h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}
