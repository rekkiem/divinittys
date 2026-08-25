import { prisma } from '@/lib/prisma';
import { ok, serverError } from '@/lib/utils/api';
import { PUBLIC_SETTING_KEYS } from '@/lib/shipping/free-shipping';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await prisma.setting.findMany({
      where: { key: { in: [...PUBLIC_SETTING_KEYS] } },
    });
    const settings = Object.fromEntries(rows.map((s: { key: string; value: string }) => [s.key, s.value]));
    if (!settings.free_shipping_threshold) settings.free_shipping_threshold = '29990';
    return ok({ settings });
  } catch (e) {
    return serverError(e);
  }
}
