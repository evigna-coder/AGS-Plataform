import { rpName, rpID, origin, RATE_LIMIT, CHALLENGE_TTL_SEC, ALLOWED_EMAIL_DOMAIN, SUPPORT_URL } from './config.js';

describe('config', () => {
  it('exports rpName', () => {
    expect(rpName).toBe('Reportes OT - AGS');
  });

  it('exports rpID from env or localhost', () => {
    expect(typeof rpID).toBe('string');
    expect(rpID.length).toBeGreaterThan(0);
  });

  it('exports origin', () => {
    expect(typeof origin).toBe('string');
    expect(origin).toContain(rpID);
  });

  it('exports ALLOWED_EMAIL_DOMAIN (default agsanalitica.com)', () => {
    expect(ALLOWED_EMAIL_DOMAIN).toBe('agsanalitica.com');
  });

  it('exports SUPPORT_URL', () => {
    expect(typeof SUPPORT_URL).toBe('string');
    expect(SUPPORT_URL).toContain('agsanalitica');
  });

  it('exports RATE_LIMIT with expected keys', () => {
    expect(RATE_LIMIT.registerOptionsPerMinute).toBe(5);
    expect(RATE_LIMIT.registerResultPerMinute).toBe(5);
    expect(RATE_LIMIT.authOptionsPerMinute).toBe(10);
    expect(RATE_LIMIT.authResultPerMinute).toBe(10);
    expect(RATE_LIMIT.revokePerMinute).toBe(5);
  });

  it('exports CHALLENGE_TTL_SEC', () => {
    expect(CHALLENGE_TTL_SEC).toBe(300);
  });
});
