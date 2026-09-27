export default function TripLoading() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-surface-base rounded-2xl border border-fade overflow-hidden">
          <div className="h-44 bg-sunken animate-pulse" />
          <div className="p-5 space-y-3">
            <div className="h-5 w-1/3 bg-sunken rounded animate-pulse" />
            <div className="h-6 w-2/3 bg-sunken rounded animate-pulse" />
            <div className="h-4 w-full bg-sunken rounded animate-pulse" />
            <div className="h-4 w-4/5 bg-sunken rounded animate-pulse" />
            <div className="flex gap-2 pt-1">
              <div className="h-6 w-16 bg-sunken rounded-full animate-pulse" />
              <div className="h-6 w-20 bg-sunken rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
