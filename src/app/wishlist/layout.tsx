import type { Metadata } from 'next';

/** Wishlist personal: noindex. */
export const metadata: Metadata = {
  title: 'Wishlist',
  robots: { index: false, follow: false },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
