import InfoPage from '@/components/layout/InfoPage';

export const metadata = { title: 'Términos y condiciones | DIVINITTYS' };

export default function TerminosPage() {
  return (
    <InfoPage title="Términos y condiciones">
      <p>
        Al usar divinittys.cl aceptas estos términos. Los precios están en pesos chilenos (CLP) e
        incluyen IVA cuando corresponda según la normativa aplicable a cada producto.
      </p>
      <ul className="list-disc pl-5 space-y-2">
        <li>La disponibilidad de stock se confirma al procesar el pedido.</li>
        <li>Nos reservamos el derecho de cancelar pedidos por error de precio evidente o fraude.</li>
        <li>El uso del asistente LUNA es orientativo; no reemplaza consejo médico profesional.</li>
        <li>Las promociones tienen vigencia limitada y pueden cambiar sin aviso previo.</li>
      </ul>
      <p className="text-sm text-charcoal-400">Última actualización: agosto 2026.</p>
    </InfoPage>
  );
}
