# Desplegar Hosting y Cloud Function (webauthn)

El mensaje **"Servicio no encontrado. ¿Desplegaste la Cloud Function?"** aparece cuando la app desplegada llama a `/api/webauthn/register-options` y recibe **404**: Firebase Hosting reescribe esa ruta a la Cloud Function **webauthn**, pero si la función **no está desplegada**, no hay nada que responda y se devuelve 404.

## Orden de despliegue

1. **Desplegar primero la Cloud Function** (para que el rewrite de Hosting tenga a dónde enviar las peticiones).
2. **Desplegar Hosting** (frontend).

## Pasos (desde `apps/reportes-ot`)

### 1. Entrar en la carpeta del proyecto

```bash
cd apps/reportes-ot
```

### 2. Comprobar proyecto Firebase

```bash
firebase use
```

Debe mostrar el proyecto correcto (p. ej. `agssop-e7353`). Si no:

```bash
firebase use agssop-e7353
```

### 3. Compilar y desplegar la Cloud Function webauthn

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

Si aparece **error de permisos** en el build (cuenta de servicio sin permisos), sigue la guía **`docs/TROUBLESHOOTING_DEPLOY_FUNCTIONS.md`** o usa el script **`deploy-webauthn-with-build-sa.ps1`** (requiere `gcloud` instalado).

### 4. Compilar y desplegar el frontend (Hosting)

```bash
npm run build
firebase deploy --only hosting
```

### 5. Comprobar que la función está desplegada

En **Firebase Console** → **Functions**: debe aparecer la función **webauthn** (y su URL, p. ej. `https://us-central1-agssop-e7353.cloudfunctions.net/webauthn`).

En **Hosting**: la app está en la URL del proyecto (p. ej. `https://agssop-e7353.web.app`). Las peticiones a `https://agssop-e7353.web.app/api/webauthn/*` se reenvían a la función **webauthn**.

## Desplegar todo de una vez

```bash
cd apps/reportes-ot
firebase deploy
```

Eso despliega Functions, Hosting, Firestore rules y Storage rules. Asegúrate de haber ejecutado **`npm run build`** en la raíz de `apps/reportes-ot` (para el frontend) y **`npm run build`** dentro de `functions` (para la función) antes, o que tu flujo de CI lo haga.

## Resumen

| Mensaje en la app | Causa probable | Qué hacer |
|-------------------|-----------------|-----------|
| Servicio no encontrado (404) | La Cloud Function **webauthn** no está desplegada | `firebase deploy --only functions` desde `apps/reportes-ot` |
| Error de permisos al desplegar functions | Cuenta de build sin permisos | Ver `TROUBLESHOOTING_DEPLOY_FUNCTIONS.md` o `deploy-webauthn-with-build-sa.ps1` |
