import InfoPage from '@/components/layout/InfoPage';

export const metadata = { title: 'Política de envíos | DIVINITTYS' };

export default function EnviosPage() {
  return (
    <InfoPage title="Política de envíos" subtitle="Despacho a todo Chile con seguimiento.">
      <ul className="list-disc pl-5 space-y-2">
        <li>Courier principal: <strong>Bluexpress</strong>.</li>
        <li>El valor del flete se cotiza en el checkout según dirección y peso aproximado.</li>
        <li>Envío gratis en compras sobre $50.000 CLP (cuando la promoción esté activa).</li>
        <li>Plazos estimados: 1 a 5 días hábiles según zona (sujeto a courier).</li>
        <li>Recibirás el número de seguimiento cuando el pedido sea despachado.</li>
      </ul>
      <p className="text-sm text-charcoal-400">
        Los plazos pueden variar por feriados, clima o congestión del courier.
      </p>
    </InfoPage>
  );
}
