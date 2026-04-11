import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, badRequest, conflict, serverError } from '@/lib/utils/api';

const SubscribeSchema = z.object({
  email:  z.string().email('Email inválido'),
  name:   z.string().optional(),
  source: z.string().optional(),
});

// Simple in-memory rate limit for newsletter subscriptions
// In production: use Redis (upstash/ratelimit or ioredis)
const subscribeAttempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  // Rate limit: 3 subscriptions per IP per hour
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const now = Date.now();
  const limit = subscribeAttempts.get(ip);

  if (limit && limit.resetAt > now && limit.count >= 3) {
    return Response.json({ error: 'Demasiados intentos. Intenta en una hora.' }, { status: 429 });
  }
  if (!limit || limit.resetAt <= now) {
    subscribeAttempts.set(ip, { count: 1, resetAt: now + 3_600_000 });
  } else {
    limit.count++;
  }
  try {
    const body = SubscribeSchema.parse(await req.json());

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

    await prisma.subscriber.update({
      where: { email },
      data: { isActive: false },
    });

    return ok({ message: 'Desuscripción exitosa' });
  } catch (e) {
    return serverError(e);
  }
}
