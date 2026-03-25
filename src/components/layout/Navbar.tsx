'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, Search, Heart, User, Menu, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '@/hooks/useCart';
import { useAuthStore } from '@/hooks/useAuth';
import SearchModal from './SearchModal';
import CartDrawer from '../shop/CartDrawer';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { items } = useCartStore();
  const { user } = useAuthStore();

  const cartCount = hydrated ? items.reduce((sum, item) => sum + item.quantity, 0) : 0;

  useEffect(() => {
    setHydrated(true);
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '/productos', label: 'Catálogo' },
    { href: '/productos?category=cuidado-capilar', label: 'Capilar' },
    { href: '/productos?category=coloracion', label: 'Coloración' },
    { href: '/productos?category=tratamientos', label: 'Tratamientos' },
    { href: '/productos?onSale=true', label: 'Ofertas', highlight: true },
  ];

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-primary-100'
            : 'bg-transparent'
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Top bar */}
        <div className="bg-primary-500 text-white text-xs py-2 text-center font-sans font-medium tracking-wider">
          ✨ Envío gratis en compras sobre $50.000 | Pago seguro con Webpay y MercadoPago
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-rose-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-display text-2xl lg:text-3xl font-light tracking-widest text-charcoal-600 group-hover:text-primary-500 transition-colors">
                DIVINITTYS
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`font-sans text-sm font-medium tracking-wide transition-colors relative group ${
                    link.highlight
                      ? 'text-primary-500 hover:text-primary-600'
                      : 'text-charcoal-500 hover:text-primary-500'
                  }`}
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary-400 group-hover:w-full transition-all duration-300" />
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2 lg:gap-3">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-full hover:bg-primary-50 text-charcoal-500 hover:text-primary-500 transition-colors"
                aria-label="Buscar"
              >
                <Search className="w-5 h-5" />
              </button>

              <Link
                href="/wishlist"
                className="p-2 rounded-full hover:bg-primary-50 text-charcoal-500 hover:text-primary-500 transition-colors hidden sm:flex"
                aria-label="Lista de deseos"
              >
                <Heart className="w-5 h-5" />
              </Link>

              <Link
                href={hydrated && user ? '/cuenta' : '/cuenta/login'}
                className="p-2 rounded-full hover:bg-primary-50 text-charcoal-500 hover:text-primary-500 transition-colors hidden sm:flex"
                aria-label="Mi cuenta"
              >
                <User className="w-5 h-5" />
              </Link>

              <button
                onClick={() => setCartOpen(true)}
                className="relative p-2 rounded-full hover:bg-primary-50 text-charcoal-500 hover:text-primary-500 transition-colors"
                aria-label="Carrito"
              >
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center font-bold"
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </motion.span>
                )}
              </button>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="lg:hidden p-2 rounded-full hover:bg-primary-50 text-charcoal-500"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-white border-t border-primary-100 overflow-hidden"
            >
              <div className="px-4 py-4 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`py-3 px-4 rounded-lg font-sans font-medium text-sm transition-colors ${
                      link.highlight
                        ? 'text-primary-500 hover:bg-primary-50'
                        : 'text-charcoal-600 hover:bg-champagne-100'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="border-t border-border mt-2 pt-2 flex flex-col gap-1">
                  <Link href="/cuenta" onClick={() => setMenuOpen(false)} className="py-3 px-4 rounded-lg text-charcoal-600 hover:bg-champagne-100 font-sans text-sm font-medium">
                    Mi Cuenta
                  </Link>
                  <Link href="/wishlist" onClick={() => setMenuOpen(false)} className="py-3 px-4 rounded-lg text-charcoal-600 hover:bg-champagne-100 font-sans text-sm font-medium">
                    Lista de Deseos
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Spacer */}
      <div className="h-[calc(40px+64px)] lg:h-[calc(40px+80px)]" />

      {/* Modals */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
