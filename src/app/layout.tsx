import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import Providers from '@/components/layout/Providers';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://divinittys.cl';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    // Template añade " | DIVINITTYS" — las páginas hijas NO deben repetir la marca
    default: 'DIVINITTYS | Productos de Belleza Profesional',
    template: '%s | DIVINITTYS',
  },
  description:
    'DIVINITTYS — Tienda de belleza profesional en Chile. Shampoos, tinturas, tratamientos y las mejores marcas (Davines, Elgon, Wella, Kerastase). Envío gratis sobre $50.000.',
  keywords: ['DIVINITTYS', 'belleza', 'productos capilares', 'coloración', 'keratina', 'tratamientos', 'Davines', 'Elgon', 'Chile'],
  authors: [{ name: 'DIVINITTYS' }],
  creator: 'DIVINITTYS',
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    url: siteUrl,
    title: 'DIVINITTYS | Productos de Belleza Profesional',
    description:
      'Tu tienda online de belleza profesional en Chile. Marcas premium, envío a todo el país.',
    siteName: 'DIVINITTYS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DIVINITTYS | Productos de Belleza Profesional',
    description: 'Tu tienda online de belleza profesional en Chile.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large' },
  },
  alternates: {
    canonical: siteUrl,
  },
};

export const viewport: Viewport = {
  themeColor: '#C9956A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-background font-sans antialiased">
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#1A1A1A',
                color: '#F5E6D3',
                fontFamily: 'var(--font-plus-jakarta)',
                borderRadius: '12px',
                border: '1px solid rgba(201, 149, 106, 0.3)',
              },
              success: { iconTheme: { primary: '#C9956A', secondary: '#1A1A1A' } },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
