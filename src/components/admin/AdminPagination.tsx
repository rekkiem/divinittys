'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  /** Query keys a preservar (q, status, lowStock, etc.) */
  preserveKeys?: string[];
};

const LIMITS = [50, 100] as const;

export default function AdminPagination({
  page,
  totalPages,
  total,
  limit,
  preserveKeys = ['q', 'status', 'lowStock'],
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildHref = (nextPage: number, nextLimit?: number) => {
    const params = new URLSearchParams();
    for (const key of preserveKeys) {
      const v = searchParams.get(key);
      if (v) params.set(key, v);
    }
    params.set('page', String(nextPage));
    params.set('limit', String(nextLimit ?? limit));
    return `${pathname}?${params.toString()}`;
  };

  if (totalPages <= 1 && total <= LIMITS[0]) {
    return (
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="font-sans text-sm text-charcoal-500">
          {total} registro{total !== 1 ? 's' : ''}
        </p>
        <LimitSelector current={limit} buildHref={buildHref} page={page} />
      </div>
    );
  }

  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);

  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <p className="font-sans text-sm text-charcoal-500">
        {total} registro{total !== 1 ? 's' : ''} · página {page} de {totalPages}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <LimitSelector current={limit} buildHref={buildHref} page={1} />

        <Link
          href={buildHref(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm ${
            page <= 1
              ? 'pointer-events-none opacity-40 bg-champagne-50 text-charcoal-300'
              : 'bg-champagne-100 text-charcoal-600 hover:bg-champagne-200'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>

        {start > 1 && (
          <>
            <Link
              href={buildHref(1)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-sm font-sans font-semibold bg-champagne-100 text-charcoal-600 hover:bg-champagne-200"
            >
              1
            </Link>
            {start > 2 && <span className="text-charcoal-300 px-1">…</span>}
          </>
        )}

        {pages.map((p) => (
          <Link
            key={p}
            href={buildHref(p)}
            className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-sans font-semibold ${
              p === page
                ? 'bg-primary-500 text-white'
                : 'bg-champagne-100 text-charcoal-600 hover:bg-champagne-200'
            }`}
          >
            {p}
          </Link>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="text-charcoal-300 px-1">…</span>}
            <Link
              href={buildHref(totalPages)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-sm font-sans font-semibold bg-champagne-100 text-charcoal-600 hover:bg-champagne-200"
            >
              {totalPages}
            </Link>
          </>
        )}

        <Link
          href={buildHref(Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm ${
            page >= totalPages
              ? 'pointer-events-none opacity-40 bg-champagne-50 text-charcoal-300'
              : 'bg-champagne-100 text-charcoal-600 hover:bg-champagne-200'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

function LimitSelector({
  current,
  buildHref,
  page,
}: {
  current: number;
  buildHref: (p: number, limit?: number) => string;
  page: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-sans text-xs text-charcoal-400 uppercase tracking-wider">Mostrar</span>
      {LIMITS.map((n) => (
        <Link
          key={n}
          href={buildHref(page, n)}
          className={`px-2.5 py-1 rounded-lg text-xs font-sans font-semibold ${
            current === n
              ? 'bg-primary-500 text-white'
              : 'bg-champagne-100 text-charcoal-600 hover:bg-champagne-200'
          }`}
        >
          {n}
        </Link>
      ))}
    </div>
  );
}
