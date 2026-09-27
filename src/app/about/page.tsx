import InfoPage from '@/components/layout/InfoPage';

export const metadata = {
  title: 'Sobre Nosotros',
  description:
    'Conoce DIVINITTYS: misión y visión de belleza profesional accesible en Chile. Las mejores marcas, envíos a todo el país.',
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

      <h2 className="font-display text-2xl font-light text-charcoal-700 pt-4">Visión</h2>
      <p>
        Soñamos con un futuro donde el cuidado personal sea accesible para todos, y donde
        Divinittys sea el puente entre lo profesional y lo cotidiano.
      </p>

      <h2 className="font-display text-2xl font-light text-charcoal-700 pt-2">Misión</h2>
      <p>
        Creemos que la belleza profesional no debería ser un privilegio de pocos. Existimos para
        poner en tus manos las mejores marcas del mundo. Porque sentirse bien, no es solo Belleza.
      </p>
    </InfoPage>
  );
}
