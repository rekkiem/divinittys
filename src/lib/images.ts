function isLikelyMinioHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'minio';
}

type ImageLike = {
  url?: string | null;
};

type ProductMediaLike = {
  imageUrl?: string | null;
  images?: ImageLike[] | null;
};

export function buildMediaUrl(bucket: string, key: string) {
  const safeKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `/media/${encodeURIComponent(bucket)}/${safeKey}`;
}

export function normalizeImageUrl(url?: string | null) {
  if (!url) return url ?? null;
  if (url.startsWith('/media/')) return url;
  if (url.startsWith('/')) return url;

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);

    if (parts.length >= 2 && isLikelyMinioHost(parsed.hostname)) {
      const [bucket, ...keyParts] = parts;
      return buildMediaUrl(bucket, keyParts.join('/'));
    }

    if (process.env.MINIO_PUBLIC_URL) {
      const publicBase = new URL(process.env.MINIO_PUBLIC_URL);
      if (parsed.origin === publicBase.origin && parts.length >= 2) {
        const [bucket, ...keyParts] = parts;
        return buildMediaUrl(bucket, keyParts.join('/'));
      }
    }
  } catch {
    return url;
  }

  return url;
}

export function normalizeProductMedia<T extends ProductMediaLike>(product: T): T {
  return {
    ...product,
    imageUrl: normalizeImageUrl(product.imageUrl),
    images: Array.isArray(product.images)
      ? product.images.map((image) => ({
          ...image,
          url: normalizeImageUrl(image.url),
        }))
      : product.images,
  };
}

export function normalizeProductsMedia<T extends ProductMediaLike>(products: T[]): T[] {
  return products.map((product) => normalizeProductMedia(product));
}
