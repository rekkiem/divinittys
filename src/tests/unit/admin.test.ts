import { describe, it, expect, vi } from 'vitest';
import { formatCLP, slugify, calculateDiscount } from '@/lib/utils/api';

describe('Admin: Product utilities', () => {
  it('slugify handles spanish characters', () => {
    expect(slugify('Máscara Capilar Reparación')).toMatch(/mascara-capilar-reparacion/);
    expect(slugify('Crème Nutritive & Brillante!')).not.toContain('&');
  });

  it('calculateDiscount returns correct percentage', () => {
    expect(calculateDiscount(7990, 9990)).toBe(20);
    expect(calculateDiscount(4995, 9990)).toBe(50);
    expect(calculateDiscount(9990, 9990)).toBe(0);
  });

  it('formatCLP formats CLP prices correctly', () => {
    expect(formatCLP(29990)).toContain('29');
    expect(formatCLP(0)).toContain('0');
    expect(formatCLP(null)).toContain('0');
  });
});

describe('Admin: Product form validation', () => {
  it('requires name to create slug', () => {
    const name = 'Shampoo Reparador';
    const slug = slugify(name);
    expect(slug).toBe('shampoo-reparador');
    expect(slug.length).toBeGreaterThan(0);
  });

  it('price must be positive', () => {
    const isValidPrice = (p: number) => p > 0 && isFinite(p);
    expect(isValidPrice(9990)).toBe(true);
    expect(isValidPrice(0)).toBe(false);
    expect(isValidPrice(-100)).toBe(false);
  });

  it('stock must be non-negative integer', () => {
    const isValidStock = (s: number) => Number.isInteger(s) && s >= 0;
    expect(isValidStock(0)).toBe(true);
    expect(isValidStock(100)).toBe(true);
    expect(isValidStock(-1)).toBe(false);
    expect(isValidStock(1.5)).toBe(false);
  });
});

describe('Admin: Status labels', () => {
  const STATUS_LABELS: Record<string, string> = {
    PENDING: 'Pendiente', CONFIRMED: 'Confirmado', PROCESSING: 'En proceso',
    SHIPPED: 'Enviado', DELIVERED: 'Entregado', CANCELLED: 'Cancelado',
  };

  it('covers all order statuses', () => {
    const statuses = ['PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED'];
    statuses.forEach(s => expect(STATUS_LABELS[s]).toBeDefined());
  });

  it('unknown status falls back gracefully', () => {
    const label = STATUS_LABELS['UNKNOWN'] ?? 'Desconocido';
    expect(label).toBe('Desconocido');
  });
});
