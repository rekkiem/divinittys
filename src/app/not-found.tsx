import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'Página no encontrada | DIVINITTYS',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <p className="font-display text-8xl font-light text-champagne-300 mb-4">404</p>
          <h1 className="font-display text-3xl font-light text-charcoal-700 mb-3">
            Página no encontrada
          </h1>
          <p className="font-sans text-charcoal-400 mb-8">
            La página que buscas no existe o fue movida.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/" className="btn-primary">Ir al inicio</Link>
            <Link href="/productos" className="btn-secondary">Ver productos</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
