import type { Metadata } from 'next';

/** Área de cuenta: nunca indexar. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CuentaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
