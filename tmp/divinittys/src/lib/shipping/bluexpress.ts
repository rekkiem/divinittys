/**
 * Bluexpress Logistics Integration
 * API para cotización, despacho y tracking
 */

const BX_BASE_URL = 'https://api.bluexpress.cl/api/v1';
const BX_API_KEY = process.env.BLUEXPRESS_API_KEY || '';
const BX_ACCOUNT = process.env.BLUEXPRESS_ACCOUNT || '';

const bxHeaders = {
  'Authorization': `Bearer ${BX_API_KEY}`,
  'X-Account': BX_ACCOUNT,
  'Content-Type': 'application/json',
};

export type BXAddress = {
  street: string;
  number: string;
  apartment?: string;
  commune: string;
  city: string;
  region: string;
  postalCode?: string;
};

export type BXPackage = {
  weight: number; // kg
  length: number; // cm
  width: number;  // cm
  height: number; // cm
  value: number;  // CLP - for insurance
};

export type BXQuoteParams = {
  origin: BXAddress;
  destination: BXAddress;
  packages: BXPackage[];
};

export type BXQuoteResponse = {
  serviceCode: string;
  serviceName: string;
  price: number;
  estimatedDays: number;
  currency: string;
};

export type BXShipmentParams = {
  reference: string;
  origin: BXAddress & { contactName: string; phone: string; email?: string };
  destination: BXAddress & { contactName: string; phone: string; email?: string };
  packages: BXPackage[];
  serviceCode: string;
  declaredValue: number;
  notes?: string;
};

export type BXShipmentResponse = {
  trackingNumber: string;
  labelUrl: string;
  status: string;
  estimatedDelivery: string;
};

export type BXTrackingEvent = {
  date: string;
  status: string;
  description: string;
  location?: string;
};

// Origin store address (configure in settings)
const STORE_ORIGIN: BXAddress = {
  street: 'Su dirección de despacho',
  number: '123',
  commune: 'Providencia',
  city: 'Santiago',
  region: 'Metropolitana',
};

export async function quoteBluexpress(
  destination: BXAddress,
  packages: BXPackage[]
): Promise<BXQuoteResponse[]> {
  try {
    const res = await fetch(`${BX_BASE_URL}/quote`, {
      method: 'POST',
      headers: bxHeaders,
      body: JSON.stringify({
        origin: STORE_ORIGIN,
        destination,
        packages,
      }),
    });

    if (!res.ok) {
      // Return mock response if API not configured
      return getMockQuotes();
    }

    return res.json();
  } catch {
    // Return mock response in development
    return getMockQuotes();
  }
}

export async function createBluexpressShipment(
  params: BXShipmentParams
): Promise<BXShipmentResponse> {
  const res = await fetch(`${BX_BASE_URL}/shipments`, {
    method: 'POST',
    headers: bxHeaders,
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Bluexpress error: ${JSON.stringify(error)}`);
  }

  return res.json();
}

export async function trackBluexpress(
  trackingNumber: string
): Promise<BXTrackingEvent[]> {
  try {
    const res = await fetch(`${BX_BASE_URL}/tracking/${trackingNumber}`, {
      headers: bxHeaders,
    });

    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getBluexpressLabel(trackingNumber: string): Promise<string | null> {
  try {
    const res = await fetch(`${BX_BASE_URL}/shipments/${trackingNumber}/label`, {
      headers: bxHeaders,
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.labelUrl || null;
  } catch {
    return null;
  }
}

// Mock for development/testing
function getMockQuotes(): BXQuoteResponse[] {
  return [
    {
      serviceCode: 'EXPRESS',
      serviceName: 'Bluexpress Express',
      price: 4990,
      estimatedDays: 1,
      currency: 'CLP',
    },
    {
      serviceCode: 'STANDARD',
      serviceName: 'Bluexpress Estándar',
      price: 2990,
      estimatedDays: 3,
      currency: 'CLP',
    },
  ];
}

export function calculatePackageFromOrder(items: { weight?: number | null; quantity: number }[]): BXPackage {
  const totalWeight = items.reduce((sum, item) => {
    return sum + ((item.weight ? Number(item.weight) : 0.3) * item.quantity);
  }, 0);

  return {
    weight: Math.max(totalWeight, 0.1),
    length: 30,
    width: 20,
    height: 15,
    value: 0,
  };
}
