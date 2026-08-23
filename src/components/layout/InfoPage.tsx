import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export default function InfoPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <p className="font-sans text-primary-500 text-xs font-semibold tracking-widest uppercase mb-2">
          DIVINITTYS
        </p>
        <h1 className="font-display text-4xl lg:text-5xl font-light text-charcoal-700 mb-3">{title}</h1>
        {subtitle && (
          <p className="font-sans text-charcoal-500 text-lg mb-10 leading-relaxed">{subtitle}</p>
        )}
        <div className="prose-divinittys space-y-6 font-sans text-charcoal-600 leading-relaxed">
          {children}
        </div>
        <div className="mt-12 pt-8 border-t border-champagne-200">
          <Link href="/productos" className="btn-primary inline-flex">
            Ver catálogo
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
