import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import BeautyChat from '@/components/ai/BeautyChat';

export const metadata = {
  title: 'Asistente de Belleza LUNA | DIVINITTYS',
  description: 'Chatea con LUNA, tu asistente de belleza impulsada por IA. Recibe recomendaciones personalizadas.',
};

export default function BeautyAssistantPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 border border-primary-200 mb-4">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-sans text-xs font-semibold text-primary-600 uppercase tracking-wider">LUNA — Online</span>
          </div>
          <h1 className="section-title mb-3">Tu asistente de belleza</h1>
          <p className="font-sans text-charcoal-400 text-lg max-w-lg mx-auto">
            Pregúntame sobre productos, marcas, rutinas o qué necesita tu cabello.
          </p>
        </div>
        <BeautyChat />
      </main>
      <Footer />
    </div>
  );
}
