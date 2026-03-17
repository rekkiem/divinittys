/**
 * Unit Tests: lib/utils/api.ts
 */
import { describe, it, expect } from 'vitest';
import { formatCLP, generateOrderNumber, slugify, calculateDiscount, paginate } from '@/lib/utils/api';

describe('formatCLP', () => {
  it('formats number to CLP currency', () => {
    expect(formatCLP(1000)).toBe('$1.000');
    expect(formatCLP(29990)).toBe('$29.990');
    expect(formatCLP(0)).toBe('$0');
  });
  it('handles null/undefined gracefully', () => {
    expect(formatCLP(null)).toBe('$0');
    expect(formatCLP(undefined)).toBe('$0');
  });
});

describe('generateOrderNumber', () => {
  it('generates unique order numbers', () => {
    const a = generateOrderNumber();
    const b = generateOrderNumber();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^DIV-/);
  });
  it('has correct format', () => {
    const order = generateOrderNumber();
    expect(order.length).toBeGreaterThan(6);
  });
});

describe('slugify', () => {
  it('converts text to slug', () => {
    expect(slugify('Shampoo Reparador')).toBe('shampoo-reparador');
    expect(slugify('Máscara Capilar')).toMatch(/mascara-capilar/);
  });
  it('removes special characters', () => {
    const result = slugify('Producto & Belleza!');
    expect(result).not.toContain('&');
    expect(result).not.toContain('!');
  });
});

describe('calculateDiscount', () => {
  it('calculates percentage discount correctly', () => {
    expect(calculateDiscount(8000, 10000)).toBe(20);
    expect(calculateDiscount(9000, 10000)).toBe(10);
  });
  it('returns 0 when no discount', () => {
    expect(calculateDiscount(10000, 10000)).toBe(0);
  });
});

describe('paginate', () => {
  it('calculates correct skip and take', () => {
    expect(paginate(1, 20)).toEqual({ skip: 0, take: 20 });
    expect(paginate(2, 20)).toEqual({ skip: 20, take: 20 });
    expect(paginate(3, 10)).toEqual({ skip: 20, take: 10 });
  });
});
