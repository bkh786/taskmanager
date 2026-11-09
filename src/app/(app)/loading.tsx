// Shown instantly while a page's data loads, so navigation never looks frozen.
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-44 rounded bg-chip-bg mb-2" />
      <div className="h-4 w-64 rounded bg-chip-bg mb-6" />
      <div className="grid grid-cols-5 gap-3.5 mb-5.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[86px] rounded-[10px] bg-chip-bg" />
        ))}
      </div>
      <div className="rounded-[10px] bg-chip-bg h-[260px]" />
    </div>
  );
}
