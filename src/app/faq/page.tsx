import InfoPage from '@/components/layout/InfoPage';

export const metadata = {
  title: 'Preguntas frecuentes | DIVINITTYS',
};

const FAQS = [
  {
    q: '¿Hacen envíos a todo Chile?',
    a: 'Sí. Despachamos principalmente con Bluexpress. El costo y plazo se calculan en el checkout según tu comuna.',
  },
  {
    q: '¿Cuándo es el envío gratis?',
    a: 'En compras sobre $50.000 CLP (sujeto a promoción vigente). También puede aplicar un cupón de envío gratis.',
  },
  {
    q: '¿Qué medios de pago aceptan?',
    a: 'Webpay (Transbank) y MercadoPago. Los pagos se procesan en entornos seguros.',
  },
  {
    q: '¿Puedo devolver un producto?',
    a: 'Revisa la política de devoluciones. En general aceptamos productos sin abrir dentro del plazo indicado, salvo excepciones sanitarias.',
  },
  {
    q: '¿Cómo uso el asistente LUNA?',
    a: 'Entra a Asistente de Belleza desde el menú o el banner de la home. LUNA recomienda productos de nuestro catálogo real.',
  },
];

export default function FaqPage() {
  return (
    <InfoPage title="Preguntas frecuentes" subtitle="Respuestas rápidas sobre compra, envío y pagos.">
      <div className="space-y-6">
        {FAQS.map((item) => (
          <div key={item.q} className="rounded-2xl border border-champagne-200 bg-white p-5">
            <h2 className="font-sans font-semibold text-charcoal-700 mb-2">{item.q}</h2>
            <p className="text-charcoal-500 text-sm leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    </InfoPage>
  );
}
