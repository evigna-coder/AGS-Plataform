# WebAuthn proxy con cuenta de servicio (cuando la org no permite allUsers)

Si al ejecutar `allow-webauthn-public-invoke.ps1` aparece:

```text
One or more users named in the policy do not belong to a permitted customer,
perhaps due to an organization policy.
```

la política de la organización de Google Cloud impide conceder acceso público (`allUsers`). En ese caso el proxy de Vercel debe autenticarse con una **cuenta de servicio** para invocar la Cloud Function.

## Flujo

1. El navegador envía a Vercel el **Firebase ID token** del usuario (header `Authorization` o `X-Firebase-ID-Token`).
2. El proxy de Vercel usa la **cuenta de servicio** (env `WEBAUTHN_PROXY_SA_KEY`) para obtener un **access token de Google**.
3. El proxy llama a la Cloud Function con:
   - `Authorization: Bearer <token_google>` → IAM permite la invocación.
   - `X-Firebase-ID-Token: <token_firebase_usuario>` → la función valida al usuario.
4. La Cloud Function ignora el Bearer para Firebase y valida el token en `X-Firebase-ID-Token`.

## Pasos

### 1. Crear la cuenta de servicio en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/) → proyecto **agssop-e7353**.
2. **IAM y administración** → **Cuentas de servicio** → **Crear cuenta de servicio**.
3. Nombre: p. ej. `webauthn-proxy`.
4. Crear y continuar (sin roles por ahora) → **Listo**.

### 2. Dar permiso de invocador a la función

Desde la raíz de `apps/reportes-ot`, reemplaza `WEBAUTHN_PROXY_SA@agssop-e7353.iam.gserviceaccount.com` por el email real de la cuenta de servicio:

```bash
gcloud functions add-invoker-policy-binding webauthn \
  --member="serviceAccount:WEBAUTHN_PROXY_SA@agssop-e7353.iam.gserviceaccount.com" \
  --region=us-central1 \
  --project=agssop-e7353
```

O en la consola: **Cloud Functions** → función **webauthn** → **Permisos** → **Agregar principal** → principal = email de la cuenta de servicio, rol = **Cloud Functions Invoker**.

### 3. Crear y descargar la clave JSON

1. En **Cuentas de servicio**, abre la cuenta que creaste.
2. Pestaña **Claves** → **Agregar clave** → **Crear clave nueva** → **JSON** → **Crear**.
3. Se descarga un JSON. **No lo subas al repo.** Lo usarás solo en Vercel.

### 4. Configurar Vercel

1. **Vercel** → tu proyecto → **Settings** → **Environment Variables**.
2. Añade una variable:
   - **Name:** `WEBAUTHN_PROXY_SA_KEY`
   - **Value:** el contenido completo del JSON de la clave (minificado en una línea), o el mismo JSON en Base64.
   - **Environment:** Production (y Preview si quieres probar en preview).
3. Guarda y **redeploy** el proyecto (o despliega de nuevo desde Git).

### 5. Desplegar la Cloud Function (middleware actualizado)

La función debe aceptar el token en `X-Firebase-ID-Token`. Si ya aplicaste el cambio en el middleware, despliega de nuevo:

```bash
cd apps/reportes-ot
firebase deploy --only functions
```

## Comprobación

- En los logs de la función en Vercel deberías ver algo como: `webauthn proxy register-options useSA: true hasAuth: true`.
- En el móvil, al registrar el dispositivo, no debería aparecer el 401 HTML de IAM; si el token de usuario es válido, el flujo completará.
