'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SlidersHorizontal, X, ChevronDown, ChevronUp } from 'lucide-react';

type FilterProps = {
  categories: { id: string; name: string; slug: string }[];
  brands: { id: string; name: string; slug: string }[];
  minPrice: number;
  maxPrice: number;
  searchParams: { [key: string]: string | undefined };
};

export default function ProductsFilters({ categories, brands, minPrice, maxPrice, searchParams }: FilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [catOpen, setCatOpen] = useState(true);
  const [brandOpen, setBrandOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(
      Object.entries(searchParams).filter(([, v]) => v !== undefined) as [string, string][]
    );
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearAll = () => router.push(pathname);

  const hasFilters = !!(searchParams.category || searchParams.brand || searchParams.minPrice || searchParams.maxPrice || searchParams.onSale);

  return (
    <div className="sticky top-24 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-sans font-semibold text-charcoal-700">
          <SlidersHorizontal className="w-4 h-4 text-primary-500" />
          Filtros
        </div>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs font-sans text-rose-500 hover:text-rose-600 font-semibold"
          >
            <X className="w-3 h-3" />
            Limpiar
          </button>
        )}
      </div>

      {/* Offers toggle */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 cursor-pointer"
        onClick={() => updateFilter('onSale', searchParams.onSale === 'true' ? null : 'true')}>
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${searchParams.onSale === 'true' ? 'bg-rose-500 border-rose-500' : 'border-charcoal-300'}`}>
          {searchParams.onSale === 'true' && <span className="text-white text-[10px]">✓</span>}
        </div>
        <span className="font-sans text-sm font-semibold text-rose-600">Solo ofertas</span>
      </div>

      {/* Categories */}
      <div className="border border-champagne-200 rounded-2xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 font-sans font-semibold text-sm text-charcoal-700 hover:bg-champagne-50"
          onClick={() => setCatOpen(!catOpen)}
        >
          Categorías
          {catOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {catOpen && (
          <div className="px-4 pb-4 space-y-2 border-t border-champagne-100">
            {categories.map((cat) => (
              <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="category"
                  checked={searchParams.category === cat.slug}
                  onChange={() => updateFilter('category', searchParams.category === cat.slug ? null : cat.slug)}
                  className="accent-primary-500"
                />
                <span className="font-sans text-sm text-charcoal-600 group-hover:text-primary-500 transition-colors">
                  {cat.name}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Brands */}
      <div className="border border-champagne-200 rounded-2xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 font-sans font-semibold text-sm text-charcoal-700 hover:bg-champagne-50"
          onClick={() => setBrandOpen(!brandOpen)}
        >
          Marcas
          {brandOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {brandOpen && (
          <div className="px-4 pb-4 space-y-2 border-t border-champagne-100 max-h-48 overflow-y-auto">
            {brands.map((brand) => (
              <label key={brand.id} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="brand"
                  checked={searchParams.brand === brand.slug}
                  onChange={() => updateFilter('brand', searchParams.brand === brand.slug ? null : brand.slug)}
                  className="accent-primary-500"
                />
                <span className="font-sans text-sm text-charcoal-600 group-hover:text-primary-500 transition-colors">
                  {brand.name}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Price range */}
      <div className="border border-champagne-200 rounded-2xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 font-sans font-semibold text-sm text-charcoal-700 hover:bg-champagne-50"
          onClick={() => setPriceOpen(!priceOpen)}
        >
          Precio
          {priceOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {priceOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-champagne-100">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-sans text-xs text-charcoal-400 mb-1 block">Mínimo</label>
                <input
                  type="number"
                  placeholder={String(minPrice)}
                  defaultValue={searchParams.minPrice}
                  className="input-field !py-2 text-sm"
                  onBlur={(e) => updateFilter('minPrice', e.target.value || null)}
                />
              </div>
              <div>
                <label className="font-sans text-xs text-charcoal-400 mb-1 block">Máximo</label>
                <input
                  type="number"
                  placeholder={String(maxPrice)}
                  defaultValue={searchParams.maxPrice}
                  className="input-field !py-2 text-sm"
                  onBlur={(e) => updateFilter('maxPrice', e.target.value || null)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
