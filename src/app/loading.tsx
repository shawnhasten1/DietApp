export default function AppLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 py-8">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        <p className="text-sm font-medium text-slate-700">Loading...</p>
      </div>
    </main>
  );
}

