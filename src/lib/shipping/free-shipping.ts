import { prisma } from '@/lib/prisma';

const DEFAULT_THRESHOLD = 29990;

export async function getFreeShippingThreshold(): Promise<number> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'free_shipping_threshold' } });
    const n = Number(row?.value);
    if (Number.isFinite(n) && n >= 0) return n;
  } catch {
    /* ignore */
  }
  return DEFAULT_THRESHOLD;
}

export const PUBLIC_SETTING_KEYS = [
  'free_shipping_threshold',
  'shipping_message',
  'store_name',
  'currency',
  'min_order_amount',
] as const;
