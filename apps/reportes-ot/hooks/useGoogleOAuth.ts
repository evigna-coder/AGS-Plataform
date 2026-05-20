import { useState, useCallback, useRef } from 'react';
import { auth } from '../services/authService';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/gmail.send';
const STORAGE_KEY = 'ags.reportesOt.googleOAuth.gmailSend';
const CONSENT_FLAG_KEY = 'ags.reportesOt.googleOAuth.consentedOnce';

interface TokenState {
  accessToken: string | null;
  expiresAt: number | null;
}

function loadCachedToken(): TokenState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { accessToken: null, expiresAt: null };
    const parsed = JSON.parse(raw) as TokenState;
    if (!parsed.accessToken || !parsed.expiresAt) return { accessToken: null, expiresAt: null };
    if (Date.now() >= parsed.expiresAt) return { accessToken: null, expiresAt: null };
    return parsed;
  } catch {
    return { accessToken: null, expiresAt: null };
  }
}

function saveCachedToken(token: TokenState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(token));
  } catch {
    // sessionStorage falla en incognito con quota — no bloquea.
  }
}

function hasConsentedBefore(): boolean {
  try { return localStorage.getItem(CONSENT_FLAG_KEY) === '1'; } catch { return false; }
}

function markConsented() {
  try { localStorage.setItem(CONSENT_FLAG_KEY, '1'); } catch { /* quota */ }
}

/**
 * Hook para obtener un access token con scope gmail.send via Google Identity
 * Services. Ported from sistema-modular — same silent-refresh strategy.
 */
export function useGoogleOAuth() {
  const [token, setToken] = useState<TokenState>(() => loadCachedToken());
  const [loading, setLoading] = useState(false);
  const resolveRef = useRef<((token: string) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);

  const isValid = token.accessToken && token.expiresAt && Date.now() < token.expiresAt;

  const requestToken = useCallback((): Promise<string> => {
    const cached = token.accessToken && token.expiresAt && Date.now() < token.expiresAt
      ? token
      : loadCachedToken();
    if (cached.accessToken && cached.expiresAt && Date.now() < cached.expiresAt) {
      if (cached !== token) setToken(cached);
      return Promise.resolve(cached.accessToken);
    }

    if (!CLIENT_ID) return Promise.reject(new Error('VITE_GOOGLE_OAUTH_CLIENT_ID no configurado'));

    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      return Promise.reject(new Error('Google Identity Services no cargado. Recargá la página.'));
    }

    // Email del usuario ya logueado en Firebase — lo pasamos como hint a Google
    // para que use directamente esa cuenta y no muestre el selector si hay
    // múltiples sesiones de Google abiertas en el browser.
    const hintEmail = auth.currentUser?.email ?? undefined;

    const runFlow = (promptMode: '' | 'none'): Promise<string> => new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        prompt: promptMode,
        hint: hintEmail,
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          const expiresAt = Date.now() + (response.expires_in * 1000) - 60000;
          const newToken = { accessToken: response.access_token, expiresAt };
          setToken(newToken);
          saveCachedToken(newToken);
          markConsented();
          resolve(response.access_token);
        },
        error_callback: (err: any) => {
          reject(new Error(err?.message || err?.type || 'Error de autorizacion Google'));
        },
      });
      client.requestAccessToken();
    });

    const executeFlow = async (): Promise<string> => {
      setLoading(true);
      try {
        if (hasConsentedBefore()) {
          try {
            const silentToken = await runFlow('none');
            return silentToken;
          } catch (silentErr) {
            console.info('[useGoogleOAuth] silent refresh failed, falling back to interactive:',
              silentErr instanceof Error ? silentErr.message : silentErr);
          }
        }
        const interactiveToken = await runFlow('');
        return interactiveToken;
      } finally {
        setLoading(false);
      }
    };

    return executeFlow()
      .then(tkn => { resolveRef.current?.(tkn); return tkn; })
      .catch(err => { rejectRef.current?.(err); throw err; });
  }, [token]);

  return { requestToken, loading, hasToken: !!isValid };
}
