import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import Providers from '@/components/layout/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    // Nombre de marca alineado con Google OAuth Brand (DIVINITTYS)
    default: 'DIVINITTYS',
    template: '%s | DIVINITTYS',
  },
  description:
    'DIVINITTYS — Tienda de belleza profesional en Chile. Inicia sesión para gestionar pedidos, historial de compras, lista de deseos y tu perfil.',
  keywords: ['DIVINITTYS', 'belleza', 'productos capilares', 'coloración', 'keratina', 'tratamientos', 'Chile'],
  authors: [{ name: 'DIVINITTYS' }],
  creator: 'DIVINITTYS',
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: 'DIVINITTYS',
    description:
      'Inicia sesión en DIVINITTYS para gestionar tus pedidos, historial de compras y productos favoritos.',
    siteName: 'DIVINITTYS',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large' },
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
