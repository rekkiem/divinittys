'use client';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[GlobalError]', error.digest ?? error.message);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto mb-6" />
        <h1 className="font-display text-3xl font-light text-charcoal-700 mb-3">
          Algo salió mal
        </h1>
        <p className="font-sans text-charcoal-400 mb-8">
          Ocurrió un error inesperado. Si el problema persiste, contáctanos.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="btn-primary"
          >
            Intentar de nuevo
          </button>
          <a href="/" className="btn-secondary">
            Ir al inicio
          </a>
        </div>
        {process.env.NODE_ENV !== 'production' && (
          <pre className="mt-6 text-left text-xs bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 overflow-auto max-h-40">
            {error.message}
          </pre>
        )}
      </div>
    </div>
  );
}
