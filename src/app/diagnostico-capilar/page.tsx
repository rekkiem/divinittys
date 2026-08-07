import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import HairDiagnosisForm from '@/components/ai/HairDiagnosisForm';

export const metadata = {
  title: 'Diagnóstico Capilar IA | DIVINITTYS',
  description: 'Descubre los productos perfectos para tu cabello con nuestro diagnóstico personalizado impulsado por IA.',
};

export default function HairDiagnosisPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="py-16 px-4 max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <p className="font-sans text-primary-500 text-xs font-semibold tracking-widest uppercase mb-3">
            Tecnología IA
          </p>
          <h1 className="section-title mb-4">
            Diagnóstico Capilar
            <span className="gradient-text block">Personalizado</span>
          </h1>
          <p className="font-sans text-charcoal-400 text-lg max-w-md mx-auto">
            Responde algunas preguntas y nuestra IA encontrará los productos exactos que necesita tu cabello.
          </p>
        </div>
        <HairDiagnosisForm />
      </main>
      <Footer />
    </div>
  );
}
