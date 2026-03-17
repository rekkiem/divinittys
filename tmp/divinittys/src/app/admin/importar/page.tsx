'use client';

import { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/hooks/useAuth';

type ImportResult = {
  created: number;
  updated: number;
  errors: string[];
  message: string;
};

export default function ImportarPage() {
  const [fichasFile, setFichasFile] = useState<File | null>(null);
  const [preciosFile, setPreciosFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { accessToken } = useAuthStore();

  const handleImport = async () => {
    if (!fichasFile && !preciosFile) return;

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    if (fichasFile) formData.append('fichas', fichasFile);
    if (preciosFile) formData.append('precios', preciosFile);

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else {
        setResult({ created: 0, updated: 0, errors: [data.error], message: data.error });
      }
    } catch (e) {
      setResult({ created: 0, updated: 0, errors: ['Error de conexión'], message: 'Error al importar' });
    } finally {
      setLoading(false);
    }
  };

  const FileDropZone = ({
    label, file, onFile, hint,
  }: {
    label: string;
    file: File | null;
    onFile: (f: File | null) => void;
    hint: string;
  }) => (
    <div
      className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer group ${
        file ? 'border-primary-400 bg-primary-50' : 'border-border hover:border-primary-300 hover:bg-champagne-50'
      }`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const dropped = e.dataTransfer.files[0];
        if (dropped?.name.match(/\.(xlsx|xls|csv)$/i)) onFile(dropped);
      }}
      onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls,.csv';
        input.onchange = (e) => {
          const f = (e.target as HTMLInputElement).files?.[0];
          if (f) onFile(f);
        };
        input.click();
      }}
    >
      {file ? (
        <>
          <div className="flex items-center justify-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-primary-500" />
            <div className="text-left">
              <p className="font-sans font-semibold text-primary-600">{file.name}</p>
              <p className="font-sans text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onFile(null); }}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-primary-100 text-primary-400"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3 group-hover:text-primary-400 transition-colors" />
          <p className="font-sans font-semibold text-charcoal-600">{label}</p>
          <p className="font-sans text-sm text-muted-foreground mt-1">{hint}</p>
          <p className="font-sans text-xs text-muted-foreground mt-3">
            Arrastra aquí o haz clic para seleccionar
          </p>
          <p className="font-sans text-xs text-muted-foreground">Formatos: .xlsx, .xls, .csv</p>
        </>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium text-charcoal-700">Importar Productos</h1>
        <p className="font-sans text-muted-foreground mt-1">
          Importa productos desde archivos Excel. Puedes subir ambos archivos simultáneamente.
        </p>
      </div>

      {/* Instructions */}
      <div className="bg-champagne-50 border border-champagne-200 rounded-2xl p-6 space-y-3">
        <h3 className="font-sans font-semibold text-charcoal-700">Estructura esperada de los archivos:</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm font-sans">
          <div>
            <p className="font-semibold text-primary-600 mb-2">📄 Archivo de Fichas Técnicas:</p>
            <ul className="text-charcoal-500 space-y-1 text-xs">
              <li>• <strong>sku</strong> (requerido) — código único</li>
              <li>• <strong>nombre</strong> (requerido) — nombre del producto</li>
              <li>• <strong>descripcion</strong> — descripción larga</li>
              <li>• <strong>categoria</strong> — nombre de categoría</li>
              <li>• <strong>marca</strong> — nombre de marca</li>
              <li>• <strong>peso</strong> — peso en kg</li>
              <li>• Columnas extras → atributos automáticos</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-primary-600 mb-2">💰 Archivo de Precios/Stock:</p>
            <ul className="text-charcoal-500 space-y-1 text-xs">
              <li>• <strong>sku</strong> (requerido) — código único</li>
              <li>• <strong>precio</strong> (requerido) — precio en CLP</li>
              <li>• <strong>precio_comparar</strong> — precio tachado</li>
              <li>• <strong>stock</strong> — unidades disponibles</li>
              <li>• <strong>activo</strong> — S/N</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Upload zones */}
      <div className="grid md:grid-cols-2 gap-4">
        <FileDropZone
          label="Fichas Técnicas"
          file={fichasFile}
          onFile={setFichasFile}
          hint="Nombres, categorías, atributos"
        />
        <FileDropZone
          label="Precios y Stock"
          file={preciosFile}
          onFile={setPreciosFile}
          hint="Precios, stock, descuentos"
        />
      </div>

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={(!fichasFile && !preciosFile) || loading}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Importando productos...
          </>
        ) : (
          <>
            <Upload className="w-5 h-5" />
            Iniciar Importación
          </>
        )}
      </button>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-6 space-y-4 ${
              result.errors.length > 0
                ? 'bg-amber-50 border-amber-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {result.errors.length === 0 ? (
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-500" />
              )}
              <h3 className="font-sans font-semibold">{result.message}</h3>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-white rounded-xl p-3">
                <p className="font-display text-2xl font-light text-emerald-600">{result.created}</p>
                <p className="font-sans text-xs text-muted-foreground">Creados/Actualizados</p>
              </div>
              <div className="bg-white rounded-xl p-3">
                <p className="font-display text-2xl font-light text-primary-600">{result.updated}</p>
                <p className="font-sans text-xs text-muted-foreground">Precios actualizados</p>
              </div>
              <div className="bg-white rounded-xl p-3">
                <p className="font-display text-2xl font-light text-red-500">{result.errors.length}</p>
                <p className="font-sans text-xs text-muted-foreground">Errores</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="font-sans text-sm font-semibold text-amber-700">Errores:</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="font-mono text-xs text-amber-600 bg-white rounded px-2 py-1">
                      {err}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
