import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authService from './authService';
import { getAuthOptions, getRegisterOptions } from './webauthnClient';

vi.mock('./authService', () => ({
  getIdToken: vi.fn(() => Promise.resolve('mock-token')),
}));

describe('webauthnClient', () => {
  beforeEach(() => {
    vi.mocked(authService.getIdToken).mockResolvedValue('mock-token');
    vi.clearAllMocks();
  });

  describe('getAuthOptions', () => {
    it('returns error when backend returns 403', async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'domain_not_allowed' }),
        } as Response)
      ) as never;
      const result = await getAuthOptions();
      expect(result).toMatchObject({ options: null, error: expect.any(String) });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth-options'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
        })
      );
    });

    it('returns no_registered_devices when backend returns 200 with that error', async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ error: 'no_registered_devices' }),
        } as Response)
      ) as never;
      const result = await getAuthOptions();
      expect(result).toMatchObject({ options: null, error: 'no_registered_devices' });
    });

    it('returns options when backend returns 200 with options', async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              options: {
                challenge: 'Y2hhbGxlbmdl',
                rpId: 'localhost',
                allowCredentials: [],
                userVerification: 'preferred',
              },
            }),
        } as Response)
      ) as never;
      const result = await getAuthOptions();
      expect(result.options).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe('getRegisterOptions', () => {
    it('returns error when backend returns 401', async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Invalid token' }),
        } as Response)
      ) as never;
      const result = await getRegisterOptions();
      expect(result).toMatchObject({ options: null, error: expect.any(String) });
    });

    it('calls register-options endpoint with Bearer token', async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              options: {
                challenge: 'Y2hhbGxlbmdl',
                rp: { name: 'Test', id: 'localhost' },
                user: { id: 'dXNlcklk', name: 'user@test.com', displayName: 'User' },
                pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
              },
            }),
        } as Response)
      ) as never;
      await getRegisterOptions();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/register-options'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
        })
      );
    });
  });
});
