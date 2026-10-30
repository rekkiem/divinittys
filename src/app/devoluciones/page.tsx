import InfoPage from '@/components/layout/InfoPage';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Devoluciones',
  description:
    'Política de devoluciones y cambios de DIVINITTYS: plazos, condiciones de higiene y productos dañados.',
  path: '/devoluciones',
});

export default function DevolucionesPage() {
  return (
    <InfoPage title="Devoluciones y cambios" subtitle="Queremos que compres con tranquilidad.">
      <ul className="list-disc pl-5 space-y-2">
        <li>Plazo orientativo: 10 días corridos desde la recepción.</li>
        <li>El producto debe estar sin uso, con empaque original y sellos intactos.</li>
        <li>Por higiene, no se aceptan devoluciones de productos abiertos (cosméticos/capilares).</li>
        <li>Si el producto llegó dañado o incorrecto, contáctanos de inmediato con fotos.</li>
      </ul>
      <p>
        Escríbenos a <a className="text-primary-600 underline" href="mailto:contacto@divinittys.cl">contacto@divinittys.cl</a> o al WhatsApp indicado en el sitio, con tu número de pedido.
      </p>
    </InfoPage>
  );
}
