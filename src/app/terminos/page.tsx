import InfoPage from '@/components/layout/InfoPage';

export const metadata = {
  alternates: { canonical: '/terminos' }, title: 'Términos y condiciones' };

export default function TerminosPage() {
  return (
    <InfoPage title="Términos y condiciones">
      <p>
        Al usar el sitio y realizar compras en DIVINITTYS aceptas estos términos. Los productos
        se ofrecen sujetos a disponibilidad de stock.
      </p>
      <ul className="list-disc pl-5 space-y-2">
        <li>Los precios están en pesos chilenos (CLP) e incluyen IVA cuando corresponda.</li>
        <li>La confirmación del pedido se envía por email tras el pago exitoso.</li>
        <li>Nos reservamos el derecho de cancelar pedidos por error de precio o stock.</li>
        <li>El uso indebido del sitio o de las herramientas de IA puede resultar en suspensión de cuenta.</li>
      </ul>
    </InfoPage>
  );
}
