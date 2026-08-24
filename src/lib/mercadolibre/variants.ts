export type MercadoLibreVariation = {
  id: number | string;
  price?: number | string | null;
  available_quantity?: number | string | null;
  seller_custom_field?: string | null;
  picture_ids?: (string | number)[] | null;
  attribute_combinations?: {
    id?: string | null;
    name?: string | null;
    value_id?: string | null;
    value_name?: string | null;
  }[] | null;
  [key: string]: unknown;
};

export type NormalizedMercadoLibreVariant = {
  variationId: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  pictureIds: string[];
  options: Record<string, unknown>;
};

export function buildVariantName(variation: MercadoLibreVariation): string {
  const combinations = Array.isArray(variation.attribute_combinations)
    ? variation.attribute_combinations
        .map((attribute) => String(attribute.value_name || '').trim())
        .filter(Boolean)
    : [];

  if (combinations.length) return combinations.join(' / ');
  return `Variante ${String(variation.id)}`;
}

export function buildVariantSku(itemId: string, variation: MercadoLibreVariation): string {
  return `ML-${itemId}-V-${String(variation.id)}`;
}

export function getVariationStock(variation: MercadoLibreVariation): number {
  const stock = Number(variation.available_quantity ?? 0);
  return Number.isFinite(stock) && stock >= 0 ? Math.floor(stock) : 0;
}

export function getVariationPrice(
  variation: MercadoLibreVariation,
  fallbackPrice: number
): number {
  const price = Number(variation.price ?? fallbackPrice);
  return Number.isFinite(price) && price > 0 ? price : fallbackPrice;
}

export function sumVariationStock(variations: MercadoLibreVariation[]): number {
  return variations.reduce((sum, variation) => sum + getVariationStock(variation), 0);
}

export function normalizeMercadoLibreVariations(
  itemId: string,
  itemPrice: number,
  variations: MercadoLibreVariation[]
): NormalizedMercadoLibreVariant[] {
  return variations.map((variation) => ({
    variationId: String(variation.id),
    sku: buildVariantSku(itemId, variation),
    name: buildVariantName(variation),
    price: getVariationPrice(variation, itemPrice),
    stock: getVariationStock(variation),
    pictureIds: Array.isArray(variation.picture_ids)
      ? variation.picture_ids.map(String)
      : [],
    options: {
      source: 'mercadolibre',
      itemId,
      variationId: String(variation.id),
      sellerCustomField: variation.seller_custom_field ?? null,
      attributeCombinations: variation.attribute_combinations ?? [],
      pictureIds: Array.isArray(variation.picture_ids)
        ? variation.picture_ids.map(String)
        : [],
    },
  }));
}
