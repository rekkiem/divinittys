import { describe, expect, it } from 'vitest';
import {
  buildVariantName,
  buildVariantSku,
  getVariationPrice,
  getVariationStock,
  normalizeMercadoLibreVariations,
  sumVariationStock,
} from '@/lib/mercadolibre/variants';

describe('Mercado Libre variants', () => {
  const variations = [
    {
      id: 101,
      price: 6990,
      available_quantity: 3,
      attribute_combinations: [{ id: 'COLOR', name: 'Color', value_name: 'P8 - RUBIO CLARISIMO PLUS' }],
      picture_ids: ['pic-1'],
    },
    {
      id: 102,
      price: 7490,
      available_quantity: 0,
      attribute_combinations: [{ id: 'COLOR', name: 'Color', value_name: 'P9' }],
    },
  ];

  it('uses ML variation id as the stable external identity', () => {
    expect(buildVariantSku('MLC123', variations[0])).toBe('ML-MLC123-V-101');
  });

  it('builds human-readable names from attribute combinations', () => {
    expect(buildVariantName(variations[0])).toBe('P8 - RUBIO CLARISIMO PLUS');
  });

  it('normalizes price and stock safely', () => {
    expect(getVariationStock(variations[0])).toBe(3);
    expect(getVariationStock(variations[1])).toBe(0);
    expect(getVariationPrice(variations[0], 5000)).toBe(6990);
  });

  it('sums variation stock without falling back to the parent quantity', () => {
    expect(sumVariationStock(variations)).toBe(3);
  });

  it('preserves ML mapping data in options', () => {
    const result = normalizeMercadoLibreVariations('MLC123', 5000, variations);
    expect(result).toHaveLength(2);
    expect(result[0].options).toMatchObject({ source: 'mercadolibre', itemId: 'MLC123', variationId: '101' });
    expect(result[1].stock).toBe(0);
  });
});
