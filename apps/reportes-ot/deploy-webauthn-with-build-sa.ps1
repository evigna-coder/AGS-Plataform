# Despliega la función webauthn usando una cuenta de build personalizada.
# Así se evita el error "missing permission on the build service account" cuando
# las cuentas por defecto están restringidas por políticas de la organización.
#
# Requisitos: gcloud instalado y autenticado (gcloud auth login).
# Ejecutar desde: apps/reportes-ot (carpeta donde está firebase.json).

$ErrorActionPreference = "Stop"
$PROJECT_ID = "agssop-e7353"
$REGION = "us-central1"
$SA_NAME = "gcf-build-sa"
$SA_EMAIL = "${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

Write-Host "Proyecto: $PROJECT_ID | Cuenta de build: $SA_EMAIL"
Write-Host ""

# 1) Crear cuenta de servicio si no existe (NOT_FOUND es normal la primera vez)
$prevErr = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
$null = gcloud iam service-accounts describe $SA_EMAIL --project=$PROJECT_ID 2>&1
$saExists = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prevErr

if (-not $saExists) {
    Write-Host "Creando cuenta de servicio $SA_NAME..."
    gcloud iam service-accounts create $SA_NAME --display-name="Cloud Functions Build" --project=$PROJECT_ID
    if ($LASTEXITCODE -ne 0) { throw "No se pudo crear la cuenta de servicio. ¿Tienes permiso iam.serviceAccounts.create?" }
} else {
    Write-Host "Cuenta de servicio $SA_NAME ya existe."
}

# 2) Roles que necesita la cuenta de build (según doc de Google)
$buildRoles = @(
    "roles/logging.logWriter",
    "roles/artifactregistry.writer",
    "roles/storage.objectViewer",
    "roles/run.builder"
)
Write-Host "Asignando roles a la cuenta de build..."
foreach ($role in $buildRoles) {
    cmd /c "gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:$SA_EMAIL --role=$role --quiet 2>nul"
    if ($LASTEXITCODE -ne 0) { Write-Error "Falló: $role" }
}
Write-Host "  OK roles asignados."
Write-Host ""

# 3) Permitir a tu usuario "actuar como" esta cuenta (necesario para el deploy)
$currentUser = (gcloud config get-value account 2>$null) -replace '^\s+|\s+$', ''
if ($currentUser) {
    Write-Host "Dando permiso 'Service Account User' a $currentUser sobre la cuenta de build..."
    cmd /c "gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL --project=$PROJECT_ID --member=user:$currentUser --role=roles/iam.serviceAccountUser --quiet 2>nul"
    if ($LASTEXITCODE -ne 0) { Write-Host "  (Si falla, un admin del proyecto debe ejecutar este paso.)" }
}
Write-Host ""

# 4) Compilar functions
$functionsDir = Join-Path $PSScriptRoot "functions"
Push-Location $functionsDir
try {
    if (-not (Test-Path "lib\index.js")) {
        Write-Host "Compilando functions (npm run build)..."
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Falló npm run build" }
    }
} finally {
    Pop-Location
}
Write-Host ""

# 5) Desplegar con gcloud usando la cuenta de build (Firebase CLI no permite esto)
Write-Host "Desplegando webauthn con cuenta de build personalizada..."
$sourcePath = Join-Path $PSScriptRoot "functions"
gcloud functions deploy webauthn `
  --gen2 `
  --region=$REGION `
  --project=$PROJECT_ID `
  --runtime=nodejs20 `
  --trigger-http `
  --entry-point=webauthn `
  --source=$sourcePath `
  --build-service-account="projects/$PROJECT_ID/serviceAccounts/$SA_EMAIL"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Si falla por permisos del deployer, un admin debe darte: roles/run.sourceDeveloper, roles/iam.serviceAccountUser (en la SA de build)."
    exit 1
}

Write-Host ""
Write-Host "Listo. La funcion webauthn esta desplegada con la cuenta de build $SA_EMAIL."
Write-Host "Para futuros despliegues usa este mismo script, o 'firebase deploy --only functions' si ya corrigieron los permisos de las cuentas por defecto."
