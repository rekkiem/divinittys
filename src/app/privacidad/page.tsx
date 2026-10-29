import InfoPage from '@/components/layout/InfoPage';

export const metadata = {
  alternates: { canonical: '/privacidad' }, title: 'Privacidad' };

export default function PrivacidadPage() {
  return (
    <InfoPage title="Política de privacidad">
      <p>
        En DIVINITTYS tratamos tus datos personales para procesar pedidos, autenticación de
        cuenta, soporte y mejora del servicio. No vendemos tus datos a terceros.
      </p>
      <ul className="list-disc pl-5 space-y-2">
        <li>Datos de cuenta y pedidos se almacenan de forma segura.</li>
        <li>Usamos cookies técnicas y de sesión necesarias para el funcionamiento del sitio.</li>
        <li>Puedes solicitar acceso, rectificación o eliminación escribiendo a contacto@divinittys.cl.</li>
      </ul>
      <p className="text-sm text-charcoal-400">
        Esta política puede actualizarse. La versión vigente es la publicada en este sitio.
      </p>
    </InfoPage>
  );
}
