import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken } from '@/lib/auth';

describe('Authentication', () => {
  it('should sign and verify JWT tokens', async () => {
    const payload = { userId: 'test-user-id', email: 'test@test.com', role: 'CUSTOMER' };
    const token = await signAccessToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const verified = await verifyAccessToken(token);
    expect(verified).not.toBeNull();
    expect(verified!.userId).toBe(payload.userId);
    expect(verified!.email).toBe(payload.email);
  });

  it('should return null for invalid tokens', async () => {
    const result = await verifyAccessToken('invalid.token.here');
    expect(result).toBeNull();
  });

  it('should return null for empty token', async () => {
    const result = await verifyAccessToken('');
    expect(result).toBeNull();
  });
});
