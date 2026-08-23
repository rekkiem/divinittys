import InfoPage from '@/components/layout/InfoPage';

export const metadata = { title: 'Contacto | DIVINITTYS' };

export default function ContactoPage() {
  return (
    <InfoPage title="Contacto" subtitle="Estamos para ayudarte con compras, envíos y postventa.">
      <div className="space-y-4 rounded-2xl border border-champagne-200 bg-white p-6">
        <p>
          <span className="font-semibold text-charcoal-700">Email:</span>{' '}
          <a className="text-primary-600 underline" href="mailto:contacto@divinittys.cl">
            contacto@divinittys.cl
          </a>
        </p>
        <p>
          <span className="font-semibold text-charcoal-700">Teléfono / WhatsApp:</span>{' '}
          <a className="text-primary-600 underline" href="https://wa.me/56989024643" target="_blank" rel="noreferrer">
            +56 9 8902 4643
          </a>
        </p>
        <p>
          <span className="font-semibold text-charcoal-700">Ubicación:</span> Santiago, Chile
        </p>
        <p className="text-sm text-charcoal-400">
          Horario de atención orientativo: lunes a viernes, 10:00–18:00 hrs.
        </p>
      </div>
    </InfoPage>
  );
}
