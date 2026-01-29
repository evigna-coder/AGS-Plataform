import { requireAllowedDomain, requireAdmin, type AuthContext } from './middleware.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this._jsonBody = body;
      return this;
    },
    _jsonBody: undefined as unknown,
  };
  return res as ReturnType<typeof createMockRes> & { status: (code: number) => typeof res; json: (body: unknown) => typeof res };
}

describe('requireAllowedDomain', () => {
  it('returns true when ALLOWED_EMAIL_DOMAIN is agsanalitica.com and email is @agsanalitica.com', () => {
    const res = createMockRes();
    const ctx: AuthContext = { uid: 'u1', email: 'user@agsanalitica.com' };
    expect(requireAllowedDomain(ctx, res as never)).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('returns true for email with different case', () => {
    const res = createMockRes();
    const ctx: AuthContext = { uid: 'u1', email: 'User@AGSANALITICA.COM' };
    expect(requireAllowedDomain(ctx, res as never)).toBe(true);
  });

  it('returns false and sends 403 when email domain does not match', () => {
    const res = createMockRes();
    const ctx: AuthContext = { uid: 'u1', email: 'user@gmail.com' };
    expect(requireAllowedDomain(ctx, res as never)).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res._jsonBody).toMatchObject({
      error: 'domain_not_allowed',
      message: expect.stringContaining('@agsanalitica.com'),
      supportUrl: expect.any(String),
    });
  });

  it('returns false and sends 403 when email is missing', () => {
    const res = createMockRes();
    const ctx: AuthContext = { uid: 'u1' };
    expect(requireAllowedDomain(ctx, res as never)).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res._jsonBody).toMatchObject({ error: 'domain_not_allowed' });
  });
});

describe('requireAdmin', () => {
  it('returns true when role is admin', () => {
    const res = createMockRes();
    const ctx: AuthContext = { uid: 'u1', role: 'admin' };
    expect(requireAdmin(ctx, res as never)).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('returns false and sends 403 when role is not admin', () => {
    const res = createMockRes();
    const ctx: AuthContext = { uid: 'u1', role: 'user' };
    expect(requireAdmin(ctx, res as never)).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res._jsonBody).toMatchObject({ error: 'Admin role required' });
  });

  it('returns false when role is undefined', () => {
    const res = createMockRes();
    const ctx: AuthContext = { uid: 'u1' };
    expect(requireAdmin(ctx, res as never)).toBe(false);
    expect(res.statusCode).toBe(403);
  });
});
