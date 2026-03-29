import { Prisma } from '@prisma/client';

export function serializeForClient<T>(value: T): T {
  return transform(value) as T;
}

function transform(value: unknown): unknown {
  if (value instanceof Prisma.Decimal) {
    return Number(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(transform);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, transform(nested)])
    );
  }

  return value;
}
