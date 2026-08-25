'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X, ShoppingBag, Minus, Plus, Trash2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '@/hooks/useCart';
import { formatCLP } from '@/lib/utils/api';

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { items, updateQuantity, removeItem, subtotal, count } = useCartStore();
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(29990);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/public')
      .then((r) => r.json())
      .then((d) => {
        const n = Number(d?.data?.settings?.free_shipping_threshold ?? d?.settings?.free_shipping_threshold);
        if (!cancelled && Number.isFinite(n) && n >= 0) setFreeShippingThreshold(n);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const remaining = freeShippingThreshold - subtotal;
  const qualifiesFree = subtotal >= freeShippingThreshold && items.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-background flex flex-col shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-primary-500" />
                <h2 className="font-display text-xl font-medium">Mi Carrito</h2>
                {count > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-600 text-xs font-bold">
                    {count}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Free shipping progress */}
            {items.length > 0 && (
              <div className="px-6 py-3 bg-champagne-50 border-b border-champagne-200">
                {qualifiesFree ? (
                  <p className="font-sans text-xs text-emerald-700 font-semibold">
                    ¡Envío gratis! Superaste {formatCLP(freeShippingThreshold)}
                  </p>
                ) : (
                  <>
                    <p className="font-sans text-xs text-charcoal-500 mb-1.5">
                      Te faltan <strong className="text-primary-600">{formatCLP(Math.max(remaining, 0))}</strong> para envío gratis
                    </p>
                    <div className="h-1.5 bg-champagne-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((subtotal / Math.max(freeShippingThreshold, 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Items */}
            <div className="flex-1 overflow-y-auto py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-champagne-100 flex items-center justify-center">
                    <ShoppingBag className="w-10 h-10 text-primary-300" />
                  </div>
                  <p className="font-display text-xl text-charcoal-400">Tu carrito está vacío</p>
                  <p className="font-sans text-sm text-muted-foreground">
                    Agrega productos para comenzar
                  </p>
                  <Link href="/productos" onClick={onClose} className="btn-primary mt-2">
                    Ver catálogo
                  </Link>
                </div>
              ) : (
                <div className="px-6 space-y-4">
                  <AnimatePresence>
                    {items.map((item) => (
                      <motion.div
                        key={`${item.id}-${item.variantId}`}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex gap-4 py-4 border-b border-border last:border-0"
                      >
                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-champagne-50 flex-shrink-0">
                          {item.image ? (
                            <Image src={item.image} alt={item.name} width={80} height={80} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-champagne-gradient" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-sans text-sm font-medium text-charcoal-700 line-clamp-2 leading-tight">
                            {item.name}
                          </p>
                          {item.variantName && (
                            <p className="font-sans text-xs text-muted-foreground mt-0.5">{item.variantName}</p>
                          )}
                          <p className="font-sans font-bold text-primary-600 mt-1">{formatCLP(item.price)}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1 border border-border rounded-lg">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1, item.variantId)}
                                className="p-1.5 hover:bg-muted rounded-l-lg transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-3 font-sans font-medium text-sm min-w-[28px] text-center">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1, item.variantId)}
                                className="p-1.5 hover:bg-muted rounded-r-lg transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <button
                              onClick={() => removeItem(item.id, item.variantId)}
                              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-border p-6 space-y-4 bg-background">
                <div className="flex justify-between items-center">
                  <span className="font-sans text-muted-foreground">Subtotal</span>
                  <span className="font-sans font-bold text-xl">{formatCLP(subtotal)}</span>
                </div>
                <p className="font-sans text-xs text-muted-foreground text-center">
                  Envío calculado en el checkout
                </p>
                <Link
                  href="/checkout"
                  onClick={onClose}
                  className="btn-primary w-full flex items-center justify-center gap-2 text-center"
                >
                  Ir al checkout
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
