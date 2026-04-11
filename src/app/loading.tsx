export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-champagne-200 border-t-primary-500 animate-spin" />
        <p className="font-sans text-sm text-charcoal-400">Cargando...</p>
      </div>
    </div>
  );
}
