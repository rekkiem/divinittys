/**
 * Test auth helpers
 * Creates real JWT tokens for test scenarios
 */
import { signAccessToken } from '@/lib/auth';

export type TestRole = 'SUPER_ADMIN' | 'ADMIN' | 'CUSTOMER';

export async function makeToken(role: TestRole, userId = 'test-user-id', email = 'test@divinittys.cl') {
  return signAccessToken({ userId, email, role });
}

export async function makeAdminToken(userId = 'admin-test-id') {
  return makeToken('SUPER_ADMIN', userId, 'admin@divinittys.cl');
}

export async function makeCustomerToken(userId = 'customer-test-id') {
  return makeToken('CUSTOMER', userId, 'customer@divinittys.cl');
}

export function bearerHeader(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

/** Creates a mock NextRequest with auth header */
export function makeAuthRequest(
  url: string,
  options: { method?: string; body?: unknown; token?: string; role?: TestRole } = {}
) {
  const { method = 'GET', body, token } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Mock user objects for DB mocking */
export const MOCK_USERS = {
  superAdmin: { id: 'admin-id-001', email: 'admin@divinittys.cl', name: 'Admin', role: 'SUPER_ADMIN', avatar: null },
  admin:      { id: 'admin-id-002', email: 'admin2@divinittys.cl', name: 'Admin 2', role: 'ADMIN', avatar: null },
  customer:   { id: 'cust-id-001',  email: 'customer@test.cl', name: 'Customer', role: 'CUSTOMER', avatar: null },
};

export const MOCK_PRODUCT = {
  id: 'prod-test-001',
  sku: 'TST-001',
  name: 'Shampoo Reparador Test',
  slug: 'shampoo-reparador-test',
  description: 'Un producto de prueba',
  shortDescription: null,
  categoryId: 'cat-test-001',
  brandId: 'brand-test-001',
  basePrice: 9990,
  comparePrice: null,
  costPrice: null,
  isActive: true,
  isFeatured: false,
  isOnSale: false,
  tags: ['cabello', 'reparación'],
  weight: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const MOCK_CATEGORY = {
  id: 'cat-test-001', name: 'Cuidado Capilar', slug: 'cuidado-capilar', isActive: true,
};
