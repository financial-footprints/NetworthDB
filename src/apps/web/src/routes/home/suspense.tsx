const DASHBOARD_SKELETON_TILE_KEYS = ["a", "b", "c", "d", "e", "f"] as const;

export function DashboardPageSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded-sm bg-slate-200" />
      <div className="h-4 w-64 rounded-sm bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {DASHBOARD_SKELETON_TILE_KEYS.map((tileKey) => (
          <div key={tileKey} className="h-20 rounded-sm bg-slate-200" />
        ))}
      </div>
      <div className="h-64 rounded-sm bg-slate-200" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-56 rounded-sm bg-slate-200" />
        <div className="h-56 rounded-sm bg-slate-200" />
      </div>
    </div>
  );
}
