# Solicitud a administradores: permitir WebAuthn en producción

La app de reportes OT usa **segundo factor (MFA) con WebAuthn** (Face ID / huella / patrón) en dispositivos móviles. El backend es una **Cloud Function** (`webauthn`) en el proyecto **agssop-e7353** que:

- Recibe peticiones HTTP desde el frontend desplegado en **Vercel**.
- **Valida siempre** el token de Firebase (ID token) en cada petición; sin token válido responde 401.

Para que esas peticiones lleguen a la función, hace falta que **Google Cloud IAM** permita la invocación. Hoy la organización bloquea:

1. Conceder **invocador público** (`allUsers`) a la función.
2. Crear **claves JSON** para cuentas de servicio.

Sin una de estas dos cosas, la función no puede ser invocada desde Vercel y el MFA en móvil no funciona en producción.

---

## Opción recomendada: permitir invocador público solo para esta función

**Qué se pide:** Conceder el rol **Cloud Functions Invoker** al principal **allUsers** únicamente para la función **webauthn** (región `us-central1`, proyecto `agssop-e7353`).

**Por qué es seguro:**

- No se expone ningún dato ni API sin control: la función **no hace nada** hasta validar el token de Firebase.
- Quien llama sin token o con token inválido/caducado recibe **401** y no accede a lógica ni datos.
- Solo usuarios ya autenticados con Google (dominio @agsanalitica.com) y con token válido pueden registrar o usar el segundo factor.

**Comando (ejecutable por un admin):**

```bash
gcloud functions add-invoker-policy-binding webauthn \
  --member=allUsers \
  --region=us-central1 \
  --project=agssop-e7353
```

O en consola: **Cloud Functions** → **webauthn** → **Permisos** → Agregar principal: `allUsers`, rol: **Cloud Functions Invoker**.

---

## Opción alternativa: habilitar una clave JSON para una sola cuenta de servicio

Si la política obliga a no usar `allUsers`, se puede:

1. **Permitir la creación de una clave JSON** solo para una cuenta de servicio dedicada (por ejemplo `webauthn-proxy@agssop-e7353.iam.gserviceaccount.com`) con el único rol **Cloud Functions Invoker** sobre la función `webauthn`.
2. Esa clave se guarda como variable de entorno **solo en Vercel** (no en el repo) y el proxy de Vercel la usa solo para obtener un token y llamar a la función; la función sigue validando el token del usuario (Firebase).

Requisitos: que la org permita crear **una** clave JSON para esa cuenta de servicio (o que un admin cree la clave y la entregue por canal seguro al equipo que configura Vercel).

---

## Resumen

| Opción | Qué habilita | Riesgo |
|--------|----------------|--------|
| **allUsers** solo en la función `webauthn` | Que cualquier cliente pueda *llamar* la URL de la función; la función sigue rechazando a quien no tenga token Firebase válido. | Bajo: sin token válido no hay acceso. |
| **Una clave JSON** para una cuenta de servicio con solo Invoker en `webauthn` | Que solo el proxy de Vercel (con esa clave) pueda invocar la función en nombre de usuarios que ya tienen token Firebase. | Bajo: clave restringida a una cuenta y a una función. |

Sin una de estas dos opciones, el segundo factor WebAuthn en móvil **no puede funcionar** en el entorno actual.

Si pueden aprobar la opción recomendada (invocador público solo para `webauthn`), es un solo comando y no requiere claves ni secretos adicionales.
