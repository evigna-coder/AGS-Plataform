import { useState, useCallback, useRef } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/gmail.send';
const STORAGE_KEY = 'ags.googleOAuth.gmailSend';
const CONSENT_FLAG_KEY = 'ags.googleOAuth.consentedOnce';

interface TokenState {
  accessToken: string | null;
  expiresAt: number | null;
}

/** Lee token cacheado de sessionStorage (sobrevive remontes + reloads misma
 *  pestaña). Devuelve null si no hay o si expiró. */
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
    // sessionStorage puede fallar en modo incógnito con quota — no bloquea.
  }
}

/** Una vez que el user consintió alguna vez en este navegador, guardamos flag
 *  en localStorage para poder intentar silent refresh (prompt=none) en sesiones
 *  futuras sin mostrar la UI de consent de nuevo. */
function hasConsentedBefore(): boolean {
  try { return localStorage.getItem(CONSENT_FLAG_KEY) === '1'; } catch { return false; }
}

function markConsented() {
  try { localStorage.setItem(CONSENT_FLAG_KEY, '1'); } catch { /* quota */ }
}

/**
 * Hook for Google OAuth token acquisition using Google Identity Services.
 * Returns an access token with gmail.send scope for sending emails.
 *
 * Strategy (para minimizar prompts al user):
 * 1. Token cacheado en sessionStorage — cubre la vida útil del access token (~1h).
 * 2. Cuando el token expira: primero se intenta SILENT refresh con `prompt: 'none'`.
 *    Si Google tiene sesión activa + consent previo → emite nuevo token sin UI.
 *    Esto cubre 10+ horas del usuario de corrido sin ver el popup.
 * 3. Si el silent refresh falla (sesión Google caducó, consent revocado, primera
 *    vez en este navegador), hace fallback a `prompt: ''` (interactivo) — el
 *    único caso donde el user ve la UI.
 *
 * Nota: GIS no emite refresh_tokens en browser flow (serían inseguros en frontend).
 * El silent refresh depende de la cookie de sesión de Google en el navegador —
 * mientras el user esté logueado en Google, Google reusa esa sesión.
 */
export function useGoogleOAuth() {
  const [token, setToken] = useState<TokenState>(() => loadCachedToken());
  const [loading, setLoading] = useState(false);
  const resolveRef = useRef<((token: string) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);

  const isValid = token.accessToken && token.expiresAt && Date.now() < token.expiresAt;

  const requestToken = useCallback((): Promise<string> => {
    // 1. Return cached token if still valid (in-memory OR sessionStorage)
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

    // Helper: ejecuta un flow completo con un `prompt` específico y resuelve/rechaza.
    const runFlow = (promptMode: '' | 'none'): Promise<string> => new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        prompt: promptMode,
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          const expiresAt = Date.now() + (response.expires_in * 1000) - 60000; // 1min buffer
          const newToken = { accessToken: response.access_token, expiresAt };
          setToken(newToken);
          saveCachedToken(newToken);
          markConsented(); // éxito → user ya consintió, ok para silent refresh futuro
          resolve(response.access_token);
        },
        error_callback: (err: any) => {
          // GIS dispara error_callback con `type`: 'popup_closed', 'unknown', 'immediate_failed', etc.
          // En silent refresh, immediate_failed / user_logged_out son los típicos.
          reject(new Error(err?.message || err?.type || 'Error de autorizacion Google'));
        },
      });
      client.requestAccessToken();
    });

    // 2. Si el user ya consintió antes en este navegador, intentar SILENT primero.
    // Si falla, caer al interactivo como fallback.
    // 3. Si es primera vez (no hay flag), ir directo al interactivo.
    const executeFlow = async (): Promise<string> => {
      setLoading(true);
      try {
        if (hasConsentedBefore()) {
          try {
            const silentToken = await runFlow('none');
            return silentToken;
          } catch (silentErr) {
            // Fallback a interactivo — sesión Google caducó o consent revocado.
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
