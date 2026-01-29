/**
 * Tests unitarios para generación de options WebAuthn.
 * Usa @simplewebauthn/server directamente (sin mock) para verificar challenge y parámetros.
 */
import { generateRegistrationOptions, generateAuthenticationOptions } from '@simplewebauthn/server';
import { rpName, rpID } from './config.js';

describe('WebAuthn challenge generation', () => {
  const userId = 'test-uid-123';
  const userEmail = 'test@example.com';

  it('generateRegistrationOptions returns options with challenge', async () => {
    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpID === 'localhost' ? 'localhost' : rpID,
      userName: userEmail,
      userID: new Uint8Array(Buffer.from(userId, 'utf8')),
      userDisplayName: userEmail,
      attestationType: 'none',
      excludeCredentials: [],
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    expect(options).toBeDefined();
    expect(options.challenge).toBeDefined();
    expect(typeof options.challenge).toBe('string');
    expect(options.challenge.length).toBeGreaterThan(0);
    expect(options.rp).toBeDefined();
    expect(options.rp.name).toBe(rpName);
    expect(options.rp.id).toBe(rpID === 'localhost' ? 'localhost' : rpID);
    expect(options.user).toBeDefined();
    expect(options.user.name).toBe(userEmail);
    expect(options.authenticatorSelection?.authenticatorAttachment).toBe('platform');
  });

  it('generateAuthenticationOptions returns options with challenge', async () => {
    const options = await generateAuthenticationOptions({
      rpID: rpID === 'localhost' ? 'localhost' : rpID,
      allowCredentials: [],
      userVerification: 'preferred',
    });

    expect(options).toBeDefined();
    expect(options.challenge).toBeDefined();
    expect(typeof options.challenge).toBe('string');
    expect(options.challenge.length).toBeGreaterThan(0);
    expect(options.rpId).toBe(rpID === 'localhost' ? 'localhost' : rpID);
  });

  it('generateAuthenticationOptions with allowCredentials includes credential ids', async () => {
    const credIds = ['cred-id-1', 'cred-id-2'];
    const options = await generateAuthenticationOptions({
      rpID: rpID === 'localhost' ? 'localhost' : rpID,
      allowCredentials: credIds.map((id) => ({ id })),
      userVerification: 'preferred',
    });

    expect(options.allowCredentials).toBeDefined();
    expect(options.allowCredentials).toHaveLength(2);
    expect(options.allowCredentials?.map((c) => c.id)).toEqual(credIds);
  });
});
