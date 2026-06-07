import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, badRequest, conflict, serverError } from '@/lib/utils/api';
import { rateLimit } from '@/lib/security/rate-limit';
import { sanitizeEmail, sanitizeText } from '@/lib/security/sanitize';

const SubscribeSchema = z.object({
  email:  z.string().email('Email inválido'),
  name:   z.string().optional(),
  source: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const limit = rateLimit(req, { key: 'newsletter-subscribe', limit: 3, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return Response.json({ error: 'Demasiados intentos. Intenta en una hora.' }, { status: 429 });
  }
  try {
    const parsed = SubscribeSchema.parse(await req.json());
    const body = {
      email: sanitizeEmail(parsed.email),
      name: parsed.name ? sanitizeText(parsed.name) : undefined,
      source: parsed.source ? sanitizeText(parsed.source).slice(0, 100) : undefined,
    };

    const existing = await prisma.subscriber.findUnique({ where: { email: body.email } });
    if (existing) {
      if (!existing.isActive) {
        await prisma.subscriber.update({ where: { email: body.email }, data: { isActive: true } });
        return ok({ message: 'Suscripción reactivada exitosamente' });
      }
      return conflict('Ya estás suscrito a nuestra newsletter');
    }

    await prisma.subscriber.create({
      data: { email: body.email, name: body.name, source: body.source },
    });

    return ok({ message: '¡Gracias por suscribirte!' });
  } catch (e) {
    if (e instanceof z.ZodError) return badRequest('Email inválido', e.errors);
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    if (!email) return badRequest('Email requerido');
    const normalizedEmail = sanitizeEmail(email);

    await prisma.subscriber.updateMany({ where: { email: normalizedEmail }, data: { isActive: false } });

    return ok({ message: 'Desuscripción exitosa' });
  } catch (e) {
    return serverError(e);
  }
}
