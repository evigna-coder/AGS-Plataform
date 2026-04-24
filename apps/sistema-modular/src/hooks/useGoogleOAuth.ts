import { useState, useCallback, useRef } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/gmail.send';
const STORAGE_KEY = 'ags.googleOAuth.gmailSend';

interface TokenState {
  accessToken: string | null;
  expiresAt: number | null;
}

/** Lee token cacheado de sessionStorage (sobrevive remontes de componente + reloads
 *  de misma pestaña). Devuelve null si no hay o si expiró. */
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

/**
 * Hook for Google OAuth token acquisition using Google Identity Services.
 * Returns an access token with gmail.send scope for sending emails.
 *
 * Persistencia: el access token se cachea en sessionStorage — sobrevive
 * remontes de componente, navegación entre páginas, y reloads de la misma
 * pestaña. No sobrevive al cierre del navegador ni entre pestañas (intencional
 * por seguridad — GIS no provee refresh_token en browser flow).
 */
export function useGoogleOAuth() {
  const [token, setToken] = useState<TokenState>(() => loadCachedToken());
  const [loading, setLoading] = useState(false);
  const resolveRef = useRef<((token: string) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);

  const isValid = token.accessToken && token.expiresAt && Date.now() < token.expiresAt;

  const requestToken = useCallback((): Promise<string> => {
    // Return cached token if still valid (in-memory OR sessionStorage)
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

    return new Promise((resolve, reject) => {
      resolveRef.current = resolve;
      rejectRef.current = reject;
      setLoading(true);

      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        // prompt '' = Google decide: si ya hay sesión activa + consent previo,
        // reusa silenciosamente. Si no, muestra UI. Reduce el re-login constante.
        prompt: '',
        callback: (response: any) => {
          setLoading(false);
          if (response.error) {
            rejectRef.current?.(new Error(response.error_description || response.error));
            return;
          }
          const expiresAt = Date.now() + (response.expires_in * 1000) - 60000; // 1min buffer
          const newToken = { accessToken: response.access_token, expiresAt };
          setToken(newToken);
          saveCachedToken(newToken);
          resolveRef.current?.(response.access_token);
        },
        error_callback: (err: any) => {
          setLoading(false);
          rejectRef.current?.(new Error(err.message || 'Error de autorizacion Google'));
        },
      });

      client.requestAccessToken();
    });
  }, [token]);

  return { requestToken, loading, hasToken: !!isValid };
}
