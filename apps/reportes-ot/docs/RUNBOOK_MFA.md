# Runbook MFA — Pérdida o robo de dispositivo

Cuando un usuario pierde el dispositivo con el que completaba el segundo factor (Face/patrón/huella), o sospecha que fue robado, un administrador debe **revocar las credenciales WebAuthn** de ese usuario y **cerrar sesiones** para que no se pueda seguir usando ese dispositivo para acceder.

---

## Pasos para el administrador

### 1. Revocar dispositivo(s) del usuario

El administrador debe llamar al endpoint de revocación con su **Firebase ID token** (cuenta con custom claim `role: 'admin'`) y el **uid** del usuario afectado.

**Opción A — Revocar un dispositivo concreto (si se conoce el credentialId)**

```http
POST https://us-central1-<PROJECT_ID>.cloudfunctions.net/webauthn/revoke
Authorization: Bearer <ID_TOKEN_ADMIN>
Content-Type: application/json

{
  "targetUid": "<UID_DEL_USUARIO>",
  "credentialId": "<CREDENTIAL_ID_DEL_DISPOSITIVO>"
}
```

**Opción B — Revocar todos los dispositivos del usuario (recomendado en pérdida/robo)**

```http
POST https://us-central1-<PROJECT_ID>.cloudfunctions.net/webauthn/revoke
Authorization: Bearer <ID_TOKEN_ADMIN>
Content-Type: application/json

{
  "targetUid": "<UID_DEL_USUARIO>"
}
```

- El backend borra los documentos en `mfa/webauthn/users/<uid>/devices`.
- Llama a **Firebase Auth** `revokeRefreshTokens(uid)` para cerrar todas las sesiones del usuario (todos los dispositivos donde tenía la app abierta quedarán deslogueados).

### 2. Comunicar al usuario

- Indicar que se revocaron sus dispositivos MFA y sus sesiones.
- Pedir que **vuelva a iniciar sesión** con Google (en un dispositivo de confianza).
- Si quiere seguir usando segundo factor, debe **registrar de nuevo** un dispositivo desde la app: **Seguridad → Activar desbloqueo con dispositivo** (enrolamiento).

### 3. Verificación de identidad (recomendado)

Antes de revocar, el responsable de seguridad o administrador puede:

- Confirmar la identidad del usuario por canal seguro (por ejemplo, videollamada o presencial).
- Verificar que la solicitud de revocación es legítima (usuario que perdió el dispositivo o detectó uso no autorizado).

No hay flujo automático de “recuperación” sin segundo factor: el usuario siempre debe poder entrar con **Google Sign-In**; el segundo factor solo se exige si tiene dispositivos registrados. Tras revocar todos los dispositivos, el usuario entra solo con Google y puede volver a enrolar un dispositivo cuando quiera.

---

## Cómo obtener el UID del usuario

- **Firebase Console** → Authentication → Users → buscar por email → copiar **User UID**.
- O desde Admin SDK (Cloud Function o script): `getUserByEmail(email)` y usar `user.uid`.

---

## Cómo asignar rol admin

Para que una cuenta pueda llamar a `/webauthn/revoke`:

1. **Firebase Console** → Authentication → Users → seleccionar usuario (o crear uno de administración).
2. Asignar custom claim `role: 'admin'` mediante **Admin SDK** (Firebase no permite custom claims desde la consola):

```javascript
const admin = require('firebase-admin');
admin.auth().setCustomUserClaims('<UID_ADMIN>', { role: 'admin' });
```

Tras esto, los tokens emitidos para ese UID incluirán `role: 'admin'` y el backend aceptará las peticiones a `/revoke`.

---

## Auditoría

Cada llamada a `/revoke` (éxito o fallo) se registra en la colección **mfa/audit/logs** con:

- `uid` (quién ejecutó la acción, el admin)
- `action: 'revoke'`
- `result: 'success' | 'failure'`
- `timestamp`
- `details` (por ejemplo, targetUid)

Revisar periódicamente esta colección para detectar abusos o errores.

---

## Resumen rápido

| Acción                         | Comando / Ubicación                                                                 |
|--------------------------------|--------------------------------------------------------------------------------------|
| Revocar todos los dispositivos | `POST .../webauthn/revoke` con `{ "targetUid": "<uid>" }` + Bearer token de admin    |
| Revocar un dispositivo         | `POST .../webauthn/revoke` con `{ "targetUid": "<uid>", "credentialId": "<id>" }`   |
| Cerrar sesiones del usuario    | Se hace automáticamente con `revokeRefreshTokens(uid)` al revocar                   |
| Ver logs                       | Firestore → colección `mfa/audit/logs`                                              |
| Asignar admin                  | `admin.auth().setCustomUserClaims(uid, { role: 'admin' })`                          |
