import InfoPage from '@/components/layout/InfoPage';

export const metadata = {
  title: 'Sobre Nosotros | DIVINITTYS',
  description: 'Conoce DIVINITTYS, tu tienda de belleza profesional en Chile.',
};

export default function AboutPage() {
  return (
    <InfoPage
      title="Sobre nosotros"
      subtitle="Belleza profesional, productos originales y asesoría con inteligencia artificial."
    >
      <p>
        <strong>DIVINITTYS</strong> es una tienda online chilena especializada en productos de
        belleza y cuidado capilar profesional. Trabajamos con marcas reconocidas y un catálogo
        orientado a resultados reales en casa o en el salón.
      </p>
      <p>
        Además del e-commerce, ofrecemos herramientas como <strong>LUNA</strong> (asistente de
        belleza) y el <strong>diagnóstico capilar</strong> para ayudarte a elegir mejor.
      </p>
      <p>
        Envíos a todo Chile, pagos seguros con Webpay y MercadoPago, y un equipo disponible para
        resolver dudas de compra y postventa.
      </p>
    </InfoPage>
  );
}
