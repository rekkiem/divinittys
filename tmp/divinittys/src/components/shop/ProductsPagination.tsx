'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ProductsPagination({
  currentPage,
  totalPages,
  searchParams,
}: {
  currentPage: number;
  totalPages: number;
  searchParams: { [key: string]: string | undefined };
}) {
  const router = useRouter();
  const pathname = usePathname();

  const goTo = (page: number) => {
    const params = new URLSearchParams(
      Object.entries(searchParams).filter(([, v]) => v !== undefined) as [string, string][]
    );
    params.set('page', String(page));
    router.push(`${pathname}?${params.toString()}`);
  };

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2
  );

  return (
    <div className="flex items-center justify-center gap-2 mt-12">
      <button
        onClick={() => goTo(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-xl border border-champagne-300 hover:border-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4 text-charcoal-600" />
      </button>

      {pages.map((page, i) => {
        const prev = pages[i - 1];
        return (
          <div key={page} className="flex items-center gap-2">
            {prev && page - prev > 1 && (
              <span className="font-sans text-charcoal-300">…</span>
            )}
            <button
              onClick={() => goTo(page)}
              className={`w-10 h-10 rounded-xl font-sans font-semibold text-sm transition-colors ${
                page === currentPage
                  ? 'bg-primary-500 text-white'
                  : 'border border-champagne-300 text-charcoal-600 hover:border-primary-300 hover:text-primary-500'
              }`}
            >
              {page}
            </button>
          </div>
        );
      })}

      <button
        onClick={() => goTo(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-xl border border-champagne-300 hover:border-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-4 h-4 text-charcoal-600" />
      </button>
    </div>
  );
}
