import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, serverError } from '@/lib/utils/api';
import { enqueueProductDelete, enqueueProductIndex } from '@/lib/queue/search.queue';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const product = await prisma.product.update({
      where: { id: params.id },
      data: body,
    });
    await enqueueProductIndex(product.id);
    return ok(product);
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.product.delete({ where: { id: params.id } });
    await enqueueProductDelete(params.id);
    return ok({ message: 'Producto eliminado' });
  } catch (error) {
    return serverError(error);
  }
}
