/**
 * Proxy de Vercel para la Cloud Function WebAuthn.
 * Cuando la org de Google Cloud no permite allUsers, el proxy se autentica con una
 * cuenta de servicio (WEBAUTHN_PROXY_SA_KEY) y envía el token del usuario en X-Firebase-ID-Token.
 */
const CLOUD_FUNCTION_BASE = 'https://us-central1-agssop-e7353.cloudfunctions.net/webauthn';

function getHeader(req, name) {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (k.toLowerCase() === lower && v) return typeof v === 'string' ? v : v[0];
  }
  return undefined;
}

/** Token Firebase del usuario (raw, sin "Bearer "). */
function getUserFirebaseToken(req) {
  const fromAuth = getHeader(req, 'authorization');
  if (typeof fromAuth === 'string' && fromAuth.startsWith('Bearer ')) return fromAuth.slice(7);
  const fromHeader = getHeader(req, 'x-firebase-id-token');
  if (typeof fromHeader === 'string') return fromHeader.startsWith('Bearer ') ? fromHeader.slice(7) : fromHeader;
  return null;
}

/** Obtiene un access token de Google para invocar la Cloud Function (cuenta de servicio). */
async function getGoogleAccessToken() {
  const raw = process.env.WEBAUTHN_PROXY_SA_KEY;
  if (!raw || typeof raw !== 'string') return null;
  let keyJson;
  try {
    keyJson = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch (e) {
    console.error('webauthn proxy: invalid WEBAUTHN_PROXY_SA_KEY', e?.message);
    return null;
  }
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({ credentials: keyJson });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token ?? null;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-WebAuthn-Origin, X-Firebase-ID-Token');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  const pathSegments = req.query.path || [];
  const path = pathSegments.length ? pathSegments.join('/') : '';
  const targetUrl = path ? `${CLOUD_FUNCTION_BASE}/${path}` : CLOUD_FUNCTION_BASE;

  const userToken = getUserFirebaseToken(req);
  const originHeader = getHeader(req, 'x-webauthn-origin');

  let authHeader = null;
  let xFirebaseIdToken = null;
  const useServiceAccount = !!process.env.WEBAUTHN_PROXY_SA_KEY;
  if (useServiceAccount && userToken) {
    const googleToken = await getGoogleAccessToken();
    if (googleToken) {
      authHeader = `Bearer ${googleToken}`;
      xFirebaseIdToken = userToken;
    }
  }
  if (!authHeader && userToken) {
    authHeader = userToken.startsWith('Bearer ') ? userToken : `Bearer ${userToken}`;
  }

  console.log('webauthn proxy', path || '(root)', 'useSA:', useServiceAccount, 'hasAuth:', !!authHeader, 'hasOrigin:', !!originHeader);

  const headers = {
    'Content-Type': 'application/json',
    ...(authHeader && { Authorization: authHeader }),
    ...(xFirebaseIdToken && { 'X-Firebase-ID-Token': xFirebaseIdToken }),
    ...(originHeader && { 'X-WebAuthn-Origin': originHeader }),
  };

  let body;
  if (req.method !== 'GET' && req.body != null) {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (response.status === 401) {
        console.log('webauthn proxy upstream 401:', data.error || data.message || JSON.stringify(data));
      }
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      if (response.status === 401) console.log('webauthn proxy upstream 401 (non-json):', text);
      res.status(response.status).setHeader('Content-Type', contentType || 'text/plain').send(text);
    }
  } catch (err) {
    console.error('webauthn proxy error:', err);
    res.status(502).json({ error: 'Error de proxy', message: err.message });
  }
}
