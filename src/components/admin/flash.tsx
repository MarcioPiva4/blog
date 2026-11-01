export function Flash({ error, saved }: { error?: string; saved?: string }) {
  if (error)
    return <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>;
  if (saved)
    return <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">Salvo.</div>;
  return null;
}
