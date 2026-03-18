'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X, Loader2, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCLP } from '@/lib/utils/api';

type SearchResult = {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  images: { url: string }[];
  brand?: { name: string } | null;
  category?: { name: string } | null;
};

const POPULAR = ['Wella', 'Kerastase', 'Redken', 'Tinte cabello', 'Shampoo', 'Mascarilla', 'Acondicionador'];

export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const controller = new AbortController();

    if (!query.trim() || query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(query)}&limit=6`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(data.data?.products || []);
      } catch {
        // Ignore abort errors
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/productos?q=${encodeURIComponent(query)}`);
    onClose();
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-0 left-0 right-0 z-50 bg-white shadow-2xl rounded-b-3xl max-h-[80vh] overflow-hidden"
          >
            {/* Search bar */}
            <form onSubmit={handleSubmit} className="flex items-center gap-3 px-6 py-5 border-b border-champagne-200">
              <Search className="w-5 h-5 text-primary-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar productos, marcas, categorías..."
                className="flex-1 font-sans text-lg text-charcoal-700 placeholder:text-charcoal-300 outline-none bg-transparent"
              />
              {loading && <Loader2 className="w-4 h-4 animate-spin text-primary-400" />}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-champagne-100 text-charcoal-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </form>

            {/* Results / Popular */}
            <div className="overflow-y-auto max-h-[60vh] p-4">
              {!query && (
                <div>
                  <div className="flex items-center gap-2 mb-4 text-charcoal-400">
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-sans text-xs font-semibold tracking-wider uppercase">Búsquedas populares</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR.map((term) => (
                      <button
                        key={term}
                        onClick={() => {
                          setQuery(term);
                          router.push(`/productos?q=${encodeURIComponent(term)}`);
                          onClose();
                        }}
                        className="px-4 py-2 rounded-full bg-champagne-100 hover:bg-primary-100 text-charcoal-600 hover:text-primary-700 font-sans text-sm font-medium transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.length > 0 && (
                <div className="space-y-2">
                  <p className="font-sans text-xs font-semibold text-charcoal-400 uppercase tracking-wider mb-3">
                    {results.length} resultados
                  </p>
                  {results.map((product) => (
                    <Link
                      key={product.id}
                      href={`/productos/${product.slug}`}
                      onClick={onClose}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-champagne-50 transition-colors group"
                    >
                      <div className="w-14 h-14 rounded-xl bg-champagne-100 overflow-hidden shrink-0">
                        {product.images[0]?.url ? (
                          <Image src={product.images[0].url} alt={product.name} width={56} height={56} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="font-display text-xl text-primary-300">D</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {product.brand && (
                          <p className="font-sans text-xs font-semibold text-primary-500 uppercase tracking-wider">
                            {product.brand.name}
                          </p>
                        )}
                        <p className="font-sans text-sm font-medium text-charcoal-700 group-hover:text-primary-600 truncate transition-colors">
                          {product.name}
                        </p>
                        {product.category && (
                          <p className="font-sans text-xs text-charcoal-400">{product.category.name}</p>
                        )}
                      </div>
                      <span className="font-sans font-bold text-primary-600 text-sm shrink-0">
                        {formatCLP(product.basePrice)}
                      </span>
                    </Link>
                  ))}

                  {query && (
                    <button
                      onClick={() => {
                        router.push(`/productos?q=${encodeURIComponent(query)}`);
                        onClose();
                      }}
                      className="w-full py-3 text-center font-sans text-sm text-primary-500 hover:text-primary-600 font-semibold border-t border-champagne-200 mt-2 pt-4"
                    >
                      Ver todos los resultados para "{query}"
                    </button>
                  )}
                </div>
              )}

              {query && query.length >= 2 && !loading && results.length === 0 && (
                <div className="text-center py-8 text-charcoal-400">
                  <p className="font-sans text-sm">Sin resultados para "{query}"</p>
                  <p className="font-sans text-xs mt-1">Intenta con otro término</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
