'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const steps = [
  { num: '01', label: 'Describe tu cabello' },
  { num: '02', label: 'Cuéntanos tu rutina' },
  { num: '03', label: 'Recibe tus productos' },
];

export default function HairDiagnosisBanner() {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-background to-champagne-50/50">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div>
              <p className="font-sans text-primary-500 text-xs font-semibold tracking-widest uppercase mb-3">
                Diagnóstico Capilar
              </p>
              <h2 className="section-title">
                Descubre qué
                <span className="gradient-text block">necesita tu cabello</span>
              </h2>
              <p className="font-sans text-charcoal-500 text-lg leading-relaxed mt-4 max-w-md">
                Nuestro diagnóstico impulsado por IA analiza las características de tu cabello y te sugiere los productos perfectos para tu rutina.
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-4">
              {steps.map((step, i) => (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-4"
                >
                  <span className="font-display text-3xl font-light text-primary-300 w-10 shrink-0">
                    {step.num}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-primary-200 to-transparent" />
                  <span className="font-sans text-sm font-medium text-charcoal-600">
                    {step.label}
                  </span>
                </motion.div>
              ))}
            </div>

            <Link href="/diagnostico-capilar" className="btn-primary inline-flex items-center gap-2 group">
              Hacer mi diagnóstico gratis
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          {/* Right: Visual */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative flex justify-center"
          >
            <div className="relative w-full max-w-sm">
              {/* Phone mockup */}
              <div className="relative bg-white rounded-[2.5rem] shadow-2xl shadow-primary-500/20 border border-champagne-200 overflow-hidden p-6">
                <div className="flex items-center justify-between mb-6">
                  <span className="font-display text-lg font-light text-charcoal-700">Diagnóstico</span>
                  <span className="text-xs font-sans text-primary-500 bg-primary-50 px-3 py-1 rounded-full font-semibold">IA</span>
                </div>

                {/* Questions mockup */}
                {[
                  { q: '¿Cómo describirías tu cabello?', a: 'Ondulado y seco' },
                  { q: '¿Usas color o decoloración?', a: 'Sí, coloración' },
                  { q: '¿Principal problema?', a: 'Frizz y rotura' },
                ].map((item, i) => (
                  <div key={i} className="mb-4 p-3 rounded-xl bg-champagne-50 border border-champagne-200">
                    <p className="font-sans text-xs text-charcoal-400 mb-1">{item.q}</p>
                    <p className="font-sans text-sm font-semibold text-charcoal-700">{item.a}</p>
                  </div>
                ))}

                {/* Result preview */}
                <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-primary-50 to-rose-50 border border-primary-200">
                  <p className="font-sans text-xs font-semibold text-primary-600 mb-2">✨ Resultado personalizado</p>
                  <p className="font-sans text-xs text-charcoal-500">
                    Basado en tu perfil, recomendamos tratamientos hidratantes con keratina y aceites naturales...
                  </p>
                </div>
              </div>

              {/* Floating elements */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute -top-4 -right-4 bg-primary-500 text-white px-4 py-2 rounded-2xl text-xs font-sans font-bold shadow-lg"
              >
                🎯 100% Personalizado
              </motion.div>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                className="absolute -bottom-4 -left-4 bg-white border border-champagne-300 px-4 py-2 rounded-2xl text-xs font-sans font-semibold text-charcoal-600 shadow-lg"
              >
                ⚡ En 2 minutos
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
