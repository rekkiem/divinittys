'use client';
/**
 * SortSelector — Client Component
 * Handles sort order changes via URL navigation (no page reload).
 * Extracted from ProductsGrid (Server Component) to isolate event handlers.
 */
import { useRouter, usePathname } from 'next/navigation';

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Más recientes' },
  { value: 'price_asc',  label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'name_asc',   label: 'Nombre A-Z' },
  { value: 'featured',   label: 'Destacados' },
] as const;

type SortValue = typeof SORT_OPTIONS[number]['value'];

type SortSelectorProps = {
  currentSort: string;
  searchParams: { [key: string]: string | undefined };
};

export default function SortSelector({ currentSort, searchParams }: SortSelectorProps) {
  const router   = useRouter();
  const pathname = usePathname() ?? '/productos';

  const handleChange = (sort: string) => {
    const params = new URLSearchParams(
      Object.entries(searchParams)
        .filter(([, v]) => v !== undefined) as [string, string][]
    );
    params.set('sort', sort);
    params.delete('page'); // reset page when sort changes
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <select
      value={currentSort}
      className="input-field !w-auto !py-2 text-sm"
      onChange={(e) => handleChange(e.target.value)}
    >
      {SORT_OPTIONS.map(({ value, label }) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}
