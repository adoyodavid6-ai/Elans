/** Shown instantly while a console/portal page loads its data. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading…</span>
      <div className="mb-2 h-8 w-64 rounded-lg bg-surface-2" />
      <div className="mb-6 h-4 w-96 max-w-full rounded bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-surface-2" />)}</div>
      <div className="mt-6 h-72 rounded-2xl bg-surface-2" />
    </div>
  );
}
