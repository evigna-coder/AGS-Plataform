import { useState, useCallback, useRef } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/gmail.send';

interface TokenState {
  accessToken: string | null;
  expiresAt: number | null;
}

/**
 * Hook for Google OAuth token acquisition using Google Identity Services.
 * Returns an access token with gmail.send scope for sending emails.
 */
export function useGoogleOAuth() {
  const [token, setToken] = useState<TokenState>({ accessToken: null, expiresAt: null });
  const [loading, setLoading] = useState(false);
  const resolveRef = useRef<((token: string) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);

  const isValid = token.accessToken && token.expiresAt && Date.now() < token.expiresAt;

  const requestToken = useCallback((): Promise<string> => {
    // Return cached token if still valid
    if (isValid && token.accessToken) return Promise.resolve(token.accessToken);

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
        callback: (response: any) => {
          setLoading(false);
          if (response.error) {
            rejectRef.current?.(new Error(response.error_description || response.error));
            return;
          }
          const expiresAt = Date.now() + (response.expires_in * 1000) - 60000; // 1min buffer
          setToken({ accessToken: response.access_token, expiresAt });
          resolveRef.current?.(response.access_token);
        },
        error_callback: (err: any) => {
          setLoading(false);
          rejectRef.current?.(new Error(err.message || 'Error de autorizacion Google'));
        },
      });

      client.requestAccessToken();
    });
  }, [isValid, token.accessToken]);

  return { requestToken, loading, hasToken: !!isValid };
}
