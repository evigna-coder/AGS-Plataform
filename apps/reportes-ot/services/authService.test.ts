import { describe, it, expect, vi } from 'vitest';
import { getAllowedDomain, getSupportUrl, isAllowedDomain } from './authService';

vi.mock('./firebaseService', () => ({ app: {} }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

describe('authService', () => {
  describe('getAllowedDomain', () => {
    it('returns agsanalitica.com', () => {
      expect(getAllowedDomain()).toBe('agsanalitica.com');
    });
  });

  describe('getSupportUrl', () => {
    it('returns URL containing agsanalitica', () => {
      expect(getSupportUrl()).toContain('agsanalitica');
    });
  });

  describe('isAllowedDomain', () => {
    it('returns false when user is null', () => {
      expect(isAllowedDomain(null)).toBe(false);
    });

    it('returns false when user has no email', () => {
      expect(isAllowedDomain({ email: null } as never)).toBe(false);
      expect(isAllowedDomain({ email: undefined } as never)).toBe(false);
    });

    it('returns true when email is @agsanalitica.com', () => {
      expect(isAllowedDomain({ email: 'user@agsanalitica.com' } as never)).toBe(true);
      expect(isAllowedDomain({ email: 'User@AGSANALITICA.COM' } as never)).toBe(true);
    });

    it('returns false when email is from another domain', () => {
      expect(isAllowedDomain({ email: 'user@gmail.com' } as never)).toBe(false);
      expect(isAllowedDomain({ email: 'user@other.com' } as never)).toBe(false);
    });
  });
});
