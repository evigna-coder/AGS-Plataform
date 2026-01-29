# Implementación MFA - Plan de PRs

## Resumen

MFA (Multi-Factor Authentication) con:
- **Factor primario**: Google Workspace (Google Sign-In) vía Firebase Authentication.
- **Segundo factor**: Autenticadores de plataforma (biometría facial, huella, patrón) con WebAuthn (FIDO2).

No se implementan SMS, TOTP ni otros factores.

---

## Entregables por PR

### PR1 (pequeño) — Backend ✅
- Cloud Functions: endpoints WebAuthn registration (attestation) y authentication (assertion).
- Almacenamiento seguro de credenciales públicas por usuario en Firestore.
- Colección de audit logs.
- RBAC mínimo (custom claim `admin` para revocar dispositivos).
- Tests unitarios para generación de challenge y verificación (mocks).

**Implementado**: `apps/reportes-ot/functions/` — ver `functions/README.md` para endpoints y esquema Firestore.

### PR2 (mediano) — Frontend login y WebAuthn ✅
- Integrar Google Sign-In (Firebase Auth) como único método de login.
- Tras login, forzar paso WebAuthn si el usuario tiene factor registrado.
- Flujo de enrolamiento WebAuthn (registro de dispositivo).
- Modal/UI mínima fuera del flujo de reportes OT.

**Implementado**: AuthGate en `index.tsx`; `LoginScreen`, `WebAuthnModal`, `DomainErrorScreen`, `MfaEnrollModal`; `authService`, `webauthnClient`. Variable de entorno `VITE_WEBAUTHN_URL` (URL base de la Cloud Function).

**Configuración necesaria**:
- Firebase Console: habilitar proveedor "Google" en Authentication.
- En `.env.local`: añadir `VITE_WEBAUTHN_URL=https://us-central1-<PROJECT_ID>.cloudfunctions.net/webauthn` (tras desplegar las Functions).

### PR3 (pequeño) — Frontend gestión de dispositivos
- UI para administrar dispositivos de plataforma: listar, renombrar, revocar.
- Mensajes de UX para desbloqueo facial/patrón.

### PR4 (pequeño) — Tests y documentación ✅
- Tests unitarios (Functions: config, webauthn, middleware; Frontend: authService, webauthnClient, LoginScreen).
- Documentación E2E y limitaciones: `docs/E2E_MFA.md`.
- Actualización de SECURITY.md (política MFA, enrolamiento, runbook).
- Runbook pérdida/robo: `docs/RUNBOOK_MFA.md`.

---

## Especificaciones técnicas

### A) Google Workspace Sign-In
- Firebase Authentication, proveedor "Google".
- Botón "Ingresar con Google".
- **Dominio corporativo**: solo se permite acceso con cuentas **@agsanalitica.com**. El backend (Cloud Functions) rechaza con `403 domain_not_allowed` y `supportUrl` si el email no pertenece al dominio. Configurable con `ALLOWED_EMAIL_DOMAIN` (vacío = no validar, útil en desarrollo).

### B) WebAuthn (plataforma)
- **Backend**: Cloud Functions (Node.js/TypeScript).
  - `POST /webauthn/register-options` — challenge + options para `navigator.credentials.create()`.
  - `POST /webauthn/register-result` — verificar attestation, guardar en `mfa/webauthn/{uid}/devices`.
  - `POST /webauthn/auth-options` — challenge/options para `navigator.credentials.get()`.
  - `POST /webauthn/auth-result` — verificar assertion, continuar sesión, log en `mfa/audit`.
- **Frontend**: @simplewebauthn/browser para `create()` y `get()`.
- Solo autenticadores de plataforma (`authenticatorAttachment: 'platform'`).

### C) Seguridad y almacenamiento
- Firestore: `mfa/webauthn/{uid}/devices` (credentialID, publicKey, deviceName, createdAt, lastUsedAt).
- Firestore: `mfa/audit` (uid, ip, userAgent, action, result, timestamp).
- Validar Firebase ID token en todos los endpoints.
- Rate limiting por uid e IP.
- Admin: custom claim `role === 'admin'` para revocar dispositivos.

### D) UX
- No modificar UI de reportes ni layout del PDF.
- WebAuthn en modal/panel mínimo, solo tras Google Sign-In.
- Mensaje claro: "Necesario desbloqueo con dispositivo (Face/Patrón) para continuar".
- Si WebAuthn no soportado: indicar uso de dispositivo compatible, sin bypass.

---

## Orden de implementación

1. **PR1** — Backend (Functions + Firestore schema + tests). ✅
2. **PR2** — Frontend Google Sign-In + flujo WebAuthn (auth-options/auth-result) + enrolamiento. ✅
3. **PR3** — UI gestión de dispositivos (listar, renombrar, revocar).
4. **PR4** — Tests e2e, SECURITY.md, runbook. ✅

Cada PR incluye: cambios en README, actualizaciones en SECURITY.md (o doc de MFA), tests y notas de migración.

---

## Notas de migración (PR1)

- **Firestore**: Se añadieron reglas para `mfa/{document=**}` (deny client). Las colecciones MFA solo son accesibles desde Cloud Functions (Admin SDK).
- **Despliegue**: Desde `apps/reportes-ot` ejecutar `firebase deploy --only functions`. La función exportada es `webauthn`; URL base: `https://us-central1-<PROJECT_ID>.cloudfunctions.net/webauthn`.
- **Custom claims**: Para usar el endpoint `/revoke` (admin), asignar `role: 'admin'` al usuario en Firebase Auth (p. ej. desde Admin SDK o Firebase Console).
