# Resolución: error de permisos al desplegar Cloud Functions (webauthn)

Cuando aparece:

```text
Build failed with status: FAILURE. Could not build the function due to a missing permission on the build service account.
```

el **build** de la función lo ejecuta una **cuenta de servicio** de Google Cloud (no tu usuario). Esa cuenta debe tener permisos para: leer el código desde Cloud Storage, escribir logs y subir la imagen a Artifact Registry.

**Si ya ejecutaste `fix-functions-build-permissions.ps1` y el error sigue:** las políticas de la organización pueden estar impidiendo que las cuentas por defecto hagan el build. En ese caso usa el script **`deploy-webauthn-with-build-sa.ps1`** (en la raíz de `apps/reportes-ot`): crea una cuenta de build propia y despliega con `gcloud` usando esa cuenta. Requiere tener `gcloud` instalado y autenticado.

## 1. Ver el error exacto en Cloud Build

En el mensaje de error se incluye un enlace a los logs (por ejemplo: `https://console.cloud.google.com/cloud-build/builds;region=us-central1/...?project=818451692964`). Ábrelo en el navegador (con la misma cuenta con la que despliegas), entra en el build que falló y revisa:

- **Qué paso falla** (por ejemplo "fetch", "build", "push").
- **El mensaje exacto**: suele decir "Permission X denied" o "access denied" e indica qué permiso falta y para qué recurso.

Eso confirma si el problema es la cuenta de build (y si usar la cuenta personalizada con `deploy-webauthn-with-build-sa.ps1` lo resuelve).

Ejemplo de enlace:

```text
https://console.cloud.google.com/cloud-build/builds;region=us-central1/...
```

## 2. Qué cuenta ejecuta el build

Según la política del proyecto y la fecha en que se habilitó Cloud Build, el build lo ejecuta una de estas cuentas:

| Cuenta | Formato |
|--------|--------|
| **Compute Engine (por defecto en proyectos nuevos)** | `PROJECT_NUMBER-compute@developer.gserviceaccount.com` |
| **Cloud Build legacy** | `PROJECT_NUMBER@cloudbuild.gserviceaccount.com` |

Para saber el **project number**:

```bash
gcloud projects describe agssop-e7353 --format="value(projectNumber)"
```

Para ver qué cuenta usa Cloud Build por defecto en tu proyecto (si el comando está disponible):

```bash
gcloud builds get-default-service-account
```

## 3. Asignar permisos a la cuenta que hace el build

Puedes usar el script **`fix-functions-build-permissions.ps1`** en la raíz de `apps/reportes-ot` (misma carpeta que `firebase.json`): abre PowerShell, ve a esa carpeta y ejecuta `.\fix-functions-build-permissions.ps1`. Si prefieres hacerlo a mano:

Hay que dar los roles a la **cuenta de servicio** que ejecuta el build (no a tu usuario). Si ya diste roles y sigue fallando, comprueba que los asignaste a esa cuenta y en el proyecto correcto.

### Opción A: Cuenta por defecto de Compute (proyectos nuevos)

Sustituye `PROJECT_NUMBER` por el número de tu proyecto (ej. `818451692964`) y ejecuta en PowerShell o en Cloud Shell:

```powershell
$PROJECT_ID = "agssop-e7353"
$PROJECT_NUMBER = "818451692964"   # obtenerlo con: gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
$SA = "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA" --role="roles/cloudbuild.builds.builder"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA" --role="roles/logging.logWriter"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA" --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA" --role="roles/storage.objectViewer"
```

### Opción B: Cuenta legacy de Cloud Build

Si en tu proyecto el build lo ejecuta la cuenta legacy:

```powershell
$PROJECT_ID = "agssop-e7353"
$PROJECT_NUMBER = "818451692964"
$SA = "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA" --role="roles/cloudbuild.builds.builder"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA" --role="roles/logging.logWriter"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA" --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA" --role="roles/storage.objectViewer"
```

### Opción C: Cuenta de build personalizada (recomendada si hay políticas restrictivas)

1. Crear una cuenta de servicio solo para el build:

```bash
gcloud iam service-accounts create gcf-build-sa --display-name="Cloud Functions Build" --project=agssop-e7353
```

2. Obtener su email (ej. `gcf-build-sa@agssop-e7353.iam.gserviceaccount.com`) y asignar los roles en el **proyecto**:

```powershell
$PROJECT_ID = "agssop-e7353"
$SA = "gcf-build-sa@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA" --role="roles/logging.logWriter"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA" --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA" --role="roles/storage.objectViewer"
```

3. Dar a **tu usuario** (el que hace deploy) permiso para “actuar como” esa cuenta:

```bash
gcloud iam service-accounts add-iam-policy-binding gcf-build-sa@agssop-e7353.iam.gserviceaccount.com \
  --project=agssop-e7353 \
  --member="user:TU_EMAIL@dominio.com" \
  --role="roles/iam.serviceAccountUser"
```

4. Desplegar la función indicando esa cuenta de build (Firebase CLI no expone esta opción, hay que usar `gcloud`):

Desde la raíz del monorepo, desde la carpeta de functions y con el código compilado en `lib/`:

```bash
cd apps/reportes-ot/functions
gcloud functions deploy webauthn --gen2 --region=us-central1 --project=agssop-e7353 \
  --runtime=nodejs20 --trigger-http --entry-point=webauthn \
  --source=. \
  --build-service-account=projects/agssop-e7353/serviceAccounts/gcf-build-sa@agssop-e7353.iam.gserviceaccount.com
```

Nota: con `gcloud` el “source” es la carpeta actual; Firebase sube desde `apps/reportes-ot` con `source: "functions"`. Asegúrate de que en esa carpeta esté el código listo (p. ej. `lib/` generado por `npm run build`).

## 4. Políticas de organización

Si el proyecto está en una **organización**:

- Puede estar forzado el uso de la cuenta de Compute y que esa cuenta **no** tenga el rol Editor. En ese caso hay que darle explícitamente los roles anteriores (opción A) o usar una cuenta de build personalizada (opción C).
- Si tu organización deshabilitó la “cuenta por defecto de Compute” para builds, tendrás que usar una cuenta de build personalizada (opción C) y desplegar con `gcloud ... --build-service-account=...`.

Referencia: [Cloud Build Service Account Change](https://cloud.google.com/build/docs/cloud-build-service-account-updates).

## 5. Comprobar que la cuenta no está deshabilitada

Si el error dice que la cuenta de build está **disabled**, en IAM (Google Cloud Console → IAM) localiza esa cuenta de servicio y asegúrate de que está **habilitada**.

## 6. Volver a desplegar

Después de cambiar permisos, espera unos segundos y vuelve a desplegar:

```bash
cd apps/reportes-ot
firebase deploy --only functions
```

Si usas la cuenta de build personalizada (opción C), despliega con el comando `gcloud functions deploy` anterior en lugar de `firebase deploy --only functions`.
