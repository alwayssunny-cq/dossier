export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-surface-base">
      <header className="bg-surface-base border-b border-fade">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <div className="h-5 w-32 bg-fade rounded animate-pulse" />
            <div className="h-2 w-8 bg-fade rounded mt-1.5 animate-pulse" />
          </div>
          <div className="w-9 h-9 rounded-full bg-fade animate-pulse" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-5 py-8">
        <div className="mb-8">
          <div className="h-9 w-48 bg-fade rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-36 bg-fade rounded animate-pulse" />
        </div>

        <div className="mb-2">
          <div className="h-3 w-20 bg-fade rounded animate-pulse mb-4" />
        </div>

        {[1, 2].map(i => (
          <div key={i} className="bg-surface-base rounded-2xl border border-fade overflow-hidden mb-4">
            <div className="h-48 bg-sunken animate-pulse" />
            <div className="p-4 flex items-center justify-between">
              <div className="h-4 w-32 bg-sunken rounded animate-pulse" />
              <div className="h-6 w-20 bg-sunken rounded-full animate-pulse" />
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
