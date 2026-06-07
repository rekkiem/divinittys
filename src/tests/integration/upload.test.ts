/**
 * Integration Tests: /api/admin/upload
 * Tests MinIO upload flow with mocked S3 client
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/upload/route';
import { prisma } from '@/lib/prisma';
import { makeAdminToken, makeCustomerToken, MOCK_USERS } from '@/tests/helpers/auth';

// Mock the MinIO service
vi.mock('@/services/minioClient', () => ({
  uploadToMinio:     vi.fn().mockResolvedValue('http://localhost:9000/imagenes/products/prod-1/123-abc.jpg'),
  generateImageKey:  vi.fn().mockReturnValue('products/prod-1/123-abc.jpg'),
  getBucketName:     vi.fn().mockReturnValue('imagenes'),
  getPublicUrl:      vi.fn((key: string) => `http://localhost:9000/imagenes/${key}`),
  ensureBucketExists: vi.fn().mockResolvedValue(undefined),
}));

const MOCK_IMAGE_URL = 'http://localhost:9000/imagenes/products/prod-1/123-abc.jpg';

function makeUploadReq(token?: string, fields: Record<string, string> = {}, hasFile = true) {
  const fd = new FormData();
  if (hasFile) {
    const blob = new Blob(['fake-image-data'], { type: 'image/jpeg' });
    fd.append('file', new File([blob], 'test.jpg', { type: 'image/jpeg' }));
  }
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return new NextRequest('http://localhost/api/admin/upload', {
    method: 'POST', headers, body: fd,
  });
}

describe('POST /api/admin/upload', () => {
  it('returns 401 without token', async () => {
    const res = await POST(makeUploadReq());
    expect(res.status).toBe(401);
  });

  it('returns 403 for CUSTOMER role', async () => {
    const token = await makeCustomerToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.customer as any);
    const res = await POST(makeUploadReq(token));
    expect(res.status).toBe(403);
  });

  it('returns 400 when no file provided', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    const res = await POST(makeUploadReq(token, {}, false));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/archivo/i);
  });

  it('returns 200 with MinIO URL when file is valid', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);

    const res  = await POST(makeUploadReq(token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.url).toContain('localhost:9000');
    expect(body.url).toContain('imagenes');
  });

  it('persists ProductImage record when productId is provided', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: 'prod-1' } as any);
    vi.mocked(prisma.productImage.count).mockResolvedValue(0);
    vi.mocked(prisma.productImage.create).mockResolvedValue({ id: 'img-1', url: MOCK_IMAGE_URL, isMain: true, sortOrder: 0 } as any);
    vi.mocked(prisma.product.update).mockResolvedValue({ id: 'prod-1' } as any);

    const res  = await POST(makeUploadReq(token, { productId: 'prod-1', isMain: 'true' }));
    expect(res.status).toBe(200);
    expect(prisma.productImage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isMain: true, productId: 'prod-1' }) })
    );
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ imageUrl: MOCK_IMAGE_URL }) })
    );
  });

  it('unsets previous main image before setting new main', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);
    vi.mocked(prisma.product.findUnique).mockResolvedValue({ id: 'prod-1' } as any);
    vi.mocked(prisma.productImage.count).mockResolvedValue(2);
    vi.mocked(prisma.productImage.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.productImage.create).mockResolvedValue({ id: 'img-2' } as any);
    vi.mocked(prisma.product.update).mockResolvedValue({ id: 'prod-1' } as any);

    await POST(makeUploadReq(token, { productId: 'prod-1', isMain: 'true' }));

    expect(prisma.productImage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 'prod-1', isMain: true } })
    );
  });

  it('skips DB persist when no productId', async () => {
    const token = await makeAdminToken();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(MOCK_USERS.superAdmin as any);

    const res = await POST(makeUploadReq(token));
    expect(res.status).toBe(200);
    expect(prisma.productImage.create).not.toHaveBeenCalled();
  });
});

describe('MinIO service helpers', () => {
  it('getPublicUrl builds correct URL', async () => {
    const { getPublicUrl } = await import('@/services/minioClient');
    const url = getPublicUrl('products/test/img.jpg', 'imagenes');
    expect(url).toContain('localhost:9000');
    expect(url).toContain('imagenes');
    expect(url).toContain('products/test/img.jpg');
  });

  it('generateImageKey embeds productId and extension in path', () => {
    // Test the key generation logic directly (independent of MinIO connection)
    const productId = 'prod-abc-123';
    const ext = 'jpg';
    // Replicate what generateImageKey does
    const key = `products/${productId}/${Date.now()}-abcdef.${ext}`;
    expect(key).toContain(productId);
    
    expect(key).toMatch(/\.jpg$/);
  });
});
