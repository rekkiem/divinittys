import Link from 'next/link';
import { Sparkles, Instagram, Facebook, Youtube, MapPin, Phone, Mail } from 'lucide-react';

const footerLinks = {
  productos: [
    { label: 'Cuidado Capilar', href: '/productos?category=cuidado-capilar' },
    { label: 'Coloración', href: '/productos?category=coloracion' },
    { label: 'Tratamientos', href: '/productos?category=tratamientos' },
    { label: 'Maquillaje', href: '/productos?category=maquillaje' },
    { label: 'Ofertas', href: '/productos?onSale=true' },
  ],
  servicios: [
    { label: 'Asistente IA LUNA', href: '/asistente-belleza' },
    { label: 'Diagnóstico Capilar', href: '/diagnostico-capilar' },
    { label: 'Mi Cuenta', href: '/cuenta' },
    { label: 'Mis Pedidos', href: '/cuenta/pedidos' },
    { label: 'Wishlist', href: '/wishlist' },
  ],
  info: [
    { label: 'Sobre Nosotros', href: '/about' },
    { label: 'Preguntas Frecuentes', href: '/faq' },
    { label: 'Política de Envíos', href: '/envios' },
    { label: 'Devoluciones', href: '/devoluciones' },
    { label: 'Contacto', href: '/contacto' },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-charcoal-600 text-charcoal-200">
      {/* Top section */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2 space-y-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-rose-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-display text-2xl font-light tracking-widest text-white">
                DIVINITTYS
              </span>
            </Link>
            <p className="font-sans text-sm text-charcoal-300 leading-relaxed max-w-xs">
              Tu portal de belleza profesional con los mejores productos capilares y cosméticos, con tecnología IA para recomendaciones personalizadas.
            </p>

            {/* Contact */}
            <div className="space-y-2">
              {[
                { Icon: MapPin, text: 'Santiago, Chile' },
                { Icon: Phone, text: '+56 9 8902 4643' },
                { Icon: Mail, text: 'contacto@divinittys.cl' },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-sm text-charcoal-300">
                  <Icon className="w-4 h-4 text-primary-400 shrink-0" />
                  <span className="font-sans">{text}</span>
                </div>
              ))}
            </div>

            {/* Social */}
            <div className="flex gap-3">
              {[
                { Icon: Instagram, href: '#' },
                { Icon: Facebook, href: '#' },
                { Icon: Youtube, href: '#' },
              ].map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  className="w-9 h-9 rounded-full bg-charcoal-500 hover:bg-primary-500 flex items-center justify-center text-charcoal-300 hover:text-white transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([key, links]) => (
            <div key={key}>
              <h4 className="font-sans text-xs font-bold text-white tracking-widest uppercase mb-5">
                {key === 'productos' ? 'Productos' : key === 'servicios' ? 'Servicios' : 'Información'}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="font-sans text-sm text-charcoal-300 hover:text-primary-300 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Payment methods & trust */}
      <div className="border-t border-charcoal-500">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap justify-center">
              {['Webpay', 'MercadoPago', 'Visa', 'Mastercard'].map((method) => (
                <span
                  key={method}
                  className="px-3 py-1.5 bg-charcoal-500 rounded-lg text-xs font-sans font-semibold text-charcoal-200"
                >
                  {method}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-6 text-xs font-sans text-charcoal-400">
              <span>🔒 Pago 100% seguro</span>
              <span>📦 Despacho Bluexpress</span>
              <span>✅ Productos originales</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-charcoal-500">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-sans text-xs text-charcoal-400">
            © {new Date().getFullYear()} DIVINITTYS. Todos los derechos reservados.
          </p>
          <div className="flex gap-4">
            <Link href="/privacidad" className="font-sans text-xs text-charcoal-400 hover:text-primary-300 transition-colors">
              Privacidad
            </Link>
            <Link href="/terminos" className="font-sans text-xs text-charcoal-400 hover:text-primary-300 transition-colors">
              Términos
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
