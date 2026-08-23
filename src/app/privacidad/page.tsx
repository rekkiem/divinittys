import InfoPage from '@/components/layout/InfoPage';

export const metadata = { title: 'Privacidad | DIVINITTYS' };

export default function PrivacidadPage() {
  return (
    <InfoPage title="Política de privacidad">
      <p>
        En DIVINITTYS tratamos tus datos personales para procesar pedidos, autenticación de
        cuenta, soporte y mejora del servicio. No vendemos tus datos a terceros.
      </p>
      <ul className="list-disc pl-5 space-y-2">
        <li>Datos de cuenta: nombre, email, teléfono (si lo indicas).</li>
        <li>Datos de compra y envío necesarios para cumplir el pedido.</li>
        <li>Pagos procesados por Webpay / MercadoPago; no almacenamos números de tarjeta completos.</li>
        <li>Puedes solicitar acceso o eliminación de datos escribiendo a contacto@divinittys.cl.</li>
      </ul>
      <p className="text-sm text-charcoal-400">Última actualización: agosto 2026.</p>
    </InfoPage>
  );
}
