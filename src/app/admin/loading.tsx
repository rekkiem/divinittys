export default function AdminLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-champagne-200 border-t-primary-500 animate-spin" />
        <p className="font-sans text-sm text-charcoal-400">Cargando...</p>
      </div>
    </div>
  );
}
