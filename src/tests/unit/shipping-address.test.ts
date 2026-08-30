import { describe, it, expect } from 'vitest';
import { formatShippingAddress, isValidChileCommune, findRegionForCommune } from '@/lib/chile/geo';

describe('formatShippingAddress', () => {
  it('renders current checkout payload', () => {
    const f = formatShippingAddress({
      firstName: 'Rafael',
      lastName: 'Briones',
      street: 'Los Alerces',
      number: '123',
      apartment: 'Casa',
      commune: 'La Cisterna',
      city: 'Santiago',
      region: 'Metropolitana',
      email: 'rekkiem@gmail.com',
      phone: '+56989024587',
    });
    expect(f.fullName).toBe('Rafael Briones');
    expect(f.line1).toContain('Los Alerces 123');
    expect(f.line2).toContain('La Cisterna');
    expect(f.isComplete).toBe(true);
  });

  it('does not show a leading comma when street is missing', () => {
    const f = formatShippingAddress({ lastName: 'Briones', commune: 'La Cisterna', city: 'Santiago', region: 'Metropolitana' });
    expect(f.line1).not.toMatch(/^,/);
    expect(f.fullName).toBe('Briones');
  });
});

describe('chile geo', () => {
  it('validates La Cisterna in Metropolitana', () => {
    expect(isValidChileCommune('Metropolitana', 'La Cisterna')).toBe(true);
    expect(findRegionForCommune('La Cisterna')).toBe('Metropolitana');
    expect(isValidChileCommune('Valparaíso', 'La Cisterna')).toBe(false);
  });
});
