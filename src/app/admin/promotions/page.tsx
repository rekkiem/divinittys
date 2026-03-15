import { prisma } from '@/lib/prisma';

export default async function AdminPromotionsPage() {
  const promotions = await prisma.promotion.findMany({ orderBy: { startAt: 'desc' } });

  return (
    <main className="container py-10 space-y-4">
      <h1 className="text-2xl font-semibold">Promociones programadas</h1>
      {promotions.map((promotion) => (
        <div key={promotion.id} className="card-product p-4">
          <p className="font-medium">{promotion.name}</p>
          <p className="text-sm text-muted-foreground">{promotion.type} | {Number(promotion.value)}</p>
        </div>
      ))}
    </main>
  );
}
