/**
 * Builders de JSON-LD (schema.org) para rich results.
 * Solo datos públicos; sin secretos ni PII.
 */

const DEFAULT_SITE_URL = 'https://divinittys.cl';

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

/** URL absoluta: si ya es http(s) la deja; si es path relativo la une al site. */
export function absoluteUrl(pathOrUrl: string | null | undefined): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = getSiteUrl();
  return `${base}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

/** Descripción pública de marca (misión + visión) para Organization JSON-LD. */
export const ORG_DESCRIPTION =
  'Creemos que la belleza profesional no debería ser un privilegio de pocos. Existimos para poner en tus manos las mejores marcas del mundo. Porque sentirse bien, no es solo Belleza. Soñamos con un futuro donde el cuidado personal sea accesible para todos, y donde Divinittys sea el puente entre lo profesional y lo cotidiano.';

export type OrganizationJsonLd = {
  '@context': 'https://schema.org';
  '@type': 'Organization';
  name: string;
  url: string;
  description?: string;
  slogan?: string;
  logo?: string;
  sameAs?: string[];
  contactPoint?: {
    '@type': 'ContactPoint';
    contactType: string;
    email?: string;
    availableLanguage?: string[];
  };
};

export function buildOrganizationJsonLd(): OrganizationJsonLd {
  const url = getSiteUrl();
  // Logo opcional: solo si existe asset público (evitar URL 404 en rich results)
  const logoPath = process.env.NEXT_PUBLIC_ORG_LOGO_URL || undefined;
  const org: OrganizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'DIVINITTYS',
    url,
    description: ORG_DESCRIPTION,
    slogan: 'Porque sentirse bien, no es solo Belleza.',
    sameAs: [
      'https://www.instagram.com/divinitty4/',
      'https://www.facebook.com/divinittys/',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'contacto@divinittys.cl',
      availableLanguage: ['Spanish'],
    },
  };
  if (logoPath) {
    org.logo = absoluteUrl(logoPath);
  }
  return org;
}

export type WebSiteJsonLd = {
  '@context': 'https://schema.org';
  '@type': 'WebSite';
  name: string;
  url: string;
  potentialAction?: {
    '@type': 'SearchAction';
    target: { '@type': 'EntryPoint'; urlTemplate: string };
    'query-input': string;
  };
};

export function buildWebSiteJsonLd(): WebSiteJsonLd {
  const url = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'DIVINITTYS',
    url,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${url}/productos?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export type BreadcrumbItem = { name: string; path: string };

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  const site = getSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path) || `${site}${item.path}`,
    })),
  };
}

export type ProductJsonLdInput = {
  name: string;
  slug: string;
  description?: string | null;
  sku?: string | null;
  basePrice: number | string;
  comparePrice?: number | string | null;
  imageUrls: string[];
  brandName?: string | null;
  categoryName?: string | null;
  inStock: boolean;
  ratingAverage?: number | null;
  ratingCount?: number | null;
};

export function buildProductJsonLd(input: ProductJsonLdInput) {
  const site = getSiteUrl();
  const url = `${site}/productos/${input.slug}`;
  const images = input.imageUrls
    .map((u) => absoluteUrl(u))
    .filter((u): u is string => Boolean(u));

  const price = Number(input.basePrice);
  const json: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description:
      input.description?.slice(0, 5000) ||
      `${input.name}${input.brandName ? ` — ${input.brandName}` : ''} | DIVINITTYS`,
    sku: input.sku || undefined,
    url,
    image: images.length ? images : undefined,
    brand: input.brandName
      ? { '@type': 'Brand', name: input.brandName }
      : { '@type': 'Brand', name: 'DIVINITTYS' },
    category: input.categoryName || undefined,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'CLP',
      price: Number.isFinite(price) ? price.toFixed(0) : '0',
      availability: input.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'DIVINITTYS',
      },
    },
  };

  if (
    input.ratingCount != null &&
    input.ratingCount > 0 &&
    input.ratingAverage != null &&
    input.ratingAverage > 0
  ) {
    json.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(input.ratingAverage.toFixed(1)),
      reviewCount: input.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return json;
}
