import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://divinittys.cl';

export type PageMetadataInput = {
  title: string;
  description: string;
  /** Path canónico, p.ej. '/about' o '/productos?page=2' */
  path: string;
  robots?: Metadata['robots'];
  /** Si false, no emite alternates.canonical ni openGraph.url (p.ej. noindex con filtros). */
  withCanonical?: boolean;
};

/**
 * Metadata de página con canonical + openGraph/twitter alineados al path.
 * Evita heredar og:url/og:title de la home (S1).
 */
export function buildPageMetadata({
  title,
  description,
  path,
  robots = { index: true, follow: true },
  withCanonical = true,
}: PageMetadataInput): Metadata {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const absolute = `${siteUrl.replace(/\/$/, '')}${normalized}`;

  const meta: Metadata = {
    title,
    description,
    robots,
    openGraph: {
      title,
      description,
      locale: 'es_CL',
      type: 'website',
      siteName: 'DIVINITTYS',
      ...(withCanonical ? { url: absolute } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };

  if (withCanonical) {
    meta.alternates = { canonical: normalized };
  }

  return meta;
}
