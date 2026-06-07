/**
 * /api/admin/settings — GET all + PUT/PATCH settings
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-auth';
import { ok, badRequest, serverError } from '@/lib/utils/api';
import { sanitizeText } from '@/lib/security/sanitize';

export async function GET(req: NextRequest) {
  const { user, error } = await withAdmin(req);
  if (error) return error;
  try {
    const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    const asObject = Object.fromEntries(settings.map((s: any) => [s.key, s.value]));
    return ok({ settings: asObject });
  } catch (e) { return serverError(e); }
}

const SettingsSchema = z.record(z.string(), z.string());

export async function PUT(req: NextRequest) {
  const { user, error } = await withAdmin(req);
  if (error) return error;
  try {
    const parsed = SettingsSchema.parse(await req.json());
    const body = Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [sanitizeText(key), sanitizeText(value).slice(0, 5000)])
    );
    const invalidKey = Object.keys(body).find((key) => !/^[a-z0-9._-]{2,100}$/i.test(key));
    if (invalidKey) return badRequest(`Clave de configuración inválida: ${invalidKey}`);
    // Upsert each key
    await Promise.all(
      Object.entries(body).map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value, type: 'string' },
        })
      )
    );
    return ok({ saved: Object.keys(body).length });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Datos inválidos');
    return serverError(e);
  }
}
