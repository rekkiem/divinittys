'use client';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AdminError]', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h2 className="font-sans font-semibold text-charcoal-700 mb-2">Error en el panel</h2>
        <p className="font-sans text-sm text-charcoal-400 mb-6">
          {process.env.NODE_ENV !== 'production' ? error.message : 'Ocurrió un error inesperado.'}
        </p>
        <button onClick={reset} className="flex items-center gap-2 btn-primary mx-auto">
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
      </div>
    </div>
  );
}
