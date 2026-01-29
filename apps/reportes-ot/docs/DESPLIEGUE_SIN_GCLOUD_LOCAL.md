# Desplegar webauthn sin tener gcloud en tu PC

Si en PowerShell aparece **"gcloud no se reconoce"**, tienes dos opciones: instalar gcloud en Windows o hacer todo desde **Cloud Shell** (navegador).

---

## Opción 1: Instalar gcloud en Windows

1. **Descargar e instalar**  
   https://cloud.google.com/sdk/docs/install-sdk#windows  
   (elige "Install for current user" y marca **"Add gcloud to PATH"**.)

2. **Cerrar todas las ventanas de PowerShell y Cursor** y volver a abrirlas (para que cargue el PATH).

3. **Comprobar** en una nueva PowerShell:
   ```powershell
   gcloud version
   ```
   Si sigue sin reconocer `gcloud`, añade a mano el PATH:
   - En Windows: Configuración → Sistema → Acerca de → Configuración avanzada → Variables de entorno.
   - En "Variables del usuario" edita `Path` y agrega:  
     `C:\Users\TU_USUARIO\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin`  
     (o la ruta donde se instaló el SDK).

4. **Autenticarte y desplegar**:
   ```powershell
   gcloud auth login
   gcloud config set project agssop-e7353
   cd "c:\Users\Evigna\Desktop\Ags plataform\apps\reportes-ot"
   .\deploy-webauthn-with-build-sa.ps1
   ```

---

## Opción 2: Usar solo Cloud Shell (sin instalar nada)

En la consola de Google Cloud, **gcloud** ya está instalado. Puedes crear la cuenta de build y desplegar desde ahí.

### Paso 1: Abrir Cloud Shell

1. Entra en https://console.cloud.google.com  
2. Arriba a la derecha, pulsa el icono **>_** (Cloud Shell).  
3. Elige el proyecto **agssop-e7353** si te lo pide.

### Paso 2: Crear la cuenta de build y dar permisos

Pega y ejecuta este bloque en Cloud Shell (es Bash):

```bash
PROJECT_ID=agssop-e7353
REGION=us-central1
SA_NAME=gcf-build-sa
SA_EMAIL=${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com

# Crear cuenta de servicio
gcloud iam service-accounts create $SA_NAME --display-name="Cloud Functions Build" --project=$PROJECT_ID 2>/dev/null || true

# Roles para el build
for role in roles/logging.logWriter roles/artifactregistry.writer roles/storage.objectViewer roles/run.builder; do
  gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA_EMAIL" --role=$role --quiet
done

# Permitir a tu usuario actuar como esta cuenta
ME=$(gcloud config get-value account 2>/dev/null)
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL --project=$PROJECT_ID --member="user:$ME" --role="roles/iam.serviceAccountUser" --quiet

echo "Cuenta de build lista: $SA_EMAIL"
```

### Paso 3: Subir el código y desplegar

Tienes que tener el código de `functions` en Cloud Shell.

**Si el proyecto está en GitHub (o similar):**

```bash
git clone https://github.com/TU_ORG/TU_REPO.git repo
cd repo/apps/reportes-ot
```

**Si no usas Git:** en Cloud Shell usa el menú "⋮" (tres puntos) → **Upload file** y sube un ZIP de la carpeta `apps/reportes-ot/functions`, luego:

```bash
unzip functions.zip -d functions
cd functions
```

**Compilar y desplegar:**

```bash
cd ~/repo/apps/reportes-ot/functions
# O: cd ~/functions   si subiste solo la carpeta functions

npm install
npm run build

gcloud functions deploy webauthn \
  --gen2 --region=us-central1 --project=agssop-e7353 \
  --runtime=nodejs20 --trigger-http --entry-point=webauthn \
  --source=. \
  --build-service-account=projects/agssop-e7353/serviceAccounts/gcf-build-sa@agssop-e7353.iam.gserviceaccount.com
```

Cuando termine, la función `webauthn` quedará desplegada usando la cuenta de build `gcf-build-sa`.

---

## Resumen

| Opción | Qué hacer |
|--------|-----------|
| **Instalar gcloud** | Instalar SDK, cerrar/abrir PowerShell, luego ejecutar `.\deploy-webauthn-with-build-sa.ps1` desde `apps/reportes-ot`. |
| **Cloud Shell** | Abrir Cloud Shell, ejecutar el bloque Bash de "Paso 2", subir/clonar código, luego el bloque de "Paso 3". |

En ambos casos se usa la misma cuenta de build (`gcf-build-sa`) y se evita el error de permisos de la cuenta de build por defecto.
