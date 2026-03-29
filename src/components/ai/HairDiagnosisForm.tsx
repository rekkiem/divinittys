'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { formatCLP } from '@/lib/utils/api';
import { normalizeImageUrl } from '@/lib/images';

const STEPS = [
  {
    id: 'hairType',
    title: '¿Cómo es tu cabello?',
    subtitle: 'Selecciona la opción que mejor describe tu cabello',
    options: [
      { value: 'liso', label: 'Liso', icon: '—' },
      { value: 'ondulado', label: 'Ondulado', icon: '~' },
      { value: 'rizado', label: 'Rizado', icon: '∿' },
      { value: 'afro', label: 'Muy rizado', icon: '⊕' },
    ],
  },
  {
    id: 'condition',
    title: '¿Estado de tu cabello?',
    subtitle: 'Sé honesta para obtener la mejor recomendación',
    options: [
      { value: 'sano', label: 'Sano y fuerte', icon: '💪' },
      { value: 'seco', label: 'Seco y opaco', icon: '🌵' },
      { value: 'graso', label: 'Graso', icon: '💧' },
      { value: 'danado', label: 'Dañado/quebrado', icon: '⚡' },
    ],
  },
  {
    id: 'chemical',
    title: '¿Usas procesos químicos?',
    subtitle: 'Los tratamientos químicos cambian las necesidades del cabello',
    options: [
      { value: 'natural', label: 'Sin procesos', icon: '🌿' },
      { value: 'color', label: 'Color / tinte', icon: '🎨' },
      { value: 'decoloracion', label: 'Decoloración', icon: '✨' },
      { value: 'alaciado', label: 'Alaciado / keratina', icon: '💆' },
    ],
  },
  {
    id: 'concern',
    title: '¿Cuál es tu mayor preocupación?',
    subtitle: 'Priorizaremos los productos según esto',
    options: [
      { value: 'hidratacion', label: 'Falta de hidratación', icon: '💦' },
      { value: 'frizz', label: 'Frizz / encrespamiento', icon: '⚡' },
      { value: 'caida', label: 'Caída del cabello', icon: '🍂' },
      { value: 'brillo', label: 'Falta de brillo', icon: '✨' },
    ],
  },
];

type Answers = Record<string, string>;
type RecommendedProduct = {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  images: { url: string }[];
  brand?: { name: string } | null;
  reason?: string;
};

export default function HairDiagnosisForm() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ products: RecommendedProduct[]; advice: string } | null>(null);

  const currentStep = STEPS[step];
  const progress = ((step) / STEPS.length) * 100;

  const selectOption = (value: string) => {
    const newAnswers = { ...answers, [currentStep.id]: value };
    setAnswers(newAnswers);

    if (step < STEPS.length - 1) {
      setTimeout(() => setStep((s) => s + 1), 200);
    } else {
      submitDiagnosis(newAnswers);
    }
  };

  const submitDiagnosis = async (finalAnswers: Answers) => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'diagnosis', answers: finalAnswers }),
      });
      const data = await res.json();
      setResult(data.data || data);
    } catch {
      setResult({ products: [], advice: 'No pudimos generar recomendaciones en este momento. Por favor intenta más tarde.' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-primary-200 border-t-primary-500"
        />
        <h3 className="font-display text-2xl font-light text-charcoal-700 mb-2">Analizando tu cabello...</h3>
        <p className="font-sans text-charcoal-400">LUNA está preparando tus recomendaciones personalizadas</p>
      </div>
    );
  }

  if (result) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className="text-center p-6 rounded-3xl bg-gradient-to-br from-primary-50 to-rose-50 border border-primary-200">
          <CheckCircle2 className="w-12 h-12 text-primary-500 mx-auto mb-4" />
          <h3 className="font-display text-2xl font-light text-charcoal-700 mb-3">Tu diagnóstico está listo</h3>
          <p className="font-sans text-charcoal-500 leading-relaxed">{result.advice}</p>
        </div>

        {result.products.length > 0 && (
          <div>
            <h4 className="font-sans font-bold text-charcoal-700 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-500" />
              Productos recomendados para ti
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {result.products.slice(0, 4).map((p) => (
                <Link key={p.id} href={`/productos/${p.slug}`}>
                  <div className="group p-4 rounded-2xl border border-champagne-200 hover:border-primary-300 hover:shadow-md transition-all">
                    <div className="aspect-square rounded-xl bg-champagne-100 overflow-hidden mb-3">
                      {normalizeImageUrl(p.images[0]?.url) ? (
                        <img src={normalizeImageUrl(p.images[0]?.url)!} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="font-display text-3xl text-primary-300">D</span>
                        </div>
                      )}
                    </div>
                    {p.brand && <p className="font-sans text-xs font-bold text-primary-500 uppercase tracking-wider mb-1">{p.brand.name}</p>}
                    <p className="font-sans text-sm font-medium text-charcoal-700 group-hover:text-primary-600 line-clamp-2 mb-2 transition-colors">{p.name}</p>
                    <p className="font-sans font-bold text-primary-600">{formatCLP(p.basePrice)}</p>
                    {p.reason && <p className="font-sans text-xs text-charcoal-400 mt-1 italic">"{p.reason}"</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => { setStep(0); setAnswers({}); setResult(null); }}
            className="btn-secondary flex-1"
          >
            Repetir diagnóstico
          </button>
          <Link href="/productos" className="btn-primary flex-1 text-center">
            Ver todo el catálogo
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-champagne-200 shadow-xl overflow-hidden">
      {/* Progress bar */}
      <div className="h-1.5 bg-champagne-100">
        <motion.div
          className="h-full bg-gradient-to-r from-primary-400 to-rose-400"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <div className="p-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i < step ? 'bg-primary-500' : i === step ? 'bg-primary-300' : 'bg-champagne-200'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <p className="font-sans text-xs font-semibold text-primary-500 uppercase tracking-widest mb-2">
              Pregunta {step + 1} de {STEPS.length}
            </p>
            <h2 className="font-display text-3xl font-light text-charcoal-700 mb-2">{currentStep.title}</h2>
            <p className="font-sans text-charcoal-400 mb-8">{currentStep.subtitle}</p>

            <div className="grid grid-cols-2 gap-4">
              {currentStep.options.map((opt) => (
                <motion.button
                  key={opt.value}
                  onClick={() => selectOption(opt.value)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-5 rounded-2xl border-2 text-left transition-all ${
                    answers[currentStep.id] === opt.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-champagne-200 hover:border-primary-300 hover:bg-champagne-50'
                  }`}
                >
                  <span className="text-2xl mb-3 block">{opt.icon}</span>
                  <span className="font-sans font-semibold text-charcoal-700 text-sm">{opt.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="mt-6 flex items-center gap-2 font-sans text-sm text-charcoal-400 hover:text-charcoal-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
        )}
      </div>
    </div>
  );
}
