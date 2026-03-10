'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, MessageCircle, ArrowRight } from 'lucide-react';

export default function BeautyAssistantBanner() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-500 via-primary-400 to-rose-400 p-10 lg:p-16"
        >
          {/* Background decorations */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-rose-400/20 blur-xl" />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />

          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-10">
            {/* Icon */}
            <div className="flex-none w-24 h-24 lg:w-32 lg:h-32 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Sparkles className="w-12 h-12 lg:w-16 lg:h-16 text-white" />
            </div>

            {/* Content */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 mb-4">
                <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                <span className="text-white text-xs font-semibold tracking-wider uppercase font-sans">
                  LUNA — Asistente IA activa
                </span>
              </div>
              <h2 className="font-display text-4xl lg:text-5xl font-light text-white mb-4 leading-tight">
                Tu asistente de belleza
                <br />
                <span className="font-medium">con inteligencia artificial</span>
              </h2>
              <p className="font-sans text-white/80 text-lg leading-relaxed max-w-xl">
                LUNA conoce miles de productos y puede ayudarte a encontrar exactamente lo que tu cabello necesita. Consulta, compara y recibe recomendaciones personalizadas.
              </p>
            </div>

            {/* CTA */}
            <div className="flex-none flex flex-col items-center gap-4">
              <Link
                href="/asistente-belleza"
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white text-primary-600 font-sans font-bold text-lg hover:bg-champagne-50 transition-colors shadow-xl group"
              >
                <MessageCircle className="w-5 h-5" />
                Chatear con LUNA
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <p className="text-white/60 text-xs font-sans">Gratis · Sin registro · 24/7</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
