# Backup AGS — copia local (Firestore + Storage), SIN claves

> ⛔ La organización bloquea la descarga de service account keys
> (`iam.disableServiceAccountKeyCreation`) y `gcloud` está roto en las PCs con Avast.
> Por eso el backup va **sin claves**, en dos tracks:

| Track | Herramienta | Auth | Archivo |
|---|---|---|---|
| **Firestore** (datos, 1-5 GB) | Browser (sistema-modular DEV) | sesión staff ya logueada | `firestore-backup-browser.js` |
| **Storage** (300 GB PDFs) | `rclone` | login Google por navegador (sin key) | ver sección rclone |

Plan completo: `.claude/plans/backup-implementacion.md`.

> `backup-ags.mjs` + `run-backup.ps1` + `package.json` (Node + Admin SDK con `--key`)
> quedan como **referencia para el futuro** — sirven si algún día se corre DENTRO de GCP
> (Cloud Function con la SA del runtime, sin key) o si se habilita una key. **Hoy NO se usan.**

---

## Track 1 — Firestore (browser, hoy)
1. Levantá sistema-modular en DEV: `pnpm dev:modular` (en la app instalada NO existe el hook).
2. Logueate (staff `@agsanalitica.com`).
3. F12 → Console → pegá todo `firestore-backup-browser.js` → Enter.
4. Clic en el botón flotante **"▶ Backup Firestore"** → elegí la carpeta del disco.
5. Escribe `backup-firestore-<fecha>.ndjson` (una línea JSON por documento, legible).
   - Para una prueba rápida: editá `ONLY = ['clientes','sistemas']` arriba del script; después `ONLY = []` (todas).

## Track 2 — Storage (rclone, sin key)
```powershell
# instalar rclone (https://rclone.org/downloads/) y configurar el remote GCS:
rclone config
#   → n (new) → nombre: gcs → tipo: "Google Cloud Storage"
#   → service_account_file: DEJAR VACÍO  → así usa OAuth de usuario (login por navegador)
#   → al final abre el navegador para que autorices con tu cuenta

# probar (una muestra):
rclone copy gcs:agssop-e7353.firebasestorage.app/reports D:\backups-ags\storage\reports --max-transfer=500M -P

# sync incremental completo (1ra vez baja ~300GB):
rclone sync gcs:agssop-e7353.firebasestorage.app D:\backups-ags\storage -P
```
rclone es Go → usa el cert store de Windows → debería andar pese a Avast (a diferencia de gcloud).

---

## (Referencia futura — Node + key, HOY NO usar)
- `backup-ags.mjs` — la lógica (dump NDJSON de Firestore + descarga incremental de Storage).
- `run-backup.ps1` — wrapper para Task Scheduler (setea el cert y llama a Node).
- `package.json` — dependencia `firebase-admin`.

---

## Montaje único (≈10 min)

### 1. Service account key (desde el navegador — sin gcloud)
1. **Firebase Console** → ⚙️ Configuración del proyecto → pestaña **Cuentas de servicio**.
2. Botón **"Generar nueva clave privada"** → descarga un `.json`.
3. Guardalo en `C:\ags-backup\sa-key.json` (esa SA ya tiene permiso de leer Firestore y Storage).
   > ⚠️ Es una credencial sensible: NO subir a git, NO compartir.

### 2. Instalar dependencias (una vez)
```powershell
cd <repo>\ops\backup
$env:NODE_OPTIONS="--use-system-ca"   # por el cert de Avast
npm install
```

### 3. Configurar el destino
Editar la sección **CONFIG** de `run-backup.ps1`:
- `$DEST` → ruta del disco (hoy USB: `D:\backups-ags`; mañana servidor: la que definas).
- `$KEY`  → `C:\ags-backup\sa-key.json`.

---

## Probar HOY en el disco local
```powershell
cd <repo>\ops\backup
$env:NODE_OPTIONS="--use-system-ca"

# 1) Solo la base (rápido, ~1-5 GB) — la prueba más importante
node backup-ags.mjs --mode=firestore --dest=D:\backups-ags --key=C:\ags-backup\sa-key.json

# 2) Una muestra de Storage (primeros 50 archivos, para validar el mecanismo sin bajar 300 GB)
node backup-ags.mjs --mode=storage --limit=50 --dest=D:\backups-ags --key=C:\ags-backup\sa-key.json
```
Revisar que aparezcan:
- `D:\backups-ags\firestore\<fecha>.ndjson`  (abrilo: una línea JSON por documento)
- `D:\backups-ags\storage\...`               (los archivos descargados)

Cuando quieras la copia completa de Storage (la 1ª vez baja los ~300 GB):
```powershell
node backup-ags.mjs --mode=all --dest=D:\backups-ags --key=C:\ags-backup\sa-key.json
```

---

## Automatizar (cuando el destino sea fijo)
Dos tareas en el **Programador de tareas**, ambas con *"Ejecutar aunque el usuario no
haya iniciado sesión"* + *"Privilegios más altos"*:

| Tarea | Cuándo | Comando |
|---|---|---|
| Firestore diario | diario 02:00 | `powershell -ExecutionPolicy Bypass -File <repo>\ops\backup\run-backup.ps1 -Mode firestore` |
| Storage semanal | domingo 03:00 | `powershell -ExecutionPolicy Bypass -File <repo>\ops\backup\run-backup.ps1 -Mode storage` |

Una vez programado → **corre solo, nadie lo toca**. La PC/servidor debe estar encendida a esa hora.

---

## Flags de `backup-ags.mjs`
| Flag | Qué hace |
|---|---|
| `--mode=firestore\|storage\|all` | Qué respaldar |
| `--dest=<ruta>` | Carpeta destino (disco) |
| `--key=<ruta>` | Service account key JSON |
| `--prefix=reports/` | (storage) respaldar solo un subárbol |
| `--limit=N` | (storage) bajar solo N archivos — para pruebas |

## Formato y recuperación
- **Firestore**: NDJSON, una línea `{path, data}` por documento (incluye subcolecciones).
  Tipos preservados con tags (`__t: ts/geo/ref/bytes`). Restore = leer cada línea y
  `setDoc(path, data)` con el Admin SDK (script de restore: pedirlo cuando se necesite).
- **Storage**: archivos tal cual, en árbol espejo. Restore = subirlos de vuelta o abrirlos directo.

## Pendiente (otras capas del plan)
- **Capa 1** (GCP nativo, inmediata): Scheduled Backups + Versioning — comandos en el plan.
- **Capa 3** (offsite B2/Glacier/Coldline): se agrega después.
- **Dossier PDF por cliente**: feature app-side aparte.
