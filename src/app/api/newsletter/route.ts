import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { badRequest, created, serverError } from '@/lib/utils/api';

const schema = z.object({
  email: z.string().email(),
  source: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest('Email inválido');

    const sub = await prisma.subscriber.upsert({
      where: { email: parsed.data.email.toLowerCase() },
      create: {
        email: parsed.data.email.toLowerCase(),
        source: parsed.data.source || 'footer',
      },
      update: { status: 'ACTIVE' },
    });

    return created({ id: sub.id, email: sub.email });
  } catch (error) {
    return serverError(error);
  }
}
