export interface OurProduct {
  id: string;
  title: string;
  sku?: string | null;
  gtin?: string | null;
  brand?: string | null;
  model?: string | null;
  price?: number | null;
  mlItemId?: string | null;
}

export interface CompetitorHit {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  permalink: string;
  sellerId: number;
  sellerNickname?: string;
  soldQuantity?: number;
  logisticType: string;
  freeShipping: boolean;
  matchedBy: string;
  ourProductId: string;
  ourTitle: string;
}

export interface AuditReport {
  generatedAt: string;
  ourSellerId: number;
  productsScanned: number;
  alerts: CompetitorHit[];
  summary: {
    productsWithCompetitors: number;
    totalCompetitorListings: number;
  };
}

export type TokenData = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id?: number;
  scope?: string;
  obtained_at?: string;
};
