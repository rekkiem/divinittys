'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Star } from 'lucide-react';

const slides = [
  {
    title: 'Belleza\nProfesional',
    subtitle: 'A tu alcance',
    description: 'Los mejores productos capilares y de belleza, directo de las marcas más prestigiosas.',
    cta: 'Explorar catálogo',
    ctaLink: '/productos',
    accent: 'Nuevo',
    accentText: 'Colección Primavera',
    bg: 'from-champagne-200 via-rose-100 to-primary-50',
  },
  {
    title: 'Diagnóstico\nCapilar',
    subtitle: 'Con inteligencia artificial',
    description: 'Descubre exactamente qué productos necesita tu cabello con nuestro diagnóstico personalizado.',
    cta: 'Hacer diagnóstico',
    ctaLink: '/diagnostico-capilar',
    accent: 'IA',
    accentText: 'Tecnología LUNA',
    bg: 'from-primary-100 via-champagne-100 to-rose-50',
  },
];

export default function HeroSection() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const slide = slides[current];

  return (
    <section className={`relative min-h-[85vh] lg:min-h-screen flex items-center overflow-hidden bg-gradient-to-br ${slide.bg} transition-all duration-1000`}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-primary-200/40 to-rose-200/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-champagne-300/50 to-primary-100/30 blur-3xl" />

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary-400/30"
            style={{
              top: `${20 + i * 13}%`,
              left: `${10 + i * 14}%`,
            }}
            animate={{
              y: [0, -15, 0],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.4,
            }}
          />
        ))}

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(201,149,106,1) 1px, transparent 1px), linear-gradient(90deg, rgba(201,149,106,1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div className="space-y-8">
            {/* Accent badge */}
            <motion.div
              key={`badge-${current}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-primary-200 backdrop-blur-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary-500" />
              <span className="text-primary-600 font-sans text-xs font-semibold tracking-wider uppercase">
                {slide.accentText}
              </span>
            </motion.div>

            {/* Title */}
            <motion.div
              key={`title-${current}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <h1 className="font-display text-6xl lg:text-8xl xl:text-9xl font-light leading-[0.9] tracking-tight text-charcoal-700">
                {slide.title.split('\n').map((line, i) => (
                  <span key={i} className="block">
                    {i === 1 ? (
                      <span className="gradient-text">{line}</span>
                    ) : line}
                  </span>
                ))}
              </h1>
              <p className="font-display text-2xl lg:text-3xl font-light text-primary-400 mt-2">
                {slide.subtitle}
              </p>
            </motion.div>

            {/* Description */}
            <motion.p
              key={`desc-${current}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="font-sans text-charcoal-500 text-lg leading-relaxed max-w-md"
            >
              {slide.description}
            </motion.p>

            {/* CTAs */}
            <motion.div
              key={`cta-${current}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link href={slide.ctaLink} className="btn-primary inline-flex items-center gap-2 group">
                {slide.cta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/asistente-belleza" className="btn-secondary inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Asistente IA
              </Link>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-6 pt-4"
            >
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-primary-400 fill-primary-400" />
                ))}
                <span className="font-sans text-sm text-charcoal-500 ml-2">4.9/5</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <span className="font-sans text-sm text-charcoal-500">
                +2.000 productos disponibles
              </span>
            </motion.div>
          </div>

          {/* Visual */}
          <motion.div
            className="hidden lg:flex justify-center items-center relative"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            {/* Decorative circles */}
            <div className="absolute w-[500px] h-[500px] rounded-full border border-primary-200/50" />
            <div className="absolute w-[380px] h-[380px] rounded-full border border-primary-300/30 animate-[spin_20s_linear_infinite]" />

            {/* Center piece */}
            <div className="relative z-10 w-64 h-64 rounded-full bg-gradient-to-br from-primary-300 to-rose-300 shadow-2xl shadow-primary-300/40 flex items-center justify-center">
              <div className="text-center text-white">
                <Sparkles className="w-16 h-16 mx-auto mb-3 animate-float" />
                <p className="font-display text-2xl font-light">Belleza</p>
                <p className="font-sans text-sm font-medium tracking-widest">PROFESIONAL</p>
              </div>
            </div>

            {/* Floating product cards */}
            {[
              { label: 'Wella', sub: 'Coloración', top: '5%', right: '0%' },
              { label: 'Kerastase', sub: 'Tratamientos', bottom: '15%', left: '0%' },
              { label: 'Redken', sub: 'Cuidado', top: '50%', right: '-5%' },
            ].map((card, i) => (
              <motion.div
                key={i}
                className="absolute px-4 py-2 bg-white/90 backdrop-blur-sm rounded-xl border border-white shadow-lg"
                style={{ top: card.top, bottom: card.bottom, left: card.left, right: card.right }}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.8 }}
              >
                <p className="font-display text-sm font-semibold text-charcoal-700">{card.label}</p>
                <p className="font-sans text-xs text-charcoal-400">{card.sub}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === current ? 'w-8 bg-primary-500' : 'w-1.5 bg-primary-300'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
