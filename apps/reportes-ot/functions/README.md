# Cloud Functions - MFA WebAuthn (reportes-OT)

Backend para segundo factor MFA con WebAuthn (autenticadores de plataforma: Face ID, huella, patrón).

## Requisitos

- Node.js >= 20
- Firebase CLI (`firebase-tools`)
- Proyecto Firebase con Authentication (Google) y Firestore

## Instalación

```bash
cd functions
npm install
```

## Build

```bash
npm run build
```

## Tests

```bash
npm test
```

Tests unitarios cubren:
- Configuración (rpName, rpID, rate limits)
- Generación de options de registro (challenge, rp, authenticatorSelection)
- Generación de options de autenticación (challenge, allowCredentials)

## Despliegue

Desde la raíz de `apps/reportes-ot`:

```bash
firebase deploy --only functions
```

La función exportada es `webauthn`. URL base:

`https://us-central1-<PROJECT_ID>.cloudfunctions.net/webauthn`

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/register-options` | Bearer (Firebase ID token) | Devuelve options para `navigator.credentials.create()` |
| POST | `/register-result` | Bearer | Verifica attestation y guarda credencial |
| POST | `/auth-options` | Bearer | Devuelve options para `navigator.credentials.get()` |
| POST | `/auth-result` | Bearer | Verifica assertion y completa segundo factor |
| POST | `/revoke` | Bearer (admin) | Revoca dispositivo(s) de un usuario y refresh tokens |

## Esquema Firestore

- **mfa/webauthn/users/{uid}/devices/{credentialId}**: credenciales WebAuthn por usuario.
  - `credentialID`, `publicKeyBase64`, `deviceName`, `rpId`, `counter`, `createdAt`, `lastUsedAt`
- **mfa/challenges/{uid}/current**: challenge temporal (TTL 5 min) para registro/autenticación.
- **mfa/audit/logs**: auditoría (uid, ip, userAgent, action, result, timestamp).
- **mfa/ratelimit/counters/{key}**: contadores para rate limiting.

Las colecciones bajo `mfa/*` están protegidas por reglas (deny client); solo el Admin SDK en Functions escribe/lee.

## Restricción de dominio

Solo pueden acceder usuarios cuyo email pertenezca al dominio **@agsanalitica.com**. Cualquier otro correo recibe `403` con `error: "domain_not_allowed"` y un enlace de soporte.

Para desactivar la validación en desarrollo, define `ALLOWED_EMAIL_DOMAIN` vacío al desplegar (ej. en Firebase: Config → Functions → environment variables).

## Variables de entorno (opcional)

- `ALLOWED_EMAIL_DOMAIN`: dominio de correo permitido (ej. `agsanalitica.com`). Por defecto `agsanalitica.com`. Vacío = no se valida dominio.
- `SUPPORT_URL`: URL mostrada cuando el usuario no pertenece al dominio (por defecto `https://agsanalitica.com/contacto`).
- `RP_ID`: dominio Relying Party (ej. `tuapp.com`). Por defecto `localhost` en desarrollo.
- `ORIGIN`: origen permitido para WebAuthn (ej. `https://tuapp.com`).

## PR1 - Alcance

- Endpoints WebAuthn (register-options, register-result, auth-options, auth-result)
- Endpoint admin revoke
- Firestore schema y reglas
- Middleware: verificación Firebase ID token, rate limiting, RBAC (admin)
- Tests unitarios para generación de challenge/options
